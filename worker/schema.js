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
  // 連結的家人：雙向各一列；person_id 是 user_id 這一方用來對應的人物卡
  `CREATE TABLE IF NOT EXISTS links (
    user_id TEXT NOT NULL,
    partner_id TEXT NOT NULL,
    person_id TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, partner_id)
  )`,
  `CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    person_id TEXT,
    expires_at TEXT NOT NULL
  )`,
  // AI 故事每人每天用了幾次（day 是台灣時間的日期）
  `CREATE TABLE IF NOT EXISTS story_usage (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (user_id, day)
  )`,
  // 串門子：留給連結的人的紙條（貼圖＋最多 40 字，30 天後清掉）
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    icon TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  // 誰來過我的小窩（一天一列，day 是台灣時間的日期）
  `CREATE TABLE IF NOT EXISTS visits (
    host_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    day TEXT NOT NULL,
    PRIMARY KEY (host_id, visitor_id, day)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_notes_to ON notes (to_id)',
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
