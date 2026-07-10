"""
db.py — Postgres persistence for completed pipeline runs ("past generations").

Stores one row per generation (keyed by session_id) holding every stage's output
so the frontend can list past runs and replay any of them end-to-end (PRD → … →
canvas). Writes happen once, on completion (see server.py).

Tolerant by design: if DATABASE_URL is unset or SQLAlchemy/psycopg2 are missing,
the module loads in a DISABLED state and every helper no-ops — the pipeline keeps
working, history is simply unavailable. Set DATABASE_URL in server/.env to enable,
e.g. postgresql+psycopg2://user:pass@localhost:5432/concept_to_ui
"""

from __future__ import annotations

import os
from pathlib import Path
from datetime import datetime, timezone

# Default store: a local SQLite file at server/generations.db. No network, no
# ports — immune to firewalls/proxies, works identically in dev and prod.
_DEFAULT_SQLITE = f"sqlite:///{(Path(__file__).parent.parent / 'generations.db').as_posix()}"


def _resolve_database_url() -> str:
    """
    Use DATABASE_URL if explicitly set (e.g. a hosted Postgres); otherwise fall
    back to a local SQLite file. The optional Supabase 5-var block is still
    honored for anyone who wants Postgres.
    """
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        return url
    u  = os.getenv("user")
    pw = os.getenv("password")
    h  = os.getenv("host")
    pt = os.getenv("port")
    db = os.getenv("dbname")
    if all([u, pw, h, pt, db]):
        from urllib.parse import quote_plus
        return (f"postgresql+psycopg2://{u}:{quote_plus(pw.strip())}"
                f"@{h}:{pt}/{db}?sslmode=require")
    return _DEFAULT_SQLITE


DATABASE_URL = _resolve_database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")
ENABLED = False
_engine = None
_Session = None
Generation = None  # ORM model, defined when enabled


def _now():
    return datetime.now(timezone.utc)


try:
    if DATABASE_URL:
        from sqlalchemy import create_engine, Column, String, Boolean, DateTime, JSON, select, delete
        from sqlalchemy.orm import declarative_base, sessionmaker
        from sqlalchemy.pool import NullPool

        if IS_SQLITE:
            # check_same_thread=False: we call DB helpers from asyncio.to_thread
            # worker threads, so the connection must be usable across threads.
            _engine = create_engine(
                DATABASE_URL,
                connect_args={"check_same_thread": False},
                poolclass=NullPool,
                future=True,
            )
        else:
            # Hosted Postgres: NullPool + a connect timeout so an unreachable host
            # fails fast instead of hanging the server import.
            _engine = create_engine(
                DATABASE_URL,
                poolclass=NullPool,
                connect_args={"connect_timeout": 10},
                future=True,
            )
        _Session = sessionmaker(bind=_engine, future=True)
        _Base = declarative_base()

        class Generation(_Base):  # type: ignore
            __tablename__ = "generations"

            id           = Column(String, primary_key=True)   # = session_id
            created_at   = Column(DateTime(timezone=True), default=_now)
            updated_at   = Column(DateTime(timezone=True), default=_now, onupdate=_now)
            status       = Column(String, default="completed")  # completed | error
            title        = Column(String, default="Untitled")
            output_mode  = Column(String, default="figma")
            use_ds       = Column(Boolean, default=False)
            inputs       = Column(JSON, default=dict)
            prd_data        = Column(JSON, default=dict)
            ia_data         = Column(JSON, default=dict)
            user_flow_data  = Column(JSON, default=dict)
            ux_layout_data  = Column(JSON, default=dict)
            wireframe_payload = Column(JSON, default=dict)
            html_screens    = Column(JSON, default=list)
            render_data     = Column(JSON, default=dict)
            review          = Column(JSON, default=dict)
            logs            = Column(JSON, default=list)
            errors          = Column(JSON, default=list)

        ENABLED = True
except Exception as e:  # noqa: BLE001
    print(f"[DB] disabled — history persistence unavailable ({type(e).__name__}: {e})")
    ENABLED = False


def init_db():
    """Create tables if they don't exist. Safe to call repeatedly."""
    if not ENABLED:
        print("[DB] driver unavailable — 'past generations' history is disabled.")
        return
    try:
        Generation.metadata.create_all(_engine)
        where = DATABASE_URL.split("///")[-1] if IS_SQLITE else "Postgres"
        print(f"[DB] ready — 'generations' table at {where}.")
    except Exception as e:  # noqa: BLE001
        print(f"[DB] init failed ({type(e).__name__}: {e}); history disabled this session.")


