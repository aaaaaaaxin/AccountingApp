import asyncio
import logging
from datetime import datetime, timedelta

from .db import open_db
from .security import iso_utc, now_utc
from .settings import settings
from .sync_compaction import compact_db, purge_deleted_before


log = logging.getLogger(__name__)


async def _run_forever() -> None:
  hour = settings.auto_compact_hour
  if hour < 0 or hour > 23:
    hour = 3

  while settings.auto_compact:
    now = datetime.now()
    next_run = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if next_run <= now:
      next_run = next_run + timedelta(days=1)
    await asyncio.sleep(max(1.0, (next_run - now).total_seconds()))

    db = None
    try:
      db = open_db()
      baseline_v, deleted_ops = compact_db(db, settings.oplog_retention_days)
      log.info("auto_compact_ok deleted_ops=%s baseline_version=%s", deleted_ops, baseline_v)

      before = iso_utc(now_utc() - timedelta(days=settings.recycle_retention_days))
      v, purged, ok = purge_deleted_before(db, before, idempotency_key=f"auto_purge_deleted_before:{before}")
      if ok:
        log.info("auto_recycle_purge_ok purged=%s version=%s before=%s", purged, v, before)
    except Exception:
      log.exception("auto_compact_failed")
    finally:
      if db is not None:
        try:
          db.close()
        except Exception:
          pass


def start_auto_compact() -> None:
  if not settings.auto_compact:
    return
  asyncio.create_task(_run_forever())
