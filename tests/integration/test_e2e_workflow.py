# -*- coding: utf-8 -*-
"""
端到端测试 - 完整写作工作流

测试从用户请求到最终输出的完整流程。
"""

import pytest
import asyncio
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

pytestmark = [pytest.mark.e2e]


class MockLLMResponse:
    """模拟 LLM 响应"""
    def __init__(self, content: str):
        self.content = content


class TestFullWritingWorkflow:
    """完整写作工作流测试"""

    @pytest.mark.asyncio
    async def test_l1_quick_edit_workflow(self):
        """测试 L1 快速修复工作流"""
        from agents.commander import CommanderAgent, WorkflowLevel

        mock_llm = Mock()
        commander = CommanderAgent(llm=mock_llm)

        # 1. 路由
        level = commander.route("修复这个错别字")
        assert level == WorkflowLevel.L1_RAPID

        # 2. 分解任务
        tasks = commander.dispatch_tasks("修复错别字", level)
        assert len(tasks) == 1
        assert tasks[0].agent_type == "writer"

    @pytest.mark.asyncio
    async def test_l3_chapter_writing_workflow(self):
        """测试 L3 章节写作工作流"""
        from agents.commander import CommanderAgent, WorkflowLevel, SceneType

        mock_llm = Mock()
        commander = CommanderAgent(llm=mock_llm)

        # 1. 路由
        task = "写第三章：主角与导师的对话"
        level = commander.route(task)
        assert level == WorkflowLevel.L3_STANDARD

        # 2. 检测场景类型
        scene_type = commander.detect_scene_type(task)
        assert scene_type == SceneType.DIALOGUE

        # 3. 获取技能
        skills = commander.dispatch_skills(scene_type)
        assert "dialogue-system" in skills

        # 4. 分解任务
        tasks = commander.dispatch_tasks(task, level)
        assert len(tasks) == 3

        # 验证任务链
        agent_types = [t.agent_type for t in tasks]
        assert agent_types == ["architect", "writer", "critic"]

        # 验证依赖关系
        assert tasks[1].depends_on == ["task-001"]
        assert tasks[2].depends_on == ["task-002"]

    @pytest.mark.asyncio
    async def test_l5_brainstorm_workflow(self):
        """测试 L5 头脑风暴工作流"""
        from agents.commander import CommanderAgent, WorkflowLevel

        mock_llm = Mock()
        commander = CommanderAgent(llm=mock_llm)

        # 1. 路由
        task = "设计一个奇幻世界的魔法体系"
        level = commander.route(task)
        assert level == WorkflowLevel.L5_BRAINSTORM

        # 2. 分解任务
        tasks = commander.dispatch_tasks(task, level)
        assert len(tasks) == 5

        # 验证包含上下文 Agent
        agent_types = [t.agent_type for t in tasks]
        assert "worldbuilding" in agent_types
        assert "character" in agent_types

    @pytest.mark.asyncio
    async def test_commander_execute_full_pipeline(self):
        """测试 Commander 完整执行管线"""
        from agents.commander import CommanderAgent, CommanderOutput

        mock_llm = Mock()
        commander = CommanderAgent(llm=mock_llm)

        output = await commander.execute("写一个动作场景")

        assert isinstance(output, CommanderOutput)
        assert output.total_steps > 0
        assert len(output.task_assignments) > 0


class TestMemoryIntegration:
    """记忆系统集成测试"""

    @pytest.mark.asyncio
    async def test_memory_in_writing_context(self, tmp_path):
        """测试写作上下文中的记忆使用"""
        from memory.unified_memory import UnifiedMemoryEngine

        engine = UnifiedMemoryEngine(db_path=str(tmp_path / "test.db"))

        try:
            # 1. 存储角色信息
            await engine.add(
                content="林晓：25岁，火系魔法师，性格沉稳",
                layer="project",
                dimension="character",
                entity_id="char:linxiao",
                importance=0.9
            )

            # 2. 存储世界设定
            await engine.add(
                content="魔法学院位于云端之城",
                layer="project",
                dimension="worldview",
                importance=0.8
            )

            # 3. 搜索相关上下文
            results = await engine.search(
                query="林晓的魔法能力",
                dimensions=["character"],
                limit=5
            )

            assert len(results) > 0
            assert any("林晓" in r["content"] for r in results)

        finally:
            engine.close()


