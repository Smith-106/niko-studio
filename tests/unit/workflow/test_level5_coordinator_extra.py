# -*- coding: utf-8 -*-
"""Level5Coordinator extra tests - _execute_* helpers, execute_chain branches, phase helpers."""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock
from pathlib import Path

from src.workflow.levels.level5_coordinator import (
    CommandType,
    ExecutionStatus,
    Command,
    CommandChain,
    ExecutionUnit,
    RequirementAnalysis,
    CoordinatorState,
    Level5Coordinator,
)
from src.workflow.base_state import BaseState

_NOW = "2025-01-01T00:00:00"


def _make_cs(session_id="s1", **kwargs):
    return CoordinatorState(session_id=session_id, created_at=_NOW, updated_at=_NOW, **kwargs)


@pytest.fixture()
def coord(tmp_path):
    with patch("src.workflow.levels.level5_coordinator.SessionManager"):
        c = Level5Coordinator(config={"persist_dir": str(tmp_path / "coord")})
    return c


def _make_cmd(cmd_type: CommandType, name: str = "cmd", params: dict = None):
    return Command(
        command_id=f"c_{name}",
        command_type=cmd_type,
        name=name,
        description=name,
        agent="coordinator",
        parameters=params or {},
    )


# ============================================================
# _execute_revise
# ============================================================

class TestExecuteRevise:
    def test_appends_feedback_context(self, coord):
        cmd = _make_cmd(CommandType.REVISE)
        state = BaseState({"feedback_context": "fix plot", "context": "existing"})
        with patch.object(coord, "_execute_write", return_value={"content": "revised", "status": "completed"}):
            result = coord._execute_revise(cmd, state)
        assert result["content"] == "revised"
        assert result["status"] == "completed"

    def test_empty_feedback(self, coord):
        cmd = _make_cmd(CommandType.REVISE)
        state = BaseState({})
        with patch.object(coord, "_execute_write", return_value={"content": "out", "status": "completed"}) as mw:
            coord._execute_revise(cmd, state)
            called_state = mw.call_args[0][1]
            assert "[REVISION_FEEDBACK]" in called_state.get("context", "")


# ============================================================
# _execute_verify
# ============================================================

class TestExecuteVerify:
    def test_lite_branch(self, coord):
        cmd = _make_cmd(CommandType.VERIFY, params={"workflow_branch": "lite"})
        state = BaseState({"score": 0.5})
        with patch("src.workflow.levels.level5_coordinator.Level2Lite") as MockLite:
            mock_inst = MagicMock()
            mock_inst._verify_lite.return_value = {"score": 92, "decision": "ACCEPT", "feedback_context": "good"}
            MockLite.return_value = mock_inst
            result = coord._execute_verify(cmd, state)
        assert result["score"] == 92.0
        assert result["decision"] == "ACCEPT"

    def test_standard_branch(self, coord):
        cmd = _make_cmd(CommandType.VERIFY)
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level3Standard") as MockStd:
            mock_inst = MagicMock()
            mock_inst._critic_phase.return_value = {"score": 78, "decision": "REVISE", "feedback_context": "needs work"}
            MockStd.return_value = mock_inst
            result = coord._execute_verify(cmd, state)
        assert result["score"] == 78.0
        assert result["decision"] == "REVISE"

    def test_citations_appended(self, coord):
        cmd = _make_cmd(CommandType.VERIFY)
        state = BaseState({"metadata": {"citations": ["cit-1", "cit-2"]}})
        with patch("src.workflow.levels.level5_coordinator.Level3Standard") as MockStd:
            mock_inst = MagicMock()
            mock_inst._critic_phase.return_value = {"feedback_context": "base feedback"}
            MockStd.return_value = mock_inst
            result = coord._execute_verify(cmd, state)
        assert "cit-1" in result["feedback"]

    def test_verify_exception_fallback(self, coord):
        cmd = _make_cmd(CommandType.VERIFY)
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level3Standard") as MockStd:
            MockStd.return_value._critic_phase.side_effect = RuntimeError("critic error")
            result = coord._execute_verify(cmd, state)
        assert result["decision"] == "REVISE"
        assert result["score"] == 0.0


# ============================================================
# _execute_plan
# ============================================================

class TestExecutePlan:
    def test_success(self, coord):
        cmd = _make_cmd(CommandType.PLAN)
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level3Standard") as MockStd:
            mock_inst = MagicMock()
            mock_inst._plan_phase.return_value = {"implementation_plan": {"steps": ["s1"]}}
            MockStd.return_value = mock_inst
            result = coord._execute_plan(cmd, state)
        assert result["plan"] == {"steps": ["s1"]}
        assert result["status"] == "completed"

    def test_exception(self, coord):
        cmd = _make_cmd(CommandType.PLAN)
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level3Standard") as MockStd:
            MockStd.return_value._plan_phase.side_effect = RuntimeError("plan fail")
            result = coord._execute_plan(cmd, state)
        assert result["plan"] == {}
        assert "L3 规划阶段失败" in state.get("warnings", [""])[0]


