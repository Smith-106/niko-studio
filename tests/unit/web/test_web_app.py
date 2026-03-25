# -*- coding: utf-8 -*-
"""Web app tests - ConnectionManager, _serialize_state, GET endpoint."""

import pytest
import json
from unittest.mock import MagicMock, AsyncMock, patch
import os


# _serialize_state is a module-level function, import carefully
# web/app.py tries to import from src.workflow.graph at module level
# We need to mock those before importing

@pytest.fixture(autouse=True)
def mock_web_deps(monkeypatch):
    """Mock heavy imports that web/app.py does at module level."""
    import sys
    mock_graph = MagicMock()
    mock_state = MagicMock()
    mock_state.DEFAULT_CONFIG = {}
    mock_state.create_initial_state = MagicMock()
    monkeypatch.setitem(sys.modules, "src.workflow.graph", mock_graph)
    monkeypatch.setitem(sys.modules, "src.workflow.state", mock_state)


class TestSerializeState:
    def test_serializable_values(self):
        from src.web.app import _serialize_state
        state = {"key": "value", "num": 42, "lst": [1, 2]}
        result = _serialize_state(state)
        assert result["key"] == "value"
        assert result["num"] == 42

    def test_non_serializable_values(self):
        from src.web.app import _serialize_state
        obj = object()
        state = {"obj": obj, "ok": "fine"}
        result = _serialize_state(state)
        assert result["ok"] == "fine"
        assert isinstance(result["obj"], str)

    def test_empty_state(self):
        from src.web.app import _serialize_state
        assert _serialize_state({}) == {}


class TestConnectionManager:
    @pytest.mark.asyncio
    async def test_connect(self):
        from src.web.app import ConnectionManager
        mgr = ConnectionManager()
        ws = AsyncMock()
        await mgr.connect(ws)
        ws.accept.assert_awaited_once()
        assert ws in mgr.active_connections

    def test_disconnect(self):
        from src.web.app import ConnectionManager
        mgr = ConnectionManager()
        ws = MagicMock()
        mgr.active_connections.add(ws)
        mgr.disconnect(ws)
        assert ws not in mgr.active_connections

    @pytest.mark.asyncio
    async def test_send_personal_message(self):
        from src.web.app import ConnectionManager
        mgr = ConnectionManager()
        ws = AsyncMock()
        await mgr.send_personal_message("hello", ws)
        ws.send_text.assert_awaited_once_with("hello")

    @pytest.mark.asyncio
    async def test_send_json(self):
        from src.web.app import ConnectionManager
        mgr = ConnectionManager()
        ws = AsyncMock()
        await mgr.send_json({"key": "val"}, ws)
        ws.send_json.assert_awaited_once_with({"key": "val"})

    @pytest.mark.asyncio
    async def test_broadcast(self):
        from src.web.app import ConnectionManager
        mgr = ConnectionManager()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        mgr.active_connections = {ws1, ws2}
        await mgr.broadcast("msg")
        ws1.send_text.assert_awaited_once_with("msg")
        ws2.send_text.assert_awaited_once_with("msg")


class TestGetEndpoint:
    def test_deprecated_410(self):
        from src.web.app import app
        from fastapi.testclient import TestClient
        with patch.dict(os.environ, {}, clear=False):
            # Ensure WEB_UI_FORWARD_URL is not set
            os.environ.pop("WEB_UI_FORWARD_URL", None)
            client = TestClient(app)
            response = client.get("/")
            assert response.status_code == 410

    def test_forward_302(self):
        from src.web.app import app
        from fastapi.testclient import TestClient
        with patch.dict(os.environ, {"WEB_UI_FORWARD_URL": "http://127.0.0.1:9000"}):
            client = TestClient(app, follow_redirects=False)
            response = client.get("/")
            assert response.status_code == 302
