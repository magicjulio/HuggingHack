-- Online ranking (server/ranking.ts). One row per claimed name; runs keep each player's improvements.
CREATE TABLE players (
  name_key   TEXT PRIMARY KEY,          -- lower-case name, so names are unique ignoring case
  name       TEXT NOT NULL,             -- as typed
  token_hash TEXT,                      -- SHA-256 of the claiming browser's key; NULL = nobody can post
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE runs (
  id         INTEGER PRIMARY KEY,
  level      TEXT NOT NULL,             -- chapter id, e.g. 'end1' (src/data/ranking.ts)
  name_key   TEXT NOT NULL REFERENCES players(name_key),
  score      REAL NOT NULL,             -- seconds for timed levels
  stats      TEXT NOT NULL DEFAULT '{}',-- JSON, e.g. {"falls":2}
  listed     INTEGER NOT NULL DEFAULT 0,-- 1 = on the board even when not the player's best
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX runs_level ON runs (level, name_key, score);
