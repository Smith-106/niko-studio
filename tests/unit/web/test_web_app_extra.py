# -*- coding: utf-8 -*-
"""Web app extra tests - websocket origin check, _serialize_state edge cases, ConnectionManager."""

import json
import builtins
import importlib.util
import sys
import types
from pathlib import Path

import pytest
from unittest.mock import AsyncMock, MagicMock

from fastapi import WebSocketDisconnect

from src.web import app as web_app
from src.web.app import (
    _is_web_workflow_enabled,
    _serialize_state,
    ConnectionManager,
    WEB_WORKFLOW_DISABLED_MESSAGE,
    WEB_WORKFLOW_RISK_MESSAGE,
)


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
class TestWebSocketWorkflowGate:
    async def test_gate_read_error_defaults_to_disabled(self, monkeypatch):
        class _BadValue:
            def strip(self):
                raise RuntimeError("env read failed")

        monkeypatch.setattr(web_app.os, "getenv", lambda *_args, **_kwargs: _BadValue())

        assert _is_web_workflow_enabled() is False

    async def test_start_workflow_rejected_by_default(self, monkeypatch):
        mgr = ConnectionManager()
        monkeypatch.setattr(web_app, "manager", mgr)
        monkeypatch.delenv("WEB_WORKFLOW_ENABLED", raising=False)

        ws = AsyncMock()
        ws.headers = {"origin": "http://localhost:8000"}
        ws.receive_text = AsyncMock(
            side_effect=[
                json.dumps({"type": "start_workflow", "content": "idea", "mode": "L3"}),
                WebSocketDisconnect(),
            ]
        )

        compile_graph_mock = MagicMock()
        monkeypatch.setattr(web_app, "compile_graph", compile_graph_mock)

        await web_app.websocket_endpoint(ws, "gate-default")

        sent_payloads = [call.args[0] for call in ws.send_json.await_args_list]
        assert any(
            payload.get("type") == "error"
            and payload.get("code") == "workflow_disabled"
            and payload.get("message") == WEB_WORKFLOW_DISABLED_MESSAGE
            for payload in sent_payloads
        )
        compile_graph_mock.assert_not_called()


@pytest.mark.asyncio
class TestWebSocketOriginCheck:
    """Test the origin validation logic from websocket_endpoint."""

    async def test_untrusted_origin_rejected(self):
        """Simulate untrusted origin → close(1008)."""
        ws = AsyncMock()
        ws.headers = {"origin": "http://evil.com"}
        ws.close = AsyncMock()

        await web_app.websocket_endpoint(ws, "c1")

        ws.close.assert_awaited_once_with(code=1008)

    async def test_trusted_origin_accepted(self, monkeypatch):
        """Trusted origin with explicit enable should process start_workflow and complete."""

        class _WorkflowApp:
            async def astream(self, _state):
                yield {
                    "writer": {
                        "draft_content": "draft",
                        "lock_analysis": {"score": 1},
                        "scene_cards": [{"id": "S1"}],
                        "other": object(),
                    }
                }

        mgr = ConnectionManager()
        monkeypatch.setattr(web_app, "manager", mgr)

        ws = AsyncMock()
        ws.headers = {"origin": "http://localhost:8000"}
        ws.receive_text = AsyncMock(
            side_effect=[
                json.dumps({"type": "start_workflow", "content": "idea", "mode": "L3"}),
                WebSocketDisconnect(),
            ]
        )

        monkeypatch.setenv("WEB_WORKFLOW_ENABLED", "true")
        monkeypatch.setattr(web_app, "create_initial_state", lambda **kwargs: {"seed": kwargs["user_idea"]})
        monkeypatch.setattr(web_app, "compile_graph", lambda *_args, **_kwargs: _WorkflowApp())

        await web_app.websocket_endpoint(ws, "c2")

        ws.accept.assert_awaited_once()
        sent_types = [call.args[0]["type"] for call in ws.send_json.await_args_list]
        assert "risk_prompt" in sent_types
        assert "status" in sent_types
        assert "node_update" in sent_types
        assert "draft_update" in sent_types
        assert "lock_update" in sent_types
        assert "scenes_update" in sent_types
        risk_payload = next(call.args[0] for call in ws.send_json.await_args_list if call.args[0]["type"] == "risk_prompt")
        assert risk_payload["message"] == WEB_WORKFLOW_RISK_MESSAGE
        assert ws not in mgr.active_connections

    async def test_workflow_exception_sends_error(self, monkeypatch):
        mgr = ConnectionManager()
        monkeypatch.setattr(web_app, "manager", mgr)
        monkeypatch.setenv("WEB_WORKFLOW_ENABLED", "true")

        ws = AsyncMock()
        ws.headers = {"origin": "http://localhost:8000"}
        ws.receive_text = AsyncMock(
            side_effect=[
                json.dumps({"type": "start_workflow", "content": "idea", "mode": "L3"}),
                WebSocketDisconnect(),
            ]
        )

        def _boom(*_args, **_kwargs):
            raise RuntimeError("compile failed")

        monkeypatch.setattr(web_app, "compile_graph", _boom)
        monkeypatch.setattr(web_app, "create_initial_state", lambda **_kwargs: {"seed": "x"})

        await web_app.websocket_endpoint(ws, "c3")

        sent_payloads = [call.args[0] for call in ws.send_json.await_args_list]
        assert any(payload.get("type") == "error" for payload in sent_payloads)
        assert ws not in mgr.active_connections

    async def test_generic_exception_disconnects(self, monkeypatch):
        mgr = ConnectionManager()
        monkeypatch.setattr(web_app, "manager", mgr)

        ws = AsyncMock()
        ws.headers = {"origin": "http://localhost:8000"}
        ws.receive_text = AsyncMock(side_effect=ValueError("bad socket"))

        await web_app.websocket_endpoint(ws, "c4")

        assert ws not in mgr.active_connections

    async def test_no_origin_header(self, monkeypatch):
        """No origin header should continue path and then disconnect on close."""
        mgr = ConnectionManager()
        monkeypatch.setattr(web_app, "manager", mgr)

        ws = AsyncMock()
        ws.headers = {}
        ws.receive_text = AsyncMock(side_effect=WebSocketDisconnect())

        await web_app.websocket_endpoint(ws, "c5")

        ws.close.assert_not_called()
        assert ws not in mgr.active_connections


