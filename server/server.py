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
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from src.graph import app as langgraph_app

server = FastAPI()

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
    async for chunk in langgraph_app.astream(input_val, config, stream_mode="updates"):
        for node_name, output in chunk.items():
            yield _sse(node_name, "completed", output)

    graph_state = langgraph_app.get_state(config)

    if graph_state.next and graph_state.values.get("review_status") == "awaiting_human":
        review_data = graph_state.values.get("review_data", {})
        yield _sse("prd_review_node", "awaiting_human", {"review_data": review_data})
    else:
        yield _sse("done", "done", {})


@server.get("/api/generate")
async def generate(
    concept:    str = Query(...),
    figma_url:  str = Query(...),
    session_id: str = Query(default="default"),
):
    config = {"configurable": {"thread_id": session_id}}

    initial_state = {
        "concept": concept, "figma_url": figma_url,
        "prd_data": {}, "ia_data": {}, "user_flow_data": {},
        "ux_layout_data": {}, "wireframe_payload": {}, "render_data": {},
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


@server.get("/health")
async def health():
    return {"status": "ok"}
