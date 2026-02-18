# -*- coding: utf-8 -*-
"""Extra branch tests for ServiceContainer."""

import asyncio
import sys
import types
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.container import ServiceContainer


def _plugin_config(enabled=False, modules=None):
    return SimpleNamespace(enabled=enabled, modules=modules or [])


@pytest.mark.asyncio
async def test_schedule_init_task_registers_task_in_running_loop():
    sc = ServiceContainer()

    async def init_fn():
        return None

    sc._schedule_init_task("engine", init_fn)

    assert "engine" in sc._init_tasks
    await sc._init_tasks["engine"]


def test_load_engine_plugins_success_path_instantiates_plugin():
    sc = ServiceContainer()
    fake_module = types.ModuleType("fake_plugins")

    class FakePlugin:
        pass

    fake_module.FakePlugin = FakePlugin

    with patch.dict(sys.modules, {"fake_plugins": fake_module}):
        plugins = sc._load_engine_plugins(_plugin_config(enabled=True, modules=["fake_plugins.FakePlugin"]))

    assert len(plugins) == 1
    assert isinstance(plugins[0], FakePlugin)


def test_engine_factories_memory_graph_critic_use_from_config():
    sc = ServiceContainer()

    fake_memory_module = types.ModuleType("src.memory.unified_memory")
    fake_graph_module = types.ModuleType("src.graph.graph_engine")
    fake_critic_module = types.ModuleType("src.narrative.critic_engine")

    memory_engine = object()
    graph_engine = object()
    critic_engine = object()

    class FakeUnifiedMemoryEngine:
        @staticmethod
        def from_config(plugins=None):
            return {"engine": memory_engine, "plugins": plugins}

    class FakeGraphEngine:
        @staticmethod
        def from_config(plugins=None):
            return {"engine": graph_engine, "plugins": plugins}

    class FakeCriticEngine:
        @staticmethod
        def from_config(plugins=None):
            return {"engine": critic_engine, "plugins": plugins}

    fake_memory_module.UnifiedMemoryEngine = FakeUnifiedMemoryEngine
    fake_graph_module.GraphEngine = FakeGraphEngine
    fake_critic_module.CriticEngine = FakeCriticEngine

    cfg = SimpleNamespace(
        memory_plugins=_plugin_config(enabled=False),
        graph_plugins=_plugin_config(enabled=False),
        critic_plugins=_plugin_config(enabled=False),
    )

    with (
        patch.object(sc, "_load_gateway_engine_config", return_value=cfg),
        patch.object(sc, "_load_engine_plugins", return_value=["p"]),
        patch.dict(
            sys.modules,
            {
                "src.memory.unified_memory": fake_memory_module,
                "src.graph.graph_engine": fake_graph_module,
                "src.narrative.critic_engine": fake_critic_module,
            },
        ),
    ):
        memory = sc.memory
        graph = sc.graph
        critic = sc.critic

    assert memory["plugins"] == ["p"]
    assert graph["plugins"] == ["p"]
    assert critic["plugins"] == ["p"]


def test_engine_factories_search_workflow_commander_backup_token_obsidian_construct_instances():
    sc = ServiceContainer()

    fake_search_module = types.ModuleType("src.search.iterative_retriever")
    fake_workflow_module = types.ModuleType("src.workflow.workflow_engine")
    fake_commander_module = types.ModuleType("src.agents.commander")
    fake_backup_module = types.ModuleType("src.services.backup_manager")
    fake_token_module = types.ModuleType("src.services.token_service")
    fake_obsidian_module = types.ModuleType("src.services.obsidian_service")

    class FakeIterativeRetriever:
        pass

    class FakeWorkflowEngine:
        pass

    class FakeCommanderAgent:
        def __init__(self, llm=None):
            self.llm = llm

    class FakeBackupManager:
        pass

    class FakeTokenService:
        pass

    class FakeObsidianService:
        pass

    fake_search_module.IterativeRetriever = FakeIterativeRetriever
    fake_workflow_module.WorkflowEngine = FakeWorkflowEngine
    fake_commander_module.CommanderAgent = FakeCommanderAgent
    fake_backup_module.BackupManager = FakeBackupManager
    fake_token_module.TokenService = FakeTokenService
    fake_obsidian_module.ObsidianService = FakeObsidianService

    with patch.dict(
        sys.modules,
        {
            "src.search.iterative_retriever": fake_search_module,
            "src.workflow.workflow_engine": fake_workflow_module,
            "src.agents.commander": fake_commander_module,
            "src.services.backup_manager": fake_backup_module,
            "src.services.token_service": fake_token_module,
            "src.services.obsidian_service": fake_obsidian_module,
        },
    ):
        assert isinstance(sc.search, FakeIterativeRetriever)
        assert isinstance(sc.workflow, FakeWorkflowEngine)
        assert isinstance(sc.commander, FakeCommanderAgent)
        assert isinstance(sc.backup, FakeBackupManager)
        assert isinstance(sc.token, FakeTokenService)
        assert isinstance(sc.obsidian, FakeObsidianService)


