"""
Gateway Endpoints Tests - Health and Tools

Tests for GET /health and GET /tools endpoints.
"""

import pytest
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock


class TestMetricsEndpoint:
    """Tests for GET /metrics endpoint"""

    def test_metrics_returns_200(self, client_no_lifespan):
        response = client_no_lifespan.get("/metrics")
        assert response.status_code == 200

    def test_metrics_returns_required_fields(self, client_no_lifespan):
        response = client_no_lifespan.get("/metrics")
        data = response.json()
        assert data["status"] == "ok"
        metrics = data["metrics"]
        assert "requests_total" in metrics
        assert "requests_failed_total" in metrics
        assert "requests_success_total" in metrics
        assert "latency_ms_avg" in metrics
        assert "latency_ms_max" in metrics

    def test_metrics_returns_404_when_disabled(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module
        monkeypatch.setattr(gateway_module, "get_config_value", lambda key, default=None: False if key == "gateway.metrics_enabled" else default)
        response = client_no_lifespan.get("/metrics")
        assert response.status_code == 404
        assert response.json()["status"] == "disabled"


class TestHealthEndpoint:
    """Tests for GET /health endpoint"""

    def test_health_check_returns_200(self, client_no_lifespan):
        """Test health check returns 200 status"""
        response = client_no_lifespan.get("/health")
        assert response.status_code == 200

    def test_health_check_returns_healthy_status(self, client_no_lifespan):
        """Test health check returns healthy status"""
        response = client_no_lifespan.get("/health")
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_check_degraded_when_search_unhealthy(self, client_no_lifespan, monkeypatch):
        """Test health status degrades when search engine is unhealthy"""
        from src.mcp import gateway as gateway_module

        mock_engine = MagicMock()
        mock_engine.health_check = AsyncMock(return_value={"status": "error", "reason": "search down"})
        monkeypatch.setattr(gateway_module, "get_search_engine", lambda: mock_engine)

        response = client_no_lifespan.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["engine_health"]["search"]["status"] == "error"

    def test_health_check_returns_version(self, client_no_lifespan):
        """Test health check returns current __version__"""
        from src import __version__
        response = client_no_lifespan.get("/health")
        data = response.json()
        assert data["version"] == __version__

    def test_health_check_returns_all_services(self, client_no_lifespan):
        """Test health check returns all 7 services"""
        response = client_no_lifespan.get("/health")
        data = response.json()

        expected_services = ["memory", "graph", "search", "workflow", "critic", "agent", "skills"]
        for service in expected_services:
            assert service in data["services"]
            if service in {"agent", "skills"}:
                assert data["services"][service] == "ok"
            else:
                assert data["services"][service] in {"ok", "error"}

    def test_health_check_returns_engine_health(self, client_no_lifespan):
        """Test health check includes engine health details"""
        response = client_no_lifespan.get("/health")
        data = response.json()

        assert "engine_health" in data
        assert "memory" in data["engine_health"]
        assert "graph" in data["engine_health"]
        assert "search" in data["engine_health"]
        assert "workflow" in data["engine_health"]
        assert "critic" in data["engine_health"]

    def test_health_check_returns_agents_list(self, client_no_lifespan):
        """Test health check returns agents list"""
        response = client_no_lifespan.get("/health")
        data = response.json()

        assert "agents" in data
        expected_agents = ["commander", "architect", "writer", "critic", "worldbuilding", "character", "plot"]
        for agent in expected_agents:
            assert agent in data["agents"]

    def test_health_check_engine_exception_degrades_status(self, client_no_lifespan, monkeypatch):
        """Test health check captures engine exception and reports degraded"""
        from src.mcp import gateway as gateway_module

        mock_engine = MagicMock()
        mock_engine.health_check = AsyncMock(side_effect=RuntimeError("boom"))
        monkeypatch.setattr(gateway_module, "get_memory_engine", lambda: mock_engine)

        response = client_no_lifespan.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["engine_health"]["memory"]["status"] == "error"
        assert "boom" in data["engine_health"]["memory"]["error"]


class TestModelsEndpoint:
    """Tests for GET /models endpoint"""

    def test_models_returns_200_with_aggregated_models(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_config = SimpleNamespace(providers=[
            SimpleNamespace(
                provider=SimpleNamespace(value="openai"),
                model_mapping={"fast": "gpt-4o-mini", "default": "gpt-4o", "powerful": "gpt-4o"},
                embedding_model="text-embedding-3-small",
            ),
            SimpleNamespace(
                provider=SimpleNamespace(value="anthropic"),
                model_mapping={"fast": "claude-3-haiku-20240307", "default": "claude-3-5-sonnet-20241022", "powerful": "claude-3-opus-20240229"},
                embedding_model="",
            ),
        ])

        monkeypatch.setattr(gateway_module, "load_services_config", lambda: mock_config)

        response = client_no_lifespan.get("/models")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "providers" in data
        assert data["providers"]["openai"] == ["gpt-4o-mini", "gpt-4o", "text-embedding-3-small"]
        assert "gpt-4o" in data["models"]
        assert "claude-3-5-sonnet-20241022" in data["models"]

    def test_models_returns_provider_filtered_result(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_config = SimpleNamespace(providers=[
            SimpleNamespace(
                provider=SimpleNamespace(value="openai"),
                model_mapping={"fast": "gpt-4o-mini", "default": "gpt-4o", "powerful": "gpt-4-turbo"},
                embedding_model="text-embedding-3-small",
            )
        ])

        monkeypatch.setattr(gateway_module, "load_services_config", lambda: mock_config)

        response = client_no_lifespan.get("/models?provider=openai")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["provider"] == "openai"
        assert data["models"] == ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "text-embedding-3-small"]

    def test_models_returns_404_for_unknown_provider(self, client_no_lifespan, monkeypatch):
        from src.mcp import gateway as gateway_module

        mock_config = SimpleNamespace(providers=[
            SimpleNamespace(
                provider=SimpleNamespace(value="openai"),
                model_mapping={"fast": "gpt-4o-mini", "default": "gpt-4o", "powerful": "gpt-4-turbo"},
                embedding_model="text-embedding-3-small",
            )
        ])

        monkeypatch.setattr(gateway_module, "load_services_config", lambda: mock_config)

        response = client_no_lifespan.get("/models?provider=unknown")
        assert response.status_code == 404
        data = response.json()
        assert data["status"] == "not_found"
        assert data["provider"] == "unknown"
        assert data["models"] == []


class TestToolsEndpoint:
    """Tests for GET /tools endpoint"""

    def test_list_tools_returns_200(self, client_no_lifespan):
        """Test tools list returns 200 status"""
        response = client_no_lifespan.get("/tools")
        assert response.status_code == 200

    def test_list_tools_returns_all_services(self, client_no_lifespan):
        """Test tools list returns all 7 service categories"""
        response = client_no_lifespan.get("/tools")
        data = response.json()

        expected_services = ["memory", "graph", "search", "workflow", "critic", "agent", "skills"]
        for service in expected_services:
            assert service in data

    def test_list_tools_memory_service(self, client_no_lifespan):
        """Test memory service tools"""
        response = client_no_lifespan.get("/tools")
        data = response.json()

        memory_tools = data["memory"]
        expected = ["memory_add", "memory_search", "memory_get_temporal",
                    "memory_get_conflicts", "memory_resolve_conflict"]
        assert memory_tools == expected

    def test_list_tools_graph_service(self, client_no_lifespan):
        """Test graph service tools"""
        response = client_no_lifespan.get("/tools")
        data = response.json()

        graph_tools = data["graph"]
        expected = ["graph_query", "graph_get_character", "graph_get_relationships",
                    "graph_get_foreshadows", "graph_add_entity", "graph_add_relation"]
        assert graph_tools == expected

    def test_list_tools_search_service(self, client_no_lifespan):
        """Test search service tools"""
        response = client_no_lifespan.get("/tools")
        data = response.json()

        search_tools = data["search"]
        expected = ["search_hybrid", "search_iterative", "search_context"]
        assert search_tools == expected

    def test_list_tools_workflow_service(self, client_no_lifespan):
        """Test workflow service tools"""
        response = client_no_lifespan.get("/tools")
        data = response.json()

        workflow_tools = data["workflow"]
        expected = ["workflow_route", "workflow_plan", "workflow_execute",
                    "checkpoint_create", "checkpoint_restore", "checkpoint_list"]
        assert workflow_tools == expected

    def test_list_tools_critic_service(self, client_no_lifespan):
        """Test critic service tools"""
        response = client_no_lifespan.get("/tools")
        data = response.json()

        critic_tools = data["critic"]
        expected = ["evaluate_content", "get_improvement_suggestions", "compare_versions"]
        assert critic_tools == expected

    def test_list_tools_agent_service(self, client_no_lifespan):
        """Test agent service tools"""
        response = client_no_lifespan.get("/tools")
        data = response.json()

        agent_tools = data["agent"]
        expected = ["agent_route", "agent_write", "agent_revise", "agent_get_context"]
        assert agent_tools == expected

    def test_list_tools_skills_service(self, client_no_lifespan):
        """Test skills service tools"""
        response = client_no_lifespan.get("/tools")
        data = response.json()

        skills_tools = data["skills"]
        expected = ["skills_list", "skills_match", "skills_load", "skills_get_chain"]
        assert skills_tools == expected

    def test_list_tools_total_count(self, client_no_lifespan):
        """Test total tools count is 31"""
        response = client_no_lifespan.get("/tools")
        data = response.json()



def test_resolve_cors_origins_requires_real_prod_whitelist(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setenv("NIKO_ENV", "production")
    monkeypatch.setenv("NIKO_CORS_PROD_ORIGINS", "http://localhost:3000, *")

    with pytest.raises(RuntimeError):
        gateway_module._resolve_cors_origins()




def _reset_gateway_metrics(gateway_module):
    gateway_module._METRICS["requests_total"] = 0
    gateway_module._METRICS["requests_failed_total"] = 0
    gateway_module._METRICS["latency_ms_total"] = 0.0
    gateway_module._METRICS["latency_ms_max"] = 0.0


def test_is_llm_available_handles_exception(monkeypatch):
    from src.mcp import gateway as gateway_module

    class _Svc:
        def is_healthy(self):
            raise RuntimeError("svc down")

    monkeypatch.setattr(gateway_module, "get_services", lambda: _Svc())
    assert gateway_module._is_llm_available() is False


def test_parse_origins_variants():
    from src.mcp import gateway as gateway_module

    assert gateway_module._parse_origins("https://a.com, https://b.com") == ["https://a.com", "https://b.com"]
    assert gateway_module._parse_origins([" https://a.com ", "", 123]) == ["https://a.com", "123"]
    assert gateway_module._parse_origins(None) == []


def test_is_production_env_from_config(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.delenv("NIKO_ENV", raising=False)
    monkeypatch.setattr(gateway_module, "get_config_value", lambda key, default=None: "production" if key == "env" else default)

    assert gateway_module._is_production_env() is True


def test_resolve_reload_enabled_paths(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setenv("NIKO_ENV", "production")
    assert gateway_module._resolve_reload_enabled() is False

    monkeypatch.setenv("NIKO_ENV", "development")
    monkeypatch.setenv("NIKO_GATEWAY_RELOAD", "on")
    assert gateway_module._resolve_reload_enabled() is True

    monkeypatch.setenv("NIKO_GATEWAY_RELOAD", "0")
    assert gateway_module._resolve_reload_enabled() is False

    monkeypatch.delenv("NIKO_GATEWAY_RELOAD", raising=False)
    monkeypatch.setattr(gateway_module, "get_config_value", lambda key, default=None: False if key == "gateway.reload" else default)
    assert gateway_module._resolve_reload_enabled() is False


def test_resolve_gateway_host_port_env_and_config(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setenv("NIKO_GATEWAY_HOST", "127.0.0.1")
    monkeypatch.setenv("NIKO_GATEWAY_PORT", "9100")
    assert gateway_module._resolve_gateway_host_port() == ("127.0.0.1", 9100)

    monkeypatch.delenv("NIKO_GATEWAY_HOST", raising=False)
    monkeypatch.delenv("NIKO_GATEWAY_PORT", raising=False)
    monkeypatch.setattr(
        gateway_module,
        "get_config_value",
        lambda key, default=None: "0.0.0.0" if key == "gateway.host" else (8800 if key == "gateway.port" else default),
    )
    assert gateway_module._resolve_gateway_host_port() == ("0.0.0.0", 8800)


def test_resolve_cors_origins_dev_default_star(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setenv("NIKO_ENV", "development")
    monkeypatch.delenv("NIKO_CORS_DEV_ORIGINS", raising=False)
    monkeypatch.setattr(gateway_module, "get_config_value", lambda key, default=None: [] if key == "gateway.cors_dev_origins" else default)

    assert gateway_module._resolve_cors_origins() == ["*"]


def test_resolve_cors_origins_prod_from_config_with_filter(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setenv("NIKO_ENV", "production")
    monkeypatch.delenv("NIKO_CORS_PROD_ORIGINS", raising=False)
    monkeypatch.setattr(
        gateway_module,
        "get_config_value",
        lambda key, default=None: ["*", "http://localhost:3000", "https://prod.example.com"] if key == "gateway.cors_prod_origins" else default,
    )

    assert gateway_module._resolve_cors_origins() == ["https://prod.example.com"]


def test_gateway_metrics_record_and_snapshot():
    from src.mcp import gateway as gateway_module

    _reset_gateway_metrics(gateway_module)
    gateway_module._record_request_metrics(200, 12.5)
    gateway_module._record_request_metrics(500, 20.0)

    snapshot = gateway_module._get_metrics_snapshot()
    assert snapshot["requests_total"] == 2
    assert snapshot["requests_failed_total"] == 1
    assert snapshot["requests_success_total"] == 1
    assert snapshot["latency_ms_avg"] == 16.25
    assert snapshot["latency_ms_max"] == 20.0


def test_gateway_metrics_snapshot_zero_requests():
    from src.mcp import gateway as gateway_module

    _reset_gateway_metrics(gateway_module)
    snapshot = gateway_module._get_metrics_snapshot()

    assert snapshot["requests_total"] == 0
    assert snapshot["latency_ms_avg"] == 0.0
    assert snapshot["latency_ms_max"] == 0.0


@pytest.mark.asyncio
async def test_gateway_metrics_middleware_dispatch_paths():
    from src.mcp import gateway as gateway_module
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import JSONResponse

    _reset_gateway_metrics(gateway_module)
    middleware = gateway_module.GatewayMetricsMiddleware(app=Starlette())
    request = Request({"type": "http", "method": "GET", "path": "/health", "headers": []})

    async def call_next_ok(_request):
        return JSONResponse({"ok": True}, status_code=201)

    response = await middleware.dispatch(request, call_next_ok)
    assert response.status_code == 201

    assert gateway_module._METRICS["requests_total"] == 1
    assert gateway_module._METRICS["requests_failed_total"] == 0

    async def call_next_fail(_request):
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        await middleware.dispatch(request, call_next_fail)



def test_models_returns_500_when_config_load_fails(client_no_lifespan, monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(gateway_module, "load_services_config", lambda: (_ for _ in ()).throw(RuntimeError("config boom")))

    response = client_no_lifespan.get("/models")
    assert response.status_code == 500
    assert "config boom" in response.json()["error"]


def test_health_check_normalizes_missing_status_from_db_flag(client_no_lifespan, monkeypatch):
    from src.mcp import gateway as gateway_module

    mock_engine = MagicMock()
    mock_engine.health_check = AsyncMock(return_value={"db_ok": False})
    monkeypatch.setattr(gateway_module, "get_memory_engine", lambda: mock_engine)

    response = client_no_lifespan.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["engine_health"]["memory"]["status"] == "error"


def test_health_check_non_dict_health_treated_as_ok(client_no_lifespan, monkeypatch):
    from src.mcp import gateway as gateway_module

    mock_engine = MagicMock()
    mock_engine.health_check = AsyncMock(return_value="ok")
    monkeypatch.setattr(gateway_module, "get_memory_engine", lambda: mock_engine)

    response = client_no_lifespan.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["engine_health"]["memory"]["status"] == "ok"


def test_health_check_db_ok_true_normalized_to_ok(client_no_lifespan, monkeypatch):
    from src.mcp import gateway as gateway_module

    mock_engine = MagicMock()
    mock_engine.health_check = AsyncMock(return_value={"db_ok": True})
    monkeypatch.setattr(gateway_module, "get_memory_engine", lambda: mock_engine)

    response = client_no_lifespan.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["engine_health"]["memory"]["status"] == "ok"


def test_health_check_engine_without_health_check_treated_as_ok(client_no_lifespan, monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(gateway_module, "get_graph_engine", lambda: object())

    response = client_no_lifespan.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["engine_health"]["graph"]["status"] == "ok"


def test_with_terminal_contract_sets_defaults():
    from src.mcp import gateway as gateway_module

    result = gateway_module._with_terminal_contract({"status": "completed"})
    assert result["decision"] == "go"
    assert result["terminal"] == "done"
    assert result["terminal_state"] == "done"
    assert result["legacy_contract_fields"]["decision"] == "go"


def test_with_terminal_contract_maps_legacy_terminal_values():
    from src.mcp import gateway as gateway_module

    interrupted = gateway_module._with_terminal_contract({"terminal": "interrupted", "decision": "no_go"})
    assert interrupted["legacy_contract_fields"]["terminal"] == "aborted"
    assert interrupted["terminal_state"] == "aborted"

    recovered = gateway_module._with_terminal_contract({"terminal": "recovered", "decision": "soft_go"})
    assert recovered["legacy_contract_fields"]["terminal"] == "done"
    assert recovered["terminal_state"] == "done"


def test_adaptive_chunk_content_variants():
    from src.mcp import gateway as gateway_module

    assert gateway_module.adaptive_chunk_content("") == []

    content = "第一句。第二句！第三句？第四句。"
    chunks = gateway_module.adaptive_chunk_content(content, max_chunk_size=8, min_chunk_size=2)
    assert chunks
    assert "".join(chunks) == content

    long_content = "A" * 30
    long_chunks = gateway_module.adaptive_chunk_content(long_content, max_chunk_size=10, min_chunk_size=2)
    assert all(len(c) <= 10 for c in long_chunks)
    assert "".join(long_chunks) == long_content


def test_adaptive_chunk_content_keeps_small_prefix_when_overflow():
    from src.mcp import gateway as gateway_module

    content = "ab。cdefghijk"
    chunks = gateway_module.adaptive_chunk_content(content, max_chunk_size=5, min_chunk_size=4)

    assert chunks == [content]


def test_adaptive_chunk_content_hits_sentence_boundary_and_no_tail(monkeypatch):
    from src.mcp import gateway as gateway_module

    class _FakeRegex:
        def split(self, _content):
            return ["abc!"]

        def match(self, _part):
            return False

    monkeypatch.setattr(gateway_module.re, "compile", lambda _pattern: _FakeRegex())

    chunks = gateway_module.adaptive_chunk_content("ignored", max_chunk_size=20, min_chunk_size=2)

    assert chunks == ["abc!"]


def test_chat_endpoint_rejects_invalid_workflow_level(client_no_lifespan):
    response = client_no_lifespan.post("/chat", json={
        "workflowLevel": "L9",
        "messages": [{"role": "user", "content": "test"}],
    })
    assert response.status_code == 400


def test_chat_endpoint_rejects_no_user_message(client_no_lifespan):
    response = client_no_lifespan.post("/chat", json={
        "messages": [{"role": "assistant", "content": "hello"}],
    })
    assert response.status_code == 400
    assert response.json()["error"] == "No user message found"


def test_chat_stream_endpoint_rejects_invalid_workflow_level(client_no_lifespan):
    response = client_no_lifespan.post("/chat/stream", json={
        "workflowLevel": "L99",
        "messages": [{"role": "user", "content": "test"}],
    })
    assert response.status_code == 400


def test_chat_stream_endpoint_rejects_no_messages(client_no_lifespan):
    response = client_no_lifespan.post("/chat/stream", json={"messages": []})
    assert response.status_code == 400
    assert response.json()["error"] == "No messages provided"


# ============================================================
# REST compatibility endpoints and gateway lifecycle
# ============================================================

import contextlib
import json
import runpy
import sys
import types
from starlette.requests import Request


async def _json_request(path: str, payload: dict | None = None, query_string: str = "") -> Request:
    body = json.dumps(payload or {}).encode("utf-8")
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "query_string": query_string.encode("utf-8"),
        "headers": [(b"content-type", b"application/json")],
    }
    return Request(scope, receive)


async def _raw_request(path: str, body: bytes, content_type: bytes = b"application/json") -> Request:
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "query_string": b"",
        "headers": [(b"content-type", content_type)],
    }
    return Request(scope, receive)


def _get_raw_mcp_tool_function(mcp_obj, func_name: str):
    decorator = mcp_obj.tool.return_value
    for call in decorator.call_args_list:
        fn = call.args[0]
        if getattr(fn, "__name__", "") == func_name:
            return fn
    raise AssertionError(f"raw function not found for {func_name}")


@pytest.mark.asyncio
async def test_rest_memory_graph_and_critic_endpoints_forward_payload(monkeypatch):
    from src.mcp import gateway as gateway_module

    mock_memory_search = AsyncMock(return_value={"items": [1]})
    mock_memory_add = AsyncMock(return_value={"id": "m1"})
    mock_memory_temporal = AsyncMock(return_value={"facts": []})
    mock_graph_query = AsyncMock(return_value={"rows": []})
    mock_graph_character = AsyncMock(return_value={"name": "niko"})
    mock_graph_foreshadows = AsyncMock(return_value={"foreshadows": []})
    mock_critic_eval = AsyncMock(return_value={"score": 88})
    mock_critic_suggest = AsyncMock(return_value={"suggestions": ["x"]})

    monkeypatch.setattr(gateway_module, "memory_search", mock_memory_search)
    monkeypatch.setattr(gateway_module, "memory_add", mock_memory_add)
    monkeypatch.setattr(gateway_module, "memory_get_temporal", mock_memory_temporal)
    monkeypatch.setattr(gateway_module, "graph_query", mock_graph_query)
    monkeypatch.setattr(gateway_module, "graph_get_character", mock_graph_character)
    monkeypatch.setattr(gateway_module, "graph_get_foreshadows", mock_graph_foreshadows)
    monkeypatch.setattr(gateway_module, "evaluate_content", mock_critic_eval)
    monkeypatch.setattr(gateway_module, "get_improvement_suggestions", mock_critic_suggest)

    req = await _json_request("/memory/search", {"query": "q", "limit": 3})
    res = await gateway_module.memory_search_endpoint(req)
    assert res.status_code == 200
    mock_memory_search.assert_awaited_once_with(query="q", layer=None, dimensions=None, entity_id=None, at_time=None, limit=3)

    req = await _json_request("/memory/add", {"content": "c", "tags": ["t"]})
    res = await gateway_module.memory_add_endpoint(req)
    assert res.status_code == 200
    mock_memory_add.assert_awaited_once_with(content="c", layer="session", dimension=None, entity_id=None, valid_from=None, valid_until=None, importance=0.5, tags=["t"])

    req = await _json_request("/memory/temporal", {"entity_id": "e1"})
    res = await gateway_module.memory_temporal_endpoint(req)
    assert res.status_code == 200
    mock_memory_temporal.assert_awaited_once_with(entity_id="e1", at_time=None)

    req = await _json_request("/graph/query", {"cypher": "MATCH (n) RETURN n"})
    res = await gateway_module.graph_query_endpoint(req)
    assert res.status_code == 200
    mock_graph_query.assert_awaited_once_with(cypher="MATCH (n) RETURN n")

    req = await _json_request("/graph/character", {"name": "Niko", "include_relations": False})
    res = await gateway_module.graph_character_endpoint(req)
    assert res.status_code == 200
    mock_graph_character.assert_awaited_once_with(name="Niko", include_relations=False, include_timeline=False)

    req = await _json_request("/graph/foreshadows", {"chapter": "3"})
    res = await gateway_module.graph_foreshadows_endpoint(req)
    assert res.status_code == 200
    mock_graph_foreshadows.assert_awaited_once_with(status="pending", chapter="3")

    req = await _json_request("/critic/evaluate", {"content": "abc", "dimensions": ["logic"]})
    res = await gateway_module.critic_evaluate_endpoint(req)
    assert res.status_code == 200
    mock_critic_eval.assert_awaited_once_with(content="abc", scene_card=None, dimensions=["logic"])

    req = await _json_request("/critic/suggestions", {"content": "abc", "max_suggestions": 2})
    res = await gateway_module.critic_suggestions_endpoint(req)
    assert res.status_code == 200
    mock_critic_suggest.assert_awaited_once_with(content="abc", issues=None, max_suggestions=2)


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_forwards_to_evaluator(monkeypatch):
    from src.mcp import gateway as gateway_module
    from src.workflow.levels.types import ANALYSIS_SCHEMA_VERSION

    mock_eval = MagicMock(return_value={
        "analysis_schema_version": ANALYSIS_SCHEMA_VERSION,
        "quality_score": 88.0,
        "issues": [],
        "metrics": {
            "dialogue_ratio": 0.2,
            "conflict_points": 3,
            "visual_details": 5,
            "template_sentence_ratio": 0.1,
            "dimension_scores": {
                "repetition": 90.0,
                "tone": 85.0,
                "clarity": 88.0,
                "causality": 84.0,
                "detail": 82.0,
                "factuality": 90.0,
            },
        },
        "publish_recommendation": "pass",
    })
    monkeypatch.setattr(gateway_module, "evaluate_novel_quality", mock_eval)

    req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 200
    mock_eval.assert_called_once_with("valid body")


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_normalizes_missing_contract_fields(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(
        gateway_module,
        "evaluate_novel_quality",
        MagicMock(return_value={"quality_score": "72.5", "metrics": {"dialogue_ratio": "0.25"}}),
    )

    req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 200
    data = json.loads(res.body.decode("utf-8"))

    assert set(data.keys()) == {
        "analysis_schema_version",
        "quality_score",
        "issues",
        "metrics",
        "publish_recommendation",
    }
    assert isinstance(data["quality_score"], float)
    assert data["publish_recommendation"] in {"pass", "revise", "block"}

    metrics = data["metrics"]
    assert set(metrics.keys()) == {
        "dialogue_ratio",
        "conflict_points",
        "visual_details",
        "template_sentence_ratio",
        "dimension_scores",
    }
    assert isinstance(metrics["conflict_points"], int)
    assert isinstance(metrics["visual_details"], int)
    assert isinstance(metrics["template_sentence_ratio"], float)

    dim_scores = metrics["dimension_scores"]
    assert set(dim_scores.keys()) == {
        "repetition",
        "tone",
        "clarity",
        "causality",
        "detail",
        "factuality",
    }


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_maps_legacy_decision_fields(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(
        gateway_module,
        "evaluate_novel_quality",
        MagicMock(return_value={"decision_result": "no_go", "metrics": {}, "issues": []}),
    )

    req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 200
    data = json.loads(res.body.decode("utf-8"))
    assert data["publish_recommendation"] == "block"


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_accepts_contract_version_alias(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(
        gateway_module,
        "evaluate_novel_quality",
        MagicMock(return_value={"contract_version": "legacy-v1", "metrics": {}, "issues": []}),
    )

    req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 200
    data = json.loads(res.body.decode("utf-8"))
    assert data["analysis_schema_version"] == "legacy-v1"


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_maps_more_legacy_decision_aliases(monkeypatch):
    from src.mcp import gateway as gateway_module

    scenarios = [
        ({"decision_result": "approved", "metrics": {}, "issues": []}, "pass"),
        ({"decision": "rewrite", "metrics": {}, "issues": []}, "block"),
        ({"decision": "human_review", "metrics": {}, "issues": []}, "block"),
        ({"decision_result": "soft_go", "metrics": {}, "issues": []}, "revise"),
        ({"decision_result": "unknown", "metrics": {}, "issues": []}, "revise"),
    ]

    for payload, expected in scenarios:
        monkeypatch.setattr(
            gateway_module,
            "evaluate_novel_quality",
            MagicMock(return_value=payload),
        )

        req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
        res = await gateway_module.novel_quality_check_endpoint(req)

        assert res.status_code == 200
        data = json.loads(res.body.decode("utf-8"))
        assert data["publish_recommendation"] == expected


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_handles_non_dict_evaluator_payload(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(gateway_module, "evaluate_novel_quality", MagicMock(return_value="invalid"))

    req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 200
    data = json.loads(res.body.decode("utf-8"))
    assert data["quality_score"] == 0.0
    assert data["publish_recommendation"] == "revise"


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_normalizes_issue_item_fields(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(
        gateway_module,
        "evaluate_novel_quality",
        MagicMock(
            return_value={
                "quality_score": 66,
                "issues": [
                    {"severity": 1, "type": None, "evidence": 404, "suggestion": False},
                    {"severity": "  CRITICAL  ", "type": "  ", "evidence": "  note  ", "suggestion": "   "},
                    "skip-me",
                ],
                "metrics": {},
            }
        ),
    )

    req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 200
    data = json.loads(res.body.decode("utf-8"))
    assert data["issues"] == [
        {
            "severity": "medium",
            "type": "unknown",
            "evidence": "404",
            "suggestion": "False",
        },
        {
            "severity": "medium",
            "type": "unknown",
            "evidence": "note",
            "suggestion": "",
        },
    ]


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_clamps_numeric_ranges(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(
        gateway_module,
        "evaluate_novel_quality",
        MagicMock(
            return_value={
                "quality_score": 133,
                "issues": [],
                "metrics": {
                    "dialogue_ratio": 3,
                    "conflict_points": -4,
                    "visual_details": -2,
                    "template_sentence_ratio": -0.4,
                    "dimension_scores": {
                        "repetition": 120,
                        "tone": -1,
                        "clarity": 40,
                        "causality": 101,
                        "detail": -7,
                        "factuality": 0,
                    },
                },
            }
        ),
    )

    req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 200
    data = json.loads(res.body.decode("utf-8"))
    assert data["quality_score"] == 100.0

    metrics = data["metrics"]
    assert metrics["dialogue_ratio"] == 1.0
    assert metrics["template_sentence_ratio"] == 0.0
    assert metrics["conflict_points"] == 0
    assert metrics["visual_details"] == 0

    dim_scores = metrics["dimension_scores"]
    assert dim_scores["repetition"] == 100.0
    assert dim_scores["tone"] == 0.0
    assert dim_scores["clarity"] == 40.0
    assert dim_scores["causality"] == 100.0
    assert dim_scores["detail"] == 0.0
    assert dim_scores["factuality"] == 0.0


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_normalizes_recommendation_casing_and_priority(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(
        gateway_module,
        "evaluate_novel_quality",
        MagicMock(
            return_value={
                "publish_recommendation": "  PASS  ",
                "decision": "no_go",
                "metrics": {},
                "issues": [],
            }
        ),
    )

    req = await _json_request("/api/novel/quality-check", {"content": "valid body"})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 200
    data = json.loads(res.body.decode("utf-8"))
    assert data["publish_recommendation"] == "pass"


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_rejects_invalid_json_body():
    from src.mcp import gateway as gateway_module

    req = await _raw_request("/api/novel/quality-check", b"{not-json")
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 400
    assert b"content is required" in res.body


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_rejects_non_object_json_body():
    from src.mcp import gateway as gateway_module

    req = await _raw_request("/api/novel/quality-check", b"[1,2,3]")
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 400
    assert b"content is required" in res.body


@pytest.mark.asyncio
async def test_novel_quality_check_endpoint_rejects_empty_content():
    from src.mcp import gateway as gateway_module

    req = await _json_request("/api/novel/quality-check", {"content": "   "})
    res = await gateway_module.novel_quality_check_endpoint(req)

    assert res.status_code == 400
    assert b"content is required" in res.body


def test_novel_quality_check_route_smoke():
    from src.mcp import gateway as gateway_module

    app = gateway_module.create_gateway()
    routes = {getattr(route, "path", None) for route in app.app.routes}
    assert "/api/novel/quality-check" in routes


@pytest.mark.asyncio
async def test_rest_workflow_agent_and_skills_endpoints_forward_payload(monkeypatch):
    from src.mcp import gateway as gateway_module

    mock_workflow_route = AsyncMock(return_value={"level": "L3"})
    mock_workflow_plan = AsyncMock(return_value={"plan_id": "p1"})
    mock_workflow_execute = AsyncMock(return_value={"status": "ok"})
    mock_quick_rollback = AsyncMock(return_value={"status": "rolled_back"})
    mock_checkpoint_create = AsyncMock(return_value={"checkpoint_id": "cp1"})
    mock_checkpoint_restore = AsyncMock(return_value={"status": "restored"})
    mock_checkpoint_list = AsyncMock(return_value={"checkpoints": []})
    mock_agent_route = AsyncMock(return_value={"route": "writer"})
    mock_agent_write = AsyncMock(return_value={"content": "x"})
    mock_agent_revise = AsyncMock(return_value={"content": "y"})
    mock_agent_context = AsyncMock(return_value={"ctx": []})
    mock_skills_list = AsyncMock(return_value=[{"id": "s1"}])
    mock_skills_load = AsyncMock(return_value={"skill_id": "s1"})
    mock_skills_match = AsyncMock(return_value=["s1"])
    mock_skills_chain = AsyncMock(return_value=[{"skill_id": "s1"}])

    monkeypatch.setattr(gateway_module, "workflow_route", mock_workflow_route)
    monkeypatch.setattr(gateway_module, "workflow_plan", mock_workflow_plan)
    monkeypatch.setattr(gateway_module, "workflow_execute", mock_workflow_execute)
    monkeypatch.setattr(gateway_module, "workflow_quick_rollback", mock_quick_rollback)
    monkeypatch.setattr(gateway_module, "checkpoint_create", mock_checkpoint_create)
    monkeypatch.setattr(gateway_module, "checkpoint_restore", mock_checkpoint_restore)
    monkeypatch.setattr(gateway_module, "checkpoint_list", mock_checkpoint_list)
    monkeypatch.setattr(gateway_module, "agent_route", mock_agent_route)
    monkeypatch.setattr(gateway_module, "agent_write", mock_agent_write)
    monkeypatch.setattr(gateway_module, "agent_revise", mock_agent_revise)
    monkeypatch.setattr(gateway_module, "agent_get_context", mock_agent_context)
    monkeypatch.setattr(gateway_module, "skills_list", mock_skills_list)
    monkeypatch.setattr(gateway_module, "skills_load", mock_skills_load)
    monkeypatch.setattr(gateway_module, "skills_match", mock_skills_match)
    monkeypatch.setattr(gateway_module, "skills_get_chain", mock_skills_chain)

    req = await _json_request("/workflow/route", {"task": "write"})
    assert (await gateway_module.workflow_route_endpoint(req)).status_code == 200
    mock_workflow_route.assert_awaited_once_with(task="write")

    req = await _json_request("/workflow/plan", {"task": "write", "level": "L3", "recommendations": ["r"]})
    assert (await gateway_module.workflow_plan_endpoint(req)).status_code == 200
    mock_workflow_plan.assert_awaited_once_with(task="write", level="L3", recommendations=["r"])

    req = await _json_request("/workflow/execute", {"plan_id": "p1", "step_id": "s1", "confirm_token": "t"})
    assert (await gateway_module.workflow_execute_endpoint(req)).status_code == 200
    mock_workflow_execute.assert_awaited_once_with(plan_id="p1", step_id="s1", recommendations=None, confirm_token="t")

    req = await _json_request("/workflow/quick-rollback", {"plan_id": "p1", "checkpoint_id": "cp1", "reason": "rollback"})
    assert (await gateway_module.workflow_quick_rollback_endpoint(req)).status_code == 200
    mock_quick_rollback.assert_awaited_once_with(plan_id="p1", checkpoint_id="cp1", reason="rollback")

    req = await _json_request("/workflow/checkpoint/create", {"description": "d", "auto_commit": False})
    assert (await gateway_module.checkpoint_create_endpoint(req)).status_code == 200
    mock_checkpoint_create.assert_awaited_once_with(description="d", auto_commit=False)

    req = await _json_request("/workflow/checkpoint/restore", {"checkpoint_id": "cp1"})
    assert (await gateway_module.checkpoint_restore_endpoint(req)).status_code == 200
    mock_checkpoint_restore.assert_awaited_once_with(checkpoint_id="cp1", confirm_token=None)

    req = await _json_request("/workflow/checkpoint/list", {"limit": 3})
    assert (await gateway_module.checkpoint_list_endpoint(req)).status_code == 200
    mock_checkpoint_list.assert_awaited_once_with(limit=3)

    req = await _json_request("/agent/route", {"task": "scene"})
    assert (await gateway_module.agent_route_endpoint(req)).status_code == 200
    mock_agent_route.assert_awaited_once_with(task="scene")

    req = await _json_request("/agent/write", {"scene_card": {"id": "s"}, "word_target": 300})
    assert (await gateway_module.agent_write_endpoint(req)).status_code == 200
    mock_agent_write.assert_awaited_once_with(scene_card={"id": "s"}, skills=None, word_target=300, allow_llm_fallback=True)

    req = await _json_request("/agent/revise", {"draft": "d", "feedback": {"x": 1}, "allow_llm_fallback": False})
    assert (await gateway_module.agent_revise_endpoint(req)).status_code == 200
    mock_agent_revise.assert_awaited_once_with(draft="d", feedback={"x": 1}, allow_llm_fallback=False)

    req = await _json_request("/agent/context", {"scene_info": {"chapter": 1}, "context_types": ["memory"]})
    assert (await gateway_module.agent_context_endpoint(req)).status_code == 200
    mock_agent_context.assert_awaited_once_with(scene_info={"chapter": 1}, context_types=["memory"])

    req = await _json_request("/skills/list", query_string="category=dialogue")
    assert (await gateway_module.skills_list_endpoint(req)).status_code == 200
    mock_skills_list.assert_awaited_once_with(category="dialogue")

    req = await _json_request("/skills/load", {"skill_id": "s1"})
    assert (await gateway_module.skills_load_endpoint(req)).status_code == 200
    mock_skills_load.assert_awaited_once_with(skill_id="s1")

    req = await _json_request("/skills/match", {"task_type": "dialogue", "keywords": ["talk"]})
    assert (await gateway_module.skills_match_endpoint(req)).status_code == 200
    mock_skills_match.assert_awaited_once_with(task_type="dialogue", keywords=["talk"], issue=None)

    req = await _json_request("/skills/chain", {"task_type": "dialogue"})
    assert (await gateway_module.skills_chain_endpoint(req)).status_code == 200
    mock_skills_chain.assert_awaited_once_with(task_type="dialogue")


@pytest.mark.asyncio
async def test_create_gateway_lifespan_starts_services_and_prewarms(monkeypatch):
    from src.mcp import gateway as gateway_module

    class _DummySessionManager:
        def __init__(self, tracker):
            self._tracker = tracker

        @contextlib.asynccontextmanager
        async def run(self):
            self._tracker.append("enter")
            yield
            self._tracker.append("exit")

    class _DummyMCP:
        def __init__(self, tracker):
            self.settings = SimpleNamespace(streamable_http_path=None)
            self.session_manager = _DummySessionManager(tracker)

        def streamable_http_app(self):
            async def _app(scope, receive, send):
                return None
            return _app

    tracker = []
    dummy_mcps = [_DummyMCP(tracker) for _ in range(7)]
    monkeypatch.setattr(gateway_module, "memory_mcp", dummy_mcps[0])
    monkeypatch.setattr(gateway_module, "graph_mcp", dummy_mcps[1])
    monkeypatch.setattr(gateway_module, "search_mcp", dummy_mcps[2])
    monkeypatch.setattr(gateway_module, "workflow_mcp", dummy_mcps[3])
    monkeypatch.setattr(gateway_module, "critic_mcp", dummy_mcps[4])
    monkeypatch.setattr(gateway_module, "agent_mcp", dummy_mcps[5])
    monkeypatch.setattr(gateway_module, "skills_mcp", dummy_mcps[6])

    prewarm = AsyncMock(return_value=None)
    monkeypatch.setattr(gateway_module, "prewarm_engines", prewarm)

    app = gateway_module.create_gateway()
    inner = app.app

    async with inner.router.lifespan_context(inner):
        pass

    assert prewarm.await_count == 1
    assert tracker.count("enter") == 7
    assert tracker.count("exit") == 7
    assert all(mcp.settings.streamable_http_path == "/" for mcp in dummy_mcps)


def test_gateway_main_invokes_uvicorn_with_resolved_settings(monkeypatch):
    monkeypatch.setenv("NIKO_GATEWAY_HOST", "127.0.0.1")
    monkeypatch.setenv("NIKO_GATEWAY_PORT", "9876")
    monkeypatch.setenv("NIKO_GATEWAY_RELOAD", "0")

    fake_uvicorn = types.SimpleNamespace(run=MagicMock())
    monkeypatch.setitem(sys.modules, "uvicorn", fake_uvicorn)

    runpy.run_module("src.mcp.gateway", run_name="__main__")

    assert fake_uvicorn.run.call_count == 1
    kwargs = fake_uvicorn.run.call_args.kwargs
    assert kwargs["host"] == "127.0.0.1"
    assert kwargs["port"] == 9876
    assert kwargs["reload"] is False


@pytest.mark.asyncio
async def test_evaluate_content_legacy_and_transformed_paths(monkeypatch):
    from src.mcp import gateway as gateway_module

    raw_evaluate_content = _get_raw_mcp_tool_function(gateway_module.critic_mcp, "evaluate_content")

    legacy_engine = MagicMock()
    legacy_engine.evaluate = AsyncMock(return_value={
        "total_score": 88,
        "lock_score": 30,
        "style_score": 31,
        "logic_score": 27,
        "actionable_feedback": "ok",
    })
    monkeypatch.setattr(gateway_module, "get_critic_engine", lambda: legacy_engine)

    legacy_result = await raw_evaluate_content("text", dimensions=["logic"])
    assert legacy_result["total_score"] == 88
    assert legacy_result["actionable_feedback"] == "ok"

    transformed_engine = MagicMock()
    transformed_engine.evaluate = AsyncMock(return_value={
        "overall_score": 8.3,
        "dimensions": {
            "dream": {"score": "2"},
            "voice": {"score": 3},
            "suspense": {"score": "bad"},
            "character": {"score": 4},
            "premise": {"score": 8},
        },
        "issues": ["a", "b", "c", "d"],
        "recommended_skills": ["skill-1"],
    })
    monkeypatch.setattr(gateway_module, "get_critic_engine", lambda: transformed_engine)

    transformed = await raw_evaluate_content("text")
    assert transformed["decision"] == "APPROVED"
    assert transformed["total_score"] == 83.0
    assert transformed["lock_score"] == 8.0
    assert transformed["style_score"] == 10.5
    assert transformed["logic_score"] == 10.0
    assert transformed["actionable_feedback"] == "a；b；c"
    assert transformed["suggestions"] == ["skill-1"]


@pytest.mark.asyncio
async def test_agent_route_and_agent_write_internal_paths(monkeypatch):
    from src.mcp import gateway as gateway_module

    raw_agent_route = _get_raw_mcp_tool_function(gateway_module.agent_mcp, "agent_route")
    raw_agent_write = _get_raw_mcp_tool_function(gateway_module.agent_mcp, "agent_write")

    assignment = MagicMock()
    assignment.model_dump = MagicMock(return_value={"agent_type": "writer"})
    commander = MagicMock()
    commander.route = MagicMock(return_value="L4")
    commander.detect_scene_type = MagicMock(return_value=SimpleNamespace(value="dialogue"))
    commander.dispatch_skills = MagicMock(return_value=["dialogue-system"])
    commander.dispatch_tasks = MagicMock(return_value=[assignment])
    monkeypatch.setattr(gateway_module, "get_commander_agent", lambda: commander)

    route_result = await raw_agent_route("write scene")
    assert route_result["workflow_level"] == "L4"
    assert route_result["workflow_level_slug"] == "brainstorm"
    assert route_result["dispatched_skills"] == ["dialogue-system"]
    assert route_result["task_assignments"] == [{"agent_type": "writer"}]

    fake_writer_module = types.ModuleType("src.agents.writer")

    class _WriterInput:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    fake_writer_module.WriterInput = _WriterInput
    fake_writer_module.WriterAgent = object
    monkeypatch.setitem(sys.modules, "src.agents.writer", fake_writer_module)

    writer_agent = MagicMock()
    writer_agent.inject_skills = MagicMock()
    writer_agent.write = AsyncMock(return_value=SimpleNamespace(
        content="generated",
        wordcount=321,
        sensory_types_used=["visual"],
        forbidden_words_found=[],
        sections_needing_review=["tail"],
    ))
    monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: writer_agent)

    write_result = await raw_agent_write(
        scene_card={"pov_character": "Niko"},
        skills=["dialogue-system"],
        word_target=300,
        allow_llm_fallback=False,
    )
    assert write_result["content"] == "generated"
    writer_agent.inject_skills.assert_called_once_with(["dialogue-system"])

    write_call = writer_agent.write.await_args
    writer_input = write_call.args[0]
    assert writer_input.scene_id == "CH01-SC01"
    assert writer_input.chapter_num == 1
    assert writer_input.pov_character == "Niko"
    assert writer_input.word_target == 300
    assert write_call.kwargs["allow_llm_fallback"] is False


@pytest.mark.asyncio
async def test_agent_get_context_selective_and_default_paths(monkeypatch):
    from src.mcp import gateway as gateway_module

    raw_agent_get_context = _get_raw_mcp_tool_function(gateway_module.agent_mcp, "agent_get_context")

    def _ctx_module(module_name: str, key: str):
        module = types.ModuleType(module_name)

        class _Agent:
            async def get_context(self, _scene_info):
                return SimpleNamespace(model_dump=lambda: {key: True})

        if key == "world":
            module.WorldbuildingAgent = _Agent
        elif key == "character":
            module.CharacterAgent = _Agent
        else:
            module.PlotAgent = _Agent
        return module

    monkeypatch.setitem(sys.modules, "src.agents.worldbuilding", _ctx_module("src.agents.worldbuilding", "world"))
    monkeypatch.setitem(sys.modules, "src.agents.character", _ctx_module("src.agents.character", "character"))
    monkeypatch.setitem(sys.modules, "src.agents.plot", _ctx_module("src.agents.plot", "plot"))

    selective = await raw_agent_get_context({"chapter": 1}, context_types=["world", "plot"])
    assert selective == {"world": {"world": True}, "plot": {"plot": True}}

    all_context = await raw_agent_get_context({"chapter": 1}, context_types=None)
    assert all_context["world"]["world"] is True
    assert all_context["character"]["character"] is True
    assert all_context["plot"]["plot"] is True


@pytest.mark.asyncio
async def test_skills_internal_paths_cover_filter_match_load_and_chain(monkeypatch):
    from src.mcp import gateway as gateway_module

    raw_skills_list = _get_raw_mcp_tool_function(gateway_module.skills_mcp, "skills_list")
    raw_skills_match = _get_raw_mcp_tool_function(gateway_module.skills_mcp, "skills_match")
    raw_skills_load = _get_raw_mcp_tool_function(gateway_module.skills_mcp, "skills_load")
    raw_skills_get_chain = _get_raw_mcp_tool_function(gateway_module.skills_mcp, "skills_get_chain")

    fake_skill_router_module = types.ModuleType("src.agents.skill_router")

    class _TaskType(str):
        def __new__(cls, value):
            if value not in {"dialogue", "climax"}:
                raise ValueError("invalid task type")
            return str.__new__(cls, value)

    class _Router:
        def list_all_skills(self):
            return {
                "s1": {"name": "Skill 1", "description": "d1", "keywords": ["k1"], "category": "dialogue"},
                "s2": {"name": "Skill 2", "description": "d2", "keywords": ["k2"], "category": "plot"},
            }

        def route_by_task_type(self, task_type):
            return [SimpleNamespace(skill_id="s1", skill_name="Skill 1", relevance=0.9, reason=f"task:{task_type}", priority=1)]

        def route_by_keywords(self, keywords):
            return [SimpleNamespace(skill_id="s2", skill_name="Skill 2", relevance=0.8, reason=",".join(keywords), priority=2)]

        def route_by_issue(self, issue):
            return [SimpleNamespace(skill_id="s3", skill_name="Skill 3", relevance=0.7, reason=issue, priority=3)]

        def get_skill_chain(self, task_type):
            return [SimpleNamespace(skill_id="s1", skill_name="Skill 1", reason="chain", priority=1)]

    fake_skill_router_module.SkillRouter = _Router
    fake_skill_router_module.TaskType = _TaskType
    monkeypatch.setitem(sys.modules, "src.agents.skill_router", fake_skill_router_module)

    listed = await raw_skills_list(category="dialogue")
    assert listed == [{"id": "s1", "name": "Skill 1", "description": "d1", "keywords": ["k1"]}]

    matched_by_task = await raw_skills_match(task_type="dialogue")
    assert matched_by_task[0]["skill_id"] == "s1"

    matched_invalid_task = await raw_skills_match(task_type="invalid")
    assert matched_invalid_task == []

    matched_keywords = await raw_skills_match(keywords=["urgent", "tone"])
    assert matched_keywords[0]["skill_id"] == "s2"

    matched_issue = await raw_skills_match(issue="need stronger climax")
    assert matched_issue[0]["skill_id"] == "s3"

    matched_none = await raw_skills_match()
    assert matched_none == []

    fake_loader_module = types.ModuleType("src.skills.skill_loader")

    class _Loader:
        def load_skill(self, skill_id):
            if skill_id == "s1":
                return {"content": "content", "metadata": {"m": 1}}
            return None

    fake_loader_module.SkillLoader = _Loader
    monkeypatch.setitem(sys.modules, "src.skills.skill_loader", fake_loader_module)

    loaded = await raw_skills_load("s1")
    assert loaded["id"] == "s1"
    assert loaded["content"] == "content"

    missing = await raw_skills_load("missing")
    assert missing["error"] == "Skill 'missing' not found"

    chain_ok = await raw_skills_get_chain("dialogue")
    assert chain_ok == [{"skill_id": "s1", "skill_name": "Skill 1", "step": 1, "reason": "chain"}]



@pytest.mark.asyncio
async def test_internal_raw_mcp_wrappers_cover_engine_delegation(monkeypatch):
    from src.mcp import gateway as gateway_module

    raw_memory_add = _get_raw_mcp_tool_function(gateway_module.memory_mcp, "memory_add")
    raw_memory_search = _get_raw_mcp_tool_function(gateway_module.memory_mcp, "memory_search")
    raw_memory_temporal = _get_raw_mcp_tool_function(gateway_module.memory_mcp, "memory_get_temporal")
    raw_memory_conflicts = _get_raw_mcp_tool_function(gateway_module.memory_mcp, "memory_get_conflicts")
    raw_memory_resolve = _get_raw_mcp_tool_function(gateway_module.memory_mcp, "memory_resolve_conflict")

    raw_graph_query = _get_raw_mcp_tool_function(gateway_module.graph_mcp, "graph_query")
    raw_graph_character = _get_raw_mcp_tool_function(gateway_module.graph_mcp, "graph_get_character")
    raw_graph_relationships = _get_raw_mcp_tool_function(gateway_module.graph_mcp, "graph_get_relationships")
    raw_graph_foreshadows = _get_raw_mcp_tool_function(gateway_module.graph_mcp, "graph_get_foreshadows")
    raw_graph_add_entity = _get_raw_mcp_tool_function(gateway_module.graph_mcp, "graph_add_entity")
    raw_graph_add_relation = _get_raw_mcp_tool_function(gateway_module.graph_mcp, "graph_add_relation")

    raw_search_hybrid = _get_raw_mcp_tool_function(gateway_module.search_mcp, "search_hybrid")
    raw_search_iterative = _get_raw_mcp_tool_function(gateway_module.search_mcp, "search_iterative")
    raw_search_context = _get_raw_mcp_tool_function(gateway_module.search_mcp, "search_context")

    raw_workflow_route = _get_raw_mcp_tool_function(gateway_module.workflow_mcp, "workflow_route")
    raw_workflow_plan = _get_raw_mcp_tool_function(gateway_module.workflow_mcp, "workflow_plan")
    raw_workflow_execute = _get_raw_mcp_tool_function(gateway_module.workflow_mcp, "workflow_execute")
    raw_workflow_quick_rollback = _get_raw_mcp_tool_function(gateway_module.workflow_mcp, "workflow_quick_rollback")
    raw_workflow_lifecycle = _get_raw_mcp_tool_function(gateway_module.workflow_mcp, "workflow_lifecycle")
    raw_checkpoint_create = _get_raw_mcp_tool_function(gateway_module.workflow_mcp, "checkpoint_create")
    raw_checkpoint_restore = _get_raw_mcp_tool_function(gateway_module.workflow_mcp, "checkpoint_restore")
    raw_checkpoint_list = _get_raw_mcp_tool_function(gateway_module.workflow_mcp, "checkpoint_list")

    raw_critic_suggestions = _get_raw_mcp_tool_function(gateway_module.critic_mcp, "get_improvement_suggestions")
    raw_compare_versions = _get_raw_mcp_tool_function(gateway_module.critic_mcp, "compare_versions")

    memory_engine = MagicMock()
    memory_engine.add = AsyncMock(return_value={"id": "m1"})
    memory_engine.search = AsyncMock(return_value=[])
    memory_engine.get_temporal_facts = AsyncMock(return_value=[])
    memory_engine.detect_conflicts = AsyncMock(return_value=[])
    memory_engine.resolve_conflict = AsyncMock(return_value={"status": "ok"})

    graph_engine = MagicMock()
    graph_engine.execute_cypher = AsyncMock(return_value=[])
    graph_engine.get_character = AsyncMock(return_value={})
    graph_engine.get_relationships = AsyncMock(return_value=[])
    graph_engine.get_foreshadows = AsyncMock(return_value=[])
    graph_engine.create_entity = AsyncMock(return_value={"id": "e1"})
    graph_engine.create_relation = AsyncMock(return_value={"status": "created"})

    search_engine = MagicMock()
    search_engine.hybrid_search = AsyncMock(return_value=[])
    search_engine.iterative_retrieve = AsyncMock(return_value={"answer": "ok"})
    search_engine.resolve_context = AsyncMock(return_value="resolved")

    workflow_engine = MagicMock()
    workflow_engine.route = AsyncMock(return_value={"level": "L3"})
    workflow_engine.plan = AsyncMock(return_value={"plan_id": "p1"})
    workflow_engine.execute = AsyncMock(return_value={"status": "ok"})
    workflow_engine.quick_rollback = AsyncMock(return_value={"status": "rolled_back"})
    workflow_engine.lifecycle = AsyncMock(return_value={"status": "running"})
    workflow_engine.create_checkpoint = AsyncMock(return_value={"checkpoint_id": "cp1"})
    workflow_engine.restore_checkpoint = AsyncMock(return_value={"status": "restored"})
    workflow_engine.list_checkpoints = AsyncMock(return_value=[])

    critic_engine = MagicMock()
    critic_engine.suggest_improvements = AsyncMock(return_value=[])
    critic_engine.compare = AsyncMock(return_value={"winner": "b"})

    monkeypatch.setattr(gateway_module, "get_memory_engine", lambda: memory_engine)
    monkeypatch.setattr(gateway_module, "get_graph_engine", lambda: graph_engine)
    monkeypatch.setattr(gateway_module, "get_search_engine", lambda: search_engine)
    monkeypatch.setattr(gateway_module, "get_workflow_engine", lambda: workflow_engine)
    monkeypatch.setattr(gateway_module, "get_critic_engine", lambda: critic_engine)

    container = MagicMock()
    container.initialize_all = AsyncMock(return_value=None)
    monkeypatch.setattr(gateway_module, "get_container", lambda: container)

    await gateway_module.prewarm_engines()
    container.initialize_all.assert_awaited_once()

    await raw_memory_add("content")
    await raw_memory_search("query")
    await raw_memory_temporal("entity")
    await raw_memory_conflicts("entity")
    await raw_memory_resolve("a", "b")

    await raw_graph_query("MATCH (n) RETURN n")
    await raw_graph_character("Niko")
    await raw_graph_relationships("Niko")
    await raw_graph_foreshadows()
    await raw_graph_add_entity("Character", "Niko")
    await raw_graph_add_relation("A", "B", "KNOWS")

    await raw_search_hybrid("query")
    await raw_search_iterative("query")
    await raw_search_context("@character:Niko")

    await raw_workflow_route("task")
    await raw_workflow_plan("task", level="L2", recommendations=["r1"])
    await raw_workflow_execute("p1", step_id="s1", recommendations=["r2"], confirm_token="token")
    await raw_workflow_quick_rollback("p1", "cp1", reason="rollback")
    await raw_workflow_lifecycle("p1", action="status")
    await raw_checkpoint_create(description="d", auto_commit=False)
    await raw_checkpoint_restore("cp1", confirm_token="token")
    await raw_checkpoint_list(3)

    await raw_critic_suggestions("draft", issues=["i1"], max_suggestions=2)
    await raw_compare_versions("a", "b")


@pytest.mark.asyncio
async def test_agent_route_handles_non_enum_intermediate_level(monkeypatch):
    from src.mcp import gateway as gateway_module
    from src.workflow.levels.types import WorkflowLevel

    raw_agent_route = _get_raw_mcp_tool_function(gateway_module.agent_mcp, "agent_route")

    assignment = MagicMock()
    assignment.model_dump = MagicMock(return_value={"agent_type": "writer"})
    commander = MagicMock()
    commander.route = MagicMock(return_value="L3")
    commander.detect_scene_type = MagicMock(return_value=SimpleNamespace(value="dialogue"))
    commander.dispatch_skills = MagicMock(return_value=[])
    commander.dispatch_tasks = MagicMock(return_value=[assignment])

    call_count = {"n": 0}

    def _from_label(value):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return "L3"
        return WorkflowLevel.L3_STANDARD

    monkeypatch.setattr(gateway_module, "get_commander_agent", lambda: commander)
    monkeypatch.setattr(WorkflowLevel, "from_label", staticmethod(_from_label))

    result = await raw_agent_route("write")
    assert result["workflow_level"] == "L3"


def test_with_terminal_contract_handles_missing_defaults_and_non_dict_legacy(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(gateway_module, "_with_contract", lambda payload: dict(payload))

    result = gateway_module._with_terminal_contract({"legacy_contract_fields": "invalid"})
    assert result["decision"] == "go"
    assert result["terminal"] == "done"
    assert result["legacy_contract_fields"]["terminal_state"] == "done"


def test_adaptive_chunk_content_flushes_and_finishes_without_tail():
    from src.mcp import gateway as gateway_module

    chunks = gateway_module.adaptive_chunk_content("abcd。", max_chunk_size=20, min_chunk_size=2)
    assert chunks == ["abcd。"]


@pytest.mark.asyncio
async def test_agent_write_and_revise_cover_no_skills_and_revise_return(monkeypatch):
    from src.mcp import gateway as gateway_module

    raw_agent_write = _get_raw_mcp_tool_function(gateway_module.agent_mcp, "agent_write")
    raw_agent_revise = _get_raw_mcp_tool_function(gateway_module.agent_mcp, "agent_revise")

    fake_writer_module = types.ModuleType("src.agents.writer")

    class _WriterInput:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    fake_writer_module.WriterInput = _WriterInput
    fake_writer_module.WriterAgent = object
    monkeypatch.setitem(sys.modules, "src.agents.writer", fake_writer_module)

    writer_agent = MagicMock()
    writer_agent.inject_skills = MagicMock()
    writer_agent.write = AsyncMock(return_value=SimpleNamespace(
        content="generated",
        wordcount=111,
        sensory_types_used=[],
        forbidden_words_found=[],
        sections_needing_review=[],
    ))
    writer_agent.revise = AsyncMock(return_value=SimpleNamespace(
        content="revised",
        wordcount=112,
        forbidden_words_found=["x"],
    ))
    monkeypatch.setattr(gateway_module, "get_writer_agent", lambda: writer_agent)

    write_result = await raw_agent_write(
        scene_card={"pov_character": "Niko"},
        skills=None,
        word_target=123,
        allow_llm_fallback=True,
    )
    assert write_result["content"] == "generated"
    writer_agent.inject_skills.assert_not_called()

    revise_result = await raw_agent_revise("draft", {"issues": ["i"]}, allow_llm_fallback=False)
    assert revise_result == {
        "content": "revised",
        "wordcount": 112,
        "forbidden_words_found": ["x"],
    }
    writer_agent.revise.assert_awaited_once_with("draft", {"issues": ["i"]}, allow_llm_fallback=False)


@pytest.mark.asyncio
async def test_agent_get_context_character_only_and_skills_chain_invalid(monkeypatch):
    from src.mcp import gateway as gateway_module

    raw_agent_get_context = _get_raw_mcp_tool_function(gateway_module.agent_mcp, "agent_get_context")
    raw_skills_get_chain = _get_raw_mcp_tool_function(gateway_module.skills_mcp, "skills_get_chain")

    def _ctx_module(module_name: str, key: str):
        module = types.ModuleType(module_name)

        class _Agent:
            async def get_context(self, _scene_info):
                return SimpleNamespace(model_dump=lambda: {key: True})

        if key == "world":
            module.WorldbuildingAgent = _Agent
        elif key == "character":
            module.CharacterAgent = _Agent
        else:
            module.PlotAgent = _Agent
        return module

    monkeypatch.setitem(sys.modules, "src.agents.worldbuilding", _ctx_module("src.agents.worldbuilding", "world"))
    monkeypatch.setitem(sys.modules, "src.agents.character", _ctx_module("src.agents.character", "character"))
    monkeypatch.setitem(sys.modules, "src.agents.plot", _ctx_module("src.agents.plot", "plot"))

    character_only = await raw_agent_get_context({"chapter": 1}, context_types=["character"])
    assert character_only == {"character": {"character": True}}

    fake_skill_router_module = types.ModuleType("src.agents.skill_router")

    class _TaskType(str):
        def __new__(cls, value):
            if value != "dialogue":
                raise ValueError("invalid task type")
            return str.__new__(cls, value)

    class _Router:
        def get_skill_chain(self, _task_type):
            return [SimpleNamespace(skill_id="s1", skill_name="Skill 1", reason="chain", priority=1)]

    fake_skill_router_module.SkillRouter = _Router
    fake_skill_router_module.TaskType = _TaskType
    monkeypatch.setitem(sys.modules, "src.agents.skill_router", fake_skill_router_module)

    assert await raw_skills_get_chain("invalid") == []