class TestWorkflowWithCheckpoints:
    """带检查点的工作流测试"""

    @pytest.mark.asyncio
    async def test_workflow_with_checkpoint_creation(self, tmp_path):
        """测试工作流中的检查点创建"""
        from workflow.workflow_engine import WorkflowEngine

        engine = WorkflowEngine(workspace=str(tmp_path))

        # 1. 创建计划
        plan = await engine.plan("写第一章", level="L3")
        plan_id = plan["plan_id"]

        # 2. 执行部分步骤
        await engine.execute(plan_id)

        # 3. 创建检查点
        checkpoint = await engine.create_checkpoint(
            description="完成第一步",
            auto_commit=False
        )

        assert "checkpoint_id" in checkpoint

        # 4. 继续执行
        await engine.execute(plan_id)

        # 5. 验证进度
        status = engine.get_plan_status(plan_id)
        assert "2/" in status["progress"]


class TestContextAgents:
    """上下文 Agent 测试"""

    @pytest.mark.asyncio
    async def test_worldbuilding_agent(self):
        """测试世界观 Agent"""
        from agents.worldbuilding import WorldbuildingAgent, WorldContext

        agent = WorldbuildingAgent()

        context = await agent.get_context({
            "location": "魔法学院",
            "time": "深夜"
        })

        assert isinstance(context, WorldContext)
        assert context.atmosphere != ""

    @pytest.mark.asyncio
    async def test_character_agent(self):
        """测试角色 Agent"""
        from agents.character import CharacterAgent, CharacterContext

        agent = CharacterAgent()

        context = await agent.get_context({
            "pov_character": "林晓",
            "characters": ["林晓", "张明"]
        })

        assert isinstance(context, CharacterContext)
        assert context.dialogue_guidelines is not None

    @pytest.mark.asyncio
    async def test_plot_agent(self):
        """测试剧情 Agent"""
        from agents.plot import PlotAgent, PlotContext

        agent = PlotAgent()

        context = await agent.get_context({
            "scene_id": "CH03-SC01",
            "structural_function": "Rising"
        })

        assert isinstance(context, PlotContext)
        assert context.tension_level > 0


class TestSkillInjection:
    """技能注入测试"""

    def test_skill_router_mapping(self):
        """测试技能路由映射"""
        from agents.skill_router import SkillRouter

        router = SkillRouter()
        skills = router.list_all_skills()

        # 应该有技能
        assert len(skills) > 0

    def test_commander_skill_dispatch(self):
        """测试 Commander 技能调度"""
        from agents.commander import CommanderAgent, SceneType

        commander = CommanderAgent(llm=Mock())

        # 每种场景类型都应该有对应技能
        for scene_type in SceneType:
            skills = commander.dispatch_skills(scene_type)
            assert len(skills) > 0, f"{scene_type} should have skills"


class TestResultIntegration:
    """结果整合测试"""

    def test_integrate_multi_agent_results(self):
        """测试多 Agent 结果整合"""
        from agents.commander import CommanderAgent

        commander = CommanderAgent(llm=Mock())

        results = [
            {
                "agent_type": "architect",
                "tokens_used": 500,
                "structure": {"scenes": ["开场", "发展", "高潮"]}
            },
            {
                "agent_type": "writer",
                "tokens_used": 2000,
                "content": "林晓站在学院门口，望着远方的云海..."
            },
            {
                "agent_type": "critic",
                "tokens_used": 300,
                "score": 82,
                "decision": "APPROVED"
            }
        ]

        final = commander.integrate_results(results)

        assert final["status"] == "completed"
        assert "林晓" in final["content"]
        assert final["metadata"]["quality_score"] == 82
        assert final["metadata"]["decision"] == "APPROVED"
        assert final["metadata"]["total_tokens"] == 2800


class TestErrorHandling:
    """错误处理测试"""

    @pytest.mark.asyncio
    async def test_commander_fallback_on_llm_failure(self):
        """测试 LLM 失败时的回退"""
        from agents.commander import CommanderAgent, WorkflowLevel

        # 模拟失败的 LLM
        mock_llm = Mock()
        mock_llm.invoke.side_effect = Exception("LLM Error")

        commander = CommanderAgent(llm=mock_llm)

        # 应该回退到关键词匹配
        level = commander.route("fix typo")
        assert level == WorkflowLevel.L1_RAPID

    @pytest.mark.asyncio
    async def test_memory_engine_handles_invalid_query(self, tmp_path):
        """测试记忆引擎处理无效查询"""
        from memory.unified_memory import UnifiedMemoryEngine

        engine = UnifiedMemoryEngine(db_path=str(tmp_path / "test.db"))

        try:
            results = await engine.search(query="", limit=10)
            # 应该返回空列表而不是崩溃
            assert isinstance(results, list)
        finally:
            engine.close()


# 运行测试
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
