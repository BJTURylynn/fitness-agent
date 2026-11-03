import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const mciOrigin = 'https://fitness.example';
const mciDefaultKey = 'sk-default-integration-private-key';
const mciCustomKey = 'sk-custom-integration-private-key';
const mciConfig = { name: '自选 AI 教练', baseUrl: 'https://custom.provider.example/v4', model: 'custom-model', apiKey: mciCustomKey };
let mciModule = 0;

async function mciFreshApi() {
  return (await import(`../server-api.js?model-config-integration=${++mciModule}`)).handleApi;
}

function mciEnvironment(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('CREATE TABLE model_configs (user_id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL, model TEXT NOT NULL, encrypted_key TEXT NOT NULL, updated_at TEXT NOT NULL, verified_at TEXT)');
  return {
    DB: {
      sqlite,
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        return { bind(...values) { return { async first() { return statement.get(...values) || null; }, async run() { return statement.run(...values); } }; } };
      }
    },
    MODEL_CONFIG_ENCRYPTION_KEY: Buffer.alloc(32, 71).toString('base64'),
    LLM_BASE_URL: 'https://default.provider.example/v1', LLM_MODEL: 'default-model', LLM_API_KEY: mciDefaultKey
  };
}

function mciRequest(path = '/api/model-config', method = 'GET', body, user = 'alice') {
  const headers = user ? { 'oai-authenticated-user-id': user } : {};
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers.Origin = mciOrigin;
    init.body = JSON.stringify(body);
  }
  return new Request(mciOrigin + path, init);
}

const mciCoach = (user = 'alice') => mciRequest('/api/coach', 'POST', { mode: 'chat', question: '下一次训练应怎样安排？' }, user);
const mciReply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const mciCompletion = (content = 'OK') => mciReply({ choices: [{ message: { content } }] });
const mciRow = env => env.DB.sqlite.prepare('SELECT * FROM model_configs WHERE user_id = ?').get('alice');
const mciCount = env => env.DB.sqlite.prepare('SELECT count(*) AS count FROM model_configs').get().count;

function mciAssertCall(url, options, baseUrl, apiKey, model) {
  assert.equal(url, baseUrl + '/chat/completions');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer ' + apiKey);
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.equal(options.redirect, 'manual', 'never forward credentials by automatically following a redirect');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(JSON.parse(options.body).model, model);
}

test('API save, status, and coach select a user model; other users and deletion select the server fallback', async t => {
  const handleApi = await mciFreshApi();
  const env = mciEnvironment(t);
  const calls = [];
  const upstream = async (url, options) => {
    calls.push({ url, options });
    const payload = JSON.parse(options.body);
    if (calls.length === 1) {
      assert.equal(mciCount(env), 0, 'the connection is verified before saving');
      mciAssertCall(url, options, mciConfig.baseUrl, mciCustomKey, mciConfig.model);
      assert.deepEqual(payload.messages, [{ role: 'user', content: '连接验证：请只回复 OK。' }]);
      assert.equal(payload.max_tokens, 1024);
      assert.equal('temperature' in payload, false);
      return mciCompletion();
    }
    return mciCompletion(`按恢复情况安排训练。${options.headers.Authorization.slice(7)}`);
  };
  const savedResponse = await handleApi(mciRequest('/api/model-config', 'PUT', mciConfig), env, upstream);
  assert.equal(savedResponse.status, 200);
  const saved = await savedResponse.json();
  assert.equal(saved.source, 'custom');
  assert.equal(JSON.stringify(saved).includes(mciCustomKey), false);
  assert.equal(JSON.stringify(mciRow(env)).includes(mciCustomKey), false);
  const status = await (await handleApi(mciRequest('/api/status'), env, upstream)).json();
  assert.deepEqual(status, { modelConfigured: true, searchConfigured: false, model: mciConfig.model, source: 'custom', configName: mciConfig.name });
  const coach = await handleApi(mciCoach(), env, upstream);
  assert.equal(coach.status, 200);
  const coachBody = await coach.json();
  assert.equal(coachBody.model, mciConfig.model);
  assert.equal(coachBody.source, 'custom');
  assert.equal(coachBody.answer.includes(mciCustomKey), false);
  mciAssertCall(calls[1].url, calls[1].options, mciConfig.baseUrl, mciCustomKey, mciConfig.model);
  const otherStatus = await (await handleApi(mciRequest('/api/status', 'GET', undefined, 'bob'), env, upstream)).json();
  assert.equal(otherStatus.source, 'default');
  assert.equal(otherStatus.model, env.LLM_MODEL);
  const otherCoach = await handleApi(mciCoach('bob'), env, upstream);
  assert.equal(otherCoach.status, 200);
  assert.equal((await otherCoach.json()).source, 'default');
  mciAssertCall(calls[2].url, calls[2].options, env.LLM_BASE_URL, mciDefaultKey, env.LLM_MODEL);
  const removed = await handleApi(mciRequest('/api/model-config', 'DELETE'), env, upstream);
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).source, 'default');
  assert.equal(mciCount(env), 0);
  const restored = await handleApi(mciCoach(), env, upstream);
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).source, 'default');
  mciAssertCall(calls[3].url, calls[3].options, env.LLM_BASE_URL, mciDefaultKey, env.LLM_MODEL);
  assert.equal(calls.length, 4);
});

