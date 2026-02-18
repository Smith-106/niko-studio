# -*- coding: utf-8 -*-
"""Level5Coordinator extra tests - _execute_* helpers, execute_chain branches, phase helpers."""

import json
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

    def test_lite_branch_exception(self, coord):
        cmd = _make_cmd(CommandType.VERIFY, params={"workflow_branch": "lite"})
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level2Lite") as MockLite:
            MockLite.return_value._verify_lite.side_effect = RuntimeError("lite verify failed")
            result = coord._execute_verify(cmd, state)

        assert result["decision"] == "REVISE"
        assert "L2 验证失败" in state.get("warnings", [""])[0]

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

    def test_analyze_handles_non_dict_items_and_persists_citations(self, coord):
        cmd = _make_cmd(CommandType.ANALYZE)
        state = BaseState({"metadata": {}})

        with patch("src.workflow.levels.level5_coordinator.SmartSearch") as MockSS:
            MockSS.return_value.search.return_value = [object()]
            with patch("src.workflow.levels.level5_coordinator.get_citation_manager") as MockCM:
                citation = MagicMock()
                citation.citation_id = "cit-1"
                manager = MagicMock()
                manager.create_transient_citation.return_value = citation
                manager.persist_citation.return_value = citation
                MockCM.return_value = manager

                result = coord._execute_analyze(cmd, state)

        assert result["status"] == "completed"
        assert state["metadata"]["citations"] == ["cit-1"]


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

    def test_lite_branch_exception(self, coord):
        cmd = _make_cmd(CommandType.EXECUTE, params={"workflow_branch": "lite"})
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level2Lite") as MockL:
            MockL.return_value._execute_lite.side_effect = RuntimeError("lite failed")
            result = coord._execute_write(cmd, state)

        assert result["status"] == "completed"
        assert "L2 执行失败" in state.get("warnings", [""])[0]

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

    def test_brainstorm_branch_exception(self, coord):
        cmd = _make_cmd(CommandType.EXECUTE, params={"workflow_branch": "brainstorm"})
        state = BaseState({})
        with patch("src.workflow.levels.level5_coordinator.Level4Brainstorm") as MockB:
            MockB.return_value.execute.side_effect = RuntimeError("brainstorm failed")
            result = coord._execute_write(cmd, state)

        assert result["status"] == "completed"
        assert "L4 执行失败" in state.get("warnings", [""])[0]

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

    def test_write_success_sets_distillation_result(self, coord):
        cmd = _make_cmd(CommandType.EXECUTE)
        state = BaseState({})

        with patch("src.workflow.levels.level5_coordinator.Level3Standard") as MockS:
            MockS.return_value._execute_phase.return_value = {"draft_content": "body"}
            with patch("src.workflow.levels.level5_coordinator.DistillationManager") as MockD:
                MockD.return_value.distill.return_value = MagicMock(content="summary")
                with patch("src.workflow.levels.level5_coordinator.get_memory_manager") as MockMM:
                    MockMM.return_value.add.return_value = None
                    result = coord._execute_write(cmd, state)

        assert result["content"] == "body"
        assert state["distillation_result"]["content"] == "summary"


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

    def test_retry_exhausted_appends_unit_error(self, coord):
        chain = CommandChain(chain_id="ch2", name="retry", description="d")
        cmd = _make_cmd(CommandType.ANALYZE, "a1")
        chain.add_command(cmd)

        coord._coordinator_state = _make_cs()

        with patch.object(coord, "_execute_unit") as mock_eu:
            def side_effect(unit, st):
                unit.state = ExecutionStatus.FAILED
                unit.error = "fatal"
                unit.max_retries = 0
                return st

            mock_eu.side_effect = side_effect
            with patch.object(coord, "persist_state"):
                out = coord.execute_chain(chain, BaseState({}))

        assert any("单元执行失败" in err for err in out.get("errors", []))


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

    def test_execute_chain_phase_delegates(self, coord):
        coord._coordinator_state = _make_cs(command_chain=CommandChain(chain_id="c", name="n", description="d"))
        with patch.object(coord, "execute_chain", return_value=BaseState({"ok": True})) as mocked:
            result = coord._execute_chain_phase(BaseState({}))

        assert result["ok"] is True
        mocked.assert_called_once()

    def test_analyze_requirements_phase_populates_state(self, coord):
        coord._coordinator_state = _make_cs()
        out = coord._analyze_requirements_phase(BaseState({"user_request": "写作", "context": "短篇"}))

        assert "requirement_analysis" in out

    def test_recommend_chain_phase_populates_chain(self, coord):
        coord._coordinator_state = _make_cs(
            requirement_analysis=RequirementAnalysis(
                task_type="chapter_revision",
                complexity=60,
                estimated_steps=4,
                required_agents=["writer"],
                suggested_chain="chapter_revision",
            )
        )

        out = coord._recommend_chain_phase(BaseState({}))

        assert "command_chain" in out

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


