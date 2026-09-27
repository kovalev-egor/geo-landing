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

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  button_text TEXT NOT NULL,
  geos TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS landing_offers (
  landing_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  priority INTEGER NOT NULL,
  PRIMARY KEY (landing_id, offer_id)
);

CREATE TABLE IF NOT EXISTS combo_stats (
  country TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  landing_id TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (country, offer_id, landing_id)
);

CREATE INDEX IF NOT EXISTS idx_landing_offers_landing ON landing_offers (landing_id, priority);
CREATE INDEX IF NOT EXISTS idx_combo_stats_country ON combo_stats (country, landing_id);
