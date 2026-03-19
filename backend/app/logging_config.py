import logging
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

from .settings import settings


def configure_logging() -> None:
  log_dir = Path(settings.log_dir)
  log_dir.mkdir(parents=True, exist_ok=True)
  log_file = log_dir / "app.log"

  root = logging.getLogger()
  root.setLevel(logging.INFO)
  for h in list(root.handlers):
    root.removeHandler(h)

  fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")

  sh = logging.StreamHandler()
  sh.setFormatter(fmt)
  root.addHandler(sh)

  fh = TimedRotatingFileHandler(
    filename=str(log_file),
    when="midnight",
    backupCount=max(0, settings.log_retention_days),
    encoding="utf-8",
    utc=False,
  )
  fh.setFormatter(fmt)
  root.addHandler(fh)

  logging.getLogger("uvicorn.access").propagate = True
  logging.getLogger("uvicorn.error").propagate = True