class TestCoordinatorExecuteFlow:
    def test_execute_handles_session_manager_init_failure(self, coord):
        state = BaseState({"session_id": "sid", "user_request": "task"})

        with patch("src.workflow.levels.level5_coordinator.SessionManager") as sm:
            sm.return_value.init.side_effect = RuntimeError("sm down")
            with patch.object(coord, "_try_resume", return_value=None):
                with patch.object(coord, "_analyze_requirements_phase", side_effect=lambda s: s):
                    with patch.object(coord, "_recommend_chain_phase", side_effect=lambda s: s):
                        with patch.object(coord, "_execute_chain_phase", side_effect=lambda s: s):
                            with patch.object(coord, "_all_units_completed", return_value=True):
                                result = coord.execute(state)

        assert any("SessionManager 初始化失败" in w for w in result.get("warnings", []))
        assert result.get("decision") == "APPROVED"

    def test_execute_returns_human_review_when_units_incomplete(self, coord):
        coord._coordinator_state = _make_cs(phase="executing")
        state = BaseState({"session_id": "sid"})

        with patch.object(coord, "_try_resume", return_value=coord._coordinator_state):
            with patch.object(coord, "_all_units_completed", return_value=False):
                result = coord.execute(state)

        assert result["decision"] == "HUMAN_REVIEW"
        assert result["requires_human_intervention"] is True

    def test_execute_sets_failed_on_phase_exception(self, coord):
        state = BaseState({"session_id": "sid", "user_request": "task"})

        with patch.object(coord, "_try_resume", return_value=None):
            with patch.object(coord, "_analyze_requirements_phase", side_effect=RuntimeError("phase boom")):
                result = coord.execute(state)

        assert result["decision"] == "FAILED"
        assert any("协调者执行失败" in e for e in result.get("errors", []))



class TestCoordinatorDataClassHelpers:
    def test_command_from_dict(self):
        cmd = Command.from_dict(
            {
                "command_id": "c1",
                "command_type": "analyze",
                "name": "n",
                "description": "d",
                "agent": "coordinator",
            }
        )

        assert cmd.command_type == CommandType.ANALYZE

    def test_command_chain_get_missing_and_from_dict(self):
        chain = CommandChain.from_dict(
            {
                "chain_id": "ch1",
                "name": "chain",
                "description": "desc",
                "commands": [
                    {
                        "command_id": "c1",
                        "command_type": "plan",
                        "name": "p",
                        "description": "d",
                        "agent": "architect",
                    }
                ],
                "dependencies": {"c1": []},
                "execution_order": ["c1"],
                "estimated_duration": 7,
            }
        )

        assert chain.get_command("missing") is None
        assert chain.estimated_duration == 7

    def test_execution_unit_to_from_dict(self):
        cmd = _make_cmd(CommandType.EXECUTE)
        unit = ExecutionUnit(unit_id="u1", command=cmd, state=ExecutionStatus.FAILED, error="e")

        data = unit.to_dict()
        parsed = ExecutionUnit.from_dict(data)

        assert parsed.unit_id == "u1"
        assert parsed.state == ExecutionStatus.FAILED

    def test_requirement_analysis_from_dict(self):
        parsed = RequirementAnalysis.from_dict(
            {
                "task_type": "chapter_revision",
                "complexity": 40,
                "estimated_steps": 4,
                "required_agents": ["writer"],
                "suggested_chain": "chapter_revision",
            }
        )

        assert parsed.task_type == "chapter_revision"

    def test_coordinator_state_from_dict_full(self):
        state = CoordinatorState.from_dict(
            {
                "session_id": "sid",
                "created_at": _NOW,
                "updated_at": _NOW,
                "requirement_analysis": {
                    "task_type": "chapter_revision",
                    "complexity": 40,
                    "estimated_steps": 4,
                    "required_agents": ["writer"],
                    "suggested_chain": "chapter_revision",
                },
                "command_chain": {
                    "chain_id": "ch1",
                    "name": "chain",
                    "description": "desc",
                    "commands": [
                        {
                            "command_id": "c1",
                            "command_type": "plan",
                            "name": "p",
                            "description": "d",
                            "agent": "architect",
                        }
                    ],
                    "dependencies": {"c1": []},
                    "execution_order": ["c1"],
                    "estimated_duration": 7,
                },
                "execution_units": [
                    {
                        "unit_id": "u1",
                        "command": {
                            "command_id": "c1",
                            "command_type": "execute",
                            "name": "e",
                            "description": "d",
                            "agent": "writer",
                        },
                        "state": "completed",
                    }
                ],
                "current_unit_index": 1,
                "phase": "executing",
                "overall_progress": 50.0,
                "final_result": {"ok": True},
                "errors": ["x"],
            }
        )

        assert state.requirement_analysis is not None
        assert state.command_chain is not None
        assert len(state.execution_units) == 1
        assert state.phase == "executing"


