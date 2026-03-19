import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from .deps import get_current_user, get_db, require_csrf
from .security import iso_utc, now_utc
from .settings import settings
from .sync_compaction import compact_db
from .sync_core import (
  apply_transaction_delete,
  apply_transaction_purge,
  apply_transaction_purge_before,
  apply_transaction_restore,
  apply_upsert,
  current_oplog_version,
  insert_oplog,
  load_json,
  next_versions,
  transaction_snapshot,
  update_oplog_payload,
)


router = APIRouter(prefix="/sync", tags=["sync"])
log = logging.getLogger(__name__)


class SyncOp(BaseModel):
  entity_type: str
  entity_id: str
  op_type: str
  payload: dict[str, Any] | None = None
  idempotency_key: str | None = None


class PushBody(BaseModel):
  ops: list[SyncOp]

def _latest_baseline_version(db) -> int | None:
  cur = db.execute("SELECT version FROM baselines ORDER BY version DESC LIMIT 1")
  row = cur.fetchone()
  if not row:
    return None
  return int(row["version"])


def _min_oplog_version(db) -> int | None:
  cur = db.execute("SELECT MIN(version) AS v FROM oplog")
  row = cur.fetchone()
  v = row["v"] if row else None
  return int(v) if v is not None else None


@router.get("/version")
def version(db=Depends(get_db), user=Depends(get_current_user)) -> dict:
  return {"version": current_oplog_version(db)}


@router.get("/pull")
def pull(since_version: int = 0, limit: int = 500, db=Depends(get_db), user=Depends(get_current_user)) -> dict:
  if limit <= 0 or limit > 2000:
    raise HTTPException(status_code=400, detail="invalid_limit")

  min_v = _min_oplog_version(db)
  baseline_v = _latest_baseline_version(db)
  if min_v is None:
    if baseline_v is not None and since_version < baseline_v:
      raise HTTPException(status_code=409, detail={"code": "baseline_required", "baseline_version": baseline_v})
  else:
    if since_version < (min_v - 1):
      raise HTTPException(status_code=409, detail={"code": "baseline_required", "baseline_version": baseline_v})

  cur = db.execute(
    """
    SELECT version, entity_type, entity_id, op_type, payload, received_at
    FROM oplog
    WHERE version > ?
    ORDER BY version ASC
    LIMIT ?
    """,
    (since_version, limit),
  )
  rows = cur.fetchall()
  ops = []
  for r in rows:
    payload = load_json(r["payload"])
    ops.append(
      {
        "version": r["version"],
        "entity_type": r["entity_type"],
        "entity_id": r["entity_id"],
        "op_type": r["op_type"],
        "payload": payload,
        "received_at": r["received_at"],
      }
    )
  return {"ops": ops, "current_version": current_oplog_version(db)}


@router.get("/baseline")
def baseline(db=Depends(get_db), user=Depends(get_current_user)) -> dict:
  cur = db.execute("SELECT version, created_at, payload FROM baselines ORDER BY version DESC LIMIT 1")
  row = cur.fetchone()
  if not row:
    raise HTTPException(status_code=404, detail="baseline_not_found")
  return {"version": int(row["version"]), "created_at": row["created_at"], "payload": load_json(row["payload"])}


@router.post("/compact")
def compact(db=Depends(get_db), user=Depends(get_current_user), _=Depends(require_csrf)) -> dict:
  retention_days = settings.oplog_retention_days
  if retention_days < 0 or retention_days > 3650:
    raise HTTPException(status_code=400, detail="invalid_retention_days")

  try:
    current_v, deleted = compact_db(db, retention_days)
  except Exception:
    log.exception("sync_compact_failed username=%s", user["username"])
    raise

  log.info("sync_compact_ok username=%s deleted_ops=%s baseline_version=%s", user["username"], deleted, current_v)
  return {"status": "ok", "baseline_version": current_v, "deleted_ops": deleted, "retention_days": retention_days}


@router.post("/push")
def push(
  body: PushBody,
  db=Depends(get_db),
  user=Depends(get_current_user),
  _=Depends(require_csrf),
  idempotency_header: str | None = Header(default=None, alias="idempotency-key"),
) -> dict:
  if not body.ops:
    return {"status": "ok", "applied": 0}
  if len(body.ops) > 500:
    raise HTTPException(status_code=400, detail="too_many_ops")

  received_at = iso_utc(now_utc())
  versions = next_versions(db, len(body.ops))
  applied = 0

  try:
    for idx, op in enumerate(body.ops):
      v = versions[idx]
      key = op.idempotency_key
      if not key and idempotency_header:
        key = f"{idempotency_header}:{idx}"

      payload_json = None
      if op.payload is not None:
        payload_json = json.dumps(op.payload, ensure_ascii=False, separators=(",", ":"))

      if not insert_oplog(db, v, op.entity_type, op.entity_id, op.op_type, payload_json, received_at, key):
        continue

      if op.op_type in ("upsert", "create", "update"):
        apply_upsert(db, op.entity_type, op.entity_id, op.payload, received_at)
      elif op.op_type == "delete":
        if op.entity_type != "transaction":
          raise HTTPException(status_code=400, detail="delete_not_supported")
        apply_transaction_delete(db, op.entity_id, received_at)
        update_oplog_payload(db, v, json.dumps({"id": op.entity_id, "deleted_at": received_at}, ensure_ascii=False, separators=(",", ":")))
      elif op.op_type == "restore":
        if op.entity_type != "transaction":
          raise HTTPException(status_code=400, detail="restore_not_supported")
        apply_transaction_restore(db, op.entity_id, received_at)
        snap = transaction_snapshot(db, op.entity_id)
        update_oplog_payload(db, v, json.dumps(snap, ensure_ascii=False, separators=(",", ":")) if snap else None)
      elif op.op_type == "purge_deleted":
        if op.entity_type != "transaction":
          raise HTTPException(status_code=400, detail="purge_not_supported")
        apply_transaction_purge(db)
      elif op.op_type == "purge_deleted_before":
        if op.entity_type != "transaction":
          raise HTTPException(status_code=400, detail="purge_not_supported")
        before = (op.payload or {}).get("before")
        if not before or not isinstance(before, str):
          raise HTTPException(status_code=400, detail="payload_required")
        apply_transaction_purge_before(db, before)
      else:
        raise HTTPException(status_code=400, detail="unknown_op_type")

      applied += 1
    db.commit()
  except Exception:
    db.rollback()
    log.exception("sync_push_failed username=%s", user["username"])
    raise

  log.info("sync_push_ok username=%s applied=%s current_version=%s", user["username"], applied, versions[-1] if versions else 0)
  return {"status": "ok", "applied": applied, "current_version": versions[-1] if versions else 0}
