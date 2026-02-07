# -*- coding: utf-8 -*-
"""
集成测试 - Agent 链路验证

测试完整的 Commander → Architect → Writer → Critic 工作流链路。
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any

# 导入被测试模块
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from agents.commander import (
    CommanderAgent,
    WorkflowLevel,
    SceneType,
    TaskAssignment,
    CommanderOutput
)
from agents.skill_router import SkillRouter, TaskType


class MockLLM:
    """模拟 LLM 用于测试"""

    def __init__(self, response: str = None):
        self.response = response or '{"reasoning": "test", "workflow_level": "standard"}'
        self.invoke_count = 0

    def invoke(self, *args, **kwargs):
        self.invoke_count += 1
        return self.response

    def __or__(self, other):
        """支持 | 操作符链式调用"""
        return MockChain(self, other)


class MockChain:
    """模拟 LangChain 链"""

    def __init__(self, llm, parser):
        self.llm = llm
        self.parser = parser

    def invoke(self, *args, **kwargs):
        # 模拟解析失败，触发 fallback
        raise Exception("Mock LLM failure for testing fallback")


class TestCommanderRouting:
    """Commander 路由测试"""

    def setup_method(self):
        """每个测试前的设置"""
        self.mock_llm = MockLLM()
        self.commander = CommanderAgent(llm=self.mock_llm)

    def test_route_to_l1_rapid(self):
        """测试快速修复路由到 L1"""
        tasks = [
            "修复这个错别字",
            "polish this paragraph",
            "纠正语法错误",
            "fix the typo in line 3",
        ]

        for task in tasks:
            level = self.commander.route(task)
            assert level == WorkflowLevel.L1_RAPID, f"Task '{task}' should route to L1_RAPID"

    def test_route_to_l3_standard(self):
        """测试标准写作路由到 L3"""
        tasks = [
            "写一个对话场景",
            "继续写第三章",
            "完成这个动作戏",
        ]

        for task in tasks:
            level = self.commander.route(task)
            assert level == WorkflowLevel.L3_STANDARD, f"Task '{task}' should route to L3_STANDARD"

    def test_route_to_l5_brainstorm(self):
        """测试头脑风暴路由到 L5"""
        tasks = [
            "设计一个魔法世界观",
            "brainstorm character backgrounds",
            "规划整本书的大纲",
            "设定这个角色的性格",
        ]

        for task in tasks:
            level = self.commander.route(task)
            assert level == WorkflowLevel.L5_BRAINSTORM, f"Task '{task}' should route to L5_BRAINSTORM"


class TestSceneTypeDetection:
    """场景类型检测测试"""

    def setup_method(self):
        self.commander = CommanderAgent(llm=MockLLM())

    def test_detect_dialogue_scene(self):
        """测试对话场景检测"""
        tasks = ["写一段对话", "他们之间的交谈", "dialogue between A and B"]

        for task in tasks:
            scene_type = self.commander.detect_scene_type(task)
            assert scene_type == SceneType.DIALOGUE

    def test_detect_action_scene(self):
        """测试动作场景检测"""
        tasks = ["一场激烈的战斗", "追逐戏", "action sequence"]

        for task in tasks:
            scene_type = self.commander.detect_scene_type(task)
            assert scene_type == SceneType.ACTION

    def test_detect_climax_scene(self):
        """测试高潮场景检测"""
        tasks = ["故事高潮", "最终决战", "climax of the story"]

        for task in tasks:
            scene_type = self.commander.detect_scene_type(task)
            assert scene_type == SceneType.CLIMAX

    def test_detect_opening_scene(self):
        """测试开场场景检测"""
        tasks = ["故事开头", "opening scene", "序章"]

        for task in tasks:
            scene_type = self.commander.detect_scene_type(task)
            assert scene_type == SceneType.OPENING

    def test_default_to_dialogue(self):
        """测试默认场景类型"""
        scene_type = self.commander.detect_scene_type("写点什么")
        assert scene_type == SceneType.DIALOGUE


class TestSkillDispatch:
    """技能调度测试"""

    def setup_method(self):
        self.commander = CommanderAgent(llm=MockLLM())

    def test_dispatch_skills_for_dialogue(self):
        """测试对话场景技能调度"""
        skills = self.commander.dispatch_skills(SceneType.DIALOGUE)

        assert "dialogue-system" in skills
        assert "psychology-craft" in skills
        assert "show-dont-tell" in skills

    def test_dispatch_skills_for_action(self):
        """测试动作场景技能调度"""
        skills = self.commander.dispatch_skills(SceneType.ACTION)

        assert "action-craft" in skills
        assert "tension-scene" in skills
        assert "pov-system" in skills

    def test_dispatch_skills_for_climax(self):
        """测试高潮场景技能调度"""
        skills = self.commander.dispatch_skills(SceneType.CLIMAX)

        assert "conflict-escalation" in skills
        assert "tension-arc" in skills
        assert "emotion-arc" in skills

    def test_all_scene_types_have_skills(self):
        """测试所有场景类型都有技能映射"""
        for scene_type in SceneType:
            skills = self.commander.dispatch_skills(scene_type)
            assert len(skills) > 0, f"SceneType {scene_type} should have skills"


class TestTaskDispatch:
    """任务分解测试"""

    def setup_method(self):
        self.commander = CommanderAgent(llm=MockLLM())

    def test_l1_dispatch_single_task(self):
        """测试 L1 级别只分配一个任务"""
        assignments = self.commander.dispatch_tasks(
            "fix typo",
            WorkflowLevel.L1_RAPID
        )

        assert len(assignments) == 1
        assert assignments[0].agent_type == "writer"
        assert len(assignments[0].depends_on) == 0

    def test_l3_dispatch_three_tasks(self):
        """测试 L3 级别分配三个任务"""
        assignments = self.commander.dispatch_tasks(
            "写一个对话场景",
            WorkflowLevel.L3_STANDARD
        )

        assert len(assignments) == 3

        # 验证 Agent 顺序
        agent_types = [a.agent_type for a in assignments]
        assert agent_types == ["architect", "writer", "critic"]

        # 验证依赖关系
        assert assignments[0].depends_on == []
        assert "task-001" in assignments[1].depends_on
        assert "task-002" in assignments[2].depends_on

    def test_l5_dispatch_five_tasks(self):
        """测试 L5 级别分配五个任务"""
        assignments = self.commander.dispatch_tasks(
            "设计一个魔法世界",
            WorkflowLevel.L5_BRAINSTORM
        )

        assert len(assignments) == 5

        # 验证包含上下文 Agent
        agent_types = [a.agent_type for a in assignments]
        assert "worldbuilding" in agent_types
        assert "character" in agent_types
        assert "architect" in agent_types
        assert "writer" in agent_types
        assert "critic" in agent_types

    def test_task_has_skills(self):
        """测试任务包含技能"""
        assignments = self.commander.dispatch_tasks(
            "写一个对话场景",
            WorkflowLevel.L3_STANDARD
        )

        writer_task = next(a for a in assignments if a.agent_type == "writer")
        assert len(writer_task.skills) > 0


class TestResultIntegration:
    """结果整合测试"""

    def setup_method(self):
        self.commander = CommanderAgent(llm=MockLLM())

    def test_integrate_results(self):
        """测试结果整合"""
        mock_results = [
            {
                "agent_type": "architect",
                "tokens_used": 500,
                "structure": {"scenes": 3}
            },
            {
                "agent_type": "writer",
                "tokens_used": 2000,
                "content": "这是生成的内容..."
            },
            {
                "agent_type": "critic",
                "tokens_used": 300,
                "score": 85,
                "decision": "APPROVED"
            }
        ]

        final = self.commander.integrate_results(mock_results)

        assert final["status"] == "completed"
        assert final["content"] == "这是生成的内容..."
        assert final["metadata"]["total_tokens"] == 2800
        assert final["metadata"]["quality_score"] == 85
        assert final["metadata"]["decision"] == "APPROVED"
        assert len(final["metadata"]["agents_invoked"]) == 3


class TestCommanderExecute:
    """Commander 完整执行测试"""

    def setup_method(self):
        self.commander = CommanderAgent(llm=MockLLM())

    @pytest.mark.asyncio
    async def test_execute_returns_commander_output(self):
        """测试 execute 返回正确结构"""
        output = await self.commander.execute("写一个对话场景")

        assert isinstance(output, CommanderOutput)
        assert output.workflow_level == WorkflowLevel.L3_STANDARD
        assert output.total_steps == 3
        assert len(output.task_assignments) == 3

    @pytest.mark.asyncio
    async def test_execute_estimates_tokens(self):
        """测试 execute 估算 token"""
        output = await self.commander.execute("写一个对话场景")

        assert output.estimated_tokens > 0


class TestSkillRouter:
    """SkillRouter 测试"""

    def setup_method(self):
        self.router = SkillRouter()

    def test_list_all_skills(self):
        """测试列出所有技能"""
        skills = self.router.list_all_skills()
        assert len(skills) > 0

    def test_route_by_task_type(self):
        """测试按任务类型路由"""
        # 跳过如果 TaskType 没有定义
        try:
            recommendations = self.router.route_by_task_type(TaskType.DIALOGUE_WRITING)
            assert len(recommendations) > 0
        except (AttributeError, ValueError):
            pytest.skip("TaskType.DIALOGUE_WRITING not defined")

    def test_route_by_keywords(self):
        """测试按关键词路由"""
        recommendations = self.router.route_by_keywords(["对话", "角色"])
        # 可能返回空列表，但不应该报错
        assert isinstance(recommendations, list)


# 运行测试
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
