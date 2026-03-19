import sqlite3
from pathlib import Path

from .settings import settings


def _ensure_parent_dir(db_path: str) -> None:
  path = Path(db_path)
  parent = path.parent
  if str(parent) and not parent.exists():
    parent.mkdir(parents=True, exist_ok=True)


def open_db() -> sqlite3.Connection:
  _ensure_parent_dir(settings.db_path)
  conn = sqlite3.connect(settings.db_path, check_same_thread=False)
  conn.row_factory = sqlite3.Row
  return conn


def init_db() -> None:
  conn = open_db()
  try:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
      """
    )
    conn.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('oplog_version', '0')")

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        csrf_token TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS invite_codes (
        code TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        used_by_user_id TEXT,
        revoked_at TEXT,
        FOREIGN KEY (used_by_user_id) REFERENCES users(id)
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS oplog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        op_type TEXT NOT NULL,
        payload TEXT,
        received_at TEXT NOT NULL,
        idempotency_key TEXT,
        UNIQUE (idempotency_key)
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS baselines (
        version INTEGER PRIMARY KEY,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS category (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS template (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS tag (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )
      """
    )

    conn.commit()
  finally:
    conn.close()
