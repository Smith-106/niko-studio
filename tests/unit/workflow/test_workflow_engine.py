"""
Workflow Engine Tests

Tests for WorkflowStep, WorkflowPlan, Checkpoint dataclasses,
and WorkflowEngine (route, plan, execute, checkpoint, restore, status).
"""

import pytest
from unittest.mock import patch, MagicMock
from src.workflow.workflow_engine import (
    WorkflowStep,
    WorkflowPlan,
    Checkpoint,
    WorkflowEngine,
)
from src.workflow.levels.types import WorkflowLevel


# ============================================================
# Dataclass Tests
# ============================================================

class TestWorkflowStep:

    def test_defaults(self):
        step = WorkflowStep(id="s1", name="analyze", description="Analyze task")
        assert step.status == "pending"
        assert step.dependencies == []
        assert step.output is None
        assert step.started_at is None
        assert step.completed_at is None

    def test_custom(self):
        step = WorkflowStep(
            id="s1",
            name="generate",
            description="Generate content",
            status="running",
            dependencies=["s0"],
        )
        assert step.status == "running"
        assert step.dependencies == ["s0"]


class TestWorkflowPlan:

    def test_defaults(self):
        plan = WorkflowPlan(id="p1", task="Write chapter", level="L3")
        assert plan.steps == []
        assert plan.status == "created"
        assert plan.created_at is not None
        assert plan.completed_at is None

    def test_with_steps(self):
        step = WorkflowStep(id="s1", name="analyze", description="Analyze")
        plan = WorkflowPlan(id="p1", task="task", level="L2", steps=[step])
        assert len(plan.steps) == 1


class TestCheckpoint:

    def test_defaults(self):
        cp = Checkpoint(id="cp1", description="Milestone 1")
        assert cp.commit_hash is None
        assert cp.plan_id is None
        assert cp.step_id is None
        assert cp.created_at is not None

    def test_custom(self):
        cp = Checkpoint(
            id="cp1",
            description="After chapter 1",
            commit_hash="abc12345",
            plan_id="p1",
        )
        assert cp.commit_hash == "abc12345"
        assert cp.plan_id == "p1"


# ============================================================
# WorkflowEngine Tests
# ============================================================

class TestWorkflowEngine:

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_route_default(self, engine):
        result = await engine.route("一些普通任务")
        assert "level" in result
        assert "level_slug" in result
        assert "description" in result
        assert "suggested_workflow" in result

    @pytest.mark.asyncio
    async def test_route_l1_keywords(self, engine):
        result = await engine.route("回答一个简单问题")
        assert result["level"] == "L1"
        assert result["level_slug"] == "rapid"

    @pytest.mark.asyncio
    async def test_route_l3_keywords(self, engine):
        result = await engine.route("写一章完整的小说")
        assert result["level"] == "L3"

    @pytest.mark.asyncio
    async def test_route_l5_keywords(self, engine):
        result = await engine.route("规划全书大纲")
        assert result["level"] == "L5"

    @pytest.mark.asyncio
    async def test_route_long_text_upgrade(self, engine):
        # Short task → L2, but long text upgrades to L3
        long_task = "写一段" + "A" * 150
        result = await engine.route(long_task)
        assert result["level"] == "L3"

    @pytest.mark.asyncio
    async def test_get_workflow_template_all_levels(self, engine):
        for level in WorkflowLevel:
            if level == WorkflowLevel.L5_BRAINSTORM:
                continue  # alias
            template = engine._get_workflow_template(level)
            assert isinstance(template, list)
            assert len(template) > 0

    @pytest.mark.asyncio
    async def test_plan_auto_route(self, engine):
        result = await engine.plan("写一章小说")
        assert "plan_id" in result
        assert "steps" in result
        assert "total_steps" in result
        assert result["total_steps"] > 0

    @pytest.mark.asyncio
    async def test_plan_specified_level(self, engine):
        result = await engine.plan("task", level="L1")
        assert result["level"] == "L1"
        assert result["total_steps"] == 1  # L1 has 1 step

    @pytest.mark.asyncio
    async def test_plan_l2(self, engine):
        result = await engine.plan("task", level="L2")
        assert result["level"] == "L2"
        assert result["total_steps"] == 3

    @pytest.mark.asyncio
    async def test_plan_steps_have_dependencies(self, engine):
        result = await engine.plan("task", level="L3")
        steps = result["steps"]
        # First step has no dependencies
        assert steps[0]["dependencies"] == []
        # Second step depends on first
        assert steps[0]["id"] in steps[1]["dependencies"]

    @pytest.mark.asyncio
    async def test_plan_stored(self, engine):
        result = await engine.plan("task", level="L2")
        assert result["plan_id"] in engine.plans

    @pytest.mark.asyncio
    async def test_execute_not_found(self, engine):
        result = await engine.execute("nonexistent")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_execute_step_not_found(self, engine):
        plan_result = await engine.plan("task", level="L1")
        result = await engine.execute(plan_result["plan_id"], step_id="nonexistent")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_execute_next_step(self, engine):
        plan_result = await engine.plan("task", level="L1")
        result = await engine.execute(plan_result["plan_id"])
        assert result["status"] == "completed"
        assert result["step_name"] == "answer"

    @pytest.mark.asyncio
    async def test_execute_all_completed(self, engine):
        plan_result = await engine.plan("task", level="L1")
        await engine.execute(plan_result["plan_id"])
        # All steps done
        result = await engine.execute(plan_result["plan_id"])
        assert result["status"] == "completed"
        assert result["message"] == "All steps completed"

    @pytest.mark.asyncio
    async def test_execute_dependency_check(self, engine):
        plan_result = await engine.plan("task", level="L2")
        # Try to execute step 2 before step 1
        steps = plan_result["steps"]
        result = await engine.execute(plan_result["plan_id"], step_id=steps[1]["id"])
        assert "error" in result
        assert "Dependency" in result["error"]

    @pytest.mark.asyncio
    async def test_execute_sequential(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]

        # Execute all 3 steps sequentially
        for _ in range(3):
            result = await engine.execute(plan_id)
            assert result["status"] == "completed"

        # Plan should be completed
        assert engine.plans[plan_id].status == "completed"

    @pytest.mark.asyncio
    async def test_execute_remaining_count(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]

        result = await engine.execute(plan_id)
        assert result["remaining_steps"] == 2

    @pytest.mark.asyncio
    async def test_execute_step_handlers(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]

        # Step 1: analyze
        r1 = await engine.execute(plan_id)
        assert "analysis" in r1["result"]

        # Step 2: match_skills
        r2 = await engine.execute(plan_id)
        assert "skills" in r2["result"]

        # Step 3: generate
        r3 = await engine.execute(plan_id)
        assert "content" in r3["result"]

    def test_get_plan_status_not_found(self, engine):
        result = engine.get_plan_status("nonexistent")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_get_plan_status(self, engine):
        plan_result = await engine.plan("task", level="L1")
        status = engine.get_plan_status(plan_result["plan_id"])
        assert status["plan_id"] == plan_result["plan_id"]
        assert status["status"] == "created"
        assert "progress" in status

    @pytest.mark.asyncio
    async def test_get_plan_status_after_execute(self, engine):
        plan_result = await engine.plan("task", level="L1")
        await engine.execute(plan_result["plan_id"])
        status = engine.get_plan_status(plan_result["plan_id"])
        assert status["status"] == "completed"
        assert status["progress"] == "1/1"


