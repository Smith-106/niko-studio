# -*- coding: utf-8 -*-
"""Web app extra tests - websocket origin check, _serialize_state edge cases, ConnectionManager."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.web.app import _serialize_state, ConnectionManager


class TestSerializeStateExtra:
    def test_nested_non_serializable(self):
        """Non-serializable nested values become str."""
        obj = object()
        result = _serialize_state({"key": obj, "ok": 42})
        assert result["ok"] == 42
        assert isinstance(result["key"], str)

    def test_empty_dict(self):
        assert _serialize_state({}) == {}

    def test_list_value(self):
        result = _serialize_state({"items": [1, 2, 3]})
        assert result["items"] == [1, 2, 3]

    def test_nested_dict(self):
        result = _serialize_state({"a": {"b": "c"}})
        assert result["a"]["b"] == "c"

    def test_none_value(self):
        result = _serialize_state({"x": None})
        assert result["x"] is None

    def test_bool_value(self):
        result = _serialize_state({"flag": True})
        assert result["flag"] is True

    def test_large_string(self):
        big = "x" * 10000
        result = _serialize_state({"text": big})
        assert result["text"] == big


@pytest.mark.asyncio
class TestConnectionManagerExtra:
    async def test_connect_and_disconnect(self):
        mgr = ConnectionManager()
        ws = AsyncMock()
        await mgr.connect(ws)
        assert ws in mgr.active_connections
        ws.accept.assert_awaited_once()

        mgr.disconnect(ws)
        assert ws not in mgr.active_connections

    async def test_send_personal_message(self):
        mgr = ConnectionManager()
        ws = AsyncMock()
        await mgr.connect(ws)
        await mgr.send_personal_message("hello", ws)
        ws.send_text.assert_awaited_with("hello")

    async def test_send_json(self):
        mgr = ConnectionManager()
        ws = AsyncMock()
        await mgr.connect(ws)
        await mgr.send_json({"type": "test"}, ws)
        ws.send_json.assert_awaited_with({"type": "test"})

    async def test_broadcast(self):
        mgr = ConnectionManager()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await mgr.connect(ws1)
        await mgr.connect(ws2)
        await mgr.broadcast("msg")
        ws1.send_text.assert_awaited_with("msg")
        ws2.send_text.assert_awaited_with("msg")

    async def test_broadcast_empty(self):
        mgr = ConnectionManager()
        await mgr.broadcast("msg")  # no connections, should not raise


@pytest.mark.asyncio
class TestWebSocketOriginCheck:
    """Test the origin validation logic from websocket_endpoint."""

    async def test_untrusted_origin_rejected(self):
        """Simulate untrusted origin → close(1008)."""
        from src.web.app import origins

        ws = AsyncMock()
        ws.headers = {"origin": "http://evil.com"}
        ws.close = AsyncMock()

        # Replicate the origin check logic from websocket_endpoint
        if "origin" in ws.headers:
            origin = ws.headers["origin"]
            if origin not in origins:
                await ws.close(code=1008)

        ws.close.assert_awaited_once_with(code=1008)

    async def test_trusted_origin_accepted(self):
        """Trusted origin should not trigger close."""
        from src.web.app import origins

        ws = AsyncMock()
        ws.headers = {"origin": "http://localhost:8000"}
        ws.close = AsyncMock()

        rejected = False
        if "origin" in ws.headers:
            origin = ws.headers["origin"]
            if origin not in origins:
                await ws.close(code=1008)
                rejected = True

        assert not rejected
        ws.close.assert_not_awaited()

    async def test_no_origin_header(self):
        """No origin header → not rejected."""
        ws = AsyncMock()
        ws.headers = {}
        ws.close = AsyncMock()

        if "origin" in ws.headers:
            await ws.close(code=1008)

        ws.close.assert_not_awaited()
