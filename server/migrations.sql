-- İlkkan Sports veritabanı şeması (her açılışta güvenle çalışır: IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS matches (
  id          TEXT PRIMARY KEY,                       -- adres dostu kimlik: "bjk-ts"
  cat         TEXT NOT NULL CHECK (cat IN ('futbol', 'basketbol', 'voleybol')),
  league      TEXT NOT NULL,
  home        TEXT NOT NULL,
  away        TEXT NOT NULL,
  home_short  TEXT NOT NULL,
  away_short  TEXT NOT NULL,
  time        TEXT NOT NULL,                          -- "19:00"
  status      TEXT NOT NULL CHECK (status IN ('live', 'upcoming', 'finished')),
  clock       TEXT NOT NULL DEFAULT '',               -- "34'", "Ç2", "MS"
  period      TEXT NOT NULL DEFAULT '',               -- "34. dakika"
  score_home  INTEGER,
  score_away  INTEGER,
  derby       INTEGER NOT NULL DEFAULT 0,
  stream_1    TEXT NOT NULL DEFAULT '',
  stream_2    TEXT NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channels (
  id        TEXT PRIMARY KEY,
  no        TEXT NOT NULL,
  name      TEXT NOT NULL,
  genre     TEXT NOT NULL,
  cat       TEXT NOT NULL CHECK (cat IN ('futbol', 'basketbol', 'voleybol', 'kanal')),
  now       TEXT NOT NULL DEFAULT '',
  next      TEXT NOT NULL DEFAULT '',
  progress  REAL NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 1),
  match_id  TEXT REFERENCES matches(id) ON DELETE SET NULL,
  feature   INTEGER NOT NULL DEFAULT 0,
  stream_1  TEXT NOT NULL DEFAULT '',
  stream_2  TEXT NOT NULL DEFAULT '',
  sort      INTEGER NOT NULL DEFAULT 0
);

-- Metin listeleri: altyazılar, replikler, canlı yorumlar, anlatım, skorbord notları…
CREATE TABLE IF NOT EXISTS content (
  kind   TEXT PRIMARY KEY,
  items  TEXT NOT NULL DEFAULT '[]'                   -- JSON dizi (türüne göre doğrulanır)
);

-- Reklam alanları: "01"…"16" + "mac-arasi"
CREATE TABLE IF NOT EXISTS ad_units (
  id         TEXT PRIMARY KEY,
  slot       TEXT NOT NULL,
  label      TEXT NOT NULL,
  size       TEXT NOT NULL,
  mode       TEXT NOT NULL DEFAULT 'kiralik' CHECK (mode IN ('kiralik', 'image', 'code', 'off')),
  image_url  TEXT NOT NULL DEFAULT '',
  link_url   TEXT NOT NULL DEFAULT '',
  alt        TEXT NOT NULL DEFAULT '',
  code       TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL                                -- JSON
);

CREATE TABLE IF NOT EXISTS admins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Oturum belirtecinin kendisi değil, SHA-256 özeti saklanır
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf        TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- Çerezsiz istatistik: gün × olay × anahtar → sayı (kişisel veri yok)
CREATE TABLE IF NOT EXISTS stats_daily (
  day    TEXT NOT NULL,
  event  TEXT NOT NULL,
  key    TEXT NOT NULL DEFAULT '',
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, key)
);

-- Yalnızca bugünün tekil ziyaretçi özetleri (günlük tuzla; ham IP yok), eski günler silinir
CREATE TABLE IF NOT EXISTS visitors_today (
  day   TEXT NOT NULL,
  hash  TEXT NOT NULL,
  PRIMARY KEY (day, hash)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  admin   TEXT NOT NULL,
  action  TEXT NOT NULL,
  target  TEXT NOT NULL DEFAULT '',
  at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_stats_day ON stats_daily (day);
