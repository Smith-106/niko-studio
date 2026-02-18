# -*- coding: utf-8 -*-
"""
PlanActMode Tests

Tests for WorkflowPhase, PhaseResult, Checkpoint, PlanActState,
PlanPhaseExecutor, ActPhaseExecutor, ReviewPhaseExecutor,
RevisePhaseExecutor, PlanActMode, get_default_plan_act_mode.
"""

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from datetime import datetime

from src.workflow.modes.plan_act import (
    WorkflowPhase,
    PhaseResult,
    Checkpoint,
    PlanActState,
    IPhaseExecutor,
    PlanPhaseExecutor,
    ActPhaseExecutor,
    ReviewPhaseExecutor,
    RevisePhaseExecutor,
    PlanActMode,
    get_default_plan_act_mode,
)


# ============================================================
# WorkflowPhase
# ============================================================

class TestWorkflowPhase:

    def test_values(self):
        assert WorkflowPhase.PLAN.value == "plan"
        assert WorkflowPhase.ACT.value == "act"
        assert WorkflowPhase.REVIEW.value == "review"
        assert WorkflowPhase.REVISE.value == "revise"
        assert WorkflowPhase.COMPLETE.value == "complete"


# ============================================================
# PhaseResult
# ============================================================

class TestPhaseResult:

    def test_ok(self):
        r = PhaseResult.ok(WorkflowPhase.PLAN, "output", WorkflowPhase.ACT, extra="val")
        assert r.success is True
        assert r.phase == WorkflowPhase.PLAN
        assert r.output == "output"
        assert r.next_phase == WorkflowPhase.ACT
        assert r.metadata["extra"] == "val"

    def test_fail(self):
        err = ValueError("boom")
        r = PhaseResult.fail(WorkflowPhase.ACT, err)
        assert r.success is False
        assert r.error is err
        assert r.phase == WorkflowPhase.ACT

    def test_defaults(self):
        r = PhaseResult(phase=WorkflowPhase.PLAN, success=True)
        assert r.output is None
        assert r.metadata == {}
        assert r.error is None
        assert r.duration_ms == 0
        assert r.next_phase is None


# ============================================================
# Checkpoint
# ============================================================

class TestCheckpoint:

    def test_to_dict(self):
        now = datetime.now()
        cp = Checkpoint(
            phase=WorkflowPhase.ACT,
            timestamp=now,
            state={"key": "val"},
            iteration=2,
        )
        d = cp.to_dict()
        assert d["phase"] == "act"
        assert d["iteration"] == 2
        assert d["state"] == {"key": "val"}
        assert d["timestamp"] == now.isoformat()


# ============================================================
# PlanActState
# ============================================================

class TestPlanActState:

    def test_defaults(self):
        s = PlanActState(session_id="s1")
        assert s.current_phase == WorkflowPhase.PLAN
        assert s.iteration == 0
        assert s.max_iterations == 3
        assert s.plan is None
        assert s.output is None
        assert s.checkpoints == []
        assert s.phase_history == []

    def test_save_checkpoint(self):
        s = PlanActState(session_id="s1")
        s.plan = {"step": 1}
        s.output = "text"
        cp = s.save_checkpoint()
        assert cp.phase == WorkflowPhase.PLAN
        assert cp.state["plan"] == {"step": 1}
        assert cp.state["output"] == "text"
        assert len(s.checkpoints) == 1

    def test_restore_checkpoint(self):
        s = PlanActState(session_id="s1")
        s.plan = {"step": 1}
        s.output = "text"
        s.current_phase = WorkflowPhase.ACT
        s.iteration = 2
        cp = s.save_checkpoint()

        # Modify state
        s.plan = None
        s.output = None
        s.current_phase = WorkflowPhase.REVIEW
        s.iteration = 5

        # Restore
        s.restore_checkpoint(cp)
        assert s.current_phase == WorkflowPhase.ACT
        assert s.iteration == 2
        assert s.plan == {"step": 1}
        assert s.output == "text"


# ============================================================
# PlanPhaseExecutor
# ============================================================

