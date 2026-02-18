# -*- coding: utf-8 -*-
"""Extra branch tests for WorldbuildingAgent."""

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.worldbuilding import WorldContext, WorldbuildingAgent


@pytest.mark.asyncio
async def test_get_context_logs_graph_warning_on_location_query_failure(monkeypatch):
    agent = WorldbuildingAgent(graph_engine=MagicMock(), memory_engine=None)

    async def boom(_location):
        raise RuntimeError("location boom")

    monkeypatch.setattr(agent, "_query_location", boom)

    with patch.object(agent, "log_activity") as log_activity:
        ctx = await agent.get_context({"location": "Castle", "time": ""})

    assert isinstance(ctx, WorldContext)
    assert ctx.location_details == {}
    assert ctx.settings == []
    assert any("Location query failed" in str(call.args[0]) for call in log_activity.call_args_list)


@pytest.mark.asyncio
async def test_get_context_logs_rules_warning_on_query_rules_failure(monkeypatch):
    agent = WorldbuildingAgent(graph_engine=None, memory_engine=MagicMock())

    async def boom(_location, _time_period):
        raise RuntimeError("rules boom")

    monkeypatch.setattr(agent, "_query_rules", boom)

    with patch.object(agent, "log_activity") as log_activity:
        ctx = await agent.get_context({"location": "Town", "time": "night"})

    assert isinstance(ctx, WorldContext)
    assert ctx.active_rules == []
    assert any("Rules query failed" in str(call.args[0]) for call in log_activity.call_args_list)


@pytest.mark.asyncio
async def test_query_location_without_graph_engine_returns_empty_dict(monkeypatch):
    agent = WorldbuildingAgent(graph_engine=MagicMock())
    monkeypatch.setattr(type(agent), "graph_engine", property(lambda _self: None))

    result = await agent._query_location("Village")

    assert result == {}


@pytest.mark.asyncio
async def test_query_location_returns_empty_when_query_raises():
    graph = MagicMock()
    graph.query.side_effect = RuntimeError("query fail")
    agent = WorldbuildingAgent(graph_engine=graph)

    result = await agent._query_location("Village")

    assert result == {}


@pytest.mark.asyncio
async def test_query_rules_without_memory_engine_returns_empty_list(monkeypatch):
    agent = WorldbuildingAgent(memory_engine=MagicMock())
    monkeypatch.setattr(type(agent), "memory_engine", property(lambda _self: None))

    result = await agent._query_rules("Village", "night")

    assert result == []


@pytest.mark.asyncio
async def test_query_rules_handles_location_and_time_search_failures():
    memory = MagicMock()
    memory.search = AsyncMock(side_effect=RuntimeError("search fail"))
    agent = WorldbuildingAgent(memory_engine=memory)

    result = await agent._query_rules("Village", "night")

    assert result == []


@pytest.mark.asyncio
async def test_validate_consistency_keyword_branch_executes_pass_statement():
    agent = WorldbuildingAgent()
    ctx = WorldContext(active_rules=["forbidden magic casting"])

    result = await agent.validate_consistency("magic is mentioned here", ctx)

    assert result["is_valid"] is True
    assert result["checked_rules"] == 1


def test_memory_engine_lazy_load_success_and_failure_paths():
    success_agent = WorldbuildingAgent(memory_engine=None)
    fake_memory_instance = object()
    fake_memory_module = types.ModuleType("src.memory.unified_memory")
    fake_memory_module.UnifiedMemoryEngine = lambda: fake_memory_instance

    with patch.dict(sys.modules, {"src.memory.unified_memory": fake_memory_module}):
        assert success_agent.memory_engine is fake_memory_instance
        assert success_agent.memory_engine is fake_memory_instance

    failure_agent = WorldbuildingAgent(memory_engine=None)
    broken_module = types.ModuleType("src.memory.unified_memory")

    with patch.dict(sys.modules, {"src.memory.unified_memory": broken_module}):
        with patch.object(failure_agent, "log_activity") as log_activity:
            assert failure_agent.memory_engine is None

    log_activity.assert_called_once()


def test_graph_engine_lazy_load_success_and_failure_paths():
    success_agent = WorldbuildingAgent(graph_engine=None)
    fake_graph_instance = object()
    fake_graph_module = types.ModuleType("src.graph.graph_engine")
    fake_graph_module.GraphEngine = lambda: fake_graph_instance

    with patch.dict(sys.modules, {"src.graph.graph_engine": fake_graph_module}):
        assert success_agent.graph_engine is fake_graph_instance
        assert success_agent.graph_engine is fake_graph_instance

    failure_agent = WorldbuildingAgent(graph_engine=None)
    broken_module = types.ModuleType("src.graph.graph_engine")

    with patch.dict(sys.modules, {"src.graph.graph_engine": broken_module}):
        with patch.object(failure_agent, "log_activity") as log_activity:
            assert failure_agent.graph_engine is None

    log_activity.assert_called_once()


def test_run_uses_asyncio_run_and_closes_coroutine():
    agent = WorldbuildingAgent()

    with patch("asyncio.run", return_value={"ok": True}) as run_mock:
        result = agent.run({"location": "Town"})

    assert result == {"ok": True}
    run_mock.assert_called_once()
    run_mock.call_args.args[0].close()
