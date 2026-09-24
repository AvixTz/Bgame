// SQLite storage. Every query that touches a child's data takes the player id from the session,
// never from the request - see app.mjs.
import { DatabaseSync } from 'node:sqlite';

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,            -- as the child typed it
      school TEXT NOT NULL,
      name_key TEXT NOT NULL,        -- normalized, for login
      school_key TEXT NOT NULL,
      pin_hash TEXT NOT NULL,        -- scrypt(salt, pin)
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      failed INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0,
      UNIQUE (name_key, school_key)
    );
    CREATE TABLE IF NOT EXISTS docs (
      player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      json TEXT NOT NULL,
      version INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      at INTEGER NOT NULL,
      json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS attempts_player ON attempts(player_id, at);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_player ON sessions(player_id);
    CREATE TABLE IF NOT EXISTS ip_failures (
      ip TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ip_failures_ip ON ip_failures(ip, at);
  `);
  return db;
}