class TestPlanPhaseExecutor:

    @pytest.mark.asyncio
    async def test_default_plan(self):
        executor = PlanPhaseExecutor()
        state = PlanActState(session_id="s1")
        result = await executor.execute(state, {"task": "write chapter"})
        assert result.success is True
        assert result.next_phase == WorkflowPhase.ACT
        assert state.plan is not None
        assert state.plan["task"] == "write chapter"
        assert len(state.plan["steps"]) == 3

    @pytest.mark.asyncio
    async def test_with_architect(self):
        architect = MagicMock()
        architect.plan = AsyncMock(return_value={"custom": True})
        executor = PlanPhaseExecutor(architect)
        state = PlanActState(session_id="s1")
        result = await executor.execute(state, {"task": "test"})
        assert result.success is True
        assert state.plan == {"custom": True}

    @pytest.mark.asyncio
    async def test_architect_failure(self):
        architect = MagicMock()
        architect.plan = AsyncMock(side_effect=RuntimeError("fail"))
        executor = PlanPhaseExecutor(architect)
        state = PlanActState(session_id="s1")
        result = await executor.execute(state, {"task": "test"})
        assert result.success is False
        assert result.error is not None


# ============================================================
# ActPhaseExecutor
# ============================================================

class TestActPhaseExecutor:

    @pytest.mark.asyncio
    async def test_default_output(self):
        executor = ActPhaseExecutor()
        state = PlanActState(session_id="s1")
        state.plan = {
            "task": "write",
            "steps": [{"description": "step1"}, {"description": "step2"}],
        }
        result = await executor.execute(state, {"task": "write"})
        assert result.success is True
        assert result.next_phase == WorkflowPhase.REVIEW
        assert "step1" in state.output
        assert "step2" in state.output

    @pytest.mark.asyncio
    async def test_no_plan_fails(self):
        executor = ActPhaseExecutor()
        state = PlanActState(session_id="s1")
        result = await executor.execute(state, {"task": "test"})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_with_writer(self):
        writer = MagicMock()
        writer.write = AsyncMock(return_value="written content")
        executor = ActPhaseExecutor(writer)
        state = PlanActState(session_id="s1")
        state.plan = {"task": "test"}
        result = await executor.execute(state, {"task": "test"})
        assert result.success is True
        assert state.output == "written content"


# ============================================================
# ReviewPhaseExecutor
# ============================================================

class TestReviewPhaseExecutor:

    @pytest.mark.asyncio
    async def test_default_review_passes(self):
        executor = ReviewPhaseExecutor(quality_threshold=0.7)
        state = PlanActState(session_id="s1")
        state.output = "some content"
        result = await executor.execute(state, {})
        assert result.success is True
        # Default score 0.75 >= 0.7 threshold
        assert result.next_phase == WorkflowPhase.COMPLETE

    @pytest.mark.asyncio
    async def test_low_threshold_revise(self):
        executor = ReviewPhaseExecutor(quality_threshold=0.9)
        state = PlanActState(session_id="s1", max_iterations=3)
        state.output = "some content"
        result = await executor.execute(state, {})
        assert result.success is True
        # Default score 0.75 < 0.9 threshold, and iterations < max
        assert result.next_phase == WorkflowPhase.REVISE

    @pytest.mark.asyncio
    async def test_max_iterations_complete(self):
        executor = ReviewPhaseExecutor(quality_threshold=0.9)
        state = PlanActState(session_id="s1", max_iterations=3, iteration=3)
        state.output = "some content"
        result = await executor.execute(state, {})
        assert result.next_phase == WorkflowPhase.COMPLETE

    @pytest.mark.asyncio
    async def test_no_output_fails(self):
        executor = ReviewPhaseExecutor()
        state = PlanActState(session_id="s1")
        result = await executor.execute(state, {})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_with_critic(self):
        critic = MagicMock()
        critic.evaluate = AsyncMock(return_value={
            "overall_score": 0.95,
            "issues": [],
        })
        executor = ReviewPhaseExecutor(critic, quality_threshold=0.9)
        state = PlanActState(session_id="s1")
        state.output = "content"
        result = await executor.execute(state, {})
        assert result.success is True
        assert result.next_phase == WorkflowPhase.COMPLETE


# ============================================================
# RevisePhaseExecutor
# ============================================================

