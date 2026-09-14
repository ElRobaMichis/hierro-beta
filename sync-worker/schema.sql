PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  auth_hash TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision > 0),
  upload_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  bytes INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
  vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  upload_id TEXT NOT NULL,
  part INTEGER NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY(vault_id, upload_id, part)
);