@pytest.mark.asyncio
async def test_websocket_ignores_non_start_workflow_message(monkeypatch):
    mgr = ConnectionManager()
    monkeypatch.setattr(web_app, "manager", mgr)

    ws = AsyncMock()
    ws.headers = {"origin": "http://localhost:8000"}
    ws.receive_text = AsyncMock(
        side_effect=[
            json.dumps({"type": "ping", "content": "noop"}),
            WebSocketDisconnect(),
        ]
    )

    await web_app.websocket_endpoint(ws, "c6")

    ws.accept.assert_awaited_once()
    assert ws.send_json.await_count == 0
    assert ws not in mgr.active_connections


@pytest.mark.asyncio
async def test_workflow_without_optional_updates_sends_only_node_update(monkeypatch):
    class _WorkflowApp:
        async def astream(self, _state):
            yield {
                "writer": {"other": "x"},
                "critic": {"score": 90},
            }

    mgr = ConnectionManager()
    monkeypatch.setattr(web_app, "manager", mgr)
    monkeypatch.setenv("WEB_WORKFLOW_ENABLED", "true")

    ws = AsyncMock()
    ws.headers = {"origin": "http://localhost:8000"}
    ws.receive_text = AsyncMock(
        side_effect=[
            json.dumps({"type": "start_workflow", "content": "idea", "mode": "L3"}),
            WebSocketDisconnect(),
        ]
    )

    monkeypatch.setattr(web_app, "create_initial_state", lambda **kwargs: {"seed": kwargs["user_idea"]})
    monkeypatch.setattr(web_app, "compile_graph", lambda *_args, **_kwargs: _WorkflowApp())

    await web_app.websocket_endpoint(ws, "c7")

    sent_types = [call.args[0]["type"] for call in ws.send_json.await_args_list]
    assert "node_update" in sent_types
    assert "draft_update" not in sent_types
    assert "lock_update" not in sent_types
    assert "scenes_update" not in sent_types


@pytest.mark.asyncio
async def test_root_default_deprecated_response(monkeypatch):
    monkeypatch.delenv("WEB_UI_FORWARD_URL", raising=False)

    response = await web_app.get(None)

    assert response.status_code == 410
    assert "deprecated" in response.body.decode("utf-8")


def test_web_app_importerror_fallback_branch(monkeypatch):
    module_path = Path(__file__).resolve().parents[3] / "src" / "web" / "app.py"
    module_name = "src.web.app_import_fallback_test"

    fake_graph_mod = types.ModuleType("src.workflow.graph")
    fake_graph_mod.run_writing_session = lambda *_args, **_kwargs: None
    fake_graph_mod.compile_graph = lambda *_args, **_kwargs: None

    fake_state_mod = types.ModuleType("src.workflow.state")
    fake_state_mod.create_initial_state = lambda **_kwargs: {}
    fake_state_mod.DEFAULT_CONFIG = {}

    monkeypatch.setitem(sys.modules, "src.workflow.graph", fake_graph_mod)
    monkeypatch.setitem(sys.modules, "src.workflow.state", fake_state_mod)

    original_import = builtins.__import__
    state = {"raised": False}

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if (
            name == "src.workflow.graph"
            and fromlist
            and "run_writing_session" in fromlist
            and not state["raised"]
        ):
            state["raised"] = True
            raise ImportError("simulated import error for fallback")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    sys.modules.pop(module_name, None)
    try:
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        assert spec is not None and spec.loader is not None
        mod = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = mod
        spec.loader.exec_module(mod)

        assert state["raised"] is True
        assert hasattr(mod, "app")
    finally:
        sys.modules.pop(module_name, None)