class TestRevisePhaseExecutor:

    @pytest.mark.asyncio
    async def test_default_revision_no_issues(self):
        executor = RevisePhaseExecutor()
        state = PlanActState(session_id="s1")
        state.output = "original"
        state.review_feedback = {"issues": []}
        result = await executor.execute(state, {})
        assert result.success is True
        assert result.next_phase == WorkflowPhase.REVIEW
        assert state.output == "original"
        assert state.iteration == 1

    @pytest.mark.asyncio
    async def test_default_revision_with_issues(self):
        executor = RevisePhaseExecutor()
        state = PlanActState(session_id="s1")
        state.output = "original"
        state.review_feedback = {"issues": ["issue1", "issue2"]}
        result = await executor.execute(state, {})
        assert result.success is True
        assert "Addressed 2 issues" in state.output

    @pytest.mark.asyncio
    async def test_no_output_fails(self):
        executor = RevisePhaseExecutor()
        state = PlanActState(session_id="s1")
        result = await executor.execute(state, {})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_with_writer(self):
        writer = MagicMock()
        writer.revise = AsyncMock(return_value="revised content")
        executor = RevisePhaseExecutor(writer)
        state = PlanActState(session_id="s1")
        state.output = "original"
        state.review_feedback = {"issues": []}
        result = await executor.execute(state, {})
        assert result.success is True
        assert state.output == "revised content"


# ============================================================
# PlanActMode
# ============================================================

class TestPlanActMode:

    @pytest.mark.asyncio
    async def test_full_workflow_default(self):
        mode = PlanActMode()
        result = await mode.execute("s1", "write a chapter")
        assert result.success is True
        assert result.phase == WorkflowPhase.COMPLETE
        assert result.output is not None

    @pytest.mark.asyncio
    async def test_get_state(self):
        mode = PlanActMode()
        await mode.execute("s1", "task")
        state = mode.get_state("s1")
        assert state is not None
        assert state.session_id == "s1"

    @pytest.mark.asyncio
    async def test_get_state_nonexistent(self):
        mode = PlanActMode()
        assert mode.get_state("unknown") is None

    @pytest.mark.asyncio
    async def test_clear_state(self):
        mode = PlanActMode()
        await mode.execute("s1", "task")
        assert mode.clear_state("s1") is True
        assert mode.get_state("s1") is None

    @pytest.mark.asyncio
    async def test_clear_state_nonexistent(self):
        mode = PlanActMode()
        assert mode.clear_state("unknown") is False

    @pytest.mark.asyncio
    async def test_list_sessions(self):
        mode = PlanActMode()
        await mode.execute("s1", "task1")
        await mode.execute("s2", "task2")
        sessions = mode.list_sessions()
        assert "s1" in sessions
        assert "s2" in sessions

    @pytest.mark.asyncio
    async def test_resume_from_checkpoint(self):
        mode = PlanActMode()
        await mode.execute("s1", "task")
        # Execute again with resume
        result = await mode.execute("s1", "task", resume_from_checkpoint=True)
        assert result.success is True

    @pytest.mark.asyncio
    async def test_with_context(self):
        mode = PlanActMode()
        result = await mode.execute("s1", "task", context={"genre": "mystery"})
        assert result.success is True

    @pytest.mark.asyncio
    async def test_execute_breaks_when_executor_missing(self):
        mode = PlanActMode()
        mode._executors.pop(WorkflowPhase.PLAN)

        result = await mode.execute("missing-executor", "task")

        assert result.success is True
        assert result.phase == WorkflowPhase.COMPLETE
        assert result.metadata["phase_count"] == 0

    @pytest.mark.asyncio
    async def test_execute_returns_phase_failure(self):
        mode = PlanActMode()
        failing = MagicMock()
        failing.execute = AsyncMock(
            return_value=PhaseResult.fail(WorkflowPhase.PLAN, RuntimeError("boom"))
        )
        mode._executors[WorkflowPhase.PLAN] = failing

        result = await mode.execute("phase-fail", "task")

        assert result.success is False
        assert isinstance(result.error, RuntimeError)
        assert str(result.error) == "boom"

    @pytest.mark.asyncio
    async def test_execute_breaks_when_next_phase_missing(self):
        mode = PlanActMode()
        one_step = MagicMock()
        one_step.execute = AsyncMock(
            return_value=PhaseResult.ok(
                phase=WorkflowPhase.PLAN,
                output={"ok": True},
                next_phase=None,
            )
        )
        mode._executors[WorkflowPhase.PLAN] = one_step

        result = await mode.execute("no-next-phase", "task")

        assert result.success is True
        assert result.phase == WorkflowPhase.COMPLETE
        assert result.metadata["phase_count"] == 1


# ============================================================
# get_default_plan_act_mode
# ============================================================

class TestGetDefaultPlanActMode:

    def test_returns_instance(self):
        mode = get_default_plan_act_mode()
        assert isinstance(mode, PlanActMode)

    def test_with_agents(self):
        a = MagicMock()
        w = MagicMock()
        c = MagicMock()
        mode = get_default_plan_act_mode(a, w, c)
        assert isinstance(mode, PlanActMode)
