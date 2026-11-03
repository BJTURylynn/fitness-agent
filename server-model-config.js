// User model credentials remain on the server. The encryption key is a separate
// deployment secret; AES-GCM also binds every ciphertext to its authenticated user.
const mcDefaultBaseUrl = 'https://aihubmix.com/v1';
const mcDefaultModel = 'coding-glm-5.3-flash-free';
const mcBodyLimit = 16 * 1024;
const mcFixedMask = '••••••••';

class McError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function mcJson(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }
  });
}

function mcUserId(request, env) {
  const value = request.headers.get('oai-authenticated-user-id') || env.LOCAL_SETTINGS_USER_ID;
  return typeof value === 'string' && value.trim() && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : null;
}

function mcRequireUser(request, env) {
  const id = mcUserId(request, env);
  if (!id) throw new McError(401, '请先登录后再管理模型配置。');
  return id;
}

function mcHasDatabase(env) {
  return Boolean(env.DB && typeof env.DB.prepare === 'function');
}

function mcDecodeBase64(value) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Invalid base64');
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function mcEncodeBase64(value) {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function mcMasterBytes(env) {
  try {
    const bytes = mcDecodeBase64(env.MODEL_CONFIG_ENCRYPTION_KEY);
    if (bytes.byteLength !== 32) throw new Error('Invalid key size');
    return bytes;
  } catch {
    throw new McError(503, '模型配置加密服务尚未就绪，请联系管理员。');
  }
}

function mcStorageAvailable(env) {
  if (!mcHasDatabase(env)) return false;
  try { mcMasterBytes(env); return true; } catch { return false; }
}

function mcRequireDatabase(env) {
  if (!mcHasDatabase(env)) throw new McError(503, '模型配置存储尚未就绪，请联系管理员。');
}

async function mcReadRecord(env, userId) {
  if (!mcHasDatabase(env)) return null;
  try {
    return await env.DB.prepare('SELECT user_id, name, base_url, model, encrypted_key, updated_at, verified_at FROM model_configs WHERE user_id = ?').bind(userId).first();
  } catch {
    throw new McError(503, '暂时无法读取模型配置，请稍后重试。');
  }
}

function mcPrivateIpv4(hostname) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return false;
  const [a, b, c] = hostname.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113);
}

function mcNormalizeBaseUrl(value) {
  const invalid = () => new McError(400, 'API 地址须为公网 HTTPS 地址，且不能含账号、查询参数或片段。');
  if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\x00-\x20\x7f\\?#]/.test(value)) throw invalid();
  let url;
  try { url = new URL(value); } catch { throw invalid(); }
  const host = url.hostname.toLowerCase();
  const labels = host.split('.');
  const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host);
  const reserved = /(?:^|\.)(?:localhost|local|localdomain|internal|test|invalid|home|lan|onion|arpa)$/.test(host) ||
    /(?:^|\.)(?:nip\.io|sslip\.io|xip\.io)$/.test(host) || /^(?:metadata|instance-data)(?:\.|$)/.test(host);
  if (url.protocol !== 'https:' || url.username || url.password || /^https:\/\/[^/]*@/i.test(value) || url.search || url.hash ||
      host.includes(':') || reserved || mcPrivateIpv4(host) || labels.length < 2 || host.length > 253 ||
      labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      (!ipv4 && !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(labels.at(-1)))) throw invalid();
  // Accept a pasted completion endpoint, but store the base consumed by the API.
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '').replace(/\/+$/, '') || '/';
  return url.href.replace(/\/+$/, '');
}

function mcName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60 || /[\x00-\x1f\x7f]/.test(value)) throw new McError(400, '请填写 1–60 字的配置名称。');
  return value.trim();
}

function mcModel(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._:/-]{1,120}$/.test(value.trim())) throw new McError(400, '请填写有效的模型名称（最多 120 个英文字符）。');
  return value.trim();
}

function mcApiKey(value) {
  if (typeof value !== 'string' || value.trim().length < 6 || value.trim().length > 4096 || /[\x00-\x1f\x7f]/.test(value)) throw new McError(400, '请填写有效的 API 密钥（6–4096 字符）。');
  return value.trim();
}

async function mcEncryptKey(apiKey, userId, env) {
  const key = await crypto.subtle.importKey('raw', mcMasterBytes(env), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) }, key, new TextEncoder().encode(apiKey)));
  const envelope = new Uint8Array(iv.length + cipher.length);
  envelope.set(iv); envelope.set(cipher, iv.length);
  return 'v1:' + mcEncodeBase64(envelope);
}

