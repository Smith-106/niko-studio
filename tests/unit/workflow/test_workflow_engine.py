"""
Workflow Engine Tests

Tests for WorkflowStep, WorkflowPlan, Checkpoint dataclasses,
and WorkflowEngine (route, plan, execute, checkpoint, restore, status).
"""

import json
from pathlib import Path
import pytest
from unittest.mock import patch, MagicMock
from src.workflow.workflow_engine import (
    WorkflowStep,
    WorkflowPlan,
    Checkpoint,
    WorkflowEngine,
    WORKFLOW_STATE_SCHEMA_VERSION,
)
from src.workflow.session.session_manager import ContentType
from src.workflow.levels.types import (
    WorkflowLevel,
    WorkflowDecision,
    ANALYSIS_SCHEMA_VERSION,
    LEGACY_CONTRACT_FIELD_MAP,
)
from src.workflow import graph as workflow_graph


# ============================================================
# Dataclass Tests
# ============================================================

class TestWorkflowStep:

    def test_defaults(self):
        step = WorkflowStep(id="s1", name="analyze", description="Analyze task")
        assert step.status == "planned"
        assert step.dependencies == []
        assert step.output is None
        assert step.started_at is None
        assert step.completed_at is None

    def test_custom(self):
        step = WorkflowStep(
            id="s1",
            name="generate",
            description="Generate content",
            status="executing",
            dependencies=["s0"],
        )
        assert step.status == "executing"
        assert step.dependencies == ["s0"]


