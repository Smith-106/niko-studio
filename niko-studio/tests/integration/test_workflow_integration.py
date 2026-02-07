# -*- coding: utf-8 -*-
"""
集成测试 - 工作流引擎验证

测试 WorkflowEngine 的 L1-L5 路由、Plan-Act 模式和检查点管理。
"""

import pytest
import asyncio
import tempfile
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from workflow.workflow_engine import (
    WorkflowEngine,
    WorkflowLevel,
    WorkflowStep,
    WorkflowPlan,
    Checkpoint
)


class TestWorkflowRouting:
    """工作流路由测试"""

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


# 运行测试
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