async function mcRecordConfig(record, userId, env) {
  try {
    if (record.user_id !== userId || typeof record.encrypted_key !== 'string' || !record.encrypted_key.startsWith('v1:')) throw new Error('Invalid record');
    const envelope = mcDecodeBase64(record.encrypted_key.slice(3));
    if (envelope.length < 34 || envelope.length > 8192) throw new Error('Invalid envelope');
    const key = await crypto.subtle.importKey('raw', mcMasterBytes(env), 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: envelope.slice(0, 12), additionalData: new TextEncoder().encode(userId) }, key, envelope.slice(12));
    const apiKey = mcApiKey(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    return { name: mcName(record.name), baseUrl: mcNormalizeBaseUrl(record.base_url), model: mcModel(record.model), apiKey, updatedAt: record.updated_at, verifiedAt: record.verified_at || null };
  } catch {
    // A corrupt or undecryptable saved credential must never switch providers.
    throw new McError(503, '已保存的模型配置无法解密，请重新保存配置或恢复默认配置。');
  }
}

function mcDefaultState(env) {
  let baseUrl = String(env.LLM_BASE_URL || mcDefaultBaseUrl).trim();
  let validBase = true;
  try { baseUrl = mcNormalizeBaseUrl(baseUrl); } catch { validBase = false; }
  let model = mcDefaultModel;
  try { model = mcModel(String(env.LLM_MODEL || mcDefaultModel)); } catch { /* Keep the API's default model. */ }
  return { name: '服务器默认模型', baseUrl: validBase ? baseUrl : '', model, configured: Boolean(String(env.LLM_API_KEY || '').trim()) && validBase };
}

function mcPublicView(config, env) {
  const fallback = mcDefaultState(env);
  const custom = Boolean(config);
  return {
    source: custom ? 'custom' : 'default', name: custom ? config.name : fallback.name,
    baseUrl: custom ? config.baseUrl : fallback.baseUrl, model: custom ? config.model : fallback.model,
    keyConfigured: custom || fallback.configured, keyMasked: custom || fallback.configured ? mcFixedMask : '',
    updatedAt: custom ? config.updatedAt : null, verifiedAt: custom ? config.verifiedAt : null,
    defaultAvailable: fallback.configured, storageAvailable: mcStorageAvailable(env)
  };
}

export async function resolveModelConfig(request, env = {}) {
  const fallback = mcDefaultState(env);
  const userId = mcUserId(request, env);
  const record = userId ? await mcReadRecord(env, userId) : null;
  if (!record) return { env, source: 'default', name: fallback.name, configured: fallback.configured };
  const config = await mcRecordConfig(record, userId, env);
  return { env: { ...env, LLM_BASE_URL: config.baseUrl, LLM_MODEL: config.model, LLM_API_KEY: config.apiKey }, source: 'custom', name: config.name, configured: true, updatedAt: config.updatedAt, verifiedAt: config.verifiedAt };
}

function mcCheckMutation(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) throw new McError(403, '此来源不能修改模型配置。');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new McError(403, '此来源不能修改模型配置。');
  const referer = request.headers.get('referer');
  if (!origin && referer) {
    try { if (new URL(referer).origin !== url.origin) throw new Error('Origin mismatch'); }
    catch { throw new McError(403, '此来源不能修改模型配置。'); }
  }
}

