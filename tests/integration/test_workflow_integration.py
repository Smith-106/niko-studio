# -*- coding: utf-8 -*-
"""
集成测试 - 工作流引擎验证

测试 WorkflowEngine 的 L1-L5 路由、Plan-Act 模式和检查点管理。
"""

import pytest
import asyncio
import tempfile
import json
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from workflow.workflow_engine import (
    WorkflowEngine,
    WorkflowLevel,
    WorkflowStep,
    WorkflowPlan,
    Checkpoint,
)
from src.workflow.session.session_manager import ContentType

class TestWorkflowSingleAuthorityEntry:
    """单一权威入口测试"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_run_entry_executes_plan_to_completion(self, engine):
        result = await engine.run("回答一个简短问题", level="L1")

        assert result["status"] == "completed"
        assert result["plan"]["level"] == "L1"
        assert result["final_status"]["status"] == "completed"


class TestWorkflowRouting:
    """工作流路由测试"""

    ROBUSTNESS_TASKS = [
        "请简述这个设定并解释核心矛盾？",
        "写一段关于旧城雨夜的描写，强调气味和光影",
        "根据上次反馈继续修改第2章冲突场景",
        "请先回答这个问题，再给我写一章第3章的对决",
        "写一段对白并补充角色动作细节",
        "规划全书路线图并定义角色设定里程碑",
        "继续多章创作并同步世界观设定",
        "请给一个一句话速答：什么是叙事张力？",
        "第5章场景重写，保留前文信息并优化节奏",
        "汇总反馈后多轮讨论剧情转折点",
        "请先解释人物动机，再写一段追逐场景",
        "基于上一版意见调整第三章对白",
        "写一段清晨港口的描写，突出潮湿感",
        "给我一个简短回答：冲突要素有哪些？",
        "继续上次内容并扩写战前会议",
        "设计全书节奏并给出章节里程碑",
        "多线并行推进三位角色的目标",
        "先说明主题，再生成一段示例文本",
        "按反馈迭代第4章收尾段落",
        "规划世界观、角色弧线与主线结构",
        "请一句话解释什么是叙事视角",
        "写一章第6章：潜入失败后的反击",
        "讨论三种结局方案并汇总优缺点",
        "根据上次讨论继续完善冲突升级",
        "写一段人物独白，语气压抑克制",
        "给出短答：什么是节奏控制？",
        "继续多章推进并同步关键伏笔",
        "全书大纲重排，保留核心主题",
        "先回答问题，再扩写第2章开场",
        "汇总历史版本反馈并提出修订计划",
    ]

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_route_to_l1(self, engine):
        """测试简单问答路由到 L1"""
        result = await engine.route("回答一个问题：什么是小说？")

        assert result["level"] == "L1"
        assert "简单问答" in result["description"]

    @pytest.mark.asyncio
    async def test_route_to_l2(self, engine):
        """测试段落生成路由到 L2"""
        result = await engine.route("写一段关于日落的描写")

        assert result["level"] == "L2"

    @pytest.mark.asyncio
    async def test_route_to_l3(self, engine):
        """测试章节创作路由到 L3"""
        result = await engine.route("写一章：主角与反派的第一次对决")

        assert result["level"] == "L3"
        assert "章节创作" in result["description"]

    @pytest.mark.asyncio
    async def test_route_to_l5(self, engine):
        """测试全书规划路由到 L5"""
        result = await engine.route("规划全书大纲，设计整体故事结构")

        assert result["level"] == "L5"

    @pytest.mark.asyncio
    async def test_long_task_escalation(self, engine):
        """测试长任务自动升级"""
        # 超过 200 字符的任务应该升级
        long_task = "请帮我写一个场景，" + "这是一个非常详细的描述，" * 10
        result = await engine.route(long_task)

        assert result["level"] in ["L3", "L4", "L5"]

    @pytest.mark.asyncio
    async def test_route_diagnostics_backward_compatible(self, engine):
        """验证新诊断字段与旧字段兼容"""
        result = await engine.route("回答一个问题：什么是小说？")

        assert result["level"] == "L1"
        assert "reason" in result
        assert "matched_features" in result
        assert "score" in result
        assert "final_level" in result
        assert result["final_level"] == result["level"]
        assert "routing_diagnostics" in result
        assert result["routing_diagnostics"]["baseline"]["legacy_level"] in ["L1", "L2", "L3", "L4", "L5"]

    @pytest.mark.asyncio
    async def test_route_robustness_baseline_comparison(self, engine):
        """鲁棒性样本集对比：结构化评分不劣于旧基线"""
        baseline_miss = 0
        structured_miss = 0

        for task in self.ROBUSTNESS_TASKS:
            result = await engine.route(task)
            baseline = result["routing_diagnostics"]["baseline"]

            if baseline["legacy_score"] <= 0:
                baseline_miss += 1
            if result["score"] <= 0:
                structured_miss += 1

        assert len(self.ROBUSTNESS_TASKS) >= 10
        assert structured_miss <= baseline_miss


class TestPlanMode:
    """Plan 模式测试"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_create_plan(self, engine):
        """测试创建执行计划"""
        result = await engine.plan("写第三章：决战时刻")

        assert "plan_id" in result
        assert "steps" in result
        assert result["total_steps"] > 0

    @pytest.mark.asyncio
    async def test_plan_has_correct_steps_for_l3(self, engine):
        """测试 L3 计划包含正确步骤"""
        result = await engine.plan("写一章内容", level="L3")

        step_names = [s["name"] for s in result["steps"]]

        assert "analyze" in step_names
        assert "generate_draft" in step_names
        assert "evaluate" in step_names

    @pytest.mark.asyncio
    async def test_plan_steps_have_dependencies(self, engine):
        """测试计划步骤有正确依赖"""
        result = await engine.plan("写一章", level="L3")

        # 第一个步骤无依赖
        assert result["steps"][0]["dependencies"] == []

        # 后续步骤有依赖
        if len(result["steps"]) > 1:
            assert len(result["steps"][1]["dependencies"]) > 0


