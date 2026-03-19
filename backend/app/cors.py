from .settings import settings


def get_cors_origins() -> list[str]:
  raw = settings.cors_origins.strip()
  if not raw:
    return []
  parts = [p.strip() for p in raw.split(",")]
  return [p for p in parts if p]

