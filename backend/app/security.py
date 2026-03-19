import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from .settings import settings


def now_utc() -> datetime:
  return datetime.now(timezone.utc)


def iso_utc(dt: datetime) -> str:
  return dt.astimezone(timezone.utc).isoformat()


def parse_iso(dt: str) -> datetime:
  return datetime.fromisoformat(dt)


def new_id() -> str:
  return secrets.token_urlsafe(16)


def new_session_token() -> str:
  return secrets.token_urlsafe(32)


def new_csrf_token() -> str:
  return secrets.token_urlsafe(32)


def session_expires_at(created_at: datetime) -> datetime:
  return created_at + timedelta(days=settings.session_ttl_days)


def sha256_hex(value: str) -> str:
  return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str, iterations: int = 310_000) -> str:
  salt = os.urandom(16)
  dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
  return "pbkdf2_sha256${}${}${}".format(
    iterations,
    base64.urlsafe_b64encode(salt).decode("utf-8").rstrip("="),
    base64.urlsafe_b64encode(dk).decode("utf-8").rstrip("="),
  )


def verify_password(password: str, encoded: str) -> bool:
  try:
    algo, iters, salt_b64, dk_b64 = encoded.split("$", 3)
    if algo != "pbkdf2_sha256":
      return False
    iterations = int(iters)
    salt = base64.urlsafe_b64decode(salt_b64 + "==")
    expected = base64.urlsafe_b64decode(dk_b64 + "==")
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)
  except Exception:
    return False