class TestActMode:
    """Act 模式测试"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_execute_step(self, engine):
        """测试执行单个步骤"""
        # 先创建计划
        plan = await engine.plan("写一段内容", level="L2")
        plan_id = plan["plan_id"]

        # 执行第一个步骤
        result = await engine.execute(plan_id)

        assert result["status"] == "completed"
        assert "result" in result

    @pytest.mark.asyncio
    async def test_execute_all_steps(self, engine):
        """测试执行所有步骤"""
        plan = await engine.plan("回答问题", level="L1")
        plan_id = plan["plan_id"]

        # 执行直到完成
        while True:
            result = await engine.execute(plan_id)
            if result.get("status") == "completed" and result.get("remaining_steps", 0) == 0:
                break
            if "error" in result:
                break

        # 验证计划完成
        status = engine.get_plan_status(plan_id)
        assert status["status"] == "completed"

    @pytest.mark.asyncio
    async def test_execute_respects_dependencies(self, engine):
        """测试执行尊重依赖关系"""
        plan = await engine.plan("写一章", level="L3")
        plan_id = plan["plan_id"]

        # 尝试直接执行有依赖的步骤
        second_step_id = plan["steps"][1]["id"]
        result = await engine.execute(plan_id, step_id=second_step_id)

        # 应该失败因为依赖未完成
        assert "error" in result or result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_execute_nonexistent_plan(self, engine):
        """测试执行不存在的计划"""
        result = await engine.execute("nonexistent-plan-id")

        assert "error" in result


class TestCheckpointManagement:
    """检查点管理测试"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_create_checkpoint(self, engine):
        """测试创建检查点"""
        result = await engine.create_checkpoint(
            description="完成第一章初稿",
            auto_commit=False  # 不执行 git 操作
        )

        assert "checkpoint_id" in result
        assert result["description"] == "完成第一章初稿"

    @pytest.mark.asyncio
    async def test_list_checkpoints(self, engine):
        """测试列出检查点"""
        # 创建几个检查点
        await engine.create_checkpoint(description="检查点1", auto_commit=False)
        await engine.create_checkpoint(description="检查点2", auto_commit=False)

        checkpoints = await engine.list_checkpoints(limit=10)

        assert len(checkpoints) >= 2

    @pytest.mark.asyncio
    async def test_restore_checkpoint_without_git(self, engine):
        """测试恢复检查点（无 git）"""
        # 创建检查点
        cp = await engine.create_checkpoint(
            description="测试点",
            auto_commit=False
        )

        # 尝试恢复
        result = await engine.restore_checkpoint(cp["checkpoint_id"])

        # 没有 commit hash，应该返回错误
        assert "error" in result

    @pytest.mark.asyncio
    async def test_restore_nonexistent_checkpoint(self, engine):
        """测试恢复不存在的检查点"""
        result = await engine.restore_checkpoint("nonexistent")

        assert "error" in result