# ============================================================
# Checkpoint Tests (mocked Git)
# ============================================================

class TestCheckpoints:

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_create_checkpoint_no_git(self, engine):
        result = await engine.create_checkpoint(
            description="Test checkpoint",
            auto_commit=False,
        )
        assert "checkpoint_id" in result
        assert result["commit_hash"] is None
        assert result["description"] == "Test checkpoint"

    @pytest.mark.asyncio
    async def test_create_checkpoint_stored(self, engine):
        result = await engine.create_checkpoint(
            description="Stored",
            auto_commit=False,
        )
        assert result["checkpoint_id"] in engine.checkpoints

    @pytest.mark.asyncio
    async def test_create_checkpoint_with_git_failure(self, engine):
        with patch("subprocess.run", side_effect=FileNotFoundError("No git")):
            result = await engine.create_checkpoint(
                description="No git",
                auto_commit=True,
            )
        assert result["commit_hash"] is None

    @pytest.mark.asyncio
    async def test_restore_checkpoint_not_found(self, engine):
        result = await engine.restore_checkpoint("nonexistent")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_restore_checkpoint_no_hash(self, engine):
        cp_result = await engine.create_checkpoint("No hash", auto_commit=False)
        result = await engine.restore_checkpoint(cp_result["checkpoint_id"])
        assert "error" in result
        assert "No commit hash" in result["error"]

    @pytest.mark.asyncio
    async def test_restore_checkpoint_with_hash(self, engine):
        # Manually add checkpoint with hash
        cp = Checkpoint(id="cp1", description="test", commit_hash="abc123")
        engine.checkpoints["cp1"] = cp

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            result = await engine.restore_checkpoint("cp1")
        assert result["status"] == "restored"
        assert result["commit_hash"] == "abc123"

    @pytest.mark.asyncio
    async def test_restore_checkpoint_git_failure(self, engine):
        import subprocess
        cp = Checkpoint(id="cp1", description="test", commit_hash="abc123")
        engine.checkpoints["cp1"] = cp

        with patch("subprocess.run", side_effect=subprocess.CalledProcessError(1, "git")):
            result = await engine.restore_checkpoint("cp1")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_list_checkpoints_empty(self, engine):
        result = await engine.list_checkpoints()
        assert result == []

    @pytest.mark.asyncio
    async def test_list_checkpoints(self, engine):
        await engine.create_checkpoint("CP1", auto_commit=False)
        await engine.create_checkpoint("CP2", auto_commit=False)
        result = await engine.list_checkpoints()
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_list_checkpoints_limit(self, engine):
        for i in range(5):
            await engine.create_checkpoint(f"CP{i}", auto_commit=False)
        result = await engine.list_checkpoints(limit=2)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_list_checkpoints_sorted(self, engine):
        await engine.create_checkpoint("Old", auto_commit=False)
        await engine.create_checkpoint("New", auto_commit=False)
        result = await engine.list_checkpoints()
        # Sorted by created_at desc (newest first)
        assert result[0]["created_at"] >= result[1]["created_at"]
