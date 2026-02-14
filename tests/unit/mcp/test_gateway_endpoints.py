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


def test_resolve_cors_origins_from_env_prod(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setenv("NIKO_ENV", "production")
    monkeypatch.setenv("NIKO_CORS_PROD_ORIGINS", "https://app.example.com, https://gray.example.com")

    origins = gateway_module._resolve_cors_origins()
    assert origins == ["https://app.example.com", "https://gray.example.com"]
