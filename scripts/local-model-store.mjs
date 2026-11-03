import { createHash, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, readdir, chmod } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = resolve(import.meta.dirname, '..');
const defaultWorkDirectory = resolve(projectRoot, '../work');

function validEncryptionKey(value) {
  return typeof value === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, 'base64').length === 32;
}

/** Called only by local server startup. Never persists a provider API key. */
export async function loadLocalEncryptionKey({
  providedKey,
  filename = resolve(defaultWorkDirectory, 'model-runtime.json'),
} = {}) {
  if (providedKey !== undefined && providedKey !== '') {
    if (!validEncryptionKey(providedKey)) throw new Error('MODEL_CONFIG_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    return providedKey;
  }
  const readExisting = async () => {
    const data = JSON.parse(await readFile(filename, 'utf8'));
    if (!validEncryptionKey(data.MODEL_CONFIG_ENCRYPTION_KEY)) throw new Error('Invalid local model encryption key file');
    await chmod(filename, 0o600);
    return data.MODEL_CONFIG_ENCRYPTION_KEY;
  };
  try {
    return await readExisting();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
  const key = randomBytes(32).toString('base64');
  let file;
  try {
    file = await open(filename, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') return readExisting();
    throw error;
  }
  try {
    await file.writeFile(JSON.stringify({ MODEL_CONFIG_ENCRYPTION_KEY: key }) + '\n', 'utf8');
    await file.sync();
  } finally {
    await file.close();
  }
  return key;
}

class LocalPreparedStatement {
  constructor(database, sql, parameters = []) {
    this.database = database;
    this.sql = sql;
    this.parameters = parameters;
  }
  bind(...parameters) {
    return new LocalPreparedStatement(this.database, this.sql, parameters);
  }
  async first(columnName) {
    const row = this.database.prepare(this.sql).get(...this.parameters);
    if (!row) return null;
    return columnName === undefined ? { ...row } : row[columnName] ?? null;
  }
  async all() {
    const results = this.database.prepare(this.sql).all(...this.parameters).map(row => ({ ...row }));
    return { success: true, results, meta: {} };
  }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.parameters);
    return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

/** Persistent local implementation of the small D1 API used by the Worker. */
export async function openLocalModelStore({
  databasePath = resolve(defaultWorkDirectory, 'model-settings.sqlite'),
  migrationsPath = resolve(projectRoot, 'drizzle'),
} = {}) {
  await mkdir(dirname(databasePath), { recursive: true, mode: 0o700 });
  const file = await open(databasePath, 'a', 0o600);
  await file.close();
  await chmod(databasePath, 0o600);
  const database = new DatabaseSync(databasePath);
  try {
    database.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    database.exec('CREATE TABLE IF NOT EXISTS __local_migrations (name TEXT PRIMARY KEY NOT NULL, hash TEXT NOT NULL, applied_at TEXT NOT NULL)');
    const migrations = (await readdir(migrationsPath)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
    if (!migrations.length) throw new Error('No model settings migrations found');
    for (const name of migrations) {
      const sql = await readFile(resolve(migrationsPath, name), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      database.exec('BEGIN IMMEDIATE');
      try {
        const applied = database.prepare('SELECT hash FROM __local_migrations WHERE name = ?').get(name);
        if (applied && applied.hash !== hash) throw new Error('An applied local database migration was modified');
        if (!applied) {
          database.exec(sql);
          database.prepare('INSERT INTO __local_migrations (name, hash, applied_at) VALUES (?, ?, ?)').run(name, hash, new Date().toISOString());
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }
    return {
      prepare(sql) { return new LocalPreparedStatement(database, sql); },
      close() { database.close(); },
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
