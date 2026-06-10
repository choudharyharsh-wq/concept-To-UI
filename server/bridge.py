"""
Bridge server — holds the latest wireframe payload so the Figma plugin can poll it.

Run separately from the main pipeline server:
    python bridge.py

Endpoints:
    POST /payload   — pipeline render_node pushes the compiled wireframe JSON here
    GET  /payload   — Figma plugin polls this to fetch the latest payload
    GET  /health    — liveness check
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Figma plugin iframe needs open CORS
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_latest_payload: dict = {"screens": []}


@app.post("/payload")
async def receive_payload(payload: dict):
    global _latest_payload
    _latest_payload = payload
    screen_count = len(payload.get("screens", []))
    return {"status": "ok", "screens_received": screen_count}


@app.get("/payload")
async def serve_payload():
    return JSONResponse(content=_latest_payload)


@app.get("/health")
async def health():
    return {"status": "ok", "screens_queued": len(_latest_payload.get("screens", []))}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)