class TestCoordinatorPersistenceAndHelpers:
    def test_get_required_agents(self, coord):
        assert coord.get_required_agents() == ["coordinator", "architect", "writer", "critic"]

    def test_recommend_chain_unknown_template_uses_default(self, coord):
        req = RequirementAnalysis(
            task_type="unknown",
            complexity=10,
            estimated_steps=1,
            required_agents=[],
            suggested_chain="unknown",
        )

        chain = coord.recommend_chain(req)

        assert chain.name == "默认执行链"

    def test_persist_state_session_manager_write_failure_warns(self, coord):
        state = _make_cs()

        with patch("src.workflow.levels.level5_coordinator.SessionManager") as sm:
            sm.return_value.write.side_effect = RuntimeError("sm write fail")
            sid = coord.persist_state(state)

        assert sid == "s1"

    def test_load_state_from_session_manager_payload(self, coord):
        payload = json.dumps(_make_cs().to_dict(), ensure_ascii=False)

        with patch("src.workflow.levels.level5_coordinator.SessionManager") as sm:
            sm.return_value.read.return_value = payload
            loaded = coord.load_state("s1")

        assert loaded is not None
        assert loaded.session_id == "s1"

    def test_load_state_fallback_to_file_after_session_manager_error(self, coord):
        state = _make_cs()
        p = coord.persist_dir / "s1.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(state.to_dict(), ensure_ascii=False), encoding="utf-8")

        with patch("src.workflow.levels.level5_coordinator.SessionManager") as sm:
            sm.return_value.read.side_effect = RuntimeError("read fail")
            loaded = coord.load_state("s1")

        assert loaded is not None
        assert loaded.session_id == "s1"

    def test_load_state_missing_and_invalid_file(self, coord):
        with patch("src.workflow.levels.level5_coordinator.SessionManager") as sm:
            sm.return_value.read.return_value = ""
            assert coord.load_state("missing") is None

        bad = coord.persist_dir / "bad.json"
        bad.parent.mkdir(parents=True, exist_ok=True)
        bad.write_text("{bad", encoding="utf-8")
        with patch("src.workflow.levels.level5_coordinator.SessionManager") as sm:
            sm.return_value.read.return_value = ""
            assert coord.load_state("bad") is None

    def test_all_units_completed_false_branch(self, coord):
        cmd = _make_cmd(CommandType.ANALYZE)
        coord._coordinator_state = _make_cs(
            execution_units=[ExecutionUnit(unit_id="u1", command=cmd, state=ExecutionStatus.RUNNING)]
        )

        assert coord._all_units_completed() is False

    def test_detect_task_type_branches(self, coord):
        assert coord._detect_task_type("修订章节") == "chapter_revision"
        assert coord._detect_task_type("头脑风暴方案") == "brainstorm_synthesis"
        assert coord._detect_task_type("misc") == "chapter_revision"

    def test_select_execution_branch_uses_requirement_brainstorm(self, coord):
        coord._coordinator_state = _make_cs(
            requirement_analysis=RequirementAnalysis(
                task_type="brainstorm_synthesis",
                complexity=60,
                estimated_steps=5,
                required_agents=["architect"],
                suggested_chain="brainstorm_synthesis",
            )
        )

        branch = coord._select_execution_branch(_make_cmd(CommandType.EXECUTE))

        assert branch == "brainstorm"

    def test_all_units_completed_true_branch(self, coord):
        cmd = _make_cmd(CommandType.ANALYZE)
        coord._coordinator_state = _make_cs(
            execution_units=[
                ExecutionUnit(unit_id="u1", command=cmd, state=ExecutionStatus.COMPLETED),
                ExecutionUnit(unit_id="u2", command=cmd, state=ExecutionStatus.SKIPPED),
            ]
        )

        assert coord._all_units_completed() is True

    def test_estimate_complexity_middle_length_and_keyword_branches(self, coord):
        complexity = coord._estimate_complexity("完整" + ("x" * 600), "")

        assert complexity >= 75

    def test_estimate_complexity_over_2000_branch(self, coord):
        complexity = coord._estimate_complexity("x" * 2101, "")

        assert complexity >= 80

    def test_determine_agents_and_suggest_chain(self, coord):
        agents = coord._determine_required_agents("brainstorm_synthesis", 90)

        assert "researcher" in agents
        assert "optimist" in agents
        assert coord._suggest_chain_template("unknown", 10) == "chapter_revision"

    def test_extract_constraints_assess_risks_and_default_chain(self, coord):
        constraints = coord._extract_constraints("字数不要必须风格")
        risks = coord._assess_risks("novel_creation", 90)
        chain = coord._create_default_chain()

        assert set(constraints) == {"字数限制", "排除条件", "必要条件", "风格约束"}
        assert any("高复杂度任务" in r for r in risks)
        assert any("一致性" in r for r in risks)
        assert chain.name == "默认执行链"
