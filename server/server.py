import json
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)  # must run before langsmith reads env vars

from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from langsmith import traceable
from src.graph import app as langgraph_app

server = FastAPI()

server.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@traceable(name="concept-to-ui-pipeline", run_type="chain")
def run_pipeline(concept: str, figma_url: str):
    """
    Runs the full LangGraph pipeline.
    Wrapping in @traceable gives LangSmith one top-level trace
    with all 5 LangGraph nodes nested inside it.
    """
    initial_state = {
        "concept": concept,
        "figma_url": figma_url,
        "prd_data": {},
        "ia_data": {},
        "copy_data": {},
        "layout_data": {},
        "render_data": {},
        "logs": [],
        "errors": [],
    }

    events = []
    for event in langgraph_app.stream(initial_state):
        for node_name, output in event.items():
            events.append((node_name, output))
    return events


async def generate_stream(concept: str, figma_url: str):
    try:
        # run_pipeline is synchronous (LangGraph .stream is sync);
        # run it in a thread so we don't block the event loop.
        loop = asyncio.get_event_loop()
        events = await loop.run_in_executor(None, run_pipeline, concept, figma_url)

        for node_name, output in events:
            payload = {"phase": node_name, "status": "completed", "data": output}
            yield f"data: {json.dumps(payload)}\n\n"
            await asyncio.sleep(0)

    except Exception as e:
        error_payload = {"phase": "error", "status": "error", "data": {"message": str(e)}}
        yield f"data: {json.dumps(error_payload)}\n\n"
    finally:
        yield "data: {\"phase\": \"done\", \"status\": \"done\", \"data\": {}}\n\n"


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