class TestWorkflowPlan:

    def test_defaults(self):
        plan = WorkflowPlan(id="p1", task="Write chapter", level="L3")
        assert plan.steps == []
        assert plan.status == "created"
        assert plan.runner_state == "pending"
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

    def test_session_id_for_plan_uses_workspace_namespace(self, tmp_path):
        workspace = tmp_path / "novel_alpha_workspace"
        workspace.mkdir(parents=True, exist_ok=True)
        engine = WorkflowEngine(workspace=str(workspace))

        session_id = engine._session_id_for_plan("abc12345")

        assert session_id.startswith("novel_alpha_workspace--workflow-")
        assert session_id.endswith("abc12345")

    def test_session_id_for_plan_uses_explicit_namespace(self, tmp_path):
        workspace = tmp_path / "default_workspace"
        workspace.mkdir(parents=True, exist_ok=True)
        engine = WorkflowEngine(workspace=str(workspace), session_namespace="Novel A")

        session_id = engine._session_id_for_plan("abc12345")

        assert session_id.startswith("novel-a--workflow-")
        assert session_id.endswith("abc12345")

    def test_session_id_for_plan_is_stable_per_plan(self, engine):
        first = engine._session_id_for_plan("plan-001")
        second = engine._session_id_for_plan("plan-001")
        assert first == second

    @pytest.mark.asyncio
    async def test_route_default(self, engine):
        result = await engine.route("一些普通任务")
        assert "level" in result
        assert "level_slug" in result
        assert "description" in result
        assert "suggested_workflow" in result
        assert "matched_features" in result
        assert "score" in result
        assert "final_level" in result
        assert "routing_diagnostics" in result

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
        # Short task -> L2, but long text upgrades to L3
        long_task = "写一段" + "A" * 150
        result = await engine.route(long_task)
        assert result["level"] == "L3"

    @pytest.mark.asyncio
    async def test_route_variant_intent_with_diagnostics(self, engine):
        result = await engine.route("请简述这个设定的核心冲突并回答原因？")

        assert result["level"] == "L1"
        assert result["final_level"] == result["level"]
        assert isinstance(result["matched_features"], list)
        assert result["score"] >= 1
        assert isinstance(result["routing_diagnostics"]["level_scores"], dict)
        assert result["routing_diagnostics"]["feature_model"]["weights"]["keyword"] == 3
        assert result["routing_diagnostics"]["feature_model"]["thresholds"]["default_level"] == "L2"

    @pytest.mark.asyncio
    async def test_route_matched_features_have_explanations(self, engine):
        result = await engine.route("请简述这个设定的核心冲突并回答原因？")

        assert len(result["matched_features"]) > 0
        assert all("explanation" in feature for feature in result["matched_features"])
        assert result["routing_diagnostics"]["feature_model"]["category_explanations"]["history"] == "命中历史反馈信号"

    @pytest.mark.asyncio
    async def test_route_mixed_intent_prefers_highest_structured_score(self, engine):
        task = "请先回答这个问题，再给我写一章第3章的冲突场景"
        result = await engine.route(task)

        assert result["level"] in ["L3", "L4"]
        assert result["routing_diagnostics"]["final_level"] == result["level"]
        assert result["routing_diagnostics"]["baseline"]["legacy_level"] in ["L1", "L3", "L4"]

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
    async def test_plan_schema_contract_fields_completeness(self, engine):
        result = await engine.plan("task", level="L3")
        assert result["analysis_schema_version"] == ANALYSIS_SCHEMA_VERSION
        assert result["compatibility"]["soft_gate"] is True
        assert result["compatibility"]["legacy_field_map"] == LEGACY_CONTRACT_FIELD_MAP
        assert result["legacy_contract_fields"]["contract_version"] == ANALYSIS_SCHEMA_VERSION
        assert result["legacy_contract_fields"]["level"] == result["level"]
        assert result["legacy_contract_fields"]["level_slug"] == result["level_slug"]
        assert result["diagnostics"]["schema_version"] == ANALYSIS_SCHEMA_VERSION

    @pytest.mark.asyncio
    async def test_plan_recommendations_stable_ids_and_hash(self, engine):
        recommendations = [
            {"title": "补充冲突", "reason": "提升张力", "action": "增强对抗"},
            {"recommendation": "增加伏笔"},
        ]

        first = await engine.plan("写一章小说", level="L3", recommendations=recommendations)
        second = await engine.plan("写一章小说", level="L3", recommendations=recommendations)

        assert [item["id"] for item in first["recommendations"]] == ["rec-01", "rec-02"]
        assert [item["id"] for item in second["recommendations"]] == ["rec-01", "rec-02"]
        assert first["recommendations"][0]["target"] == ""
        assert first["recommendations"][0]["params"] == {}
        assert first["plan_hash"]
        assert second["plan_hash"]

    @pytest.mark.asyncio
    async def test_execute_freezes_recommendations(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L1",
            recommendations=[{"title": "强化开场"}],
        )
        plan_id = plan_result["plan_id"]

        result = await engine.execute(plan_id)

        assert result["status"] == "completed"
        assert engine.plans[plan_id].recommendations_frozen is True

    @pytest.mark.asyncio
    async def test_run_public_entry_completes_l1_workflow(self, engine):
        result = await engine.run("回答一个问题", level="L1")

        assert result["status"] == "completed"
        assert result["plan"]["level"] == "L1"
        assert result["final_status"]["status"] == "completed"

    def test_graph_legacy_entrypoints_emit_deprecation_warning(self):
        with patch("src.workflow.adapters.AdapterRegistry.create_adapter") as mock_create_adapter:
            mock_adapter = MagicMock()
            mock_adapter.create_graph.return_value = MagicMock()
            mock_create_adapter.return_value = mock_adapter
            with pytest.warns(DeprecationWarning):
                workflow_graph.create_writing_graph()

    @pytest.mark.asyncio
    async def test_execute_generate_draft_persists_generation_snapshot(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L3",
            recommendations=[
                {
                    "action": "set_generation_controls",
                    "params": {
                        "style": "cinematic",
                        "length": "long",
                        "constraints": ["avoid passive voice"],
                    },
                }
            ],
        )
        plan_id = plan_result["plan_id"]

        generate_result = None
        for _ in range(6):
            result = await engine.execute(plan_id)
            if result.get("step_name") == "generate_draft":
                generate_result = result
                break

        assert generate_result is not None
        snapshot_meta = generate_result.get("generation_snapshot")
        assert isinstance(snapshot_meta, dict)
        snapshot_path = Path(snapshot_meta["snapshot_path"])
        assert snapshot_path.exists()

        payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
        assert payload["artifact_type"] == "quality_revision"
        assert payload["schema_version"] == "evidence.v1"
        assert payload["input"]["controls"]["style"] == "cinematic"
        assert payload["input"]["controls"]["length"] == "long"
        assert payload["input"]["controls"]["constraints"] == ["avoid passive voice"]
        assert payload["trace"]["session_id"] == engine._session_id_for_plan(plan_id)
        assert payload["trace"]["run_id"] == f"run-{plan_id}"

    @pytest.mark.asyncio
    async def test_execute_generate_draft_repeated_run_trace_and_artifact_links_align(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L3",
            recommendations=[
                {
                    "action": "set_generation_controls",
                    "params": {
                        "style": "cinematic",
                        "length": "long",
                        "constraints": ["avoid passive voice"],
                    },
                }
            ],
        )
        plan_id = plan_result["plan_id"]
        session_id = engine._session_id_for_plan(plan_id)

        first_generate = None
        for _ in range(6):
            result = await engine.execute(plan_id)
            if result.get("step_name") == "generate_draft":
                first_generate = result
                break
        assert first_generate is not None

        first_meta = first_generate.get("generation_snapshot")
        assert isinstance(first_meta, dict)
        first_snapshot_path = Path(first_meta["snapshot_path"])
        assert first_snapshot_path.exists()

        first_payload = json.loads(first_snapshot_path.read_text(encoding="utf-8"))
        assert first_meta["trace"]["session_id"] == session_id
        assert first_meta["trace"]["run_id"] == f"run-{plan_id}"
        assert first_payload["trace"]["session_id"] == session_id
        assert first_payload["trace"]["run_id"] == f"run-{plan_id}"

        first_state_raw = engine.session_manager.read(session_id, ContentType.STATE)
        first_state = json.loads(first_state_raw)
        assert first_state["artifacts"]["state"] == str(
            engine.session_manager._resolve_path(session_id, ContentType.STATE)
        )
        assert first_payload["evidence_links"][1] == first_state["artifacts"]["state"]
        assert first_payload["evidence_links"][1].replace("\\", "/").endswith("/.data/state.json")

        follow_up = await engine.execute(plan_id)
        assert follow_up["status"] == "completed"

        second_payload = json.loads(first_snapshot_path.read_text(encoding="utf-8"))
        assert second_payload["trace"]["session_id"] == session_id
        assert second_payload["trace"]["run_id"] == f"run-{plan_id}"
        assert second_payload["trace"]["revision_id"] == first_payload["trace"]["revision_id"]

        second_state_raw = engine.session_manager.read(session_id, ContentType.STATE)
        second_state = json.loads(second_state_raw)
        assert second_state["artifacts"]["state"] == first_state["artifacts"]["state"]
        assert second_payload["evidence_links"][1] == second_state["artifacts"]["state"]
        assert second_payload["evidence_links"][1].replace("\\", "/").endswith("/.data/state.json")

        assert first_state["state_trace_id"] != second_state["state_trace_id"]

    @pytest.mark.asyncio
    async def test_execute_generate_draft_snapshot_includes_quality_controls(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L3",
            recommendations=[
                {
                    "action": "set_generation_controls",
                    "params": {
                        "style": "cinematic",
                        "length": "long",
                        "constraints": ["avoid passive voice"],
                    },
                },
                {
                    "action": "set_quality_controls",
                    "params": {
                        "quality_mode": "auto",
                        "quality_level": "medium",
                        "degrade_on_timeout": False,
                        "degrade_on_error": True,
                        "critical_gate_always_on": True,
                        "quality_phase_timeout_seconds": 12,
                    },
                },
            ],
        )
        plan_id = plan_result["plan_id"]

        generate_result = None
        for _ in range(6):
            result = await engine.execute(plan_id)
            if result.get("step_name") == "generate_draft":
                generate_result = result
                break

        assert generate_result is not None
        snapshot_meta = generate_result.get("generation_snapshot")
        assert isinstance(snapshot_meta, dict)
        payload = json.loads(Path(snapshot_meta["snapshot_path"]).read_text(encoding="utf-8"))
        assert payload["input"]["quality_controls"] == {
            "quality_mode": "auto",
            "quality_level": "medium",
            "degrade_on_timeout": False,
            "degrade_on_error": True,
            "critical_gate_always_on": True,
            "quality_phase_timeout_seconds": 12,
        }

    @pytest.mark.asyncio
    async def test_execute_generate_draft_rejects_invalid_quality_controls(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L3",
            recommendations=[
                {
                    "action": "set_generation_controls",
                    "params": {
                        "style": "cinematic",
                        "length": "long",
                        "constraints": ["avoid passive voice"],
                    },
                },
                {
                    "action": "set_quality_controls",
                    "params": {
                        "quality_mode": "invalid",
                        "quality_level": "high",
                    },
                },
            ],
        )
        plan_id = plan_result["plan_id"]

        for _ in range(4):
            await engine.execute(plan_id)

        failure = await engine.execute(plan_id)
        assert "error" in failure
        assert "set_quality_controls.quality_mode must be auto or manual" in failure["error"]

    @pytest.mark.asyncio
    async def test_plan_maintenance_lane_metrics_and_gate_profile(self, engine):
        result = await engine.plan("maintenance 修复任务", level="L2")

        assert result["template_meta"]["lane"] == "maintenance"
        assert result["template_meta"]["gate_profile"] == "maintenance-selective-hard"
        assert "quality_metrics" in result["template_meta"]
        assert result["template_meta"]["quality_metrics"]["risk_score"] >= 0.75

    @pytest.mark.asyncio
    async def test_lifecycle_maintenance_stop_keeps_active_session(self, engine):
        plan_result = await engine.plan("maintenance 修复任务", level="L2")
        plan_id = plan_result["plan_id"]

        started = await engine.lifecycle(plan_id, "start")
        assert started["session_status"] == "active"
        assert started["state_mapping"]["stopped"] == "active"

        paused = await engine.lifecycle(plan_id, "pause")
        assert paused["session_status"] == "checkpointed"

        stopped = await engine.lifecycle(plan_id, "stop")
        assert stopped["runner_state"] == "stopped"
        assert stopped["session_status"] == "active"
        assert stopped["state_mapping"]["stopped"] == "active"

        status = await engine.lifecycle(plan_id, "status")
        assert status["runner_state"] == "stopped"
        assert status["session_status"] == "active"
        assert status["lane"] == "maintenance"
        assert "quality_metrics" in status

    @pytest.mark.asyncio
    async def test_plan_default_lane_keeps_soft_profile(self, engine):
        result = await engine.plan("普通问答", level="L1")

        assert result["template_meta"]["lane"] == "default"
        assert result["template_meta"]["gate_profile"] == "rapid-soft"

    @pytest.mark.asyncio
    async def test_execute_not_found(self, engine):
        result = await engine.execute("nonexistent")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_execute_preflight_blocked_when_project_tech_stale_and_policy_block(self, engine, tmp_path, monkeypatch):
        plan_result = await engine.plan("task", level="L1")
        plan_id = plan_result["plan_id"]

        project_tech_path = tmp_path / ".workflow" / "project-tech.json"
        project_tech_path.parent.mkdir(parents=True, exist_ok=True)
        project_tech_path.write_text(
            json.dumps(
                {
                    "freshness": {
                        "generated_at": "2000-01-01T00:00:00+00:00",
                        "source": "unit:test",
                        "schema_version": "1.1.0",
                        "ttl_hours": 1,
                    },
                    "_metadata": {
                        "analysis_timestamp": "2000-01-01T00:00:00+00:00",
                        "analysis_mode": "unit:test",
                        "version": "1.0.0",
                    },
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        monkeypatch.setenv("NIKO_PROJECT_TECH_STALE_POLICY", "block")

        result = await engine.execute(plan_id)

        assert result["status"] == "preflight_blocked"
        assert result["error"] == "project-tech freshness preflight blocked execution"
        assert result["freshness_preflight"]["status"] == "stale"
        assert result["freshness_preflight"]["blocking"] is True
        assert result["plan_status"] == "running"
        assert result["runner_state"] == "running"
        assert "observability_metrics" in result
        assert "budget_guardrail" in result

        monkeypatch.delenv("NIKO_PROJECT_TECH_STALE_POLICY", raising=False)

    @pytest.mark.asyncio
    async def test_execute_step_not_found(self, engine):
        plan_result = await engine.plan("task", level="L1")
        result = await engine.execute(plan_result["plan_id"], step_id="nonexistent")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_execute_returns_concurrency_payload_without_conflict(self, engine):
        plan_result = await engine.plan("task", level="L1")

        result = await engine.execute(plan_result["plan_id"])

        assert result["status"] == "completed"
        assert result["concurrency"]["serialized"] is False
        assert result["concurrency"]["conflict_modules"] == []
        assert any(item["module"] == "workflow:answer" for item in result["concurrency"]["ownership"])

    @pytest.mark.asyncio
    async def test_execute_conflict_modules_auto_serialized(self, engine):
        plan_result = await engine.plan(
            "task",
            level="L1",
            recommendations=[{"action": "module:shared-core"}],
        )
        plan_id = plan_result["plan_id"]

        engine._module_owners["module:shared-core"] = "external-plan"

        result = await engine.execute(plan_id)

        assert result["status"] == "completed"
        assert result["concurrency"]["serialized"] is True
        assert "module:shared-core" in result["concurrency"]["conflict_modules"]
        assert "module:shared-core" not in engine._module_owners

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        events = [json.loads(line) for line in lines]
        assert any(event.get("event_type") == "module_conflict_serialized" for event in events)

    @pytest.mark.asyncio
    async def test_execute_all_completed(self, engine):
        plan_result = await engine.plan("task", level="L1")
        await engine.execute(plan_result["plan_id"])
        # All steps done
        result = await engine.execute(plan_result["plan_id"])
        assert result["status"] == "completed"
        assert result["message"] == "All steps completed"
        assert result["execution_mode"] in {"Autopilot", "Team", "Pipeline/Ralph", "EcoMode"}
        assert "observability_metrics" in result
        assert "budget_guardrail" in result
        assert "completion_rate" in result["observability_metrics"]

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
        assert "task" in r1["result"]
        assert "intent" in r1["result"]

        # Step 2: match_skills
        r2 = await engine.execute(plan_id)
        assert "skills" in r2["result"]

        # Step 3: generate
        r3 = await engine.execute(plan_id)
        assert "content" in r3["result"]
        assert r3["result"]["content"].startswith("任务：")

    @pytest.mark.asyncio
    async def test_execute_unknown_step_returns_error(self, engine):
        plan_result = await engine.plan("task", level="L1")
        plan_id = plan_result["plan_id"]

        engine.plans[plan_id].steps[0].name = "unknown_step"

        result = await engine.execute(plan_id)
        assert "error" in result
        assert "Unsupported workflow step" in result["error"]

    @pytest.mark.asyncio
    async def test_execute_hard_gate_decision_waiting_confirmation(self, engine):
        plan_result = await engine.plan("写一章完整的小说", level="L3")
        plan_id = plan_result["plan_id"]

        while True:
            result = await engine.execute(plan_id)
            if result.get("status") == "waiting_confirmation":
                break
            if result.get("status") == "completed" and result.get("message") == "All steps completed":
                pytest.fail("destructive step was not executed")

        assert result["gate"]["decision"] == WorkflowDecision.NO_GO.value
        assert result["gate"]["blocking"] is True
        assert result["gate"]["confirm_required"] is True
        assert result["execution_mode"] in {"Autopilot", "Team", "Pipeline/Ralph", "EcoMode"}
        assert "observability_metrics" in result
        assert "budget_guardrail" in result

    @pytest.mark.asyncio
    async def test_wave_gate_blocks_progression_on_fail(self, engine):
        plan_result = await engine.plan(
            "回答一个问题",
            level="L1",
            recommendations=[{"action": "require_wave_gate"}, {"action": "force_gate_fail"}],
        )
        plan_id = plan_result["plan_id"]

        result = await engine.execute(plan_id)
        assert result["status"] == "gate_blocked"
        assert result["blocked"] is True
        assert result["gate_chain"]["required"] is True
        assert result["gate_chain"]["passed"] is False
        assert result["gate_chain"]["failed_gate"] == "review-session-cycle"
        assert result["recovery"]["status"] == "awaiting_execute"
        assert result["recovery"]["current_step"] == "execute"
        assert engine.plans[plan_id].status == "failed"

    @pytest.mark.asyncio
    async def test_wave_gate_pass_creates_completion_checkpoint(self, engine):
        plan_result = await engine.plan(
            "回答一个问题",
            level="L1",
            recommendations=[{"action": "require_wave_gate"}],
        )
        plan_id = plan_result["plan_id"]

        result = await engine.execute(plan_id)
        assert result["status"] == "completed"
        assert result["gate_chain"]["required"] is True
        assert result["gate_chain"]["passed"] is True
        checkpoint_id = result["wave_completion_checkpoint_id"]
        assert checkpoint_id
        assert checkpoint_id in engine.checkpoints

    @pytest.mark.asyncio
    async def test_get_plan_status(self, engine):
        plan_result = await engine.plan("task", level="L1")
        status = engine.get_plan_status(plan_result["plan_id"])
        assert status["plan_id"] == plan_result["plan_id"]
        assert status["status"] == "created"
        assert "progress" in status
        assert status["execution_mode"] in {"Autopilot", "Team", "Pipeline/Ralph", "EcoMode"}
        assert "observability_metrics" in status
        assert "budget_guardrail" in status
        assert "handoff_package" in status
        assert status["fix_status"] == "unfixed"
        assert status["fix_owner"] == ""
        assert "completion_rate" in status["observability_metrics"]

    @pytest.mark.asyncio
    async def test_lifecycle_start_pause_resume_stop_status(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]

        started = await engine.lifecycle(plan_id, "start")
        assert started["runner_state"] == "running"
        assert started["triage_state"] == "open"
        assert started["session_status"] == "active"

        paused = await engine.lifecycle(plan_id, "pause")
        assert paused["runner_state"] == "paused"
        assert paused["triage_state"] == "open"
        assert paused["session_status"] == "checkpointed"
        assert paused["checkpoint_id"]

        resumed = await engine.lifecycle(plan_id, "resume")
        assert resumed["runner_state"] == "running"
        assert resumed["triage_state"] == "open"
        assert resumed["session_status"] == "active"

        stopped = await engine.lifecycle(plan_id, "stop")
        assert stopped["runner_state"] == "stopped"
        assert stopped["triage_state"] == "open"
        assert stopped["session_status"] == "archived"

        status = await engine.lifecycle(plan_id, "status")
        assert status["runner_state"] == "stopped"
        assert status["triage_state"] == "open"
        assert status["session_status"] == "archived"
        assert "budget_guardrail" in status
        assert "execution_mode" in status

    @pytest.mark.asyncio
    async def test_lifecycle_valid_triage_transition_persists_state_and_audit(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]

        result = await engine.lifecycle(plan_id, "start", triage_state="in_progress")
        assert result["runner_state"] == "running"
        assert result["triage_state"] == "in_progress"
        assert result["fix_status"] == "in_progress"
        assert result["fix_owner"] == plan_id

        status = await engine.lifecycle(plan_id, "status")
        assert status["triage_state"] == "in_progress"
        assert status["fix_status"] == "in_progress"
        assert status["fix_owner"] == plan_id

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        triage_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "triage_state_transition"]
        assert triage_events
        latest = triage_events[-1]
        assert latest["payload"]["from"] == "open"
        assert latest["payload"]["to"] == "in_progress"
        assert latest["payload"]["reason"] == "lifecycle:start"

    @pytest.mark.asyncio
    async def test_lifecycle_invalid_triage_transition_guard(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]

        result = await engine.lifecycle(plan_id, "start", triage_state="resolved")
        assert "error" in result
        assert "Invalid triage transition" in result["error"]
        assert result["transition_rejection"]["from"] == "open"
        assert result["transition_rejection"]["to"] == "resolved"
        assert result["transition_rejection"]["action"] == "start"
        assert result["transition_rejection"]["reason_code"] == "invalid_triage_transition"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        rejected_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "triage_state_transition_rejected"]
        assert rejected_events
        latest = rejected_events[-1]
        assert latest["event_type"] == "triage_state_transition_rejected"
        assert latest["payload"]["from"] == "open"
        assert latest["payload"]["to"] == "resolved"
        assert latest["payload"]["reason_code"] == "invalid_triage_transition"

        gate_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "gate_approval_trace"]
        assert gate_events
        triage_gate_events = [event for event in gate_events if event.get("payload", {}).get("gate_name") == "triage_transition_guard"]
        assert triage_gate_events
        latest_gate = triage_gate_events[-1]
        assert latest_gate["payload"]["decision"] == "reject"
        assert latest_gate["payload"]["reason_code"] == "invalid_triage_transition"
        assert latest_gate["payload"]["trace"]["session_id"] == session_id

    @pytest.mark.asyncio
    async def test_lifecycle_escalation_persists_actor_reason_metadata(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]

        await engine.lifecycle(plan_id, "start", triage_state="in_progress")
        escalated = await engine.lifecycle(plan_id, "resume", triage_state="escalated")
        assert escalated["triage_state"] == "escalated"
        assert escalated["fix_status"] == "in_progress"
        assert escalated["fix_owner"] == plan_id

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]

        escalation_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "triage_escalation"]
        assert escalation_events
        latest = escalation_events[-1]
        assert latest["payload"]["actor"] == "workflow_engine"
        assert latest["payload"]["reason"] == "lifecycle:resume"
        assert latest["payload"]["reason_code"] == "triage_escalated"
        assert latest["payload"]["fix_status"] == "in_progress"
        assert latest["payload"]["fix_owner"] == plan_id

        gate_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "gate_approval_trace"]
        escalation_gate_events = [
            event for event in gate_events
            if event.get("payload", {}).get("gate_name") == "triage_escalation"
        ]
        assert escalation_gate_events
        latest_gate = escalation_gate_events[-1]
        assert latest_gate["payload"]["decision"] == "escalate"
        assert latest_gate["payload"]["reason_code"] == "triage_escalated"
        assert latest_gate["payload"]["actor"] == "workflow_engine"

    @pytest.mark.asyncio
    async def test_lifecycle_invalid_transition_guard(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]
        result = await engine.lifecycle(plan_id, "pause")
        assert "error" in result
        assert "Invalid runner transition" in result["error"]
        assert result["transition_rejection"]["from"] == "pending"
        assert result["transition_rejection"]["to"] == "paused"
        assert result["transition_rejection"]["action"] == "pause"
        assert result["transition_rejection"]["reason_code"] == "invalid_runner_transition"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        assert lines
        rejected_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "runner_state_transition_rejected"]
        assert rejected_events
        latest = rejected_events[-1]
        assert latest["event_type"] == "runner_state_transition_rejected"
        assert latest["payload"]["from"] == "pending"
        assert latest["payload"]["to"] == "paused"
        assert latest["payload"]["reason_code"] == "invalid_runner_transition"

        gate_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "gate_approval_trace"]
        assert gate_events
        latest_gate = gate_events[-1]
        assert latest_gate["payload"]["gate_name"] == "runner_transition_guard"
        assert latest_gate["payload"]["decision"] == "reject"
        assert latest_gate["payload"]["reason_code"] == "invalid_runner_transition"
        assert latest_gate["payload"]["trace"]["session_id"] == session_id

    @pytest.mark.asyncio
    async def test_lifecycle_pause_and_stop_generate_handoff_package(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]

        await engine.lifecycle(plan_id, "start")
        paused = await engine.lifecycle(plan_id, "pause")
        assert "handoff_package" in paused
        assert paused["handoff_package"]["trigger"] == "pause"
        assert paused["handoff_package"]["next_command"].startswith("workflow_execute")
        assert paused["handoff_package"]["stage_owner"] == plan_id
        assert paused["handoff_package"]["ownership_model"] == "plan_owner"
        assert paused["handoff_package"]["phase_owners"]["executing"] == plan_id
        assert paused["handoff_package"]["triage_state"] == "open"
        assert paused["handoff_package"]["fix_status"] == "unfixed"
        assert paused["handoff_package"]["fix_owner"] == ""

        await engine.lifecycle(plan_id, "resume", triage_state="escalated")
        stopped = await engine.lifecycle(plan_id, "stop")
        assert "handoff_package" in stopped
        assert stopped["handoff_package"]["trigger"] == "stop"
        assert stopped["handoff_package"]["triage_state"] == "escalated"
        assert stopped["handoff_package"]["fix_status"] == "in_progress"
        assert stopped["handoff_package"]["fix_owner"] == plan_id

        session_id = engine._session_id_for_plan(plan_id)
        handoff_path = engine.session_manager._resolve_path(session_id, ContentType.HANDOFF)
        assert handoff_path.exists()

    @pytest.mark.asyncio
    async def test_budget_guardrail_triggers_ecomode(self, engine):
        long_task = "超长任务" + ("细节" * 4000)
        plan_result = await engine.plan(long_task, level="L1")
        plan_id = plan_result["plan_id"]

        assert plan_result["budget_guardrail"]["threshold_triggered"] is True
        assert plan_result["budget_guardrail"]["degraded"] is True
        assert plan_result["execution_mode"] == "EcoMode"

        status = engine.get_plan_status(plan_id)
        assert status["execution_mode"] == "EcoMode"
        assert status["budget_guardrail"]["degraded"] is True
        assert status["budget_guardrail"]["degrade_mode"] == "EcoMode"


    @pytest.mark.asyncio
    async def test_lifecycle_invalid_action(self, engine):
        plan_result = await engine.plan("task", level="L2")
        result = await engine.lifecycle(plan_result["plan_id"], "noop")
        assert "error" in result
        assert "Unsupported lifecycle action" in result["error"]

    @pytest.mark.asyncio
    async def test_execute_blocked_when_paused(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]
        await engine.lifecycle(plan_id, "start")
        await engine.lifecycle(plan_id, "pause")

        result = await engine.execute(plan_id)
        assert "error" in result
        assert "paused" in result["error"]

    @pytest.mark.asyncio
    async def test_execute_blocked_when_stopped(self, engine):
        plan_result = await engine.plan("task", level="L2")
        plan_id = plan_result["plan_id"]
        await engine.lifecycle(plan_id, "start")
        await engine.lifecycle(plan_id, "stop")

        result = await engine.execute(plan_id)
        assert "error" in result
        assert "stopped" in result["error"]


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
            plan_id="plan-1",
            step_id="plan-1-0",
            replay_payload={"plan_id": "plan-1", "recommendations": [{"title": "x"}]},
        )
        checkpoint = engine.checkpoints[result["checkpoint_id"]]
        assert checkpoint.plan_id == "plan-1"
        assert checkpoint.step_id == "plan-1-0"
        assert checkpoint.replay_payload["plan_id"] == "plan-1"

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
    async def test_restore_checkpoint_applies_replay_payload(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L1",
            recommendations=[{"title": "原建议"}],
        )
        plan_id = plan_result["plan_id"]
        plan = engine.plans[plan_id]

        checkpoint = Checkpoint(
            id="cp-replay",
            description="replay",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": plan.plan_hash,
                "recommendations": [{"title": "恢复建议", "reason": "回放"}],
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        pending = await engine.restore_checkpoint("cp-replay")

        assert pending["status"] == "waiting_confirmation"
        assert pending["replay"]["applied"] is False

        result = await engine.restore_checkpoint("cp-replay", confirm_token="ok")

        assert "error" in result
        assert result["gate"]["confirmed"] is True
        assert result["replay"]["applied"] is True
        assert result["replay"]["plan_id"] == plan_id
        assert engine.plans[plan_id].recommendations[0]["id"] == "rec-01"
        assert engine.plans[plan_id].recommendations[0]["title"] == "恢复建议"
        assert engine.plans[plan_id].recommendations_frozen is True

    @pytest.mark.asyncio
    async def test_restore_checkpoint_plan_hash_mismatch(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L1",
            recommendations=[{"title": "建议A"}],
        )
        plan_id = plan_result["plan_id"]

        checkpoint = Checkpoint(
            id="cp-mismatch",
            description="mismatch",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": "invalid-hash",
                "recommendations": [{"title": "恢复建议"}],
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        pending = await engine.restore_checkpoint("cp-mismatch")

        assert pending["status"] == "waiting_confirmation"
        assert pending["replay"]["applied"] is False

        result = await engine.restore_checkpoint("cp-mismatch", confirm_token="ok")

        assert "error" in result
        assert result["gate"]["confirmed"] is True
        assert result["replay"]["applied"] is False
        assert result["replay"]["reason"] == "plan_hash_mismatch"

    @pytest.mark.asyncio
    async def test_restore_checkpoint_replay_reports_snapshot_controls(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L3",
            recommendations=[
                {
                    "action": "set_generation_controls",
                    "params": {
                        "style": "cinematic",
                        "length": "long",
                        "constraints": ["avoid passive voice"],
                    },
                }
            ],
        )
        plan_id = plan_result["plan_id"]

        for _ in range(6):
            step_result = await engine.execute(plan_id)
            if step_result.get("step_name") == "generate_draft":
                break

        checkpoint = Checkpoint(
            id="cp-replay-controls",
            description="replay-controls",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": engine.plans[plan_id].plan_hash,
                "recommendations": engine.plans[plan_id].recommendations,
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        pending = await engine.restore_checkpoint("cp-replay-controls")
        assert pending["status"] == "waiting_confirmation"

        result = await engine.restore_checkpoint("cp-replay-controls", confirm_token="ok")

        assert "error" in result
        replay = result["replay"]
        assert replay["applied"] is True
        assert replay["generation_controls_source"] == "snapshot"
        assert replay["generation_controls"] == {
            "style": "cinematic",
            "length": "long",
            "constraints": ["avoid passive voice"],
        }
        assert replay["snapshot_generation_controls"] == replay["generation_controls"]
        assert replay["snapshot_path"].replace("\\", "/").endswith(f".data/generation-snapshots/{plan_id}-generate_draft.json")
        assert replay["snapshot_trace_id"] == f"run-{plan_id}"

    @pytest.mark.asyncio
    async def test_restore_checkpoint_rejects_generation_controls_mismatch(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L3",
            recommendations=[
                {
                    "action": "set_generation_controls",
                    "params": {
                        "style": "cinematic",
                        "length": "long",
                        "constraints": ["avoid passive voice"],
                    },
                }
            ],
        )
        plan_id = plan_result["plan_id"]

        for _ in range(6):
            step_result = await engine.execute(plan_id)
            if step_result.get("step_name") == "generate_draft":
                break

        checkpoint = Checkpoint(
            id="cp-controls-mismatch",
            description="controls-mismatch",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "recommendations": [
                    {
                        "action": "set_generation_controls",
                        "params": {
                            "style": "minimal",
                            "length": "short",
                            "constraints": ["dialogue only"],
                        },
                    }
                ],
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        pending = await engine.restore_checkpoint("cp-controls-mismatch")
        assert pending["status"] == "waiting_confirmation"

        result = await engine.restore_checkpoint("cp-controls-mismatch", confirm_token="ok")

        assert "error" in result
        assert result["replay"]["applied"] is False
        assert result["replay"]["reason"] == "generation_controls_mismatch"

    @pytest.mark.asyncio
    async def test_restore_checkpoint_rejects_invalid_generation_snapshot_json(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L1",
            recommendations=[
                {
                    "action": "set_generation_controls",
                    "params": {
                        "style": "cinematic",
                        "length": "long",
                        "constraints": ["avoid passive voice"],
                    },
                }
            ],
        )
        plan_id = plan_result["plan_id"]

        session_id = engine._session_id_for_plan(plan_id)
        snapshot_path = engine.session_manager._resolve_path(
            session_id,
            ContentType.GENERATION_SNAPSHOT,
            id=f"{plan_id}-generate_draft",
        )
        snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        snapshot_path.write_text("{bad", encoding="utf-8")

        checkpoint = Checkpoint(
            id="cp-invalid-snapshot",
            description="invalid-snapshot",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "recommendations": engine.plans[plan_id].recommendations,
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        pending = await engine.restore_checkpoint("cp-invalid-snapshot")
        assert pending["status"] == "waiting_confirmation"

        result = await engine.restore_checkpoint("cp-invalid-snapshot", confirm_token="ok")

        assert "error" in result
        assert result["replay"]["applied"] is False
        assert result["replay"]["reason"] == "generation_snapshot_invalid_json"


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


class TestRiskGateAudit:

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_execute_destructive_requires_confirmation(self, engine):
        plan_result = await engine.plan("写一章完整的小说", level="L3")
        plan_id = plan_result["plan_id"]

        while True:
            result = await engine.execute(plan_id)
            if result.get("status") == "waiting_confirmation":
                break
            if result.get("status") == "completed" and result.get("message") == "All steps completed":
                pytest.fail("destructive step was not reached")

        assert result["gate"]["confirm_required"] is True
        assert result["gate"]["confirmed"] is False
        assert result["gate"]["destructive"] is True
        assert result["current_phase"] == "planned"
        assert result["state_trace_id"]
        assert result["can_resume_from_checkpoint"] is False

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        assert lines
        confirm_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "confirm_trace"]
        assert confirm_events
        latest = confirm_events[-1]
        assert latest["event_type"] == "confirm_trace"
        assert latest["payload"]["confirmed"] is False

    @pytest.mark.asyncio
    async def test_execute_destructive_confirmed_creates_precheck_checkpoint(self, engine):
        plan_result = await engine.plan("写一章完整的小说", level="L3")
        plan_id = plan_result["plan_id"]

        waiting_step_id = None
        while True:
            first = await engine.execute(plan_id)
            if first.get("status") == "waiting_confirmation":
                waiting_step_id = first["step_id"]
                break
            if first.get("status") == "completed" and first.get("message") == "All steps completed":
                pytest.fail("destructive step was not reached")

        resumed = await engine.execute(plan_id, step_id=waiting_step_id, confirm_token="ok")
        assert resumed["status"] == "completed"
        assert resumed["gate"]["confirm_required"] is True
        assert resumed["gate"]["confirmed"] is True
        assert resumed["rollback_checkpoint_id"]

    @pytest.mark.asyncio
    async def test_execute_failure_triggers_quick_rollback_trace(self, engine):
        plan_result = await engine.plan("写一章完整的小说", level="L3")
        plan_id = plan_result["plan_id"]

        waiting_step_id = None
        while True:
            first = await engine.execute(plan_id)
            if first.get("status") == "waiting_confirmation":
                waiting_step_id = first["step_id"]
                break
            if first.get("status") == "completed" and first.get("message") == "All steps completed":
                pytest.fail("destructive step was not reached")

        with patch.object(engine, "_execute_step", side_effect=RuntimeError("forced failure")):
            failed = await engine.execute(plan_id, step_id=waiting_step_id, confirm_token="ok")

        assert "error" in failed
        assert failed.get("rollback") is not None
        assert failed["rollback"]["checkpoint_id"]
        assert failed["failure"]["phase"] == "executing"
        assert failed["failure"]["reason"] == "forced failure"
        assert failed["recovery"]["status"] == "awaiting_execute"
        assert failed["recovery"]["current_step"] == "execute"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        events = [json.loads(line) for line in lines]
        assert any(event.get("event_type") == "recovery_chain_ready" for event in events)

        recovery_ready_events = [
            event for event in events if event.get("event_type") == "recovery_chain_ready"
        ]
        assert recovery_ready_events[-1]["payload"]["current_step"] == "execute"

        recovery_step_events = [
            event for event in events if event.get("event_type") == "recovery_chain_step"
        ]
        assert [event["payload"]["step"] for event in recovery_step_events] == [
            "analyze-with-file",
            "plan",
            "plan-verify",
            "execute",
        ]

    @pytest.mark.asyncio
    async def test_restore_destructive_requires_confirmation_then_allows(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L1",
            recommendations=[{"title": "恢复建议"}],
        )
        plan_id = plan_result["plan_id"]
        plan = engine.plans[plan_id]

        checkpoint = Checkpoint(
            id="cp-restore-gate",
            description="restore gate",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": plan.plan_hash,
                "recommendations": [{"title": "恢复建议", "reason": "回放"}],
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        pending = await engine.restore_checkpoint("cp-restore-gate")
        assert pending["status"] == "waiting_confirmation"
        assert pending["gate"]["confirm_required"] is True
        assert pending["gate"]["confirmed"] is False

        confirmed = await engine.restore_checkpoint("cp-restore-gate", confirm_token="ok")
        assert "error" in confirmed
        assert confirmed["gate"]["confirm_required"] is True
        assert confirmed["gate"]["confirmed"] is True

    @pytest.mark.asyncio
    async def test_recovery_chain_resume_reuses_existing_envelope(self, engine):
        plan_result = await engine.plan("回答一个问题", level="L1")
        plan_id = plan_result["plan_id"]
        plan = engine.plans[plan_id]

        existing_recovery = {
            "recovery_id": "rcv-01",
            "status": "awaiting_execute",
            "current_index": 3,
            "current_step": "execute",
            "chain": [
                {"name": "analyze-with-file", "status": "done", "started_at": "2026-01-01T00:00:00", "completed_at": "2026-01-01T00:00:00"},
                {"name": "plan", "status": "done", "started_at": "2026-01-01T00:00:00", "completed_at": "2026-01-01T00:00:00"},
                {"name": "plan-verify", "status": "done", "started_at": "2026-01-01T00:00:00", "completed_at": "2026-01-01T00:00:00"},
                {"name": "execute", "status": "pending", "started_at": "2026-01-01T00:00:00", "completed_at": None},
            ],
            "failure": {
                "phase": "executing",
                "reason": "existing failure",
                "step_id": plan.steps[0].id,
                "checkpoint_id": "cp-existing",
            },
            "recovery_checkpoint_id": "cp-existing",
            "resume_ready": True,
            "updated_at": "2026-01-01T00:00:00",
        }
        engine._persist_plan_state(plan, current_phase="recovery", recovery_envelope=existing_recovery)

        resumed = await engine._trigger_recovery_chain(
            plan=plan,
            failure_phase="executing",
            failure_reason="new failure",
            failed_step_id=plan.steps[0].id,
            checkpoint_id="cp-new",
        )

        assert resumed["recovery_id"] == "rcv-01"
        assert resumed["failure"]["reason"] == "existing failure"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        events = [json.loads(line) for line in lines]
        assert events[-1]["event_type"] == "recovery_chain_resume"

    @pytest.mark.asyncio
    async def test_restore_waiting_confirmation_does_not_apply_replay(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L1",
            recommendations=[{"title": "原始建议", "reason": "origin"}],
        )
        plan_id = plan_result["plan_id"]
        plan = engine.plans[plan_id]
        original_recommendations = json.loads(json.dumps(plan.recommendations, ensure_ascii=False))

        checkpoint = Checkpoint(
            id="cp-restore-replay-guard",
            description="restore replay guard",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": plan.plan_hash,
                "recommendations": [{"title": "恢复建议", "reason": "replay"}],
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        pending = await engine.restore_checkpoint("cp-restore-replay-guard")
        assert pending["status"] == "waiting_confirmation"
        assert engine.plans[plan_id].recommendations == original_recommendations

        confirmed = await engine.restore_checkpoint("cp-restore-replay-guard", confirm_token="ok")
        assert "error" in confirmed
        assert engine.plans[plan_id].recommendations[0]["title"] == "恢复建议"

    @pytest.mark.asyncio
    async def test_restore_whitespace_confirm_token_still_requires_confirmation(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L1",
            recommendations=[{"title": "恢复建议"}],
        )
        plan_id = plan_result["plan_id"]
        plan = engine.plans[plan_id]

        checkpoint = Checkpoint(
            id="cp-restore-whitespace-token",
            description="restore whitespace token",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": plan.plan_hash,
                "recommendations": [{"title": "恢复建议", "reason": "回放"}],
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        pending = await engine.restore_checkpoint("cp-restore-whitespace-token", confirm_token="  ")
        assert pending["status"] == "waiting_confirmation"
        assert pending["gate"]["confirmed"] is False

    @pytest.mark.asyncio
    async def test_quick_rollback_auto_confirms_destructive_restore(self, engine):
        plan_result = await engine.plan(
            "写一章小说",
            level="L1",
            recommendations=[{"title": "原始建议", "reason": "origin"}],
        )
        plan_id = plan_result["plan_id"]
        plan = engine.plans[plan_id]

        checkpoint = Checkpoint(
            id="cp-quick-rollback-guard",
            description="quick rollback guard",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": plan.plan_hash,
                "recommendations": [{"title": "回滚后建议", "reason": "rollback"}],
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[checkpoint.id] = checkpoint

        result = await engine.quick_rollback(plan_id=plan_id, checkpoint_id=checkpoint.id, reason="auto rollback")
        assert result["restored"] is True
        assert result["restore"]["gate"]["confirmed"] is True
        assert engine.plans[plan_id].recommendations[0]["title"] == "回滚后建议"

    @pytest.mark.asyncio
    async def test_confirm_token_redacted_and_not_persisted_in_audit(self, engine):
        plan_result = await engine.plan("写一章完整的小说", level="L3")
        plan_id = plan_result["plan_id"]

        waiting = None
        while True:
            result = await engine.execute(plan_id)
            if result.get("status") == "waiting_confirmation":
                waiting = result
                break
            if result.get("status") == "completed" and result.get("message") == "All steps completed":
                pytest.fail("destructive step was not reached")

        resumed = await engine.execute(
            plan_id,
            step_id=waiting["step_id"],
            confirm_token="super-secret-token",
        )
        assert resumed["gate"]["confirm_token"] == "<provided>"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        confirm_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "confirm_trace"]
        assert confirm_events
        latest_confirm = confirm_events[-1]
        assert "confirm_token" not in latest_confirm["payload"]
        assert latest_confirm["payload"].get("confirm_token_provided") is True



class TestWorkflowEngineBranchCoverage:

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    def test_resolve_adaptive_level_and_gate_profile_maintenance_branches(self, engine):
        high_risk = {"risk_score": 0.92, "pass_rate": 92.0, "recovery_latency": 100.0}
        low_pass = {"risk_score": 0.50, "pass_rate": 79.0, "recovery_latency": 100.0}
        normal = {"risk_score": 0.40, "pass_rate": 95.0, "recovery_latency": 100.0}

        assert engine._resolve_adaptive_level(WorkflowLevel.L2_LITE, "maintenance", high_risk) == WorkflowLevel.L5_COORDINATOR
        assert engine._resolve_adaptive_level(WorkflowLevel.L2_LITE, "maintenance", low_pass) == WorkflowLevel.L5_COORDINATOR
        assert engine._resolve_adaptive_level(WorkflowLevel.L2_LITE, "maintenance", normal) == WorkflowLevel.L2_LITE

        assert engine._resolve_gate_profile(WorkflowLevel.L2_LITE, "maintenance", high_risk) == "maintenance-hard"
        assert engine._resolve_gate_profile(WorkflowLevel.L2_LITE, "maintenance", {"risk_score": 0.80, "recovery_latency": 100.0}) == "maintenance-selective-hard"
        assert engine._resolve_gate_profile(WorkflowLevel.L2_LITE, "maintenance", {"risk_score": 0.40, "recovery_latency": 100.0}) == "maintenance-soft"

    def test_is_destructive_step_with_action_and_title_tokens(self, engine):
        step = WorkflowStep(id="s", name="generate", description="d")
        assert engine._is_destructive_step(step, [{"action": "remove obsolete blocks"}]) is True
        assert engine._is_destructive_step(step, [{"title": "删除旧版本"}]) is True

    def test_canonicalize_recommendations_text_and_empty_action(self, engine):
        result = engine._canonicalize_recommendations([
            {"title": "", "action": "", "reason": "r"},
            "  补充伏笔  ",
        ])
        assert result[0]["action"] == "recommendation-1"
        assert result[1]["title"] == "补充伏笔"

    def test_get_workflow_template_accepts_string_level(self, engine):
        template = engine._get_workflow_template("L2")
        assert isinstance(template, list)
        assert template[0]["name"] == "analyze"

    @pytest.mark.asyncio
    async def test_waiting_confirmation_persists_gate_approval_trace(self, engine):
        plan_result = await engine.plan("删除旧文件并重写", level="L2")
        plan_id = plan_result["plan_id"]

        pending = await engine.execute(
            plan_id,
            recommendations=[{"action": "remove obsolete blocks"}],
        )
        assert pending["status"] == "waiting_confirmation"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        gate_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "gate_approval_trace"]
        assert gate_events
        latest = gate_events[-1]
        assert latest["payload"]["gate_name"] == "risk_gate"
        assert latest["payload"]["decision"] == WorkflowDecision.NO_GO.value
        assert latest["payload"]["reason_code"] == "secondary_confirmation_required"
        assert latest["payload"]["confirmed"] is False
        assert latest["payload"]["trace"]["session_id"] == session_id

    @pytest.mark.asyncio
    async def test_waiting_confirmation_trace_continuity_aligns_with_state_snapshot(self, engine):
        plan_result = await engine.plan("删除旧文件并重写", level="L2")
        plan_id = plan_result["plan_id"]

        pending = await engine.execute(
            plan_id,
            recommendations=[{"action": "remove obsolete blocks"}],
        )
        assert pending["status"] == "waiting_confirmation"
        assert pending["state_trace_id"]

        session_id = engine._session_id_for_plan(plan_id)
        state_raw = engine.session_manager.read(session_id, ContentType.STATE)
        state_payload = json.loads(state_raw)

        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        gate_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "gate_approval_trace"]
        assert gate_events
        latest_gate = gate_events[-1]

        trace = latest_gate["payload"]["trace"]
        assert trace["session_id"] == session_id
        assert trace["run_id"] == f"run-{plan_id}"
        assert trace["state_trace_id"] == state_payload["state_trace_id"]
        assert trace["state_trace_id"] == pending["state_trace_id"]

    @pytest.mark.asyncio
    async def test_wave_gate_failure_persists_gate_approval_trace(self, engine):
        plan_result = await engine.plan(
            "回答一个问题",
            level="L1",
            recommendations=[{"action": "require_wave_gate"}, {"action": "force_gate_fail"}],
        )
        plan_id = plan_result["plan_id"]

        result = await engine.execute(plan_id)
        assert result["status"] == "gate_blocked"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        gate_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "gate_approval_trace"]
        assert gate_events
        latest = gate_events[-1]
        assert latest["payload"]["gate_name"] == "wave_gate_chain"
        assert latest["payload"]["decision"] == "NO_GO"
        assert latest["payload"]["reason_code"] == "wave_gate_chain_failed"
        assert latest["payload"]["failed_gate"] == "review-session-cycle"

    @pytest.mark.asyncio
    async def test_transition_guard_rejects_illegal_jump_and_audits(self, engine):
        planned = await engine.plan("回答一个简单问题", level="L1")
        plan_id = planned["plan_id"]
        plan = engine.plans[plan_id]
        step = plan.steps[0]
        step.status = "done"

        with pytest.raises(ValueError, match="Invalid step transition"):
            engine._transition_step_state(plan, step, "executing", "invalid_transition_test")

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        assert lines
        rejected_events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "step_state_transition_rejected"]
        assert rejected_events
        latest = rejected_events[-1]
        assert latest["event_type"] == "step_state_transition_rejected"
        assert latest["payload"]["from"] == "done"
        assert latest["payload"]["to"] == "executing"

    @pytest.mark.asyncio
    async def test_quick_rollback_plan_not_found_branch(self, engine):
        result = await engine.quick_rollback("missing-plan", "cp1", "x")
        assert "error" in result

    @pytest.mark.asyncio
    async def test_apply_replay_payload_missing_plan_id_and_missing_plan(self, engine):
        no_plan = Checkpoint(id="cp-no-plan", description="d", replay_payload={"recommendations": [{"title": "x"}]})
        engine.checkpoints[no_plan.id] = no_plan
        result = await engine.restore_checkpoint(no_plan.id, confirm_token="ok")
        assert result["replay"]["reason"] == "no_plan_id"

        missing_plan = Checkpoint(
            id="cp-missing-plan",
            description="d",
            replay_payload={"plan_id": "plan-not-exist", "recommendations": [{"title": "x"}]},
        )
        engine.checkpoints[missing_plan.id] = missing_plan
        result2 = await engine.restore_checkpoint(missing_plan.id, confirm_token="ok")
        assert result2["replay"]["reason"].startswith("plan_not_found")

    @pytest.mark.asyncio
    async def test_evaluate_plan_structure_match_skills_branch_lines(self, engine):
        plan_dialog = WorkflowPlan(id="p-dialog", task="人物对话冲突", level="L2")
        skills = engine._run_match_skills(plan_dialog)
        assert "dialogue-system" in skills["skills"]
        assert "character-forge" in skills["skills"]
        assert "suspense-builder" in skills["skills"]

        plan_outline = WorkflowPlan(id="p-outline", task="小说大纲", level="L2")
        structure = engine._run_plan_structure(plan_outline)
        assert structure["structure"][0] == "核心设定"

        gen_step = WorkflowStep(id="p-g-0", name="generate", description="g")
        gen_step.output = {"content": "generated content"}
        plan_eval = WorkflowPlan(id="p-eval", task="普通任务", level="L2", steps=[gen_step])
        evaluate = engine._run_evaluate(plan_eval)
        assert evaluate["length"] == len("generated content")

    @pytest.mark.asyncio
    async def test_execute_with_recommendations_and_empty_plan_hash(self, engine):
        planned = await engine.plan("回答一个简单问题", level="L1")
        plan_id = planned["plan_id"]
        engine.plans[plan_id].plan_hash = ""

        result = await engine.execute(plan_id, recommendations=[{"title": "新增建议", "action": "polish draft"}])
        assert result["status"] == "completed"
        assert engine.plans[plan_id].recommendations_frozen is True
        assert engine.plans[plan_id].plan_hash

    @pytest.mark.asyncio
    async def test_execute_step_checkpoint_branch(self, engine):
        plan = WorkflowPlan(id="p-check", task="task", level="L3")
        step = WorkflowStep(id="p-check-0", name="checkpoint", description="cp")

        async def fake_create_checkpoint(**kwargs):
            return {
                "checkpoint_id": "cp-1",
                "created_at": "2026-01-01T00:00:00",
                "replay_payload": kwargs.get("replay_payload", {}),
            }

        with patch.object(engine, "create_checkpoint", side_effect=fake_create_checkpoint):
            result = await engine._execute_step(plan, step)

        assert result["checkpoint_id"] == "cp-1"
        assert "replay_payload" in result

    @pytest.mark.asyncio
    async def test_create_checkpoint_auto_commit_success_and_calledprocesserror(self, engine):
        import subprocess

        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = [
                MagicMock(returncode=0),
                MagicMock(returncode=0),
                MagicMock(stdout="abc123\n", returncode=0),
            ]
            result = await engine.create_checkpoint("auto", auto_commit=True)
            assert result["commit_hash"] == "abc123"

        with patch("subprocess.run", side_effect=subprocess.CalledProcessError(1, "git")):
            result2 = await engine.create_checkpoint("auto-fail", auto_commit=True)
            assert result2["commit_hash"] is None

    def test_resolve_adaptive_level_pass_rate_branch_returns_l3(self, engine):
        metrics = {"risk_score": 0.5, "pass_rate": 87.0, "recovery_latency": 100.0}
        assert engine._resolve_adaptive_level(WorkflowLevel.L2_LITE, "maintenance", metrics) == WorkflowLevel.L3_STANDARD

    def test_observability_mode_resolution_branches(self, engine):
        autopilot = engine._resolve_observability_mode(
            {
                "completion_rate": 100.0,
                "failure_rate": 0.0,
                "retry_count": 0,
                "convergence_rounds": 1,
                "mttr": 0.0,
            }
        )
        team = engine._resolve_observability_mode(
            {
                "completion_rate": 60.0,
                "failure_rate": 10.0,
                "retry_count": 1,
                "convergence_rounds": 5,
                "mttr": 5.0,
            }
        )
        pipeline = engine._resolve_observability_mode(
            {
                "completion_rate": 40.0,
                "failure_rate": 25.0,
                "retry_count": 4,
                "convergence_rounds": 8,
                "mttr": 25.0,
            }
        )

        assert autopilot["mode"] == "Autopilot"
        assert autopilot["threshold_triggered"] is False
        assert team["mode"] == "Team"
        assert team["threshold_triggered"] is True
        assert pipeline["mode"] == "Pipeline/Ralph"
        assert pipeline["threshold_triggered"] is True

    @pytest.mark.asyncio
    async def test_plan_writes_observability_mode_trace_audit(self, engine):
        plan_result = await engine.plan("回答一个简单问题", level="L1")
        plan_id = plan_result["plan_id"]
        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        events = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "observability_mode_trace"]

        assert events
        payload = events[-1]["payload"]
        assert payload["mode"] in {"Autopilot", "Team", "Pipeline/Ralph"}
        assert "aggregate" in payload
        assert "completion_rate" in payload["aggregate"]

    def test_evaluate_risk_gate_soft_review_branch(self, engine):
        step = WorkflowStep(id="s-check", name="checkpoint", description="cp")

        with patch.object(engine, "_is_destructive_step", return_value=False):
            gate = engine._evaluate_risk_gate(WorkflowLevel.L4_BRAINSTORM, step)

        assert gate["decision"] == WorkflowDecision.SOFT_GO.value
        assert gate["blocking"] is False
        assert gate["confirm_required"] is False
        assert gate["confirmed"] is True

    @pytest.mark.asyncio
    async def test_execute_recomputes_plan_hash_when_missing_without_recommendations(self, engine):
        planned = await engine.plan("回答一个简单问题", level="L1")
        plan_id = planned["plan_id"]
        engine.plans[plan_id].plan_hash = ""

        result = await engine.execute(plan_id)
        assert result["status"] == "completed"
        assert engine.plans[plan_id].plan_hash

    @pytest.mark.asyncio
    async def test_execute_specific_step_not_planned_branch(self, engine):
        planned = await engine.plan("回答一个简单问题", level="L1")
        plan_id = planned["plan_id"]
        step_id = engine.plans[plan_id].steps[0].id
        engine.plans[plan_id].steps[0].status = "done"

        result = await engine.execute(plan_id, step_id=step_id)
        assert "error" in result
        assert "is not planned" in result["error"]

    @pytest.mark.asyncio
    async def test_execute_marks_created_plan_running_when_runner_already_running(self, engine):
        planned = await engine.plan("回答一个简单问题", level="L1")
        plan_id = planned["plan_id"]
        engine.plans[plan_id].runner_state = "running"
        engine.plans[plan_id].status = "created"

        result = await engine.execute(plan_id)
        assert result["status"] == "completed"
        assert engine.plans[plan_id].status == "completed"

    def test_run_plan_structure_dialogue_branch(self, engine):
        plan = WorkflowPlan(id="p-dialog-2", task="写一段人物对话", level="L2")
        structure = engine._run_plan_structure(plan)
        assert structure["structure"] == ["开场", "人物出场", "对话推进", "冲突显化", "收束"]

    def test_run_evaluate_without_outputs_uses_empty_text(self, engine):
        plan = WorkflowPlan(id="p-empty-eval", task="普通任务", level="L2", steps=[])
        result = engine._run_evaluate(plan)
        assert result["length"] == 0
        assert result["score"] == 60.0

    def test_canonicalize_recommendations_skips_blank_text_item(self, engine):
        result = engine._canonicalize_recommendations(["   "])
        assert result == []

    @pytest.mark.asyncio
    async def test_plan_state_snapshot_records_phase_for_resume(self, engine):
        planned = await engine.plan("回答一个简单问题", level="L1")
        plan_id = planned["plan_id"]
        session_id = engine._session_id_for_plan(plan_id)

        initial_state_raw = engine.session_manager.read(session_id, ContentType.STATE)
        initial_state = json.loads(initial_state_raw)
        assert initial_state["schema_version"] == WORKFLOW_STATE_SCHEMA_VERSION
        assert initial_state["schema_policy"] == {
            "policy": "frozen",
            "version_format": "YYYY-MM",
            "non_breaking_change": "additive_only",
            "breaking_change": "version_bump_required",
        }
        assert initial_state["metadata"]["lane"] == engine.plans[plan_id].lane
        assert initial_state["metadata"]["execution_mode"] in {"Autopilot", "Team", "Pipeline/Ralph", "EcoMode"}
        assert initial_state["metadata"]["stage_owner"] == plan_id
        assert initial_state["metadata"]["ownership_model"] == "plan_owner"
        assert initial_state["metadata"]["phase_owners"]["planned"] == plan_id
        assert initial_state["artifacts"]["state"].replace("\\", "/").endswith(".data/state.json")
        assert initial_state["current_phase"] == "planned"
        assert initial_state["last_checkpoint_id"] == ""

        await engine.execute(plan_id)

        final_state_raw = engine.session_manager.read(session_id, ContentType.STATE)
        final_state = json.loads(final_state_raw)
        assert final_state["schema_version"] == WORKFLOW_STATE_SCHEMA_VERSION
        assert final_state["schema_policy"] == {
            "policy": "frozen",
            "version_format": "YYYY-MM",
            "non_breaking_change": "additive_only",
            "breaking_change": "version_bump_required",
        }
        assert final_state["metadata"]["plan_hash"] == engine.plans[plan_id].plan_hash
        assert final_state["metadata"]["recommendations_frozen"] is True
        assert final_state["current_phase"] == "done"
        assert final_state["steps"][0]["status"] == "done"

        terminal = await engine.execute(plan_id)
        assert terminal["status"] == "completed"
        assert terminal["current_phase"] == "done"
        assert terminal["state_trace_id"]
        assert terminal["can_resume_from_checkpoint"] is False

    @pytest.mark.asyncio
    async def test_checkpoint_trace_persisted_in_state_snapshot(self, engine):
        planned = await engine.plan("回答一个简单问题", level="L1")
        plan_id = planned["plan_id"]
        step_id = engine.plans[plan_id].steps[0].id

        checkpoint = await engine.create_checkpoint(
            description="manual state trace",
            auto_commit=False,
            plan_id=plan_id,
            step_id=step_id,
        )

        session_id = engine._session_id_for_plan(plan_id)
        state_raw = engine.session_manager.read(session_id, ContentType.STATE)
        state_payload = json.loads(state_raw)
        assert state_payload["last_checkpoint_id"] == checkpoint["checkpoint_id"]
        assert state_payload["state_trace_id"]
        assert state_payload["checkpoint_trace"]
        assert state_payload["checkpoint_trace"][-1]["checkpoint_id"] == checkpoint["checkpoint_id"]
    @pytest.mark.asyncio
    async def test_create_checkpoint_auto_commit_nonzero_commit_keeps_hash_none(self, engine):
        with patch("subprocess.run") as mock_run:
            mock_run.side_effect = [
                MagicMock(returncode=0),
                MagicMock(returncode=1),
            ]
            result = await engine.create_checkpoint("auto-nonzero", auto_commit=True)

        assert result["commit_hash"] is None

    @pytest.mark.asyncio
    async def test_restore_checkpoint_waiting_confirmation_without_plan(self, engine):
        cp = Checkpoint(
            id="cp-no-plan-wait",
            description="no plan waiting",
            commit_hash=None,
            replay_payload={"recommendations": [{"title": "x"}]},
        )
        engine.checkpoints[cp.id] = cp

        pending = await engine.restore_checkpoint(cp.id)
        assert pending["status"] == "waiting_confirmation"
        assert pending["replay"]["reason"] == "waiting_confirmation"

    @pytest.mark.asyncio
    async def test_apply_replay_payload_without_plan_hash_branch(self, engine):
        plan_result = await engine.plan("写一章小说", level="L1", recommendations=[{"title": "原建议"}])
        plan_id = plan_result["plan_id"]

        cp = Checkpoint(
            id="cp-no-hash",
            description="no hash replay",
            commit_hash=None,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "recommendations": [{"title": "新建议"}],
                "recommendations_frozen": True,
            },
        )
        engine.checkpoints[cp.id] = cp

        result = await engine.restore_checkpoint(cp.id, confirm_token="ok")
        assert "error" in result
        assert result["replay"]["applied"] is True
        assert result["replay"]["plan_id"] == plan_id
        assert engine.plans[plan_id].recommendations[0]["title"] == "新建议"

    @pytest.mark.asyncio
    async def test_restore_checkpoint_with_hash_and_plan_appends_confirm_trace(self, engine):
        plan_result = await engine.plan("写一章小说", level="L1")
        plan_id = plan_result["plan_id"]

        cp = Checkpoint(
            id="cp-hash-plan",
            description="restore with hash and plan",
            commit_hash="abc123",
            plan_id=plan_id,
        )
        engine.checkpoints[cp.id] = cp

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            result = await engine.restore_checkpoint(cp.id)

        assert result["status"] == "restored"
        assert result["commit_hash"] == "abc123"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        assert lines
        latest = json.loads(lines[-1])
        assert latest["event_type"] == "confirm_trace"
        assert latest["payload"]["operation"] == "restore_checkpoint"
        assert latest["payload"]["checkpoint_id"] == "cp-hash-plan"


BOUNDARY_ASSERTION_MATRIX = [
    {
        "id": "B-001",
        "layer": "Engine",
        "rule": "Engine must not import AdapterRegistry",
        "assertion": "engine_forbidden_import_adapter_registry",
    },
    {
        "id": "B-002",
        "layer": "Engine",
        "rule": "Engine must not import NovelAdapter directly",
        "assertion": "engine_forbidden_import_novel_adapter",
    },
    {
        "id": "B-003",
        "layer": "Engine",
        "rule": "Engine must not import graph facade",
        "assertion": "engine_forbidden_import_graph_facade",
    },
    {
        "id": "B-004",
        "layer": "Engine",
        "rule": "Engine must not instantiate workflow graph",
        "assertion": "engine_forbidden_graph_instantiation",
    },
    {
        "id": "B-005",
        "layer": "Adapter",
        "rule": "Adapter must not import WorkflowEngine",
        "assertion": "adapter_forbidden_import_engine",
    },
    {
        "id": "B-006",
        "layer": "Adapter",
        "rule": "Adapter creates graph using StateGraph",
        "assertion": "adapter_owns_graph_construction",
    },
    {
        "id": "B-007",
        "layer": "Graph",
        "rule": "Graph facade delegates to AdapterRegistry",
        "assertion": "graph_delegates_to_adapter_registry",
    },
    {
        "id": "B-008",
        "layer": "Graph",
        "rule": "Graph facade delegates graph creation to adapter",
        "assertion": "graph_delegates_graph_build_to_adapter",
    },
    {
        "id": "B-009",
        "layer": "Graph",
        "rule": "Graph facade must not import WorkflowEngine",
        "assertion": "graph_forbidden_import_engine",
    },
    {
        "id": "B-010",
        "layer": "Engine",
        "rule": "Engine contract payload remains level/types based",
        "assertion": "engine_contract_payload_integration_boundary",
    },
]


class TestArchitectureBoundaryUnit:
    """Engine-Adapter-Graph architecture boundary unit tests."""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @staticmethod
    def _repo_root() -> Path:
        return Path(__file__).resolve().parents[3]

    @classmethod
    def _read_source(cls, rel_path: str) -> str:
        return (cls._repo_root() / rel_path).read_text(encoding="utf-8")

    def test_architecture_boundary_matrix_rules_are_testable(self):
        assert len(BOUNDARY_ASSERTION_MATRIX) >= 10
        ids = {rule["id"] for rule in BOUNDARY_ASSERTION_MATRIX}
        assertions = {rule["assertion"] for rule in BOUNDARY_ASSERTION_MATRIX}
        assert len(ids) == len(BOUNDARY_ASSERTION_MATRIX)
        assert len(assertions) == len(BOUNDARY_ASSERTION_MATRIX)

    def test_architecture_boundary_engine_bypass_imports_prohibited(self):
        engine_src = self._read_source("src/workflow/workflow_engine.py")

        forbidden_tokens = [
            "AdapterRegistry",
            "NovelAdapter",
            "from src.workflow.graph import",
            "from workflow.graph import",
            "compile_graph(",
            "create_writing_graph(",
            "StateGraph(",
        ]

        for token in forbidden_tokens:
            assert token not in engine_src

    def test_architecture_boundary_adapter_bypass_engine_prohibited(self):
        adapter_src = self._read_source("src/workflow/adapters/novel_adapter.py")

        assert "WorkflowEngine.warn_legacy_entrypoint(" in adapter_src

        forbidden_tokens = [
            "WorkflowEngine(",
            "WorkflowEngine.plan(",
            "WorkflowEngine.execute(",
            "WorkflowEngine.run(",
        ]

        for token in forbidden_tokens:
            assert token not in adapter_src

    def test_architecture_boundary_graph_bypass_engine_prohibited(self):
        graph_src = self._read_source("src/workflow/graph.py")

        assert "WorkflowEngine.warn_legacy_entrypoint(" in graph_src

        forbidden_tokens = [
            "WorkflowEngine(",
            "WorkflowEngine.plan(",
            "WorkflowEngine.execute(",
            "WorkflowEngine.run(",
        ]

        for token in forbidden_tokens:
            assert token not in graph_src

    def test_architecture_boundary_cli_help_single_authority_narrative(self):
        cli_src = self._read_source("src/cli/main.py")

        assert "Single authoritative workflow execution entrypoint" in cli_src
        assert "`run` (uses `WorkflowEngine`)" in cli_src

        forbidden_tokens = [
            "`compile_graph`",
            "`run_writing_session`",
            "`NovelAdapter`",
        ]

        for token in forbidden_tokens:
            assert token not in cli_src

    def test_architecture_boundary_graph_delegates_to_adapter(self):
        graph_src = self._read_source("src/workflow/graph.py")

        assert "AdapterRegistry.create_adapter" in graph_src
        assert "adapter.create_graph()" in graph_src
        assert "return adapter.create_graph()" in graph_src

    @pytest.mark.asyncio
    async def test_architecture_boundary_engine_runs_without_adapter_registry_dependency(self, engine):
        with patch(
            "src.workflow.adapters.base_adapter.AdapterRegistry.create_adapter",
            side_effect=AssertionError("engine bypassed authority boundary"),
        ) as create_adapter_mock:
            plan_result = await engine.plan("回答一个问题", level="L1")
            result = await engine.execute(plan_result["plan_id"])

        assert result["status"] == "completed"
        create_adapter_mock.assert_not_called()