# ============================================================
# _execute_analyze
# ============================================================

class TestExecuteAnalyze:
    def test_smart_search_success(self, coord):
        cmd = _make_cmd(CommandType.ANALYZE)
        state = BaseState({"user_request": "test query"})
        mock_result = MagicMock()
        mock_result.to_dict.return_value = {"content": "found text"}
        with patch("src.workflow.levels.level5_coordinator.SmartSearch") as MockSS:
            MockSS.return_value.search.return_value = [mock_result]
            with patch("src.workflow.levels.level5_coordinator.get_citation_manager") as MockCM:
                MockCM.side_effect = RuntimeError("no citation")
                result = coord._execute_analyze(cmd, state)
        assert result["status"] == "completed"
        assert "context" in state

    def test_smart_search_fallback_to_vector(self, coord):
        cmd = _make_cmd(CommandType.ANALYZE)
        state = BaseState({"user_request": "query"})
        with patch("src.workflow.levels.level5_coordinator.SmartSearch") as MockSS:
            MockSS.return_value.search.side_effect = RuntimeError("ss fail")
            with patch("src.workflow.levels.level5_coordinator.VectorSearch") as MockVS:
                MockVS.return_value.search.return_value = [{"content": "fallback"}]
                with patch("src.workflow.levels.level5_coordinator.get_citation_manager") as MockCM:
                    MockCM.side_effect = RuntimeError("no citation")
                    result = coord._execute_analyze(cmd, state)
        assert result["status"] == "completed"
        assert "SmartSearch 检索失败" in state["warnings"][0]

    def test_both_searches_fail(self, coord):
        cmd = _make_cmd(CommandType.ANALYZE)
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.SmartSearch") as MockSS:
            MockSS.return_value.search.side_effect = RuntimeError("fail1")
            with patch("src.workflow.levels.level5_coordinator.VectorSearch") as MockVS:
                MockVS.return_value.search.side_effect = RuntimeError("fail2")
                with patch("src.workflow.levels.level5_coordinator.get_citation_manager") as MockCM:
                    MockCM.side_effect = RuntimeError("no citation")
                    result = coord._execute_analyze(cmd, state)
        assert result["status"] == "completed"
        assert len(state["warnings"]) >= 2


# ============================================================
# _execute_write
# ============================================================

class TestExecuteWrite:
    def test_lite_branch(self, coord):
        cmd = _make_cmd(CommandType.EXECUTE, params={"workflow_branch": "lite"})
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level2Lite") as MockL:
            MockL.return_value._execute_lite.return_value = {"draft_content": "lite output"}
            with patch("src.workflow.levels.level5_coordinator.DistillationManager") as MockD:
                MockD.side_effect = RuntimeError("no distill")
                with patch("src.workflow.levels.level5_coordinator.get_memory_manager") as MockMM:
                    MockMM.side_effect = RuntimeError("no mem")
                    result = coord._execute_write(cmd, state)
        assert result["content"] == "lite output"

    def test_standard_branch(self, coord):
        cmd = _make_cmd(CommandType.EXECUTE)
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level3Standard") as MockS:
            MockS.return_value._execute_phase.return_value = {"draft_content": "standard output"}
            with patch("src.workflow.levels.level5_coordinator.DistillationManager") as MockD:
                MockD.side_effect = RuntimeError("no distill")
                with patch("src.workflow.levels.level5_coordinator.get_memory_manager") as MockMM:
                    MockMM.side_effect = RuntimeError("no mem")
                    result = coord._execute_write(cmd, state)
        assert result["content"] == "standard output"

    def test_brainstorm_branch(self, coord):
        cmd = _make_cmd(CommandType.EXECUTE, params={"workflow_branch": "brainstorm"})
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level4Brainstorm") as MockB:
            MockB.return_value.execute.return_value = {"draft_content": "brainstorm output"}
            with patch("src.workflow.levels.level5_coordinator.DistillationManager") as MockD:
                MockD.side_effect = RuntimeError("no distill")
                with patch("src.workflow.levels.level5_coordinator.get_memory_manager") as MockMM:
                    MockMM.side_effect = RuntimeError("no mem")
                    result = coord._execute_write(cmd, state)
        assert result["content"] == "brainstorm output"

    def test_write_exception_warning(self, coord):
        cmd = _make_cmd(CommandType.EXECUTE)
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level3Standard") as MockS:
            MockS.return_value._execute_phase.side_effect = RuntimeError("exec fail")
            with patch("src.workflow.levels.level5_coordinator.DistillationManager") as MockD:
                MockD.side_effect = RuntimeError("no distill")
                with patch("src.workflow.levels.level5_coordinator.get_memory_manager") as MockMM:
                    MockMM.side_effect = RuntimeError("no mem")
                    result = coord._execute_write(cmd, state)
        assert "L3 执行失败" in state.get("warnings", [""])[0]


# ============================================================
# execute_chain - retry and dependency skip
# ============================================================

