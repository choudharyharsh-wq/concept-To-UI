import json
import queue
import threading
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)  # must run before langsmith reads env vars

from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from src.graph import app as langgraph_app

server = FastAPI()

server.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


async def generate_stream(concept: str, figma_url: str):
    """
    Streams SSE events one-by-one as each LangGraph node completes.

    LangGraph's .stream() is synchronous, so we run it in a background
    thread and pass each node's output through a queue to the async
    generator — this way the client receives each stage result the moment
    it finishes, not after all five stages are done.

    LangSmith tracing works automatically via LANGCHAIN_TRACING_V2=true
    in .env — no explicit @traceable wrapper needed.
    """
    initial_state = {
        "concept": concept,
        "figma_url": figma_url,
        "prd_data": {},
        "ia_data": {},
        "user_flow_data": {},
        "copy_data": {},
        "layout_data": {},
        "render_data": {},
        "logs": [],
        "errors": [],
    }

    event_queue: queue.Queue = queue.Queue()

    def run_graph():
        try:
            for event in langgraph_app.stream(initial_state):
                for node_name, output in event.items():
                    event_queue.put(("event", node_name, output))
            event_queue.put(("done", None, None))
        except Exception as exc:
            event_queue.put(("error", str(exc), None))

    # Run the synchronous LangGraph stream in a background thread
    thread = threading.Thread(target=run_graph, daemon=True)
    thread.start()

    loop = asyncio.get_event_loop()

    try:
        while True:
            # Block-wait on the queue without freezing the event loop
            kind, node_name, output = await loop.run_in_executor(
                None, event_queue.get
            )

            if kind == "done":
                yield f'data: {json.dumps({"phase": "done", "status": "done", "data": {}})}\n\n'
                break

            if kind == "error":
                yield f'data: {json.dumps({"phase": "error", "status": "error", "data": {"message": node_name}})}\n\n'
                break

            # kind == "event" — emit immediately
            payload = {"phase": node_name, "status": "completed", "data": output}
            yield f"data: {json.dumps(payload)}\n\n"

    except asyncio.CancelledError:
        # Client disconnected — let the thread finish naturally (it's daemon)
        pass


@server.get("/api/generate")
async def generate(
    concept: str = Query(..., description="Product concept text"),
    figma_url: str = Query(..., description="Figma file URL"),
):
    return StreamingResponse(
        generate_stream(concept, figma_url),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@server.get("/health")
async def health():
    return {"status": "ok"}
