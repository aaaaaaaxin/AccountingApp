import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from .deps import clear_auth_cookies, get_current_user, get_db, require_csrf, set_auth_cookies
from .security import hash_password, iso_utc, new_csrf_token, new_id, new_session_token, now_utc, parse_iso, session_expires_at, sha256_hex, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger(__name__)


class RegisterBody(BaseModel):
  username: str
  password: str
  invite_code: str


class LoginBody(BaseModel):
  username: str
  password: str


@router.get("/me")
def me(user=Depends(get_current_user)) -> dict:
  return {"username": user["username"]}


@router.post("/register")
def register(body: RegisterBody, db=Depends(get_db)) -> dict:
  username = body.username.strip()
  if not username or len(username) > 50:
    log.warning("register_failed invalid_username username=%s", username)
    raise HTTPException(status_code=400, detail="invalid_username")
  if len(body.password) < 8:
    log.warning("register_failed invalid_password username=%s", username)
    raise HTTPException(status_code=400, detail="invalid_password")

  cur = db.execute("SELECT COUNT(1) AS c FROM users")
  row = cur.fetchone()
  if row and int(row["c"]) > 0:
    log.warning("register_failed single_user_already_exists username=%s", username)
    raise HTTPException(status_code=409, detail="single_user_already_exists")

  code = body.invite_code.strip()
  cur = db.execute("SELECT * FROM invite_codes WHERE code = ?", (code,))
  invite = cur.fetchone()
  if not invite:
    log.warning("register_failed invite_invalid username=%s", username)
    raise HTTPException(status_code=400, detail="invite_invalid")
  if invite["revoked_at"] is not None:
    log.warning("register_failed invite_invalid username=%s", username)
    raise HTTPException(status_code=400, detail="invite_invalid")
  if invite["used_at"] is not None:
    log.warning("register_failed invite_used username=%s", username)
    raise HTTPException(status_code=400, detail="invite_used")
  if now_utc() >= parse_iso(invite["expires_at"]):
    log.warning("register_failed invite_expired username=%s", username)
    raise HTTPException(status_code=400, detail="invite_expired")

  user_id = new_id()
  created_at = iso_utc(now_utc())
  password_hash = hash_password(body.password)
  try:
    db.execute(
      "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
      (user_id, username, password_hash, created_at),
    )
  except Exception:
    log.warning("register_failed username_taken username=%s", username)
    raise HTTPException(status_code=409, detail="username_taken")

  db.execute(
    "UPDATE invite_codes SET used_at = ?, used_by_user_id = ? WHERE code = ?",
    (created_at, user_id, code),
  )
  db.commit()
  log.info("register_ok username=%s", username)
  return {"status": "ok"}


@router.post("/login")
def login(body: LoginBody, response: Response, db=Depends(get_db)) -> dict:
  username = body.username.strip()
  cur = db.execute("SELECT * FROM users WHERE username = ?", (username,))
  user = cur.fetchone()
  if not user:
    log.warning("login_failed user_not_found username=%s", username)
    raise HTTPException(status_code=401, detail="invalid_credentials")
  if not verify_password(body.password, user["password_hash"]):
    log.warning("login_failed bad_password username=%s", username)
    raise HTTPException(status_code=401, detail="invalid_credentials")

  created = now_utc()
  session_id = new_id()
  token = new_session_token()
  token_hash = sha256_hex(token)
  csrf_token = new_csrf_token()
  expires = session_expires_at(created)
  db.execute(
    """
    INSERT INTO sessions (id, user_id, token_hash, csrf_token, created_at, expires_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL)
    """,
    (session_id, user["id"], token_hash, csrf_token, iso_utc(created), iso_utc(expires)),
  )
  db.commit()
  set_auth_cookies(response, token, csrf_token)
  log.info("login_ok username=%s", username)
  return {"status": "ok"}


@router.post("/logout")
def logout(request: Request, response: Response, user=Depends(get_current_user), db=Depends(get_db), _=Depends(require_csrf)) -> dict:
  token = request.cookies.get("session")
  if token:
    token_hash = sha256_hex(token)
    db.execute("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL", (iso_utc(now_utc()), token_hash))
    db.commit()
  clear_auth_cookies(response)
  log.info("logout_ok username=%s", user["username"])
  return {"status": "ok"}