class TestExecuteChain:
    def test_dependency_skip(self, coord):
        chain = CommandChain(chain_id="ch1", name="test", description="d")
        cmd1 = _make_cmd(CommandType.ANALYZE, "a1")
        cmd2 = _make_cmd(CommandType.PLAN, "p1")
        chain.add_command(cmd1)
        chain.add_command(cmd2, depends_on=["c_a1"])
        # Make cmd1 fail so dependency for cmd2 is not met
        coord._coordinator_state = _make_cs()
        with patch.object(coord, "_execute_unit") as mock_eu:
            def side_effect(unit, st):
                unit.state = ExecutionStatus.FAILED
                unit.error = "fail"
                return st
            mock_eu.side_effect = side_effect
            with patch.object(coord, "persist_state"):
                state = BaseState({})
                result = coord.execute_chain(chain, state)
        assert "warnings" in result or "errors" in result

    def test_retry_on_failure(self, coord):
        chain = CommandChain(chain_id="ch1", name="test", description="d")
        cmd1 = _make_cmd(CommandType.ANALYZE, "a1")
        chain.add_command(cmd1)
        coord._coordinator_state = _make_cs()
        call_count = 0
        with patch.object(coord, "_execute_unit") as mock_eu:
            def side_effect(unit, st):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    unit.state = ExecutionStatus.FAILED
                    unit.error = "transient"
                    unit.max_retries = 3
                else:
                    unit.state = ExecutionStatus.COMPLETED
                return st
            mock_eu.side_effect = side_effect
            with patch.object(coord, "persist_state"):
                result = coord.execute_chain(chain, BaseState({}))
        assert call_count == 2


# ============================================================
# _execute_unit - dispatch by command type
# ============================================================

class TestExecuteUnit:
    def test_analyze_dispatch(self, coord):
        cmd = _make_cmd(CommandType.ANALYZE)
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        coord._coordinator_state = _make_cs()
        with patch.object(coord, "_execute_analyze", return_value={"analysis": [], "status": "completed"}):
            state = coord._execute_unit(unit, BaseState({}))
        assert unit.state == ExecutionStatus.COMPLETED

    def test_plan_dispatch(self, coord):
        cmd = _make_cmd(CommandType.PLAN)
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        with patch.object(coord, "_execute_plan", return_value={"plan": {}, "status": "completed"}):
            state = coord._execute_unit(unit, BaseState({}))
        assert unit.state == ExecutionStatus.COMPLETED

    def test_execute_dispatch(self, coord):
        cmd = _make_cmd(CommandType.EXECUTE)
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        with patch.object(coord, "_execute_write", return_value={"content": "text", "status": "completed"}):
            state = coord._execute_unit(unit, BaseState({}))
        assert state.get("draft_content") == "text"

    def test_verify_dispatch(self, coord):
        cmd = _make_cmd(CommandType.VERIFY)
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        with patch.object(coord, "_execute_verify", return_value={"score": 90, "decision": "ACCEPT", "feedback": "", "status": "completed"}):
            state = coord._execute_unit(unit, BaseState({}))
        assert state.get("score") == 90

    def test_revise_dispatch(self, coord):
        cmd = _make_cmd(CommandType.REVISE)
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        with patch.object(coord, "_execute_revise", return_value={"content": "revised", "status": "completed"}):
            state = coord._execute_unit(unit, BaseState({}))
        assert state.get("draft_content") == "revised"

    def test_exception_marks_failed(self, coord):
        cmd = _make_cmd(CommandType.ANALYZE)
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        with patch.object(coord, "_execute_analyze", side_effect=RuntimeError("boom")):
            state = coord._execute_unit(unit, BaseState({}))
        assert unit.state == ExecutionStatus.FAILED
        assert "boom" in str(state.get("errors", []))


# ============================================================
# Phase helpers
# ============================================================

class TestPhaseHelpers:
    def test_recommend_chain_phase_no_analysis(self, coord):
        coord._coordinator_state = _make_cs()
        coord._coordinator_state.requirement_analysis = None
        state = coord._recommend_chain_phase(BaseState({}))
        assert "需求分析未完成" in state.get("errors", [""])[0]

    def test_execute_chain_phase_no_chain(self, coord):
        coord._coordinator_state = _make_cs()
        coord._coordinator_state.command_chain = None
        state = coord._execute_chain_phase(BaseState({}))
        assert "命令链未生成" in state.get("errors", [""])[0]

    def test_try_resume_not_found(self, coord):
        with patch.object(coord, "load_state", return_value=None):
            result = coord._try_resume("nonexistent")
        assert result is None

    def test_try_resume_completed(self, coord):
        cs = _make_cs()
        cs.phase = "completed"
        with patch.object(coord, "load_state", return_value=cs):
            result = coord._try_resume("s1")
        assert result is None

    def test_try_resume_active(self, coord):
        cs = _make_cs()
        cs.phase = "executing"
        with patch.object(coord, "load_state", return_value=cs):
            result = coord._try_resume("s1")
        assert result is not None
