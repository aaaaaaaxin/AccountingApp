import json
from datetime import timedelta

from .security import iso_utc, now_utc
from .sync_core import apply_transaction_purge_before, current_oplog_version, insert_oplog, load_json, next_versions


def build_baseline_payload(db, version: int, created_at: str) -> dict:
  def fetch_table(table: str) -> list[dict]:
    rows = db.execute(f"SELECT id, data, updated_at FROM {table}").fetchall()
    items = []
    for r in rows:
      items.append({"id": r["id"], "data": load_json(r["data"]), "updated_at": r["updated_at"]})
    return items

  tx_rows = db.execute("SELECT id, data, updated_at, deleted_at FROM transactions").fetchall()
  transactions = []
  for r in tx_rows:
    transactions.append(
      {
        "id": r["id"],
        "data": load_json(r["data"]),
        "updated_at": r["updated_at"],
        "deleted_at": r["deleted_at"],
      }
    )

  return {
    "version": version,
    "created_at": created_at,
    "ledger": fetch_table("ledger"),
    "category": fetch_table("category"),
    "template": fetch_table("template"),
    "tag": fetch_table("tag"),
    "transactions": transactions,
  }


def compact_db(db, retention_days: int) -> tuple[int, int]:
  created_at = iso_utc(now_utc())
  current_v = current_oplog_version(db)
  payload = build_baseline_payload(db, current_v, created_at)

  db.execute("BEGIN IMMEDIATE")
  try:
    db.execute(
      "INSERT OR REPLACE INTO baselines (version, created_at, payload) VALUES (?, ?, ?)",
      (current_v, created_at, json.dumps(payload, ensure_ascii=False, separators=(",", ":"))),
    )
    cutoff = iso_utc(now_utc() - timedelta(days=retention_days))
    cur = db.execute("DELETE FROM oplog WHERE received_at < ?", (cutoff,))
    deleted = cur.rowcount
    db.commit()
    return current_v, deleted
  except Exception:
    db.rollback()
    raise


def purge_deleted_before(db, before_iso: str, idempotency_key: str | None = None) -> tuple[int, int, bool]:
  received_at = iso_utc(now_utc())
  versions = next_versions(db, 1)
  v = versions[0]
  payload_json = json.dumps({"before": before_iso}, ensure_ascii=False, separators=(",", ":"))
  ok = insert_oplog(db, v, "transaction", "*", "purge_deleted_before", payload_json, received_at, idempotency_key)
  purged = 0
  if ok:
    purged = apply_transaction_purge_before(db, before_iso)
  db.commit()
  return v, purged, ok
