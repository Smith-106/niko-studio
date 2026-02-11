"""
Gateway Endpoints Tests - Health and Tools

Tests for GET /health and GET /tools endpoints.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock


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
            assert data["services"][service] == "ok"

    def test_health_check_returns_engine_health(self, client_no_lifespan):
        """Test health check includes engine health details"""
        response = client_no_lifespan.get("/health")
        data = response.json()

        assert "engine_health" in data
        assert "memory" in data["engine_health"]
        assert "graph" in data["engine_health"]
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

    def test_health_check_engine_exception_degrades_to_ok(self, client_no_lifespan, monkeypatch):
        """Test health check degrades to ok when engine health_check raises"""
        from src.mcp import gateway as gateway_module

        mock_engine = MagicMock()
        mock_engine.health_check = AsyncMock(side_effect=RuntimeError("boom"))
        monkeypatch.setattr(gateway_module, "get_memory_engine", lambda: mock_engine)

        response = client_no_lifespan.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["engine_health"]["memory"]["status"] == "error"
        assert "boom" in data["engine_health"]["memory"]["error"]

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

        total_tools = sum(len(tools) for tools in data.values())
        assert total_tools == 31