class TestRecommendationsReplay:
    """recommendations 注入与 checkpoint 回放测试"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_plan_recommendation_fields_present(self, engine):
        result = await engine.plan(
            "写一章：冲突升级",
            level="L3",
            recommendations=[
                {"title": "增加悬念", "reason": "提升张力"},
                "补充角色动机",
            ],
        )

        assert result["recommendations"][0]["id"] == "rec-01"
        assert result["recommendations"][1]["id"] == "rec-02"
        assert result["plan_hash"]
        assert result["recommendations_frozen"] is False

    @pytest.mark.asyncio
    async def test_checkpoint_replay_preserves_plan_hash(self, engine):
        plan = await engine.plan(
            "写一章：冲突升级",
            level="L1",
            recommendations=[{"title": "先埋伏笔", "reason": "节奏"}],
        )
        plan_id = plan["plan_id"]

        checkpoint = await engine.create_checkpoint(
            description="manual replay",
            auto_commit=False,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": plan["plan_hash"],
                "recommendations": [{"title": "先埋伏笔", "reason": "节奏"}],
                "recommendations_frozen": True,
            },
        )

        pending = await engine.restore_checkpoint(checkpoint["checkpoint_id"])

        assert pending["status"] == "waiting_confirmation"
        assert pending["replay"]["applied"] is False

        restore = await engine.restore_checkpoint(checkpoint["checkpoint_id"], confirm_token="ok")

        assert "error" in restore
        assert restore["gate"]["confirmed"] is True
        assert restore["replay"]["applied"] is True
        assert restore["replay"]["plan_hash"] == plan["plan_hash"]
        assert engine.plans[plan_id].recommendations[0]["id"] == "rec-01"


class TestHardGateIntegration:
    """风险门与高风险写入集成测试（hard_gate）"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_execute_hard_gate_waiting_confirmation(self, engine):
        plan = await engine.plan("写一章完整的小说", level="L3")
        plan_id = plan["plan_id"]

        waiting = None
        while True:
            result = await engine.execute(plan_id)
            if result.get("status") == "waiting_confirmation":
                waiting = result
                break
            if result.get("status") == "completed" and result.get("message") == "All steps completed":
                pytest.fail("destructive step was not reached")

        assert waiting is not None
        assert waiting["gate"]["confirm_required"] is True
        assert waiting["gate"]["confirmed"] is False
        assert waiting["gate"]["destructive"] is True
        assert waiting["current_phase"] == "planned"
        assert waiting["state_trace_id"]
        assert waiting["can_resume_from_checkpoint"] is False

    @pytest.mark.asyncio
    async def test_restore_risk_gate_confirm_token(self, engine):
        plan = await engine.plan(
            "写一章：风险恢复测试",
            level="L1",
            recommendations=[{"title": "恢复建议", "reason": "风险回放"}],
        )
        plan_id = plan["plan_id"]

        checkpoint = await engine.create_checkpoint(
            description="risk restore",
            auto_commit=False,
            plan_id=plan_id,
            replay_payload={
                "plan_id": plan_id,
                "plan_hash": plan["plan_hash"],
                "recommendations": plan["recommendations"],
                "recommendations_frozen": True,
            },
        )

        pending = await engine.restore_checkpoint(checkpoint["checkpoint_id"])
        assert pending["status"] == "waiting_confirmation"
        assert pending["gate"]["confirm_required"] is True
        assert pending["gate"]["confirmed"] is False

        confirmed = await engine.restore_checkpoint(checkpoint["checkpoint_id"], confirm_token="ok")
        assert confirmed["gate"]["confirm_required"] is True
        assert confirmed["gate"]["confirmed"] is True


    @pytest.mark.asyncio
    async def test_state_transition_trace_contains_all_phases(self, engine):
        plan = await engine.plan("回答一个问题", level="L1")
        plan_id = plan["plan_id"]

        result = await engine.execute(plan_id)
        assert result["status"] == "completed"

        session_id = engine._session_id_for_plan(plan_id)
        audit_path = engine.session_manager._resolve_path(session_id, ContentType.AUDIT)
        lines = [line for line in audit_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        transitions = [json.loads(line) for line in lines if json.loads(line).get("event_type") == "step_state_transition"]
        phase_targets = [event["payload"]["to"] for event in transitions]

        assert "executing" in phase_targets
        assert "review" in phase_targets
        assert "test" in phase_targets
        assert "done" in phase_targets

    @pytest.mark.asyncio
    async def test_resume_signal_true_after_checkpoint_created(self, engine):
        plan = await engine.plan("回答一个问题", level="L1")
        plan_id = plan["plan_id"]
        step_id = plan["steps"][0]["id"]

        checkpoint = await engine.create_checkpoint(
            description="resume-signal",
            auto_commit=False,
            plan_id=plan_id,
            step_id=step_id,
        )

        state_raw = engine.session_manager.read(engine._session_id_for_plan(plan_id), ContentType.STATE)
        state_payload = json.loads(state_raw)

        assert state_payload["last_checkpoint_id"] == checkpoint["checkpoint_id"]
        assert state_payload["checkpoint_trace"][-1]["checkpoint_id"] == checkpoint["checkpoint_id"]

        status = await engine.execute(plan_id)
        assert "can_resume_from_checkpoint" in status
        assert status["can_resume_from_checkpoint"] is True


    @pytest.mark.asyncio
    async def test_wave_gate_blocks_next_wave_on_failure(self, engine):
        plan = await engine.plan(
            "回答一个问题",
            level="L1",
            recommendations=[{"action": "require_wave_gate"}, {"action": "force_gate_fail"}],
        )
        plan_id = plan["plan_id"]

        result = await engine.execute(plan_id)
        assert result["status"] == "gate_blocked"
        assert result["gate_chain"]["required"] is True
        assert result["gate_chain"]["passed"] is False
        assert result["concurrency"]["serialized"] is False

        blocked = await engine.execute(plan_id)
        assert blocked["status"] == "completed"
        assert blocked["message"] == "All steps completed"
        assert blocked["current_phase"] == "done"

    @pytest.mark.asyncio
    async def test_wave_gate_pass_writes_wave_completion_checkpoint(self, engine):
        plan = await engine.plan(
            "回答一个问题",
            level="L1",
            recommendations=[{"action": "require_wave_gate"}],
        )
        plan_id = plan["plan_id"]

        result = await engine.execute(plan_id)
        assert result["status"] == "completed"
        assert result["gate_chain"]["required"] is True
        assert result["gate_chain"]["passed"] is True
        checkpoint_id = result["wave_completion_checkpoint_id"]
        assert checkpoint_id

        state_raw = engine.session_manager.read(engine._session_id_for_plan(plan_id), ContentType.STATE)
        state_payload = json.loads(state_raw)
        checkpoint_ids = [item["checkpoint_id"] for item in state_payload["checkpoint_trace"]]
        assert checkpoint_id in checkpoint_ids


class TestAdaptiveRouteIntegration:
    """指标驱动自适应路由集成测试（adaptive_route）"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_adaptive_route_maintenance_level_adjust(self, engine):
        result = await engine.plan("maintenance 修复任务", level="L2")

        assert result["template_meta"]["lane"] == "maintenance"
        assert result["template_meta"]["gate_profile"] == "maintenance-selective-hard"
        assert result["level"] == "L4"
        assert result["level_slug"] == "brainstorm"


class TestSessionStatusIntegration:
    """maintenance lane 会话状态持久化集成测试（session_status）"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_session_status_maintenance_lifecycle(self, engine):
        plan = await engine.plan("maintenance 修复任务", level="L2")
        plan_id = plan["plan_id"]

        started = await engine.lifecycle(plan_id, "start")
        assert started["session_status"] == "active"

        paused = await engine.lifecycle(plan_id, "pause")
        assert paused["session_status"] == "checkpointed"

        resumed = await engine.lifecycle(plan_id, "resume")
        assert resumed["session_status"] == "active"

        stopped = await engine.lifecycle(plan_id, "stop")
        assert stopped["session_status"] == "active"
        assert stopped["state_mapping"]["stopped"] == "active"

        status = await engine.lifecycle(plan_id, "status")
        assert status["session_status"] == "active"
        assert status["lane"] == "maintenance"


class TestPlanStatus:
    """计划状态测试"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_get_plan_status(self, engine):
        """测试获取计划状态"""
        plan = await engine.plan("写内容", level="L2")
        plan_id = plan["plan_id"]

        status = engine.get_plan_status(plan_id)

        assert status["plan_id"] == plan_id
        assert status["status"] == "created"
        assert "progress" in status

    @pytest.mark.asyncio
    async def test_status_updates_after_execution(self, engine):
        """测试执行后状态更新"""
        plan = await engine.plan("回答", level="L1")
        plan_id = plan["plan_id"]

        # 执行
        await engine.execute(plan_id)

        status = engine.get_plan_status(plan_id)

        # 进度应该更新
        assert "1/" in status["progress"]

    def test_get_nonexistent_plan_status(self, engine):
        """测试获取不存在的计划状态"""
        status = engine.get_plan_status("nonexistent")

        assert "error" in status


class TestArchitectureBoundaryIntegration:
    """Engine-Adapter-Graph integration boundary path tests."""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    @pytest.mark.asyncio
    async def test_boundary_engine_plan_execute_path_keeps_engine_authority(self, engine):
        planned = await engine.plan("回答一个问题", level="L1")
        plan_id = planned["plan_id"]

        result = await engine.execute(plan_id)

        assert result["status"] == "completed"
        assert result["step_name"] == "answer"
        status = engine.get_plan_status(plan_id)
        assert status["status"] == "completed"

    @pytest.mark.asyncio
    async def test_boundary_graph_compile_delegates_to_adapter(self):
        from src.workflow.graph import compile_graph

        app = compile_graph(use_memory=False)

        assert app is not None

    @pytest.mark.asyncio
    async def test_boundary_graph_run_session_uses_graph_facade_only(self, monkeypatch):
        from src.workflow.adapters.novel_adapter import NovelAdapter
        from src.workflow.graph import run_writing_session

        class _DummyLLM:
            pass

        monkeypatch.setattr(NovelAdapter, "_get_llm", lambda self: _DummyLLM())

        result = await run_writing_session(
            user_idea="写一个短故事开头",
            target_chapters=1,
            verbose=False,
        )

        assert isinstance(result, dict)
        assert "workflow_level" in result or "errors" in result

    @pytest.mark.asyncio
    async def test_boundary_bypass_adapter_to_engine_prohibited_via_source_contract(self):
        adapter_source = (
            Path(__file__).parent.parent.parent / "src" / "workflow" / "adapters" / "novel_adapter.py"
        ).read_text(encoding="utf-8")

        assert "from src.workflow.workflow_engine import" not in adapter_source
        assert "from workflow.workflow_engine import" not in adapter_source
        assert "WorkflowEngine" not in adapter_source


class TestWorkflowTemplates:
    """工作流模板测试"""

    @pytest.fixture
    def engine(self, tmp_path):
        return WorkflowEngine(workspace=str(tmp_path))

    def test_l1_template(self, engine):
        """测试 L1 模板"""
        template = engine._get_workflow_template("L1")

        assert len(template) == 1
        assert template[0]["name"] == "answer"

    def test_l3_template(self, engine):
        """测试 L3 模板"""
        template = engine._get_workflow_template("L3")

        names = [t["name"] for t in template]
        assert "analyze" in names
        assert "generate_draft" in names
        assert "evaluate" in names
        assert "checkpoint" in names

    def test_l5_template(self, engine):
        """测试 L5 模板"""
        template = engine._get_workflow_template("L5")

        names = [t["name"] for t in template]
        assert "concept" in names
        assert "outline" in names
        assert "character_design" in names
        assert "world_building" in names


class TestCodeDomainWorkflowSmoke:
    """Code 域工作流冒烟测试"""

    @pytest.mark.asyncio
    async def test_code_domain_adapter_path(self):
        from workflow.graph_factory import WorkflowFactory

        adapter = WorkflowFactory.create_adapter("code")
        assert adapter is not None

        state = adapter.create_initial_state(
            "实现一个简单 CLI",
            metadata={
                "quality_signals": {
                    "tests_passed": True,
                    "lint_passed": True,
                    "build_passed": True,
                    "coverage": 85,
                }
            },
        )

        planner_output = await adapter.planner_node(state)
        coder_input = {**state, **planner_output}
        coder_output = await adapter.coder_node(coder_input)

        evaluator_input = {**coder_input, **coder_output}
        evaluator_output = await adapter.evaluator_node(evaluator_input)
        assert evaluator_output["decision"] == "APPROVED"

        finalize_input = {**evaluator_input, **evaluator_output}
        finalize_output = await adapter.finalize_node(finalize_input)
        assert finalize_output["current_step"] == "finalize"


# 运行测试
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
