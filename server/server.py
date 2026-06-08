import json
import asyncio
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

    try:
        for event in langgraph_app.stream(initial_state):
            for node_name, output in event.items():
                payload = {"phase": node_name, "status": "completed", "data": output}
                yield f"data: {json.dumps(payload)}\n\n"
                await asyncio.sleep(0)  # yield control back to the event loop
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
