import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleModelConfig, resolveModelConfig } from '../server-model-config.js';

const mcTestOrigin = 'https://fitness.example';
const mcTestKey = 'sk-user-private-model-credential';
const mcTestDefaultKey = 'sk-default-server-only-credential';
const mcTestMaster = Buffer.alloc(32, 23).toString('base64');
const mcTestCandidate = { name: '我的模型', baseUrl: 'https://api.provider.example/v1', model: 'provider/model-1', apiKey: mcTestKey };

function mcTestDatabase(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('CREATE TABLE model_configs (user_id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL, model TEXT NOT NULL, encrypted_key TEXT NOT NULL, updated_at TEXT NOT NULL, verified_at TEXT)');
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...values) {
          return {
            async first() { return statement.get(...values) || null; },
            async run() { return statement.run(...values); }
          };
        }
      };
    }
  };
}

function mcTestEnvironment(t, overrides = {}) {
  return {
    DB: mcTestDatabase(t), MODEL_CONFIG_ENCRYPTION_KEY: mcTestMaster,
    LLM_API_KEY: mcTestDefaultKey, LLM_BASE_URL: 'https://default.provider.example/v4', LLM_MODEL: 'default-model',
    ...overrides
  };
}

function mcTestRequest(method = 'GET', body, options = {}) {
  const { user = 'alice', path = '/api/model-config', headers = {}, rawBody } = options;
  const requestHeaders = { ...(user === null ? {} : { 'oai-authenticated-user-id': user }), ...headers };
  const init = { method, headers: requestHeaders };
  if (body !== undefined || rawBody !== undefined) {
    if (!Object.keys(requestHeaders).some(key => key.toLowerCase() === 'content-type')) requestHeaders['Content-Type'] = 'application/json';
    init.body = rawBody === undefined ? JSON.stringify(body) : rawBody;
  }
  return new Request(mcTestOrigin + path, init);
}

const mcTestProbe = async () => ({ model: 'ignored-provider-model', latencyMs: 17.4, answer: `Never echo ${mcTestKey}` });
const mcTestRow = (env, user = 'alice') => env.DB.sqlite.prepare('SELECT * FROM model_configs WHERE user_id = ?').get(user);
const mcTestCount = env => env.DB.sqlite.prepare('SELECT count(*) AS count FROM model_configs').get().count;
const mcTestSave = (env, body = mcTestCandidate, options = {}, probe = mcTestProbe) => handleModelConfig(mcTestRequest('PUT', body, options), env, probe);

test('default config is masked, no-store, and does not persist credentials', async t => {
  const env = mcTestEnvironment(t);
  const response = await handleModelConfig(mcTestRequest(), env, mcTestProbe);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    source: 'default', name: '服务器默认模型', baseUrl: env.LLM_BASE_URL, model: env.LLM_MODEL,
    keyConfigured: true, keyMasked: '••••••••', updatedAt: null, verifiedAt: null,
    defaultAvailable: true, storageAvailable: true
  });
  assert.equal(JSON.stringify(body).includes(mcTestDefaultKey), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(mcTestCount(env), 0);
});