def test_writer_factory_google_failure_logs_warning_and_returns_writer_without_llm(monkeypatch):
    sc = ServiceContainer()

    fake_writer_module = types.ModuleType("src.agents.writer")
    fake_google_module = types.ModuleType("langchain_google_genai")

    class FakeWriterAgent:
        def __init__(self, llm=None):
            self.llm = llm

    class FakeChatGoogleGenerativeAI:
        def __init__(self, **_kwargs):
            raise RuntimeError("google init failed")

    fake_writer_module.WriterAgent = FakeWriterAgent
    fake_google_module.ChatGoogleGenerativeAI = FakeChatGoogleGenerativeAI

    fake_config = SimpleNamespace(agent=SimpleNamespace(google_api_key="gkey", openai_api_key=None, default_model=None))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with (
        patch("src.config.get_config", return_value=fake_config),
        patch.dict(sys.modules, {"src.agents.writer": fake_writer_module, "langchain_google_genai": fake_google_module}),
        patch("src.container.logger.warning") as warn_mock,
    ):
        writer = sc.writer

    assert isinstance(writer, FakeWriterAgent)
    assert writer.llm is None
    warn_mock.assert_called_once()


def test_writer_factory_openai_failure_logs_warning_and_returns_writer_without_llm(monkeypatch):
    sc = ServiceContainer()

    fake_writer_module = types.ModuleType("src.agents.writer")
    fake_openai_module = types.ModuleType("langchain_openai")

    class FakeWriterAgent:
        def __init__(self, llm=None):
            self.llm = llm

    class FakeChatOpenAI:
        def __init__(self, **_kwargs):
            raise RuntimeError("openai init failed")

    fake_writer_module.WriterAgent = FakeWriterAgent
    fake_openai_module.ChatOpenAI = FakeChatOpenAI

    fake_config = SimpleNamespace(agent=SimpleNamespace(google_api_key=None, openai_api_key="okey", default_model="model-x"))
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.example.com")

    with (
        patch("src.config.get_config", return_value=fake_config),
        patch.dict(sys.modules, {"src.agents.writer": fake_writer_module, "langchain_openai": fake_openai_module}),
        patch("src.container.logger.warning") as warn_mock,
    ):
        writer = sc.writer

    assert isinstance(writer, FakeWriterAgent)
    assert writer.llm is None
    warn_mock.assert_called_once()


@pytest.mark.asyncio
async def test_ensure_initialized_timeout_logs_warning_and_clears_done_task():
    sc = ServiceContainer()
    done_task = asyncio.get_running_loop().create_future()
    done_task.set_result(None)
    sc._init_tasks["memory"] = done_task

    with (
        patch("asyncio.wait_for", side_effect=asyncio.TimeoutError),
        patch("src.container.logger.warning") as warn_mock,
    ):
        await sc.ensure_initialized("memory", timeout=0.01)

    assert "memory" not in sc._init_tasks
    warn_mock.assert_called_once()


@pytest.mark.asyncio
async def test_initialize_all_triggers_prewarm_and_marks_initialized():
    sc = ServiceContainer()
    sc.ensure_initialized = AsyncMock(return_value=None)
    pending = asyncio.get_running_loop().create_future()
    pending.set_result(None)
    sc._init_tasks = {"memory": pending}

    with (
        patch.object(type(sc), "memory", new=property(lambda _s: object())),
        patch.object(type(sc), "graph", new=property(lambda _s: object())),
        patch.object(type(sc), "critic", new=property(lambda _s: object())),
        patch.object(type(sc), "search", new=property(lambda _s: object())),
        patch.object(type(sc), "workflow", new=property(lambda _s: object())),
    ):
        await sc.initialize_all()

    assert sc._initialized is True
    sc.ensure_initialized.assert_awaited_once()
