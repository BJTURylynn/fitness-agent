import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { loadLocalEncryptionKey, openLocalModelStore } from '../scripts/local-model-store.mjs';

const workDirectory = resolve(import.meta.dirname, '../../work');

async function temporaryDirectory(t) {
  await mkdir(workDirectory, { recursive: true });
  const directory = await mkdtemp(resolve(workDirectory, 'model-store-test-'));
  t.after(async () => {
    if (!resolve(directory).startsWith(workDirectory + sep)) throw new Error('Unexpected temporary test directory');
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('local D1 adapter persists bound model settings across reopening and applies migrations once', async t => {
  const directory = await temporaryDirectory(t);
  const databasePath = resolve(directory, 'settings.sqlite');
  let store = await openLocalModelStore({ databasePath });
  const encrypted = 'v1:encrypted-value';
  const values = ['owner', "Quoted ' model", 'https://provider.example/v1', 'test-model', encrypted, '2026-11-03T00:00:00.000Z', null];
  const inserted = await store.prepare('INSERT INTO model_configs (user_id,name,base_url,model,encrypted_key,updated_at,verified_at) VALUES (?,?,?,?,?,?,?)').bind(...values).run();
  assert.equal(inserted.success, true);
  assert.equal(inserted.meta.changes, 1);
  assert.equal(await store.prepare('SELECT user_id FROM model_configs WHERE user_id = ?').bind('missing').first(), null);
  const migrationCount = await store.prepare('SELECT count(*) AS count FROM __local_migrations').first('count');
  store.close();

  store = await openLocalModelStore({ databasePath });
  try {
    const row = await store.prepare('SELECT * FROM model_configs WHERE user_id = ?').bind('owner').first();
    assert.deepEqual(row, { user_id: values[0], name: values[1], base_url: values[2], model: values[3], encrypted_key: encrypted, updated_at: values[5], verified_at: null });
    assert.equal(await store.prepare('SELECT count(*) AS count FROM __local_migrations').first('count'), migrationCount);
    assert.equal((await store.prepare('SELECT user_id FROM model_configs').all()).results.length, 1);
    await store.prepare('DELETE FROM model_configs WHERE user_id = ?').bind('owner').run();
    assert.equal(await store.prepare('SELECT * FROM model_configs WHERE user_id = ?').bind('owner').first(), null);
  } finally {
    store.close();
  }
});

test('local encryption master key survives restart, honors explicit keys, and refuses corrupt persistent keys', async t => {
  const directory = await temporaryDirectory(t);
  const filename = resolve(directory, 'runtime.json');
  const key = await loadLocalEncryptionKey({ filename });
  assert.equal(Buffer.from(key, 'base64').length, 32);
  assert.equal(await loadLocalEncryptionKey({ filename }), key);
  assert.deepEqual(Object.keys(JSON.parse(await readFile(filename, 'utf8'))), ['MODEL_CONFIG_ENCRYPTION_KEY']);
  const explicitKey = Buffer.alloc(32, 1).toString('base64');
  assert.equal(await loadLocalEncryptionKey({ filename, providedKey: explicitKey }), explicitKey);
  assert.equal(await loadLocalEncryptionKey({ filename }), key);
  await writeFile(filename, '{"MODEL_CONFIG_ENCRYPTION_KEY":"corrupt"}');
  await assert.rejects(loadLocalEncryptionKey({ filename }), /Invalid local model encryption key file/);
  await assert.rejects(loadLocalEncryptionKey({ filename, providedKey: 'invalid' }), /32-byte key/);
});
