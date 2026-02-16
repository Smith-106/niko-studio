# -*- coding: utf-8 -*-
"""
SequentialThinking MCP Server Tests

Tests for get_engine, create_server, and MCP tools (think, branch,
switch_branch, revise) via direct engine interaction.
Global state is reset after each test.
"""

import pytest
from unittest.mock import patch
import types

from src.agents.sequential_thinking import (
    SequentialThinking,
    ThoughtType,
    ThoughtStatus,
)
from src.mcp_servers import sequential_thinking as st_module
from src.mcp_servers.sequential_thinking import (
    get_engine,
    create_server,
)


# ============================================================
# Fixture: reset global state after each test
# ============================================================

@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset module-level global state before and after each test."""
    st_module._engines.clear()
    st_module._default_engine = None
    yield
    st_module._engines.clear()
    st_module._default_engine = None


# ============================================================
# get_engine
# ============================================================

class TestGetEngine:

    def test_default_engine_created(self):
        engine = get_engine()
        assert isinstance(engine, SequentialThinking)
        assert st_module._default_engine is engine

    def test_default_engine_singleton(self):
        e1 = get_engine()
        e2 = get_engine()
        assert e1 is e2

    def test_session_engine_created(self):
        engine = get_engine(session_id="sess-001")
        assert isinstance(engine, SequentialThinking)
        assert "sess-001" in st_module._engines
        assert st_module._engines["sess-001"] is engine

    def test_session_engine_singleton(self):
        e1 = get_engine(session_id="sess-001")
        e2 = get_engine(session_id="sess-001")
        assert e1 is e2

    def test_different_sessions_different_engines(self):
        e1 = get_engine(session_id="sess-001")
        e2 = get_engine(session_id="sess-002")
        assert e1 is not e2

    def test_session_engine_separate_from_default(self):
        default = get_engine()
        session = get_engine(session_id="sess-001")
        assert default is not session

    def test_engine_config(self):
        engine = get_engine()
        assert engine.max_depth == 15
        assert engine.max_branches == 10
        assert engine.auto_prune is True


# ============================================================
# create_server
# ============================================================

class TestCreateServer:

    @staticmethod
    def _fake_fastmcp(name):
        class _FakeServer:
            def __init__(self, server_name):
                self.name = server_name

            def tool(self):
                def _decorator(func):
                    return func
                return _decorator

        return _FakeServer(name)

    def test_returns_fastmcp_instance(self):
        with patch.object(st_module, "FastMCP", side_effect=self._fake_fastmcp):
            server = create_server()
            assert server is not None
            assert hasattr(server, "name")
            assert hasattr(server, "tool")

    def test_custom_name(self):
        with patch.object(st_module, "FastMCP", side_effect=self._fake_fastmcp):
            server = create_server(name="TestServer")
            assert server.name == "TestServer"

    def test_default_name(self):
        with patch.object(st_module, "FastMCP", side_effect=self._fake_fastmcp):
            server = create_server()
            assert server.name == "SequentialThinking"


# ============================================================
# Engine: think
# ============================================================

class TestEngineThink:

    def test_think_creates_thought(self):
        engine = get_engine()
        thought = engine.think("initial analysis", ThoughtType.INITIAL)

        assert thought.content == "initial analysis"
        assert thought.thought_type == ThoughtType.INITIAL
        assert thought.status == ThoughtStatus.ACTIVE
        assert thought.depth == 0

    def test_think_increments_depth(self):
        engine = get_engine()
        t1 = engine.think("step 1")
        t2 = engine.think("step 2")

        assert t1.depth == 0
        assert t2.depth == 1
        assert t2.parent_id == t1.id

    def test_think_with_confidence(self):
        engine = get_engine()
        thought = engine.think("hypothesis", ThoughtType.HYPOTHESIS, confidence=0.7)
        assert thought.confidence == 0.7

    def test_think_with_metadata(self):
        engine = get_engine()
        thought = engine.think("analysis", metadata={"source": "test"})
        assert thought.metadata == {"source": "test"}

    def test_think_to_dict(self):
        engine = get_engine()
        thought = engine.think("content")
        d = thought.to_dict()

        assert d["content"] == "content"
        assert d["thought_type"] == "analysis"
        assert d["status"] == "active"
        assert "id" in d
        assert "created_at" in d

    def test_think_added_to_branch(self):
        engine = get_engine()
        thought = engine.think("content")

        main_branch = engine._branches["main"]
        assert thought.id in main_branch.thoughts


# ============================================================
# Engine: branch
# ============================================================

class TestEngineBranch:

    def test_branch_created(self):
        engine = get_engine()
        engine.think("base thought")
        new_branch = engine.branch("Plan A", "explore option A", priority=5)

        assert new_branch.name == "Plan A"
        assert new_branch.description == "explore option A"
        assert new_branch.priority == 5
        assert new_branch.parent_branch_id == "main"
        assert new_branch.id in engine._branches

    def test_branch_fork_point(self):
        engine = get_engine()
        t1 = engine.think("base")
        new_branch = engine.branch("B", "desc")

        assert new_branch.fork_point_id == t1.id

    def test_branch_id_contains_name(self):
        engine = get_engine()
        new_branch = engine.branch("Test Branch", "desc")
        assert "test_branch" in new_branch.id


# ============================================================
# Engine: switch_branch
# ============================================================

class TestEngineSwitchBranch:

    def test_switch_to_existing_branch(self):
        engine = get_engine()
        engine.think("base")
        new_branch = engine.branch("B", "desc")

        engine.switch_branch(new_branch.id)
        assert engine._current_branch_id == new_branch.id

    def test_switch_to_nonexistent_raises(self):
        engine = get_engine()
        with pytest.raises(ValueError, match="not found"):
            engine.switch_branch("branch_nonexistent")

    def test_switch_sets_current_thought(self):
        engine = get_engine()
        t1 = engine.think("base")
        new_branch = engine.branch("B", "desc")

        # Switch to new branch and add a thought
        engine.switch_branch(new_branch.id)
        t2 = engine.think("branch thought")

        # Switch back to main
        engine.switch_branch("main")
        assert engine._current_thought_id == t1.id

        # Switch to branch again
        engine.switch_branch(new_branch.id)
        assert engine._current_thought_id == t2.id


# ============================================================
# Engine: revise
# ============================================================

class TestEngineRevise:

    def test_revise_existing_thought(self):
        engine = get_engine()
        original = engine.think("original analysis")

        revision = engine.revise(
            target_thought_id=original.id,
            new_content="corrected analysis",
            reason="found error"
        )

        assert revision.thought_type == ThoughtType.REVISION
        assert revision.metadata["revises"] == original.id
        assert revision.metadata["reason"] == "found error"
        assert revision.metadata["original_content"] == "original analysis"

        # Original should be marked as revised
        assert engine._thoughts[original.id].status == ThoughtStatus.REVISED
        assert engine._thoughts[original.id].revised_by == revision.id

    def test_revise_nonexistent_raises(self):
        engine = get_engine()
        with pytest.raises(ValueError, match="not found"):
            engine.revise("thought_nonexistent", "new", "reason")


# ============================================================
# Engine: conclude & backtrack
# ============================================================

class TestEngineConclude:

    def test_conclude(self):
        engine = get_engine()
        engine.think("analysis")
        conclusion = engine.conclude("final answer", confidence=0.95)

        assert conclusion.thought_type == ThoughtType.CONCLUSION
        assert conclusion.confidence == 0.95
        assert conclusion.content == "final answer"

    def test_get_conclusions(self):
        engine = get_engine()
        engine.think("analysis")
        engine.conclude("conclusion 1")
        engine.conclude("conclusion 2")

        conclusions = engine.get_conclusions()
        assert len(conclusions) == 2


class TestEngineBacktrack:

    def test_backtrack(self):
        engine = get_engine()
        t1 = engine.think("step 1")
        t2 = engine.think("step 2")
        t3 = engine.think("step 3")

        engine.backtrack(t1.id)

        # t2 and t3 should be abandoned
        assert engine._thoughts[t2.id].status == ThoughtStatus.ABANDONED
        assert engine._thoughts[t3.id].status == ThoughtStatus.ABANDONED

    def test_backtrack_nonexistent_raises(self):
        engine = get_engine()
        with pytest.raises(ValueError, match="not found"):
            engine.backtrack("thought_nonexistent")


# ============================================================
# Engine: reset
# ============================================================

class TestEngineReset:

    def test_reset_clears_state(self):
        engine = get_engine()
        engine.think("thought 1")
        engine.think("thought 2")
        engine.branch("B", "desc")

        engine.reset()

        assert len(engine._thoughts) == 0
        assert engine._current_thought_id is None
        assert engine._current_branch_id == "main"
        assert "main" in engine._branches
        assert len(engine._branches) == 1

    def test_reset_allows_new_thoughts(self):
        engine = get_engine()
        engine.think("before reset")
        engine.reset()

        thought = engine.think("after reset")
        assert thought.depth == 0
        assert thought.parent_id is None


class _FakeMCPServer:
    def __init__(self, name):
        self.name = name
        self._tools = {}
        self.settings = types.SimpleNamespace(streamable_http_path=None)
        self._ran = False

    def tool(self):
        def _decorator(func):
            self._tools[func.__name__] = func
            return func
        return _decorator

    def streamable_http_app(self):
        return "fake-http-app"

    def run(self):
        self._ran = True


class TestMcpToolWrappers:
    def _create_fake_server_with_tools(self):
        with patch.object(st_module, "FastMCP", side_effect=lambda name: _FakeMCPServer(name)):
            return create_server("WrapperTest")

    @pytest.mark.asyncio
    async def test_all_tool_wrappers_basic_paths(self):
        server = self._create_fake_server_with_tools()
        tools = server._tools

        # think (invalid thought_type -> fallback branch)
        t = await tools["think"]("hello", thought_type="invalid", confidence=0.7, metadata={"k": "v"})
        assert t["content"] == "hello"
        assert t["thought_type"] == "analysis"

        # branch/switch/revise/backtrack/conclude
        b = await tools["branch"]("alt", "desc", priority=3)
        await tools["switch_branch"](b["id"])
        t2 = await tools["think"]("alt thought")
        r = await tools["revise"](t2["id"], "alt revised", "fix")
        assert r["thought_type"] == "revision"

        bt = await tools["backtrack"](t["id"])
        assert bt["status"] == "backtracked"

        c = await tools["conclude"]("final", confidence=0.9)
        assert c["thought_type"] == "conclusion"

        # query tools
        chain = await tools["get_chain"]()
        assert isinstance(chain, list)

        state = await tools["get_state"]()
        assert "summary" in state
        assert "total_thoughts" in state["summary"]

        conclusions = await tools["get_conclusions"]()
        assert isinstance(conclusions, list)

        best = await tools["get_best_branch"]()
        assert "id" in best and "name" in best

        md = await tools["export_markdown"]()
        assert "Sequential Thinking Chain" in md

        rst = await tools["reset"]()
        assert rst["status"] == "reset"

    @pytest.mark.asyncio
    async def test_list_sessions_and_delete_session(self):
        server = self._create_fake_server_with_tools()
        tools = server._tools

        # default + one named session
        await tools["think"]("default-thought")
        await tools["think"]("session-thought", session_id="sess-x")

        sessions = await tools["list_sessions"]()
        ids = {s["id"] for s in sessions}
        assert "default" in ids
        assert "sess-x" in ids

        deleted = await tools["delete_session"]("sess-x")
        assert deleted["status"] == "deleted"

        missing = await tools["delete_session"]("sess-x")
        assert missing["status"] == "not_found"


class _FakeArgumentParser:
    def __init__(self, parsed_args):
        self._parsed_args = parsed_args

    def add_argument(self, *args, **kwargs):
        return None

    def parse_args(self):
        return self._parsed_args


class TestMainEntrypoint:
    def test_main_stdio_mode(self):
        fake_parser = _FakeArgumentParser(
            types.SimpleNamespace(sse=False, port=8001, host="0.0.0.0")
        )
        fake_app = types.SimpleNamespace(run=lambda: None)

        run_called = {"value": False}

        def _run():
            run_called["value"] = True

        fake_app.run = _run

        with patch("argparse.ArgumentParser", return_value=fake_parser):
            with patch.object(st_module, "app", fake_app):
                st_module.main()

        assert run_called["value"] is True

    def test_main_sse_mode(self):
        fake_parser = _FakeArgumentParser(
            types.SimpleNamespace(sse=True, port=9001, host="127.0.0.1")
        )

        fake_app = _FakeMCPServer("app")

        uvicorn_calls = {"called": False, "host": None, "port": None}

        def _uvicorn_run(app_obj, host=None, port=None):
            uvicorn_calls["called"] = True
            uvicorn_calls["host"] = host
            uvicorn_calls["port"] = port

        class _FakeStarlette:
            def __init__(self, routes):
                self.routes = routes

        fake_uvicorn = types.SimpleNamespace(run=_uvicorn_run)
        fake_starlette_apps = types.SimpleNamespace(Starlette=_FakeStarlette)
        fake_starlette_routing = types.SimpleNamespace(Mount=lambda path, app: (path, app))

        with patch("argparse.ArgumentParser", return_value=fake_parser):
            with patch.object(st_module, "app", fake_app):
                with patch.dict(
                    "sys.modules",
                    {
                        "uvicorn": fake_uvicorn,
                        "starlette.applications": fake_starlette_apps,
                        "starlette.routing": fake_starlette_routing,
                    },
                ):
                    st_module.main()

        assert fake_app.settings.streamable_http_path == "/"
        assert uvicorn_calls["called"] is True
        assert uvicorn_calls["host"] == "127.0.0.1"
        assert uvicorn_calls["port"] == 9001
