// 資料表在第一次請求時自動建立（CREATE IF NOT EXISTS），不需要另外跑 migration
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    challenge TEXT NOT NULL,
    kind TEXT NOT NULL,
    data TEXT,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS docs (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    rev INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS photos (
    user_id TEXT NOT NULL,
    id TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS links (
    user_id TEXT NOT NULL,
    partner_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, partner_id)
  )`,
  `CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials (user_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)',
];

let ready = null;

export function ensureSchema(env) {
  if (!ready) {
    ready = env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql))).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
