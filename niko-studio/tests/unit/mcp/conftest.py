"""
MCP Gateway Test Fixtures

Provides mock engines and TestClient for gateway endpoint testing.
Uses module-level mocking to avoid MCP SDK dependency.
"""

import sys
import os
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch
import pytest

# Ensure src is in path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "src"))

# Mock MCP SDK before any imports that use it
_mock_fastmcp = MagicMock()
_mock_fastmcp.FastMCP = MagicMock(return_value=MagicMock())
sys.modules["mcp"] = MagicMock()
sys.modules["mcp.server"] = MagicMock()
sys.modules["mcp.server.fastmcp"] = _mock_fastmcp


@pytest.fixture(autouse=True)
def reset_container_fixture():
    """Reset ServiceContainer before and after each test for isolation."""
    from src.container import get_container
    container = get_container()
    container.reset()
    yield
    container.reset()


@pytest.fixture
def mock_memory_engine():
    """Mock UnifiedMemoryEngine"""
    mock = MagicMock()
    mock.health_check = AsyncMock(return_value={"status": "ok"})
    mock.add = AsyncMock(return_value={"id": "mem-001", "status": "created"})
    mock.search = AsyncMock(return_value=[])
    mock.get_temporal_facts = AsyncMock(return_value=[])
    mock.detect_conflicts = AsyncMock(return_value=[])
    mock.resolve_conflict = AsyncMock(return_value={"status": "resolved"})

    from src.container import get_container
    container = get_container()
    container.register_mock("memory", mock)
    return mock


@pytest.fixture
def mock_graph_engine():
    """Mock GraphEngine"""
    mock = MagicMock()
    mock.health_check = AsyncMock(return_value={"status": "ok"})
    mock.execute_cypher = AsyncMock(return_value=[])
    mock.get_character = AsyncMock(return_value={})
    mock.get_relationships = AsyncMock(return_value=[])
    mock.get_foreshadows = AsyncMock(return_value=[])
    mock.create_entity = AsyncMock(return_value={"id": "ent-001", "status": "created"})
    mock.create_relation = AsyncMock(return_value={"status": "created"})

    from src.container import get_container
    container = get_container()
    container.register_mock("graph", mock)
    return mock


@pytest.fixture
def mock_search_engine():
    """Mock IterativeRetriever"""
    mock = MagicMock()
    mock.hybrid_search = AsyncMock(return_value=[])
    mock.iterative_retrieve = AsyncMock(return_value={
        "answer": "test answer",
        "sources": [],
        "iterations": 1
    })
    mock.resolve_context = AsyncMock(return_value="resolved context")

    from src.container import get_container
    container = get_container()
    container.register_mock("search", mock)
    return mock


@pytest.fixture
def mock_workflow_engine():
    """Mock WorkflowEngine"""
    mock = MagicMock()
    mock.health_check = AsyncMock(return_value={"status": "ok"})
    mock.route = AsyncMock(return_value={
        "level": "L3",
        "reason": "Standard writing task",
        "suggested_workflow": "standard"
    })
    mock.plan = AsyncMock(return_value={
        "plan_id": "plan-001",
        "steps": [],
        "dependencies": []
    })
    mock.execute = AsyncMock(return_value={"status": "executed"})
    mock.create_checkpoint = AsyncMock(return_value={
        "checkpoint_id": "cp-001",
        "commit_hash": "abc123"
    })
    mock.restore_checkpoint = AsyncMock(return_value={"status": "restored"})
    mock.list_checkpoints = AsyncMock(return_value=[])

    from src.container import get_container
    container = get_container()
    container.register_mock("workflow", mock)
    return mock


@pytest.fixture
def mock_critic_engine():
    """Mock CriticEngine"""
    mock = MagicMock()
    mock.health_check = AsyncMock(return_value={"status": "ok"})
    mock.evaluate = AsyncMock(return_value={
        "decision": "APPROVED",
        "total_score": 85.0,
        "lock_score": 32.0,
        "style_score": 30.0,
        "logic_score": 23.0,
        "actionable_feedback": "Good work",
        "suggestions": []
    })
    mock.suggest_improvements = AsyncMock(return_value=[])
    mock.compare = AsyncMock(return_value={"comparison": "equal"})

    from src.container import get_container
    container = get_container()
    container.register_mock("critic", mock)
    return mock


@pytest.fixture
def mock_commander_agent():
    """Mock CommanderAgent"""
    # Create mock SceneType enum
    class MockSceneType:
        DIALOGUE = MagicMock()
        DIALOGUE.value = "dialogue"

    mock = MagicMock()
    mock.route = MagicMock(return_value="L3")
    mock.detect_scene_type = MagicMock(return_value=MockSceneType.DIALOGUE)
    mock.dispatch_skills = MagicMock(return_value=["dialogue-system", "character-voice"])

    # Mock task assignment
    mock_assignment = MagicMock()
    mock_assignment.agent_type = "writer"
    mock_assignment.instruction = "Write dialogue scene"
    mock_assignment.model_dump = MagicMock(return_value={
        "agent_type": "writer",
        "instruction": "Write dialogue scene"
    })
    mock.dispatch_tasks = MagicMock(return_value=[mock_assignment])

    from src.container import get_container
    container = get_container()
    container.register_mock("commander", mock)
    return mock


@pytest.fixture
def mock_writer_agent():
    """Mock WriterAgent"""
    mock = MagicMock()
    mock.inject_skills = MagicMock()

    # Mock write result
    mock_result = MagicMock()
    mock_result.content = "Generated content from writer agent."
    mock_result.wordcount = 500
    mock_result.sensory_types_used = ["visual", "auditory"]
    mock_result.forbidden_words_found = []
    mock_result.sections_needing_review = []
    mock.write = AsyncMock(return_value=mock_result)

    # Mock continue_writing
    mock.continue_writing = AsyncMock(return_value="Continued content...")

    # Mock revise
    mock_revise_result = MagicMock()
    mock_revise_result.content = "Revised content"
    mock_revise_result.wordcount = 600
    mock_revise_result.forbidden_words_found = []
    mock.revise = AsyncMock(return_value=mock_revise_result)

    from src.container import get_container
    container = get_container()
    container.register_mock("writer", mock)
    return mock


@pytest.fixture
def mock_llm_available(monkeypatch):
    """Mock LLM availability check"""
    import src.mcp.gateway as gateway_module
    monkeypatch.setattr(gateway_module, "_is_llm_available", lambda: True)


@pytest.fixture
def mock_llm_unavailable(monkeypatch):
    """Mock LLM unavailability"""
    import src.mcp.gateway as gateway_module
    monkeypatch.setattr(gateway_module, "_is_llm_available", lambda: False)


@pytest.fixture
def client_no_lifespan(
    mock_memory_engine,
    mock_graph_engine,
    mock_search_engine,
    mock_workflow_engine,
    mock_critic_engine,
    mock_commander_agent,
    mock_writer_agent,
    mock_llm_available
):
    """Create TestClient without lifespan management for simpler tests"""
    from starlette.testclient import TestClient
    from starlette.applications import Starlette
    from starlette.routing import Route
    from src.mcp.gateway import health_check, list_tools, chat_endpoint, chat_stream_endpoint

    # Create minimal app without MCP lifespan
    app = Starlette(
        routes=[
            Route("/health", health_check, methods=["GET"]),
            Route("/tools", list_tools, methods=["GET"]),
            Route("/chat", chat_endpoint, methods=["POST"]),
            Route("/chat/stream", chat_stream_endpoint, methods=["POST"]),
        ]
    )
    return TestClient(app)