test('save verifies before writing, normalizes pasted endpoint, and encrypts credentials', async t => {
  const env = mcTestEnvironment(t);
  let calls = 0;
  const response = await mcTestSave(env, { ...mcTestCandidate, baseUrl: 'https://API.Provider.Example/v1/chat/completions/' }, {}, async candidate => {
    calls++;
    assert.equal(mcTestCount(env), 0, 'the previous config remains active during verification');
    assert.equal(candidate.LLM_BASE_URL, mcTestCandidate.baseUrl);
    assert.equal(candidate.LLM_API_KEY, mcTestKey);
    assert.equal(candidate.LLM_MODEL, mcTestCandidate.model);
    return mcTestProbe();
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  const body = await response.json();
  assert.equal(body.source, 'custom');
  assert.equal(body.baseUrl, mcTestCandidate.baseUrl);
  assert.equal(body.keyConfigured, true);
  assert.equal(body.keyMasked, '••••••••');
  assert.match(body.updatedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal(body.verifiedAt, body.updatedAt);
  assert.equal(JSON.stringify(body).includes(mcTestKey), false);
  assert.equal(JSON.stringify(body).includes(mcTestKey.slice(-4)), false);
  const row = mcTestRow(env);
  assert.match(row.encrypted_key, /^v1:/);
  assert.equal(JSON.stringify(row).includes(mcTestKey), false);
  assert.equal(Buffer.from(row.encrypted_key.slice(3), 'base64').includes(Buffer.from(mcTestKey)), false);
  const resolved = await resolveModelConfig(mcTestRequest(), env);
  assert.equal(resolved.env.LLM_API_KEY, mcTestKey);
  assert.equal(resolved.env.LLM_BASE_URL, mcTestCandidate.baseUrl);
  assert.equal(resolved.source, 'custom');
  assert.equal(resolved.configured, true);
  assert.equal(env.LLM_API_KEY, mcTestDefaultKey, 'resolving a user config does not mutate shared bindings');
});

test('saved configs are isolated by authenticated user and deletion restores only their fallback', async t => {
  const env = mcTestEnvironment(t);
  await mcTestSave(env);
  await mcTestSave(env, { ...mcTestCandidate, name: 'Bob', apiKey: 'sk-bob-private-credential' }, { user: 'bob' });
  assert.equal(mcTestCount(env), 2);
  const bob = await (await handleModelConfig(mcTestRequest('GET', undefined, { user: 'bob' }), env)).json();
  assert.equal(bob.name, 'Bob');
  const absent = await (await handleModelConfig(mcTestRequest('GET', undefined, { user: 'carol' }), env)).json();
  assert.equal(absent.source, 'default');
  const response = await handleModelConfig(mcTestRequest('DELETE'), env);
  assert.equal((await response.json()).source, 'default');
  assert.equal(mcTestRow(env), undefined);
  assert.equal(mcTestRow(env, 'bob').name, 'Bob');
  const resolved = await resolveModelConfig(mcTestRequest(), env);
  assert.equal(resolved.env.LLM_API_KEY, mcTestDefaultKey);
  assert.equal(resolved.source, 'default');
});

test('AES-GCM uses fresh nonces and refuses ciphertext copied between users', async t => {
  const env = mcTestEnvironment(t);
  await mcTestSave(env);
  const first = mcTestRow(env).encrypted_key;
  await mcTestSave(env);
  assert.notEqual(mcTestRow(env).encrypted_key, first);
  await mcTestSave(env, mcTestCandidate, { user: 'bob' });
  env.DB.sqlite.prepare('UPDATE model_configs SET encrypted_key = ? WHERE user_id = ?').run(first, 'bob');
  const response = await handleModelConfig(mcTestRequest('GET', undefined, { user: 'bob' }), env);
  assert.equal(response.status, 503);
  await assert.rejects(resolveModelConfig(mcTestRequest('GET', undefined, { user: 'bob' }), env), error => error.status === 503);
  assert.equal((await resolveModelConfig(mcTestRequest(), env)).source, 'custom');
});

test('lost or corrupt encryption keys fail explicitly; deletion can recover and a new key can overwrite', async t => {
  const env = mcTestEnvironment(t);
  await mcTestSave(env);
  const wrongMaster = { ...env, MODEL_CONFIG_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64') };
  const response = await handleModelConfig(mcTestRequest(), wrongMaster);
  assert.equal(response.status, 503);
  await assert.rejects(resolveModelConfig(mcTestRequest(), wrongMaster), error => error.status === 503);
  assert.equal((await mcTestSave(wrongMaster, { ...mcTestCandidate, apiKey: '' })).status, 503);
  assert.equal((await mcTestSave(wrongMaster, { ...mcTestCandidate, apiKey: 'sk-new-valid-credential' })).status, 200);
  assert.equal((await resolveModelConfig(mcTestRequest(), wrongMaster)).env.LLM_API_KEY, 'sk-new-valid-credential');
  const missingMaster = { ...wrongMaster, MODEL_CONFIG_ENCRYPTION_KEY: undefined };
  assert.equal((await handleModelConfig(mcTestRequest('DELETE'), missingMaster)).status, 200);
  assert.equal((await resolveModelConfig(mcTestRequest(), missingMaster)).source, 'default');
});

test('blank keys retain a saved key only at the exact normalized base URL', async t => {
  const env = mcTestEnvironment(t);
  assert.equal((await mcTestSave(env, { ...mcTestCandidate, apiKey: '' })).status, 400);
  await mcTestSave(env);
  let probes = 0;
  const retained = await mcTestSave(env, { ...mcTestCandidate, baseUrl: mcTestCandidate.baseUrl + '/', apiKey: '', model: 'model-2' }, {}, async candidate => {
    probes++;
    assert.equal(candidate.LLM_API_KEY, mcTestKey);
    return mcTestProbe();
  });
  assert.equal(retained.status, 200);
  assert.equal(probes, 1);
  const previous = mcTestRow(env);
  for (const baseUrl of ['https://attacker.example/v1', 'https://api.provider.example/v4', 'https://api.provider.example:8443/v1']) {
    const result = await mcTestSave(env, { ...mcTestCandidate, baseUrl, apiKey: '' }, {}, async () => { probes++; return mcTestProbe(); });
    assert.equal(result.status, 400);
    assert.deepEqual(mcTestRow(env), previous);
  }
  assert.equal(probes, 1, 'rejected URL changes never receive stored credentials');
  assert.equal((await mcTestSave(env, { ...mcTestCandidate, baseUrl: 'https://other.provider.example/v4', apiKey: 'sk-other-new-private-key' })).status, 200);
});

test('failed verification leaves the previous configuration byte-for-byte unchanged', async t => {
  const env = mcTestEnvironment(t);
  await mcTestSave(env);
  const previous = mcTestRow(env);
  const response = await mcTestSave(env, { ...mcTestCandidate, name: 'unverified', apiKey: 'sk-rejected-new-credential' }, {}, async () => {
    throw Object.assign(new Error('模型服务拒绝访问。'), { status: 502 });
  });
  assert.equal(response.status, 502);
  assert.deepEqual(mcTestRow(env), previous);
  assert.equal((await resolveModelConfig(mcTestRequest(), env)).env.LLM_API_KEY, mcTestKey);
});

test('test responses omit provider answers, keys, and callback errors containing secrets', async t => {
  const env = mcTestEnvironment(t);
  const response = await handleModelConfig(mcTestRequest('POST', mcTestCandidate, { path: '/api/model-config/test' }), env, mcTestProbe);
  assert.deepEqual(await response.json(), { ok: true, model: mcTestCandidate.model, latencyMs: 17 });
  assert.equal(mcTestCount(env), 0, 'a candidate test does not save');
  const expected = await mcTestSave(env, mcTestCandidate, {}, async () => {
    throw Object.assign(new Error(`Rejected ${mcTestKey} with ${mcTestMaster}`), { status: 502 });
  });
  const redacted = await expected.text();
  assert.equal(redacted.includes(mcTestKey), false);
  assert.equal(redacted.includes(mcTestMaster), false);
  const unexpected = await mcTestSave(env, mcTestCandidate, {}, async () => { throw new Error(mcTestKey); });
  assert.equal(unexpected.status, 502);
  assert.equal((await unexpected.text()).includes(mcTestKey), false);
});

test('empty test body selects the saved user config or the server fallback without saving', async t => {
  const env = mcTestEnvironment(t);
  const seen = [];
  const probe = async selected => { seen.push(selected.LLM_API_KEY); return { latencyMs: 5 }; };
  assert.equal((await handleModelConfig(mcTestRequest('POST', {}, { path: '/api/model-config/test' }), env, probe)).status, 200);
  await mcTestSave(env);
  assert.equal((await handleModelConfig(mcTestRequest('POST', {}, { path: '/api/model-config/test' }), env, probe)).status, 200);
  assert.deepEqual(seen, [mcTestDefaultKey, mcTestKey]);
  assert.equal(mcTestCount(env), 1);
  const missing = await handleModelConfig(mcTestRequest('POST', {}, { path: '/api/model-config/test', user: 'carol' }), { ...env, LLM_API_KEY: '' }, probe);
  assert.equal(missing.status, 400);
  assert.equal(seen.length, 2);
});

test('rejects local, private, reserved, non-HTTPS, and credential-bearing base URLs before probing', async t => {
  const env = mcTestEnvironment(t);
  let calls = 0;
  const neverProbe = async () => { calls++; return mcTestProbe(); };
  const urls = [
    'http://api.provider.example/v1', 'ftp://api.provider.example/v1', 'https://localhost/v1', 'https://sub.localhost/v1',
    'https://host.local/v1', 'https://host.internal/v1', 'https://host.test/v1', 'https://host.invalid/v1', 'https://singlelabel/v1',
    'https://metadata.google.internal/v1', 'https://metadata.example.com/v1', 'https://instance-data.example.com/v1',
    'https://127.0.0.1/v1', 'https://127.1/v1', 'https://2130706433/v1', 'https://0x7f000001/v1', 'https://10.1.2.3/v1',
    'https://172.16.1.1/v1', 'https://172.31.255.255/v1', 'https://192.168.1.1/v1', 'https://169.254.169.254/v1',
    'https://100.64.0.1/v1', 'https://0.0.0.0/v1', 'https://224.0.0.1/v1', 'https://198.18.0.1/v1',
    'https://[::1]/v1', 'https://[2606:4700:4700::1111]/v1', 'https://[::ffff:127.0.0.1]/v1',
    'https://user:password@api.provider.example/v1', 'https://@api.provider.example/v1', 'https://api.provider.example/v1?key=value',
    'https://api.provider.example/v1?', 'https://api.provider.example/v1#', 'https://api.provider.example/v1#fragment',
    'https://127.0.0.1.nip.io/v1', 'https://private.sslip.io/v1', 'https://api.provider.example./v1',
    'https://api.provider.example\\@127.0.0.1/v1', 'https://api.provider.example/\nv1'
  ];
  for (const baseUrl of urls) {
    const response = await mcTestSave(env, { ...mcTestCandidate, baseUrl }, {}, neverProbe);
    assert.equal(response.status, 400, baseUrl);
  }
  assert.equal(calls, 0);
  assert.equal(mcTestCount(env), 0);
});

test('rejects invalid fields and secrets placed in public metadata', async t => {
  const env = mcTestEnvironment(t);
  let calls = 0;
  const neverProbe = async () => { calls++; return mcTestProbe(); };
  const patches = [
    { name: '' }, { name: 'n'.repeat(61) }, { name: 'bad\nname' }, { name: 1 },
    { model: '' }, { model: 'm'.repeat(121) }, { model: '模型' }, { model: 'model name' }, { model: {} },
    { apiKey: 123456 }, { apiKey: 'short' }, { apiKey: 'k'.repeat(4097) }, { apiKey: mcTestKey + '\r\nheader' },
    { apiKey: '\n' }, { extra: 'unsupported' }, { name: mcTestKey }, { model: mcTestKey },
    { baseUrl: `https://api.provider.example/${mcTestKey}` }
  ];
  for (const patch of patches) assert.equal((await mcTestSave(env, { ...mcTestCandidate, ...patch }, {}, neverProbe)).status, 400, JSON.stringify(patch));
  assert.equal(calls, 0);
  assert.equal(mcTestCount(env), 0);
});

test('authentication is required for settings while unauthenticated resolution only uses server defaults', async t => {
  const env = mcTestEnvironment(t);
  await mcTestSave(env);
  for (const [method, body, path] of [['GET', undefined, '/api/model-config'], ['PUT', mcTestCandidate, '/api/model-config'], ['DELETE', undefined, '/api/model-config'], ['POST', {}, '/api/model-config/test']]) {
    const response = await handleModelConfig(mcTestRequest(method, body, { user: null, path }), env, mcTestProbe);
    assert.equal(response.status, 401);
  }
  const resolved = await resolveModelConfig(mcTestRequest('GET', undefined, { user: null }), env);
  assert.equal(resolved.source, 'default');
  assert.equal(resolved.env.LLM_API_KEY, mcTestDefaultKey);
  assert.equal(mcTestCount(env), 1);
});

test('only explicitly configured local development identity bypasses cloud identity', async t => {
  const env = mcTestEnvironment(t, { LOCAL_SETTINGS_USER_ID: 'local-device-owner' });
  assert.equal((await mcTestSave(env, mcTestCandidate, { user: null })).status, 200);
  assert.equal(mcTestRow(env, 'local-device-owner').name, mcTestCandidate.name);
  const cloud = await resolveModelConfig(mcTestRequest('GET', undefined, { user: 'alice' }), env);
  assert.equal(cloud.source, 'default', 'cloud identity takes precedence over local fallback');
  const local = await resolveModelConfig(mcTestRequest('GET', undefined, { user: null }), env);
  assert.equal(local.source, 'custom');
});

test('cross-origin writes, cross-site fetches, and foreign referrers are rejected', async t => {
  const env = mcTestEnvironment(t);
  await mcTestSave(env);
  const previous = mcTestRow(env);
  for (const headers of [{ Origin: 'https://attacker.example' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site' }, { Referer: 'https://attacker.example/form' }]) {
    assert.equal((await mcTestSave(env, mcTestCandidate, { headers })).status, 403);
    assert.equal((await handleModelConfig(mcTestRequest('DELETE', undefined, { headers }), env)).status, 403);
    assert.equal((await handleModelConfig(mcTestRequest('POST', {}, { path: '/api/model-config/test', headers }), env, mcTestProbe)).status, 403);
  }
  assert.deepEqual(mcTestRow(env), previous);
  assert.equal((await mcTestSave(env, mcTestCandidate, { headers: { Origin: mcTestOrigin, 'Sec-Fetch-Site': 'same-origin' } })).status, 200);
});

test('JSON type, strict object bodies, byte limit, methods, and paths are enforced', async t => {
  const env = mcTestEnvironment(t);
  const invalid = [
    [mcTestRequest('PUT', mcTestCandidate, { headers: { 'Content-Type': 'text/plain' } }), 415],
    [mcTestRequest('PUT', undefined, { rawBody: '{broken' }), 400],
    [mcTestRequest('PUT', null), 400], [mcTestRequest('PUT', []), 400],
    [mcTestRequest('PUT', undefined), 415],
    [mcTestRequest('PUT', undefined, { rawBody: JSON.stringify({ ...mcTestCandidate, name: '中'.repeat(6000) }) }), 413],
    [mcTestRequest('PUT', mcTestCandidate, { headers: { 'Content-Length': '16385' } }), 413],
    [mcTestRequest('POST', mcTestCandidate), 405], [mcTestRequest('GET', undefined, { path: '/api/model-config/test' }), 405],
    [mcTestRequest('GET', undefined, { path: '/api/missing' }), 404]
  ];
  for (const [request, status] of invalid) assert.equal((await handleModelConfig(request, env, mcTestProbe)).status, status);
  assert.equal(mcTestCount(env), 0);
});

test('missing database or encryption secret reports unavailable storage without exposing defaults', async t => {
  const env = mcTestEnvironment(t);
  const noDb = { ...env, DB: undefined };
  const view = await (await handleModelConfig(mcTestRequest(), noDb)).json();
  assert.equal(view.source, 'default');
  assert.equal(view.storageAvailable, false);
  assert.equal(JSON.stringify(view).includes(mcTestDefaultKey), false);
  assert.equal((await mcTestSave(noDb)).status, 503);
  assert.equal((await handleModelConfig(mcTestRequest('DELETE'), noDb)).status, 503);
  assert.equal((await handleModelConfig(mcTestRequest('POST', mcTestCandidate, { path: '/api/model-config/test' }), noDb, mcTestProbe)).status, 200);
  for (const secret of [undefined, 'not-base64', Buffer.alloc(16).toString('base64')]) {
    const unready = { ...env, MODEL_CONFIG_ENCRYPTION_KEY: secret };
    assert.equal((await (await handleModelConfig(mcTestRequest(), unready)).json()).storageAvailable, false);
    assert.equal((await mcTestSave(unready)).status, 503);
  }
});

test('database failures do not silently fall back to another provider or disclose SQL errors', async t => {
  const env = mcTestEnvironment(t);
  env.DB.sqlite.exec('DROP TABLE model_configs');
  const response = await handleModelConfig(mcTestRequest(), env);
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('model_configs'), false);
  await assert.rejects(resolveModelConfig(mcTestRequest(), env), error => error.status === 503);
});

test('user IDs are bound as SQL values rather than interpolated', async t => {
  const env = mcTestEnvironment(t);
  const injected = "alice' OR 1=1 --";
  await mcTestSave(env);
  await mcTestSave(env, { ...mcTestCandidate, name: 'second owner' }, { user: injected });
  assert.equal(mcTestCount(env), 2);
  assert.equal(mcTestRow(env, injected).name, 'second owner');
  await handleModelConfig(mcTestRequest('DELETE', undefined, { user: injected }), env);
  assert.equal(mcTestCount(env), 1);
  assert.equal(mcTestRow(env).name, mcTestCandidate.name);
});
