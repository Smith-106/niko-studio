"""
AI Writing Agent - Web UI Backend (FastAPI)
===========================================
Legacy note: Desktop client + MCP Gateway is the primary delivery path; this Web UI backend is retained for compatibility forwarding only.
"""

import os
import json
import asyncio
from typing import Dict, List, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

# Import workflow components
# Note: We might need to adjust imports depending on how Python path is set
try:
    from src.workflow.graph import run_writing_session, compile_graph
    from src.workflow.state import create_initial_state, DEFAULT_CONFIG
except ImportError:
    # For development when running from src/web/
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    from src.workflow.graph import run_writing_session, compile_graph
    from src.workflow.state import create_initial_state, DEFAULT_CONFIG


app = FastAPI(title="AI Writing Agent Platform")

# 🛡️ Sentinel: Add CORS/CSWSH protection
# Restrict WebSocket access to trusted origins to prevent Cross-Site WebSocket Hijacking
origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://127.0.0.1",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Templates
templates = Jinja2Templates(directory="src/web/templates")


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def send_json(self, data: dict, websocket: WebSocket):
        await websocket.send_json(data)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()


@app.get("/", response_class=HTMLResponse)
async def get(request: Request):
    # Web UI is deprecated: Desktop + MCP Gateway is the primary entry.
    # Default behavior: return 410 to indicate the UI is phased out.
    # To temporarily forward, set WEB_UI_FORWARD_URL (e.g. http://127.0.0.1:8000).
    forward_url = os.getenv("WEB_UI_FORWARD_URL", "").strip()
    if forward_url:
        target = forward_url.rstrip("/")
        content = (
            "<html>"
            "<head><meta http-equiv=\"refresh\" content=\"0; url="
            + target
            + "\"/></head>"
            "<body>Redirecting to Gateway...</body>"
            "</html>"
        )
        return HTMLResponse(content, status_code=302)
    return HTMLResponse(
        "Web UI has been deprecated. Please use the Desktop client or MCP Gateway.",
        status_code=410,
    )


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    # 🛡️ Sentinel: Manual CSWSH check (Defense in Depth)
    # Ensure Origin is trusted before accepting connection
    if "origin" in websocket.headers:
        origin = websocket.headers["origin"]
        if origin not in origins:
            print(f"Rejected WebSocket connection from untrusted origin: {origin}")
            await websocket.close(code=1008)  # Policy Violation
            return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle different message types
            if message.get("type") == "start_workflow":
                user_idea = message.get("content", "")
                mode = message.get("mode", "L3")

                await manager.send_json({
                    "type": "status",
                    "status": "starting",
                    "message": f"Starting workflow in {mode} mode..."
                }, websocket)

                # Run the workflow
                try:
                    # Initialize state
                    initial_state = create_initial_state(
                        user_idea=user_idea,
                        genre="悬疑",  # Default for prototype
                        target_chapters=3     # Default for prototype
                    )

                    # Compile graph
                    workflow_app = compile_graph(DEFAULT_CONFIG, use_memory=False)

                    # Run stream
                    current_state = initial_state
                    async for output in workflow_app.astream(initial_state):
                        for node_name, node_output in output.items():
                            # Update state
                            current_state.update(node_output)

                            # Send update to client
                            await manager.send_json({
                                "type": "node_update",
                                "node": node_name,
                                "data": _serialize_state(node_output)
                            }, websocket)

                            # If we have a draft, send it specifically
                            if "draft_content" in node_output:
                                await manager.send_json({
                                    "type": "draft_update",
                                    "content": node_output["draft_content"]
                                }, websocket)

                            # If we have LOCK analysis, send it
                            if "lock_analysis" in node_output:
                                await manager.send_json({
                                    "type": "lock_update",
                                    "data": node_output["lock_analysis"]
                                }, websocket)

                            # If we have scene cards, send them
                            if "scene_cards" in node_output:
                                await manager.send_json({
                                    "type": "scenes_update",
                                    "data": node_output["scene_cards"]
                                }, websocket)

                    await manager.send_json({
                        "type": "status",
                        "status": "completed",
                        "message": "Workflow completed successfully."
                    }, websocket)

                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    await manager.send_json({
                        "type": "error",
                        "message": str(e)
                    }, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


def _serialize_state(state: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to serialize state for JSON transmission"""
    # Simple serialization for prototype
    # In production, might need custom encoder for complex objects
    serializable = {}
    for k, v in state.items():
        try:
            json.dumps(v)
            serializable[k] = v
        except TypeError:
            serializable[k] = str(v)
    return serializable
