import os
from dataclasses import dataclass


def _get_bool_env(name: str, default: bool) -> bool:
  raw = os.environ.get(name)
  if raw is None:
    return default
  return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
  db_path: str = os.environ.get("ACCOUNTING_DB_PATH", "./data/accounting.sqlite3")
  cookie_secure: bool = _get_bool_env("ACCOUNTING_COOKIE_SECURE", True)
  cookie_samesite: str = os.environ.get("ACCOUNTING_COOKIE_SAMESITE", "lax")
  session_ttl_days: int = int(os.environ.get("ACCOUNTING_SESSION_TTL_DAYS", "14"))
  setup_key: str = os.environ.get("ACCOUNTING_SETUP_KEY", "")
  oplog_retention_days: int = int(os.environ.get("ACCOUNTING_OPLOG_RETENTION_DAYS", "90"))
  log_dir: str = os.environ.get("ACCOUNTING_LOG_DIR", "./logs")
  log_retention_days: int = int(os.environ.get("ACCOUNTING_LOG_RETENTION_DAYS", "7"))
  auto_compact: bool = _get_bool_env("ACCOUNTING_AUTO_COMPACT", True)
  auto_compact_hour: int = int(os.environ.get("ACCOUNTING_AUTO_COMPACT_HOUR", "3"))
  recycle_retention_days: int = int(os.environ.get("ACCOUNTING_RECYCLE_RETENTION_DAYS", "30"))
  cors_origins: str = os.environ.get("ACCOUNTING_CORS_ORIGINS", "")


settings = Settings()
