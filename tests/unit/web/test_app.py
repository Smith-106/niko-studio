# -*- coding: utf-8 -*-
"""
Web App Tests

Tests for FastAPI web app: routes, ConnectionManager, _serialize_state,
WebSocket origin check.
"""

import json
import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from src.web.app import (
    app,
    ConnectionManager,
    _serialize_state,
)


# ============================================================
# _serialize_state
# ============================================================

class TestSerializeState:

    def test_simple_values(self):
        state = {"key": "value", "num": 42, "flag": True}
        result = _serialize_state(state)
        assert result["key"] == "value"
        assert result["num"] == 42

    def test_non_serializable(self):
        state = {"obj": object(), "normal": "ok"}
        result = _serialize_state(state)
        assert result["normal"] == "ok"
        assert isinstance(result["obj"], str)

    def test_nested_dict(self):
        state = {"nested": {"a": 1, "b": 2}}
        result = _serialize_state(state)
        assert result["nested"]["a"] == 1

    def test_empty(self):
        result = _serialize_state({})
        assert result == {}

    def test_list_values(self):
        state = {"items": [1, 2, 3]}
        result = _serialize_state(state)
        assert result["items"] == [1, 2, 3]


# ============================================================
# ConnectionManager
# ============================================================

class TestConnectionManager:

    def test_init(self):
        cm = ConnectionManager()
        assert cm.active_connections == set()

    @pytest.mark.asyncio
    async def test_connect(self):
        cm = ConnectionManager()
        mock_ws = AsyncMock()
        await cm.connect(mock_ws)
        assert mock_ws in cm.active_connections
        mock_ws.accept.assert_called_once()

    def test_disconnect(self):
        cm = ConnectionManager()
        mock_ws = MagicMock()
        cm.active_connections.add(mock_ws)
        cm.disconnect(mock_ws)
        assert mock_ws not in cm.active_connections

    @pytest.mark.asyncio
    async def test_send_personal_message(self):
        cm = ConnectionManager()
        mock_ws = AsyncMock()
        await cm.send_personal_message("hello", mock_ws)
        mock_ws.send_text.assert_called_once_with("hello")

    @pytest.mark.asyncio
    async def test_send_json(self):
        cm = ConnectionManager()
        mock_ws = AsyncMock()
        data = {"type": "test"}
        await cm.send_json(data, mock_ws)
        mock_ws.send_json.assert_called_once_with(data)

    @pytest.mark.asyncio
    async def test_broadcast(self):
        cm = ConnectionManager()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        cm.active_connections = {ws1, ws2}
        await cm.broadcast("msg")
        ws1.send_text.assert_called_once_with("msg")
        ws2.send_text.assert_called_once_with("msg")


# ============================================================
# GET / route
# ============================================================

class TestGetRoute:

    @pytest.mark.asyncio
    async def test_deprecated_410(self):
        from httpx import AsyncClient, ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            with patch.dict("os.environ", {"WEB_UI_FORWARD_URL": ""}):
                resp = await client.get("/")
                assert resp.status_code == 410

    @pytest.mark.asyncio
    async def test_redirect_when_forward_url(self):
        from httpx import AsyncClient, ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=False) as client:
            with patch.dict("os.environ", {"WEB_UI_FORWARD_URL": "http://127.0.0.1:8080"}):
                resp = await client.get("/")
                assert resp.status_code == 302