test('an actual failed API connection probe leaves the previously saved model active', async t => {
  const handleApi = await mciFreshApi();
  const env = mciEnvironment(t);
  const logs = [];
  t.mock.method(console, 'error', entry => logs.push(entry));
  assert.equal((await handleApi(mciRequest('/api/model-config', 'PUT', mciConfig), env, async () => mciCompletion())).status, 200);
  const previous = mciRow(env);
  const rejectedKey = 'sk-rejected-replacement-private-key';
  let failures = 0;
  const failed = await handleApi(mciRequest('/api/model-config', 'PUT', { ...mciConfig, name: '未验证的新模型', apiKey: rejectedKey }), env, async (url, options) => {
    failures++;
    mciAssertCall(url, options, mciConfig.baseUrl, rejectedKey, mciConfig.model);
    return mciReply({ error: { message: 'Provider body must remain private: ' + rejectedKey } }, 401);
  });
  assert.equal(failed.status, 502);
  assert.equal(failures, 1);
  assert.equal((await failed.text()).includes(rejectedKey), false);
  assert.equal(JSON.stringify(logs).includes(rejectedKey), false);
  assert.deepEqual(mciRow(env), previous);
  const coach = await handleApi(mciCoach(), env, async (url, options) => {
    mciAssertCall(url, options, mciConfig.baseUrl, mciCustomKey, mciConfig.model);
    return mciCompletion('原配置继续生效。');
  });
  assert.equal(coach.status, 200);
  assert.equal((await coach.json()).source, 'custom');
});

test('an undecryptable saved model returns explicit status and coach failures without calling the default provider', async t => {
  const handleApi = await mciFreshApi();
  const env = mciEnvironment(t);
  assert.equal((await handleApi(mciRequest('/api/model-config', 'PUT', mciConfig), env, async () => mciCompletion())).status, 200);
  env.DB.sqlite.prepare('UPDATE model_configs SET encrypted_key = ? WHERE user_id = ?').run('v1:not-valid-ciphertext', 'alice');
  let calls = 0;
  const neverUpstream = async () => { calls++; return mciCompletion(); };
  const status = await handleApi(mciRequest('/api/status'), env, neverUpstream);
  assert.equal(status.status, 503);
  assert.match((await status.json()).error, /无法解密/);
  const coach = await handleApi(mciCoach(), env, neverUpstream);
  assert.equal(coach.status, 503);
  assert.match((await coach.json()).error, /无法解密/);
  assert.equal(calls, 0, 'saved credential failures must not send training data to a fallback provider');
  assert.equal((await handleApi(mciRequest('/api/model-config', 'DELETE'), env, neverUpstream)).status, 200);
  assert.equal((await (await handleApi(mciRequest('/api/status'), env, neverUpstream)).json()).source, 'default');
});

test('API probes and coaching retry the completion token field once while retaining safe request options', async t => {
  const handleApi = await mciFreshApi();
  const env = mciEnvironment(t);
  const glmConfig = { ...mciConfig, model: 'coding-glm-5.3-flash-free' };
  const calls = [];
  const upstream = async (url, options) => {
    mciAssertCall(url, options, glmConfig.baseUrl, mciCustomKey, glmConfig.model);
    const payload = JSON.parse(options.body);
    calls.push(payload);
    assert.equal(payload.reasoning_effort, 'low');
    assert.equal(payload.stream, false);
    assert.equal('temperature' in payload, false);
    if (calls.length % 2 === 1) return mciReply({ error: { message: "Unsupported parameter: 'max_tokens'. Please use 'max_completion_tokens' instead." } }, 400);
    assert.equal('max_tokens' in payload, false);
    return mciCompletion();
  };
  assert.equal((await handleApi(mciRequest('/api/model-config', 'PUT', glmConfig), env, upstream)).status, 200);
  assert.equal(calls.length, 2);
  const { max_tokens: probeBudget, ...probePayload } = calls[0];
  assert.equal(probeBudget, 1024);
  assert.deepEqual(calls[1], { ...probePayload, max_completion_tokens: 1024 });
  assert.equal((await handleApi(mciCoach(), env, upstream)).status, 200);
  assert.equal(calls.length, 4);
  const { max_tokens: coachBudget, ...coachPayload } = calls[2];
  assert.equal(coachBudget, 4096);
  assert.deepEqual(calls[3], { ...coachPayload, max_completion_tokens: 4096 });
});

