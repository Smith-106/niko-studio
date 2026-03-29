# -*- coding: utf-8 -*-
"""
ServiceContainer Tests

Tests for get_container, reset_container, ServiceContainer
(reset, register_mock, _get_or_create, _schedule_init_task,
_load_gateway_engine_config, _load_engine_plugins, engine properties,
ensure_initialized, initialize_all, AgentFactory integration).
"""

import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from src.container import (
    ServiceContainer,
    get_container,
    reset_container,
)
from src.agents.base import AgentType


@pytest.fixture(autouse=True)
def clean_container():
    """Reset global container before/after each test."""
    reset_container()
    yield
    reset_container()


# ============================================================
# Module-level functions
# ============================================================

class TestModuleFunctions:

    def test_get_container_creates_singleton(self):
        c1 = get_container()
        c2 = get_container()
        assert c1 is c2

    def test_reset_container(self):
        c1 = get_container()
        reset_container()
        c2 = get_container()
        assert c1 is not c2

    def test_reset_container_when_none(self):
        reset_container()  # Should not raise
        reset_container()


# ============================================================
# ServiceContainer basics
# ============================================================

class TestServiceContainerBasics:

    def test_init(self):
        sc = ServiceContainer()
        assert sc._engines == {}
        assert sc._mocks == {}
        assert sc._initialized is False

    def test_reset(self):
        sc = ServiceContainer()
        sc._engines["test"] = "engine"
        sc._mocks["test"] = "mock"
        sc._initialized = True
        # Add agent factory
        sc._agent_factory = MagicMock()
        sc._agent_factory.reset = MagicMock()
        sc.reset()
        assert sc._engines == {}
        assert sc._mocks == {}
        assert sc._initialized is False
        # Verify agent factory was reset
        sc._agent_factory.reset.assert_called_once()

    def test_reset_without_agent_factory(self):
        sc = ServiceContainer()
        sc._engines["test"] = "engine"
        sc._initialized = True
        sc._agent_factory = None
        sc.reset()  # Should not raise
        assert sc._engines == {}

    def test_register_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("memory", mock)
        assert sc._mocks["memory"] is mock

    def test_engines_initialized_property(self):
        sc = ServiceContainer()
        assert sc.engines_initialized is False
        sc._initialized = True
        assert sc.engines_initialized is True


# ============================================================
# _get_or_create
# ============================================================

