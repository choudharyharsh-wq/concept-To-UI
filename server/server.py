import json
import queue
import threading
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)  # must run before langsmith reads env vars

from fastapi import FastAPI, Query
from fastapi.requests import Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from src.graph import app as langgraph_app

server = FastAPI()

server.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Per-session state store ───────────────────────────────────────────────────
# Holds the live graph state and feedback queue for each active session.
# Key: session_id (passed as query param), Value: dict with queue + state.
_sessions: dict = {}


async def generate_stream(concept: str, figma_url: str, session_id: str):
    """
    Streams SSE events as each LangGraph node completes.
    When prd_review_node emits review_status='awaiting_human', the stream
    pauses and waits for the human to POST feedback to /api/review/respond.
    """
    initial_state = {
        "concept":           concept,
        "figma_url":         figma_url,
        "prd_data":          {},
        "ia_data":           {},
        "user_flow_data":    {},
        "ux_layout_data":    {},
        "wireframe_payload": {},
        "render_data":       {},
        "review_data":       {},
        "human_feedback":    {"round_number": 1},
        "review_status":     "",
        "logs":              [],
        "errors":            [],
    }

    event_queue: queue.Queue = queue.Queue()
    # feedback_queue: human POSTs feedback here to unblock the graph
    feedback_queue: queue.Queue = queue.Queue()

    _sessions[session_id] = {
        "feedback_queue": feedback_queue,
        "current_state":  initial_state,
    }

    # current_state tracks the latest full graph state so we can resume
    current_state = dict(initial_state)

    def run_graph(state):
        try:
            for event in langgraph_app.stream(state):
                for node_name, output in event.items():
                    event_queue.put(("event", node_name, output))
            event_queue.put(("done", None, None))
        except Exception as exc:
            event_queue.put(("error", str(exc), None))

    loop = asyncio.get_event_loop()

    # Start first graph run
    thread = threading.Thread(target=run_graph, args=(current_state,), daemon=True)
    thread.start()

    try:
        while True:
            kind, node_name, output = await loop.run_in_executor(
                None, event_queue.get
            )

            if kind == "done":
                yield f'data: {json.dumps({"phase": "done", "status": "done", "data": {}})}\n\n'
                break

            if kind == "error":
                yield f'data: {json.dumps({"phase": "error", "status": "error", "data": {"message": node_name}})}\n\n'
                break

            # Merge output into current_state
            current_state.update(output)
            _sessions[session_id]["current_state"] = current_state

            # Emit event to frontend
            review_status = output.get("review_status", "")

            if node_name == "prd_review_node" and review_status == "awaiting_human":
                # Tell frontend we're paused waiting for human
                payload = {
                    "phase":  "prd_review_node",
                    "status": "awaiting_human",
                    "data":   output,
                }
                yield f"data: {json.dumps(payload)}\n\n"

                # Block here until human POSTs feedback
                print("[SERVER] Waiting for human feedback on PRD review…")
                feedback = await loop.run_in_executor(None, feedback_queue.get)
                print(f"[SERVER] Feedback received: {feedback}")

                # Merge feedback into state and resume from apply_feedback node
                current_state["human_feedback"] = {
                    **current_state.get("human_feedback", {}),
                    **feedback,
                }
                current_state["review_status"] = "feedback_received"
                _sessions[session_id]["current_state"] = current_state

                # Emit a "feedback received" event so frontend can show progress
                yield f'data: {json.dumps({"phase": "prd_feedback_received", "status": "processing", "data": {}})}\n\n'

                # Restart graph from prd_apply_feedback_node
                thread2 = threading.Thread(
                    target=run_graph,
                    args=({"__start__": "prd_apply_feedback_node", **current_state},),
                    daemon=True,
                )
                # LangGraph stream doesn't support __start__ directly,
                # so we invoke from the node directly
                def resume_graph(state):
                    try:
                        from src.nodes import prd_apply_feedback_node
                        result = prd_apply_feedback_node(state)
                        event_queue.put(("event", "prd_apply_feedback_node", result))
                        # After apply, continue streaming remaining graph
                        merged = {**state, **result}
                        for event in langgraph_app.stream(merged):
                            for n, o in event.items():
                                if n not in ("prd_node", "prd_review_node"):
                                    event_queue.put(("event", n, o))
                        event_queue.put(("done", None, None))
                    except Exception as exc:
                        event_queue.put(("error", str(exc), None))

                thread2 = threading.Thread(
                    target=resume_graph,
                    args=(current_state,),
                    daemon=True,
                )
                thread2.start()

            else:
                payload = {"phase": node_name, "status": "completed", "data": output}
                yield f"data: {json.dumps(payload)}\n\n"

    except asyncio.CancelledError:
        pass
    finally:
        _sessions.pop(session_id, None)


@server.get("/api/generate")
async def generate(
    concept: str   = Query(..., description="Product concept text"),
    figma_url: str = Query(..., description="Figma file URL"),
    session_id: str = Query(default="default", description="Session ID for feedback routing"),
):
    return StreamingResponse(
        generate_stream(concept, figma_url, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@server.post("/api/review/respond")
async def review_respond(request: Request):
    """
    Human submits feedback on the Design Head's review.
    Body: {
      session_id: string,
      answered_questions: { [question_id]: string },
      accepted_suggestion_ids: string[],
      human_notes: string,
      confirmed_proceed: boolean
    }
    """
    body = await request.json()
    session_id = body.get("session_id", "default")

    session = _sessions.get(session_id)
    if not session:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    feedback = {
        "answered_questions":       body.get("answered_questions", {}),
        "accepted_suggestion_ids":  body.get("accepted_suggestion_ids", []),
        "human_notes":              body.get("human_notes", ""),
        "confirmed_proceed":        body.get("confirmed_proceed", False),
        "round_number":             session["current_state"].get("human_feedback", {}).get("round_number", 1),
    }

    session["feedback_queue"].put(feedback)
    return {"status": "ok", "message": "Feedback received — pipeline resuming."}


@server.get("/health")
async def health():
    return {"status": "ok"}