async function mcReadBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new McError(415, '请使用 application/json 提交请求。');
  const length = request.headers.get('content-length');
  if (length && Number(length) > mcBodyLimit) throw new McError(413, '模型配置请求不能超过 16 KB。');
  if (!request.body) throw new McError(400, '请求 JSON 格式不正确。');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, output = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > mcBodyLimit) { await reader.cancel().catch(() => {}); throw new McError(413, '模型配置请求不能超过 16 KB。'); }
      output += decoder.decode(part.value, { stream: true });
    }
    output += decoder.decode();
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(output); } catch { throw new McError(400, '请求 JSON 格式不正确。'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new McError(400, '请提交有效的模型配置。');
  if (Object.keys(body).some(key => !['name', 'baseUrl', 'model', 'apiKey'].includes(key))) throw new McError(400, '模型配置包含不支持的字段。');
  return body;
}

async function mcCandidate(body, record, userId, env) {
  const name = mcName(body.name);
  const baseUrl = mcNormalizeBaseUrl(body.baseUrl);
  const model = mcModel(body.model);
  if (body.apiKey !== undefined && (typeof body.apiKey !== 'string' || /[\x00-\x1f\x7f]/.test(body.apiKey))) throw new McError(400, '请填写有效的 API 密钥。');
  let apiKey;
  if (typeof body.apiKey === 'string' && body.apiKey.trim()) apiKey = mcApiKey(body.apiKey);
  else {
    // Do not decrypt a broken previous record when the user supplies a new key.
    if (!record || record.base_url !== baseUrl) throw new McError(400, '首次配置或更改 API 地址时，必须重新填写 API 密钥。');
    const previous = await mcRecordConfig(record, userId, env);
    if (previous.baseUrl !== baseUrl || new URL(previous.baseUrl).origin !== new URL(baseUrl).origin) throw new McError(400, '更改 API 地址时，必须重新填写 API 密钥。');
    apiKey = previous.apiKey;
  }
  if ([name, baseUrl, model].some(value => value.includes(apiKey))) throw new McError(400, '请勿在配置名称、API 地址或模型名称中填写密钥。');
  return { name, baseUrl, model, apiKey };
}

async function mcProbeConfig(configEnv, env, probe) {
  if (typeof probe !== 'function') throw new McError(503, '模型连接测试暂时不可用。');
  let result;
  try { result = await probe(configEnv); }
  catch (error) {
    let message = '模型连接测试失败，请检查 API 地址、模型名称和密钥后重试。';
    let status = 502;
    if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 && typeof error.message === 'string' && error.message.length <= 400) {
      status = error.status; message = error.message;
      for (const secret of [configEnv.LLM_API_KEY, env.MODEL_CONFIG_ENCRYPTION_KEY].filter(value => typeof value === 'string' && value.length >= 6)) message = message.split(secret).join('[已隐藏]');
    }
    throw new McError(status, message);
  }
  return { ok: true, model: configEnv.LLM_MODEL || mcDefaultModel, latencyMs: Number.isFinite(result?.latencyMs) && result.latencyMs >= 0 ? Math.round(result.latencyMs) : 0 };
}

export async function handleModelConfig(request, env = {}, probe) {
  try {
    const pathname = new URL(request.url).pathname;
    const isTest = pathname === '/api/model-config/test';
    if (!isTest && pathname !== '/api/model-config') return mcJson({ error: '接口不存在。' }, 404);
    const allowed = isTest ? ['POST'] : ['GET', 'PUT', 'DELETE'];
    if (!allowed.includes(request.method)) return mcJson({ error: '此接口不支持该请求方法。' }, 405, { Allow: allowed.join(', ') });
    const userId = mcRequireUser(request, env);
    if (request.method === 'GET') {
      const record = await mcReadRecord(env, userId);
      return mcJson(mcPublicView(record ? await mcRecordConfig(record, userId, env) : null, env));
    }
    mcCheckMutation(request);
    if (request.method === 'DELETE') {
      mcRequireDatabase(env);
      try { await env.DB.prepare('DELETE FROM model_configs WHERE user_id = ?').bind(userId).run(); }
      catch { throw new McError(503, '暂时无法删除模型配置，请稍后重试。'); }
      return mcJson(mcPublicView(null, env));
    }
    const body = await mcReadBody(request);
    if (!isTest) { mcRequireDatabase(env); mcMasterBytes(env); }
    const record = await mcReadRecord(env, userId);
    if (isTest && Object.keys(body).length === 0) {
      const resolved = await resolveModelConfig(request, env);
      if (!resolved.configured) throw new McError(400, '当前尚无可测试的模型配置，请先填写 API 信息。');
      return mcJson(await mcProbeConfig(resolved.env, env, probe));
    }
    const candidate = await mcCandidate(body, record, userId, env);
    const candidateEnv = { ...env, LLM_BASE_URL: candidate.baseUrl, LLM_MODEL: candidate.model, LLM_API_KEY: candidate.apiKey };
    const result = await mcProbeConfig(candidateEnv, env, probe);
    if (isTest) return mcJson(result);
    const timestamp = new Date().toISOString();
    const encryptedKey = await mcEncryptKey(candidate.apiKey, userId, env);
    try {
      await env.DB.prepare('INSERT INTO model_configs (user_id, name, base_url, model, encrypted_key, updated_at, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, base_url = excluded.base_url, model = excluded.model, encrypted_key = excluded.encrypted_key, updated_at = excluded.updated_at, verified_at = excluded.verified_at')
        .bind(userId, candidate.name, candidate.baseUrl, candidate.model, encryptedKey, timestamp, timestamp).run();
    } catch { throw new McError(503, '连接测试已通过，但配置保存失败，请稍后重试。'); }
    return mcJson(mcPublicView({ ...candidate, updatedAt: timestamp, verifiedAt: timestamp }, env));
  } catch (error) {
    if (error instanceof McError) return mcJson({ error: error.message }, error.status);
    return mcJson({ error: '模型配置暂时无法处理，请稍后重试。' }, 500);
  }
}
