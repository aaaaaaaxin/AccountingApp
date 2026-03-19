from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auto_compact import start_auto_compact
from .cors import get_cors_origins
from .db import init_db
from .logging_config import configure_logging
from .routes_auth import router as auth_router
from .routes_invites import router as invites_router
from .routes_recycle import router as recycle_router
from .routes_sync import router as sync_router


app = FastAPI(title="AccountingApp Backend", version="0.1.0")
origins = get_cors_origins()
if origins:
  app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
  )


@app.on_event("startup")
def _startup() -> None:
  configure_logging()
  init_db()
  start_auto_compact()


@app.get("/health")
def health() -> dict:
  return {"status": "ok"}


app.include_router(auth_router)
app.include_router(invites_router)
app.include_router(recycle_router)
app.include_router(sync_router)
