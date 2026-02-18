# -*- coding: utf-8 -*-
"""Extra branch tests for CharacterAgent."""

import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from src.agents.character import CharacterAgent, CharacterProfile


def test_graph_engine_lazy_load_success_and_failure_paths():
    success_agent = CharacterAgent(graph_engine=None)
    fake_graph_instance = object()
    fake_graph_module = types.ModuleType("src.graph.graph_engine")
    fake_graph_module.GraphEngine = lambda: fake_graph_instance

    with patch.dict(sys.modules, {"src.graph.graph_engine": fake_graph_module}):
        assert success_agent.graph_engine is fake_graph_instance
        assert success_agent.graph_engine is fake_graph_instance

    failure_agent = CharacterAgent(graph_engine=None)
    broken_module = types.ModuleType("src.graph.graph_engine")

    with patch.dict(sys.modules, {"src.graph.graph_engine": broken_module}):
        with patch.object(failure_agent, "log_activity") as log_activity:
            assert failure_agent.graph_engine is None

    log_activity.assert_called_once()


@pytest.mark.asyncio
async def test_get_character_profile_without_graph_engine_returns_minimal_profile(monkeypatch):
    agent = CharacterAgent(graph_engine=MagicMock())
    monkeypatch.setattr(type(agent), "graph_engine", property(lambda _self: None))

    profile = await agent._get_character_profile("Hero")

    assert isinstance(profile, CharacterProfile)
    assert profile.name == "Hero"


@pytest.mark.asyncio
async def test_get_character_profile_builds_relationships_and_defaults():
    graph = MagicMock()
    graph.query.return_value = [
        {
            "c": {
                "role": "protagonist",
                "speech_pattern": "calm",
            },
            "relationships": [
                {"target": "Alice", "type": "FRIEND"},
                {"target": "Bob"},
                {"type": "ENEMY"},
            ],
        }
    ]
    agent = CharacterAgent(graph_engine=graph)

    profile = await agent._get_character_profile("Hero")

    assert profile.role == "protagonist"
    assert profile.speech_pattern == "calm"
    assert profile.relationships == {"Alice": "FRIEND", "Bob": "KNOWS"}


@pytest.mark.asyncio
async def test_get_character_profile_logs_warning_and_returns_fallback_on_query_error():
    graph = MagicMock()
    graph.query.side_effect = RuntimeError("query boom")
    agent = CharacterAgent(graph_engine=graph)

    with patch.object(agent, "log_activity") as log_activity:
        profile = await agent._get_character_profile("Hero")

    assert profile.name == "Hero"
    log_activity.assert_called_once()


def test_run_uses_asyncio_run_and_closes_coroutine():
    agent = CharacterAgent()

    with patch("asyncio.run", return_value={"ok": True}) as run_mock:
        result = agent.run({"pov_character": "Hero"})

    assert result == {"ok": True}
    run_mock.assert_called_once()
    run_mock.call_args.args[0].close()
