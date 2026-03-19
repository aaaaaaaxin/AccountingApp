import json

from fastapi import APIRouter, Depends, Header, HTTPException

from .deps import get_current_user, get_db, require_csrf
from .security import iso_utc, now_utc
from .sync_core import apply_transaction_purge, apply_transaction_restore, current_oplog_version, insert_oplog, load_json, next_versions, transaction_snapshot, update_oplog_payload


router = APIRouter(prefix="/recycle", tags=["recycle"])


@router.get("/transactions")
def list_deleted_transactions(limit: int = 100, offset: int = 0, db=Depends(get_db), user=Depends(get_current_user)) -> dict:
  if limit <= 0 or limit > 500:
    raise HTTPException(status_code=400, detail="invalid_limit")
  if offset < 0:
    raise HTTPException(status_code=400, detail="invalid_offset")
  rows = db.execute(
    """
    SELECT id, data, updated_at, deleted_at
    FROM transactions
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
    LIMIT ? OFFSET ?
    """,
    (limit, offset),
  ).fetchall()
  items = []
  for r in rows:
    items.append(
      {
        "id": r["id"],
        "data": load_json(r["data"]),
        "updated_at": r["updated_at"],
        "deleted_at": r["deleted_at"],
      }
    )
  return {"items": items, "limit": limit, "offset": offset, "current_version": current_oplog_version(db)}


@router.post("/transactions/{transaction_id}/restore")
def restore_transaction(
  transaction_id: str,
  db=Depends(get_db),
  user=Depends(get_current_user),
  _=Depends(require_csrf),
  idempotency_key: str | None = Header(default=None, alias="idempotency-key"),
) -> dict:
  received_at = iso_utc(now_utc())
  versions = next_versions(db, 1)
  v = versions[0]
  ok = insert_oplog(db, v, "transaction", transaction_id, "restore", None, received_at, idempotency_key)
  if ok:
    apply_transaction_restore(db, transaction_id, received_at)
    snap = transaction_snapshot(db, transaction_id)
    update_oplog_payload(db, v, json.dumps(snap, ensure_ascii=False, separators=(",", ":")) if snap else None)
    db.commit()
    return {"status": "ok", "current_version": v}
  db.commit()
  return {"status": "ok", "current_version": current_oplog_version(db)}


@router.post("/transactions/purge")
def purge_deleted_transactions(
  db=Depends(get_db),
  user=Depends(get_current_user),
  _=Depends(require_csrf),
  idempotency_key: str | None = Header(default=None, alias="idempotency-key"),
) -> dict:
  received_at = iso_utc(now_utc())
  versions = next_versions(db, 1)
  v = versions[0]
  ok = insert_oplog(db, v, "transaction", "*", "purge_deleted", None, received_at, idempotency_key)
  purged = 0
  if ok:
    purged = apply_transaction_purge(db)
    db.commit()
    return {"status": "ok", "purged": purged, "current_version": v}
  db.commit()
  return {"status": "ok", "purged": 0, "current_version": current_oplog_version(db)}
