import json
import sqlite3
from typing import Any

from fastapi import HTTPException


def current_oplog_version(db) -> int:
  cur = db.execute("SELECT value FROM meta WHERE key = 'oplog_version'")
  row = cur.fetchone()
  return int(row["value"]) if row else 0


def next_versions(db, count: int) -> list[int]:
  if count <= 0:
    return []
  db.execute("BEGIN IMMEDIATE")
  cur = db.execute("SELECT value FROM meta WHERE key = 'oplog_version'")
  row = cur.fetchone()
  current = int(row["value"]) if row else 0
  versions = list(range(current + 1, current + 1 + count))
  db.execute("UPDATE meta SET value = ? WHERE key = 'oplog_version'", (str(versions[-1]),))
  return versions


def insert_oplog(
  db,
  version: int,
  entity_type: str,
  entity_id: str,
  op_type: str,
  payload_json: str | None,
  received_at: str,
  idempotency_key: str | None,
) -> bool:
  try:
    db.execute(
      """
      INSERT INTO oplog (version, entity_type, entity_id, op_type, payload, received_at, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      """,
      (version, entity_type, entity_id, op_type, payload_json, received_at, idempotency_key),
    )
    return True
  except sqlite3.IntegrityError:
    return False


def update_oplog_payload(db, version: int, payload_json: str | None) -> None:
  db.execute("UPDATE oplog SET payload = ? WHERE version = ?", (payload_json, version))


def load_json(s: str | None) -> Any:
  if not s:
    return None
  try:
    return json.loads(s)
  except Exception:
    return None


def apply_upsert(db, entity_type: str, entity_id: str, payload: dict[str, Any] | None, updated_at: str) -> None:
  if payload is None:
    raise HTTPException(status_code=400, detail="payload_required")
  data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
  table = {
    "ledger": "ledger",
    "category": "category",
    "template": "template",
    "tag": "tag",
    "transaction": "transactions",
  }.get(entity_type)
  if not table:
    raise HTTPException(status_code=400, detail="unknown_entity_type")
  if table == "transactions":
    db.execute(
      """
      INSERT INTO transactions (id, data, updated_at, deleted_at)
      VALUES (?, ?, ?, NULL)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      """,
      (entity_id, data, updated_at),
    )
    return
  db.execute(
    f"""
    INSERT INTO {table} (id, data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    """,
    (entity_id, data, updated_at),
  )


def apply_transaction_delete(db, entity_id: str, deleted_at: str) -> None:
  db.execute(
    """
    UPDATE transactions SET deleted_at = ?, updated_at = ?
    WHERE id = ?
    """,
    (deleted_at, deleted_at, entity_id),
  )


def apply_transaction_restore(db, entity_id: str, restored_at: str) -> None:
  db.execute(
    """
    UPDATE transactions SET deleted_at = NULL, updated_at = ?
    WHERE id = ?
    """,
    (restored_at, entity_id),
  )


def apply_transaction_purge(db) -> int:
  cur = db.execute("DELETE FROM transactions WHERE deleted_at IS NOT NULL")
  return cur.rowcount


def apply_transaction_purge_before(db, before_iso: str) -> int:
  cur = db.execute("DELETE FROM transactions WHERE deleted_at IS NOT NULL AND deleted_at < ?", (before_iso,))
  return cur.rowcount


def apply_entity_delete(db, entity_type: str, entity_id: str) -> None:
  table = {
    "ledger": "ledger",
    "category": "category",
    "template": "template",
    "tag": "tag",
  }.get(entity_type)
  if not table:
    raise HTTPException(status_code=400, detail="delete_not_supported")
  db.execute(f"DELETE FROM {table} WHERE id = ?", (entity_id,))


def transaction_snapshot(db, transaction_id: str) -> dict | None:
  row = db.execute(
    "SELECT id, data, updated_at, deleted_at FROM transactions WHERE id = ?",
    (transaction_id,),
  ).fetchone()
  if not row:
    return None
  return {
    "id": row["id"],
    "data": load_json(row["data"]),
    "updated_at": row["updated_at"],
    "deleted_at": row["deleted_at"],
  }