class TestGetOrCreate:

    def test_creates_engine(self):
        sc = ServiceContainer()
        engine = MagicMock()
        engine.initialize = None  # No init method
        result = sc._get_or_create("test", lambda: engine)
        assert result is engine
        assert sc._engines["test"] is engine

    def test_returns_cached(self):
        sc = ServiceContainer()
        engine = MagicMock()
        engine.initialize = None
        sc._get_or_create("test", lambda: engine)
        # Factory should not be called again
        result = sc._get_or_create("test", lambda: MagicMock())
        assert result is engine

    def test_returns_mock_if_registered(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("test", mock)
        result = sc._get_or_create("test", lambda: MagicMock())
        assert result is mock

    def test_schedules_init_for_initializable_engine(self):
        sc = ServiceContainer()
        engine = MagicMock()
        engine.initialize = AsyncMock()
        with patch.object(sc, "_schedule_init_task") as mock_schedule:
            sc._get_or_create("test", lambda: engine)
            mock_schedule.assert_called_once_with("test", engine.initialize)


# ============================================================
# _schedule_init_task
# ============================================================

class TestScheduleInitTask:

    def test_no_running_loop(self):
        sc = ServiceContainer()
        # No running loop => should not raise
        sc._schedule_init_task("test", AsyncMock())
        assert "test" not in sc._init_tasks

    def test_skips_if_already_scheduled(self):
        sc = ServiceContainer()
        sc._init_tasks["test"] = MagicMock()
        sc._schedule_init_task("test", AsyncMock())
        # Should not overwrite


# ============================================================
# _load_engine_plugins
# ============================================================

class TestLoadEnginePlugins:

    def test_disabled_returns_empty(self):
        sc = ServiceContainer()
        from dataclasses import dataclass, field

        @dataclass
        class FakeConfig:
            enabled: bool = False
            modules: list = field(default_factory=list)

        result = sc._load_engine_plugins(FakeConfig())
        assert result == []

    def test_caches_plugins(self):
        sc = ServiceContainer()
        from dataclasses import dataclass, field

        @dataclass
        class FakeConfig:
            enabled: bool = True
            modules: list = field(default_factory=lambda: ["os.path"])

        with patch("builtins.__import__", side_effect=ImportError("test")):
            result = sc._load_engine_plugins(FakeConfig())
        # Should have empty list due to import error, but cached
        assert isinstance(result, list)

    def test_bad_module_logged(self):
        sc = ServiceContainer()
        from dataclasses import dataclass, field

        @dataclass
        class FakeConfig:
            enabled: bool = True
            modules: list = field(default_factory=lambda: ["nonexistent.module.Class"])

        result = sc._load_engine_plugins(FakeConfig())
        assert result == []


# ============================================================
# Engine properties with mocks
# ============================================================

class TestEnginePropertiesWithMocks:

    def test_memory_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("memory", mock)
        assert sc.memory is mock

    def test_graph_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("graph", mock)
        assert sc.graph is mock

    def test_search_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("search", mock)
        assert sc.search is mock

    def test_workflow_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("workflow", mock)
        assert sc.workflow is mock

    def test_critic_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("critic", mock)
        assert sc.critic is mock

    def test_commander_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock_agent(AgentType.COMMANDER, mock)
        assert sc.commander is mock

    def test_writer_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock_agent(AgentType.WRITER, mock)
        assert sc.writer is mock

    def test_backup_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("backup", mock)
        assert sc.backup is mock

    def test_token_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("token", mock)
        assert sc.token is mock

    def test_obsidian_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("obsidian", mock)
        assert sc.obsidian is mock


# ============================================================
# Async lifecycle
# ============================================================

class TestAsyncLifecycle:

    @pytest.mark.asyncio
    async def test_ensure_initialized_no_tasks(self):
        sc = ServiceContainer()
        await sc.ensure_initialized("memory")  # Should not raise

    @pytest.mark.asyncio
    async def test_ensure_initialized_with_task(self):
        sc = ServiceContainer()
        done_task = asyncio.get_event_loop().create_future()
        done_task.set_result(None)
        sc._init_tasks["test"] = done_task
        await sc.ensure_initialized("test")

    @pytest.mark.asyncio
    async def test_initialize_all_already_initialized(self):
        sc = ServiceContainer()
        sc._initialized = True
        await sc.initialize_all()  # Should return immediately

    @pytest.mark.asyncio
    async def test_reset_cancels_pending_tasks(self):
        sc = ServiceContainer()
        task = asyncio.get_event_loop().create_future()
        sc._init_tasks["test"] = task
        sc.reset()
        assert sc._init_tasks == {}


# ============================================================
# AgentFactory Integration
# ============================================================

class TestAgentFactoryIntegration:

    def test_agent_factory_property_creates_factory(self):
        sc = ServiceContainer()
        factory = sc.agent_factory
        assert factory is not None
        assert hasattr(factory, 'get_agent')

    def test_agent_factory_lazy_initialization(self):
        sc = ServiceContainer()
        # Factory should not exist initially
        assert sc._agent_factory is None
        # Access property to trigger lazy init
        factory = sc.agent_factory
        assert sc._agent_factory is factory
        # Second access returns same instance
        factory2 = sc.agent_factory
        assert factory is factory2

    def test_get_agent_commander(self):
        sc = ServiceContainer()
        agent = sc.get_agent(AgentType.COMMANDER)
        assert agent is not None
        # CommanderAgent has an llm attribute
        assert hasattr(agent, 'llm')

    def test_get_agent_writer(self):
        sc = ServiceContainer()
        agent = sc.get_agent(AgentType.WRITER)
        assert agent is not None
        # WriterAgent has an llm attribute
        assert hasattr(agent, 'llm')

    def test_get_agent_caches_instance(self):
        sc = ServiceContainer()
        agent1 = sc.get_agent(AgentType.COMMANDER)
        agent2 = sc.get_agent(AgentType.COMMANDER)
        assert agent1 is agent2

    def test_get_agent_with_custom_name(self):
        sc = ServiceContainer()
        agent = sc.get_agent(AgentType.PLOT, name="custom_plot")
        assert agent is not None
        assert agent.name == "custom_plot"

    def test_get_agent_with_custom_config(self):
        sc = ServiceContainer()
        config = {"model": "gpt-4", "temperature": 0.5}
        agent = sc.get_agent(AgentType.PLOT, config=config)
        assert agent is not None
        assert agent.config == config

    def test_register_mock_agent(self):
        sc = ServiceContainer()
        mock_agent = MagicMock()
        mock_agent.run = MagicMock(return_value="mocked result")

        sc.register_mock_agent(AgentType.COMMANDER, mock_agent)

        # get_agent should return mock
        agent = sc.get_agent(AgentType.COMMANDER)
        assert agent is mock_agent
        assert agent.run() == "mocked result"

    def test_commander_property_uses_factory(self):
        sc = ServiceContainer()
        commander = sc.commander
        assert commander is not None
        # Should be cached
        commander2 = sc.commander
        assert commander is commander2

    def test_writer_property_uses_factory(self):
        sc = ServiceContainer()
        writer = sc.writer
        assert writer is not None
        # Should be cached
        writer2 = sc.writer
        assert writer is writer2

    def test_reset_clears_agent_factory_cache(self):
        sc = ServiceContainer()
        # Create some agents
        sc.get_agent(AgentType.COMMANDER)
        factory = sc.agent_factory
        assert len(factory.get_cached_types()) == 1

        # Reset
        sc.reset()

        # Factory should be cleared
        assert len(factory.get_cached_types()) == 0
