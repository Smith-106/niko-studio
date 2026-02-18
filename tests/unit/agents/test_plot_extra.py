# -*- coding: utf-8 -*-
"""Extra branch tests for PlotAgent lazy loading and context fetchers."""

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.plot import ForeshadowStatus, PlotAgent


@pytest.mark.asyncio
async def test_get_previous_events_parses_short_scene_id_and_filters_non_dict():
    memory = MagicMock()
    memory.search = AsyncMock(
        return_value=[
            {
                "id": "e1",
                "content": "battle",
                "scene_id": "CH01-SC01",
                "characters": ["Alice"],
                "is_key": True,
            },
            "skip-non-dict",
        ]
    )
    agent = PlotAgent(memory_engine=memory)

    events = await agent._get_previous_events("S")

    assert len(events) == 1
    assert events[0].event_id == "e1"
    assert events[0].is_key_event is True
    memory.search.assert_awaited_once()
    assert "before 1" in memory.search.await_args.kwargs["query"]


@pytest.mark.asyncio
async def test_get_previous_events_logs_warning_on_search_error():
    memory = MagicMock()
    memory.search = AsyncMock(side_effect=RuntimeError("boom"))
    agent = PlotAgent(memory_engine=memory)

    with patch.object(agent, "log_activity") as log_activity:
        events = await agent._get_previous_events("CH03-SC01")

    assert events == []
    log_activity.assert_called_once()


@pytest.mark.asyncio
async def test_get_upcoming_events_filters_missing_content_and_handles_error():
    memory = MagicMock()
    memory.search = AsyncMock(return_value=[{"content": "next event"}, {"id": "x"}, "skip"])
    agent = PlotAgent(memory_engine=memory)

    upcoming = await agent._get_upcoming_events("CH02-SC01")

    assert upcoming == ["next event"]

    memory.search.side_effect = RuntimeError("search error")
    upcoming_after_error = await agent._get_upcoming_events("CH02-SC01")
    assert upcoming_after_error == []


@pytest.mark.asyncio
async def test_get_active_foreshadows_builds_models_and_defaults():
    graph = MagicMock()
    graph.query.return_value = [
        {
            "f": {
                "id": "FS-1",
                "description": "hint one",
                "planted_at": "CH01-SC01",
                "status": "hinted",
                "importance": "high",
                "characters": ["A"],
                "hints": ["CH02-SC01"],
            }
        },
        {"f": {"id": "FS-2", "description": "hint two"}},
    ]
    agent = PlotAgent(graph_engine=graph)

    foreshadows = await agent._get_active_foreshadows("CH03-SC01")

    assert len(foreshadows) == 2
    assert foreshadows[0].status == ForeshadowStatus.HINTED
    assert foreshadows[1].status == ForeshadowStatus.PLANTED
    graph.query.assert_called_once()


@pytest.mark.asyncio
async def test_get_active_foreshadows_logs_warning_on_query_error():
    graph = MagicMock()
    graph.query.side_effect = RuntimeError("graph down")
    agent = PlotAgent(graph_engine=graph)

    with patch.object(agent, "log_activity") as log_activity:
        foreshadows = await agent._get_active_foreshadows("CH03-SC01")

    assert foreshadows == []
    log_activity.assert_called_once()


def test_memory_engine_lazy_load_success_and_failure_paths():
    success_agent = PlotAgent(memory_engine=None)
    fake_memory_instance = object()
    fake_memory_module = types.ModuleType("src.memory.unified_memory")
    fake_memory_module.UnifiedMemoryEngine = lambda: fake_memory_instance

    with patch.dict(sys.modules, {"src.memory.unified_memory": fake_memory_module}):
        assert success_agent.memory_engine is fake_memory_instance
        assert success_agent.memory_engine is fake_memory_instance

    failure_agent = PlotAgent(memory_engine=None)
    broken_module = types.ModuleType("src.memory.unified_memory")

    with patch.dict(sys.modules, {"src.memory.unified_memory": broken_module}):
        with patch.object(failure_agent, "log_activity") as log_activity:
            assert failure_agent.memory_engine is None

    log_activity.assert_called_once()


def test_graph_engine_lazy_load_success_and_failure_paths():
    success_agent = PlotAgent(graph_engine=None)
    fake_graph_instance = object()
    fake_graph_module = types.ModuleType("src.graph.graph_engine")
    fake_graph_module.GraphEngine = lambda: fake_graph_instance

    with patch.dict(sys.modules, {"src.graph.graph_engine": fake_graph_module}):
        assert success_agent.graph_engine is fake_graph_instance
        assert success_agent.graph_engine is fake_graph_instance

    failure_agent = PlotAgent(graph_engine=None)
    broken_module = types.ModuleType("src.graph.graph_engine")

    with patch.dict(sys.modules, {"src.graph.graph_engine": broken_module}):
        with patch.object(failure_agent, "log_activity") as log_activity:
            assert failure_agent.graph_engine is None

    log_activity.assert_called_once()


def test_run_uses_asyncio_run():
    agent = PlotAgent()

    with patch("asyncio.run", return_value={"ok": True}) as run_mock:
        result = agent.run({"scene_id": "CH01-SC01"})

    assert result == {"ok": True}
    run_mock.assert_called_once()
    run_mock.call_args.args[0].close()
