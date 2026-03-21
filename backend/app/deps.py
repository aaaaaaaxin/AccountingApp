from typing import Any, Generator

from fastapi import Depends, Header, HTTPException, Request, Response

from .db import open_db
from .security import now_utc, parse_iso, sha256_hex
from .settings import settings


def get_db() -> Generator[Any, None, None]:
  conn = open_db()
  try:
    yield conn
  finally:
    conn.close()


def require_setup_allowed(request: Request, db=Depends(get_db)) -> None:
  cur = db.execute("SELECT COUNT(1) AS c FROM users")
  row = cur.fetchone()
  if row and int(row["c"]) > 0:
    raise HTTPException(status_code=403, detail="setup_not_allowed")

  if settings.setup_key:
    incoming = request.headers.get("x-setup-key")
    if incoming and incoming == settings.setup_key:
      return

  host = request.client.host if request.client else ""
  if host in ("127.0.0.1", "::1"):
    return

  raise HTTPException(status_code=403, detail="setup_not_allowed")


def get_current_user(request: Request, db=Depends(get_db)) -> dict:
  token = request.cookies.get("session")
  if not token:
    raise HTTPException(status_code=401, detail="unauthorized")
  token_hash = sha256_hex(token)
  cur = db.execute(
    """
    SELECT s.id AS session_id, s.user_id, s.csrf_token, s.expires_at, s.revoked_at, u.username
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
    """,
    (token_hash,),
  )
  row = cur.fetchone()
  if not row:
    raise HTTPException(status_code=401, detail="unauthorized")
  if row["revoked_at"] is not None:
    raise HTTPException(status_code=401, detail="unauthorized")
  if parse_iso(row["expires_at"]) <= now_utc():
    raise HTTPException(status_code=401, detail="unauthorized")
  return {"id": row["user_id"], "username": row["username"], "csrf_token": row["csrf_token"]}


def require_csrf(
  request: Request,
  user=Depends(get_current_user),
  csrf_header: str | None = Header(default=None, alias="x-csrf-token"),
) -> None:
  if request.method in ("GET", "HEAD", "OPTIONS"):
    return
  csrf_cookie = request.cookies.get("csrf_token")
  if not csrf_cookie or not csrf_header:
    raise HTTPException(status_code=403, detail="csrf_required")
  if csrf_cookie != csrf_header:
    raise HTTPException(status_code=403, detail="csrf_invalid")
  if csrf_cookie != user["csrf_token"]:
    raise HTTPException(status_code=403, detail="csrf_invalid")


def set_auth_cookies(response: Response, session_token: str, csrf_token: str) -> None:
  domain = settings.cookie_domain.strip() or None
  response.set_cookie(
    key="session",
    value=session_token,
    httponly=True,
    secure=settings.cookie_secure,
    samesite=settings.cookie_samesite,
    path="/",
    domain=domain,
  )
  response.set_cookie(
    key="csrf_token",
    value=csrf_token,
    httponly=False,
    secure=settings.cookie_secure,
    samesite=settings.cookie_samesite,
    path="/",
    domain=domain,
  )


def clear_auth_cookies(response: Response) -> None:
  domain = settings.cookie_domain.strip() or None
  response.delete_cookie(key="session", path="/", domain=domain)
  response.delete_cookie(key="csrf_token", path="/", domain=domain)