def _derive_title(values: dict) -> str:
    """Best-effort human title for a run."""
    prd = values.get("prd_data") or {}
    nm = ((prd.get("executive_summary") or {}).get("primary_value_proposition") or "").strip()
    if nm:
        return nm[:80]
    concept = (values.get("concept") or "").strip()
    if concept:
        first = concept.splitlines()[0].replace("Product:", "").strip()
        return (first[:80] or "Untitled")
    return "Untitled"


def _screen_count(values: dict) -> int:
    hs = values.get("html_screens") or []
    if hs:
        return len(hs)
    wp = values.get("wireframe_payload") or {}
    return len(wp.get("screens", []) or [])


def save_generation(gen_id: str, values: dict, status: str = "completed") -> None:
    """Upsert a completed run by id. Synchronous — call via asyncio.to_thread."""
    if not ENABLED or not gen_id:
        return
    with _Session() as s:
        row = s.get(Generation, gen_id)
        if row is None:
            row = Generation(id=gen_id, created_at=_now())
            s.add(row)
        row.status      = status
        row.title       = _derive_title(values)
        row.output_mode = values.get("output_mode", "figma")
        row.use_ds      = bool(values.get("use_ds", False))
        row.inputs      = {
            "concept":     values.get("concept", ""),
            "figma_url":   values.get("figma_url", ""),
            "max_screens": values.get("max_screens", 0),
        }
        row.prd_data          = values.get("prd_data") or {}
        row.ia_data           = values.get("ia_data") or {}
        row.user_flow_data    = values.get("user_flow_data") or {}
        row.ux_layout_data    = values.get("ux_layout_data") or {}
        row.wireframe_payload = values.get("wireframe_payload") or {}
        row.html_screens      = values.get("html_screens") or []
        row.render_data       = values.get("render_data") or {}
        row.review            = {
            "review_data":   values.get("review_data") or {},
            "review_status": values.get("review_status", ""),
            "human_feedback": values.get("human_feedback") or {},
        }
        row.logs   = values.get("logs") or []
        row.errors = values.get("errors") or []
        s.commit()
        print(f"[DB] saved generation {gen_id} ({status}, {row.output_mode}, "
              f"{_screen_count(values)} screens).")


def list_generations() -> list[dict]:
    """Lightweight list for the history sidebar (no heavy stage blobs)."""
    if not ENABLED:
        return []
    from sqlalchemy import select
    with _Session() as s:
        rows = s.execute(select(Generation).order_by(Generation.created_at.desc())).scalars().all()
        out = []
        for r in rows:
            out.append({
                "id":           r.id,
                "title":        r.title,
                "created_at":   (r.created_at or _now()).isoformat(),
                "status":       r.status,
                "output_mode":  r.output_mode,
                "use_ds":       r.use_ds,
                "screen_count": len(r.html_screens or []) or len((r.wireframe_payload or {}).get("screens", []) or []),
            })
        return out


def get_generation(gen_id: str) -> dict | None:
    """Full record to rehydrate the workspace."""
    if not ENABLED:
        return None
    with _Session() as s:
        r = s.get(Generation, gen_id)
        if r is None:
            return None
        return {
            "id":           r.id,
            "title":        r.title,
            "created_at":   (r.created_at or _now()).isoformat(),
            "status":       r.status,
            "output_mode":  r.output_mode,
            "use_ds":       r.use_ds,
            "inputs":       r.inputs or {},
            "prd_data":     r.prd_data or {},
            "ia_data":      r.ia_data or {},
            "user_flow_data": r.user_flow_data or {},
            "ux_layout_data": r.ux_layout_data or {},
            "wireframe_payload": r.wireframe_payload or {},
            "html_screens": r.html_screens or [],
            "render_data":  r.render_data or {},
            "review":       r.review or {},
            "logs":         r.logs or [],
            "errors":       r.errors or [],
        }


def health() -> dict:
    """Connectivity check for /api/db-health — returns status + row count."""
    if not ENABLED:
        return {"enabled": False, "connected": False, "reason": "DATABASE_URL not configured"}
    try:
        from sqlalchemy import select, func
        with _Session() as s:
            count = s.execute(select(func.count()).select_from(Generation)).scalar_one()
        return {"enabled": True, "connected": True, "generations": int(count)}
    except Exception as e:  # noqa: BLE001
        return {"enabled": True, "connected": False, "error": f"{type(e).__name__}: {e}"}


def delete_generation(gen_id: str) -> bool:
    if not ENABLED:
        return False
    with _Session() as s:
        r = s.get(Generation, gen_id)
        if r is None:
            return False
        s.delete(r)
        s.commit()
        return True
