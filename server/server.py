"""
server.py — Pipeline API using LangGraph native streaming + checkpoints.

Flow:
  1. GET /api/generate   → streams graph via astream() until interrupt or done.
                           Emits SSE events per node. Closes stream when graph pauses.
  2. POST /api/review/respond → injects human feedback into graph state via update_state().
  3. GET /api/generate/resume → resumes graph from checkpoint, same SSE format.

No custom threading or queues — LangGraph handles interrupts and state natively.
"""

import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv(override=True)

from fastapi import FastAPI, Query
from fastapi.requests import Request
from fastapi.responses import StreamingResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from src.graph import app as langgraph_app
from src import db

server = FastAPI()

# Create the generations table if DATABASE_URL is configured (no-op otherwise).
db.init_db()

# Comma-separated exact origins, e.g. "http://localhost:3000,https://my-app.vercel.app"
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

server.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Also allow Vercel preview deployments (https://<branch>-<project>.vercel.app)
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _sse(phase: str, status: str, data: dict) -> str:
    return f"data: {json.dumps({'phase': phase, 'status': status, 'data': data})}\n\n"


# Heartbeat interval (seconds). Must be shorter than the proxy's idle timeout.
# Long-running nodes (e.g. ux_layout) emit no SSE bytes while computing; without
# a heartbeat the edge proxy severs the idle HTTP/2 connection and the browser
# reports net::ERR_HTTP2_PROTOCOL_ERROR.
_HEARTBEAT_SECS = 15


async def _with_heartbeat(inner):
    """
    Wrap an async generator of SSE strings, injecting a comment heartbeat
    (': hb\\n\\n', ignored by EventSource) during any gap longer than
    _HEARTBEAT_SECS so the connection never goes idle. Surfaces inner
    exceptions as an SSE 'error' event instead of silently dropping the stream.
    """
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    async def _producer():
        try:
            async for item in inner:
                await queue.put(item)
        except Exception as exc:  # noqa: BLE001 — surface to client + logs
            print(f"[ERROR] graph stream failed: {exc!r}")
            await queue.put(_sse("error", "error", {"message": str(exc)}))
        finally:
            await queue.put(_DONE)

    task = asyncio.create_task(_producer())
    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=_HEARTBEAT_SECS)
            except asyncio.TimeoutError:
                yield ": hb\n\n"
                continue
            if item is _DONE:
                break
            yield item
    finally:
        task.cancel()


async def _run_graph(config: dict, input_val):
    """
    Stream one graph segment via LangGraph's native astream().
    Yields SSE strings. Emits 'awaiting_human' if graph pauses at an interrupt,
    or 'done' if the graph completes.
    """
    # stream_mode is a list → astream yields (mode, chunk) tuples.
    #   "updates" → {node_name: node_output} once a node finishes.
    #   "custom"  → whatever a node emits via get_stream_writer() (used by the
    #               HTML compiler to push screens one-by-one as they're built).
    async for mode, chunk in langgraph_app.astream(
        input_val, config, stream_mode=["updates", "custom"]
    ):
        if mode == "custom":
            screen = chunk.get("html_screen") if isinstance(chunk, dict) else None
            if screen:
                yield _sse("html_compiler_node", "screen_ready", screen)
            continue
        # mode == "updates"
        for node_name, output in chunk.items():
            yield _sse(node_name, "completed", output)

    graph_state = langgraph_app.get_state(config)

    if graph_state.next and graph_state.values.get("review_status") == "awaiting_human":
        review_data = graph_state.values.get("review_data", {})
        yield _sse("prd_review_node", "awaiting_human", {"review_data": review_data})
    else:
        # Run finished → persist the full record for "past generations" history.
        session_id = (config.get("configurable") or {}).get("thread_id", "")
        try:
            await asyncio.to_thread(
                db.save_generation, session_id, dict(graph_state.values), "completed"
            )
        except Exception as e:  # noqa: BLE001 — persistence must never break the stream
            print(f"[DB] save_generation failed (non-fatal): {e}")
        yield _sse("done", "done", {})


