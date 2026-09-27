CREATE TABLE IF NOT EXISTS landings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pageviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  landing_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  country TEXT,
  region TEXT,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  landing_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  country TEXT,
  region TEXT,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pageviews_landing ON pageviews (landing_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_landing ON clicks (landing_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pageviews_created ON pageviews (created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks (created_at);