test('token compatibility retries require HTTP 400 and both field names; redirects never receive a follow-up request', async t => {
  const env = mciEnvironment(t);
  const logs = [];
  t.mock.method(console, 'error', entry => logs.push(entry));
  const providerSecret = 'provider-secret-body-' + mciCustomKey;
  const cases = [
    { status: 400, message: 'Unknown model ' + providerSecret },
    { status: 400, message: 'Unsupported max_tokens ' + providerSecret },
    { status: 401, message: 'max_tokens max_completion_tokens ' + providerSecret },
    { status: 500, message: 'max_tokens max_completion_tokens ' + providerSecret },
    { status: 307, message: providerSecret, headers: { Location: 'https://169.254.169.254/latest/meta-data' } }
  ];
  for (const item of cases) {
    const handleApi = await mciFreshApi();
    let calls = 0;
    const response = await handleApi(mciRequest('/api/model-config', 'PUT', mciConfig), env, async (url, options) => {
      calls++;
      mciAssertCall(url, options, mciConfig.baseUrl, mciCustomKey, mciConfig.model);
      return mciReply({ error: { message: item.message } }, item.status, item.headers);
    });
    assert.equal(response.status, 502, String(item.status));
    assert.equal(calls, 1, `${item.status}: ${item.message}`);
    assert.equal((await response.text()).includes(providerSecret), false);
    assert.equal(mciCount(env), 0);
  }
  assert.equal(JSON.stringify(logs).includes(providerSecret), false);
});

test('a repeated token-field error is bounded to two upstream attempts and does not save', async t => {
  const handleApi = await mciFreshApi();
  const env = mciEnvironment(t);
  t.mock.method(console, 'error', () => {});
  let calls = 0;
  const response = await handleApi(mciRequest('/api/model-config', 'PUT', mciConfig), env, async (url, options) => {
    calls++;
    mciAssertCall(url, options, mciConfig.baseUrl, mciCustomKey, mciConfig.model);
    return mciReply({ error: { message: 'max_tokens must be max_completion_tokens' } }, 400);
  });
  assert.equal(response.status, 502);
  assert.equal(calls, 2);
  assert.equal(mciCount(env), 0);
});

test('actual test API verifies candidates and current selections without saving or exposing provider replies', async t => {
  const handleApi = await mciFreshApi();
  const env = mciEnvironment(t);
  const calls = [];
  const upstream = async (url, options) => {
    calls.push({ url, options });
    return mciCompletion('private provider answer ' + mciCustomKey);
  };
  const candidate = await handleApi(mciRequest('/api/model-config/test', 'POST', mciConfig), env, upstream);
  assert.equal(candidate.status, 200);
  const tested = await candidate.json();
  assert.equal(tested.ok, true);
  assert.equal(tested.model, mciConfig.model);
  assert.ok(tested.latencyMs >= 0);
  assert.equal(JSON.stringify(tested).includes(mciCustomKey), false);
  assert.equal('answer' in tested, false);
  assert.equal(mciCount(env), 0);
  assert.equal((await handleApi(mciRequest('/api/model-config/test', 'POST', {}), env, upstream)).status, 200);
  mciAssertCall(calls[1].url, calls[1].options, env.LLM_BASE_URL, mciDefaultKey, env.LLM_MODEL);
  assert.equal((await handleApi(mciRequest('/api/model-config', 'PUT', mciConfig), env, upstream)).status, 200);
  const saved = mciRow(env);
  assert.equal((await handleApi(mciRequest('/api/model-config/test', 'POST', {}), env, upstream)).status, 200);
  mciAssertCall(calls[3].url, calls[3].options, mciConfig.baseUrl, mciCustomKey, mciConfig.model);
  assert.deepEqual(mciRow(env), saved);
  const blocked = await handleApi(mciRequest('/api/model-config/test', 'POST', { ...mciConfig, baseUrl: 'https://127.0.0.1/v1' }), env, upstream);
  assert.equal(blocked.status, 400);
  assert.equal(calls.length, 4);
});