@server.get("/api/generate")
async def generate(
    concept:     str = Query(...),
    figma_url:   str = Query(...),
    session_id:  str = Query(default="default"),
    use_ds:      bool = Query(default=False),
    output_mode: str = Query(default="figma"),
    max_screens: int = Query(default=0),
):
    config = {"configurable": {"thread_id": session_id}}

    initial_state = {
        "concept": concept, "figma_url": figma_url, "use_ds": use_ds,
        "output_mode": output_mode, "max_screens": max_screens,
        "prd_data": {}, "ia_data": {}, "user_flow_data": {},
        "ux_layout_data": {}, "wireframe_payload": {}, "render_data": {},
        "html_screens": [],
        "review_data": {}, "human_feedback": {"round_number": 1},
        "review_status": "", "logs": [], "errors": [],
    }

    return StreamingResponse(
        _with_heartbeat(_run_graph(config, initial_state)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@server.post("/api/review/respond")
async def review_respond(request: Request):
    body       = await request.json()
    session_id = body.get("session_id", "default")
    config     = {"configurable": {"thread_id": session_id}}

    graph_state   = langgraph_app.get_state(config)
    if not graph_state.values:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    current_round = graph_state.values.get("human_feedback", {}).get("round_number", 1)

    # Human hard-override: "this PRD is perfect, proceed to IA with it as-is".
    # Approve directly — the graph routes "approved" → ia_node, skipping the
    # apply-feedback node entirely, so the current PRD is used unchanged.
    if body.get("confirmed_proceed", False):
        langgraph_app.update_state(config, {"review_status": "approved"})
        return {"status": "ok"}

    # Otherwise the human wants changes — store feedback and route to the
    # apply-feedback node, which rewrites the PRD and triggers a new review round.
    langgraph_app.update_state(config, {
        "human_feedback": {
            **graph_state.values.get("human_feedback", {}),
            "answered_questions":      body.get("answered_questions", {}),
            "accepted_suggestion_ids": body.get("accepted_suggestion_ids", []),
            "human_notes":             body.get("human_notes", ""),
            "confirmed_proceed":       False,
            "round_number":            current_round,
        },
        "review_status": "feedback_received",
    })

    return {"status": "ok"}


@server.get("/api/generate/resume")
async def generate_resume(session_id: str = Query(default="default")):
    config = {"configurable": {"thread_id": session_id}}

    graph_state = langgraph_app.get_state(config)
    if not graph_state.values:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    return StreamingResponse(
        _with_heartbeat(_run_graph(config, None)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@server.post("/api/to-design")
async def to_design(request: Request):
    """
    Server-side proxy for code.to.design clipboard mode. Keeps TO_DESIGN_API_KEY
    off the client and avoids browser CORS. Body: { html, clip? }. Returns the
    Figma clipboard blob (text/html) verbatim for the browser to place on the
    clipboard.
    """
    key = os.getenv("TO_DESIGN_API_KEY", "").strip()
    if not key:
        return JSONResponse(
            {"error": "TO_DESIGN_API_KEY is not set in server/.env"}, status_code=500
        )

    body = await request.json()
    # endpoint selects /html (single) or /html-multi (array of screens). The rest
    # of the body is forwarded verbatim so the client controls the payload shape.
    endpoint = (body.pop("endpoint", "html") or "html").strip().lstrip("/")
    if endpoint not in {"html", "html-multi", "html-component", "html-multi-components"}:
        return JSONResponse({"error": f"unsupported endpoint '{endpoint}'"}, status_code=400)
    if endpoint == "html" and not body.get("html"):
        return JSONResponse({"error": "missing 'html'"}, status_code=400)
    if endpoint == "html-multi" and not body.get("screens"):
        return JSONResponse({"error": "missing 'screens'"}, status_code=400)

    def _call():
        import requests as req
        return req.post(
            f"https://api.to.design/{endpoint}",
            json=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
            timeout=300,
        )

    try:
        resp = await asyncio.to_thread(_call)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": f"to.design unreachable: {e}"}, status_code=502)

    if resp.status_code != 200:
        return JSONResponse(
            {"error": f"to.design returned {resp.status_code}: {resp.text[:500]}"},
            status_code=502,
        )

    # clip=true → text/html clipboard blob. Return it raw.
    return Response(content=resp.text, media_type="text/plain")


@server.get("/api/to-design/balance")
async def to_design_balance():
    """Proxy code.to.design's /balance so the UI can show remaining credits."""
    key = os.getenv("TO_DESIGN_API_KEY", "").strip()
    if not key:
        return JSONResponse({"error": "TO_DESIGN_API_KEY not set"}, status_code=500)

    def _call():
        import requests as req
        return req.get(
            "https://api.to.design/balance",
            headers={"Authorization": f"Bearer {key}"},
            timeout=30,
        )

    try:
        resp = await asyncio.to_thread(_call)
    except Exception as e:  # noqa: BLE001
        return JSONResponse({"error": f"balance unreachable: {e}"}, status_code=502)
    try:
        return JSONResponse(resp.json(), status_code=resp.status_code)
    except Exception:  # noqa: BLE001
        return JSONResponse({"raw": resp.text}, status_code=resp.status_code)


@server.get("/api/generations")
async def list_generations():
    """Lightweight list for the history sidebar."""
    items = await asyncio.to_thread(db.list_generations)
    return {"generations": items, "enabled": db.ENABLED}


@server.get("/api/generations/{gen_id}")
async def get_generation(gen_id: str):
    """Full record to rehydrate the workspace."""
    rec = await asyncio.to_thread(db.get_generation, gen_id)
    if rec is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return rec


@server.delete("/api/generations/{gen_id}")
async def delete_generation(gen_id: str):
    ok = await asyncio.to_thread(db.delete_generation, gen_id)
    return JSONResponse({"deleted": ok}, status_code=200 if ok else 404)


@server.get("/api/db-health")
async def db_health():
    """Verify the database connection from the browser."""
    return await asyncio.to_thread(db.health)


@server.get("/health")
async def health():
    return {"status": "ok"}
