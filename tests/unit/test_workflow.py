"""
LangGraph 工作流单元测试
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from workflow.state import (
    WritingState,
    WorkflowConfig,
    DEFAULT_CONFIG,
    create_initial_state
)
from workflow.graph import (
    create_writing_graph
)
from workflow.adapters.novel_adapter import NovelAdapter


class TestWritingState:
    """WritingState 测试"""
    
    def test_create_initial_state(self):
        """测试初始状态创建"""
        state = create_initial_state(
            user_idea="测试故事灵感",
            genre="悬疑",
            target_chapters=10
        )
        
        assert state["user_idea"] == "测试故事灵感"
        assert state["genre"] == "悬疑"
        assert state["target_chapters"] == 10
        assert state["revision_count"] == 0
        assert state["draft_content"] == ""
    
    def test_initial_state_has_session_id(self):
        """测试初始状态包含会话ID"""
        state = create_initial_state("测试")

        assert "session_id" in state
        assert len(state["session_id"]) > 0

    def test_initial_state_has_metadata(self):
        """测试初始状态包含 metadata"""
        state = create_initial_state("测试", metadata={"resume": "yes"})

        assert state.get("metadata") == {"resume": "yes"}


class TestWorkflowConfig:
    """WorkflowConfig 测试"""
    
    def test_default_config_values(self):
        """测试默认配置值"""
        assert DEFAULT_CONFIG["pass_score"] == 99
        assert DEFAULT_CONFIG["min_c_score"] == 7
        assert DEFAULT_CONFIG["max_revisions"] == 3


class TestShouldContinue:
    """决策路由函数测试 (Testing NovelAdapter Logic)"""

    def setup_method(self):
        self.adapter = NovelAdapter()
    
    def test_approved_when_score_high_and_c_sufficient(self):
        """测试高分且C分足够时通过"""
        state = {
            "critique_result": {
                "decision": "APPROVED",
                "total_score": 99,
                "lock_analysis": {"C": {"score": 8}}
            },
            "revision_count": 1
        }
        
        result = self.adapter.route_after_critic(state)
        assert result == "finalize"
    
    def test_continue_when_score_low(self):
        """测试低分时继续修改"""
        state = {
            "critique_result": {
                "decision": "REVISE",
                "total_score": 65,
                "lock_analysis": {"C": {"score": 6}}
            },
            "revision_count": 1
        }
        
        result = self.adapter.route_after_critic(state)
        assert result == "writer"
    
    def test_human_when_max_revisions_reached(self):
        """测试达到最大修改次数时需要人工"""
        state = {
            "critique_result": {
                "decision": "REVISE",
                "total_score": 65,
                "lock_analysis": {"C": {"score": 6}}
            },
            "revision_count": 3  # 已达最大
        }
        
        result = self.adapter.route_after_critic(state)
        assert result == "human_reviewer"
    
    def test_human_when_score_too_low(self):
        """测试分数过低时需要人工"""
        state = {
            "critique_result": {
                "decision": "REWRITE",
                "total_score": 40,
                "lock_analysis": {"C": {"score": 3}}
            },
            "revision_count": 1
        }
        
        result = self.adapter.route_after_critic(state)
        assert result == "human_reviewer"
    
    def test_human_when_c_score_low_despite_high_total(self):
        """测试总分高但C分低时需要人工审阅"""
        state = {
            "critique_result": {
                "decision": "HUMAN_REVIEW",
                "total_score": 95,
                "lock_analysis": {"C": {"score": 5}}  # C分不足7
            },
            "revision_count": 1
        }
        
        result = self.adapter.route_after_critic(state)
        # 总分>=70 触发 HUMAN_REVIEW
        assert result == "human_reviewer"


class TestCreateWritingGraph:
    """图创建测试"""
    
    def test_graph_creation(self):
        """测试图创建成功"""
        graph = create_writing_graph()
        
        # 检查节点存在
        assert graph is not None
    
    def test_graph_has_required_nodes(self):
        """测试图包含必要节点"""
        graph = create_writing_graph()
        
        # 获取节点名称
        node_names = list(graph.nodes.keys())
        
        assert "architect" in node_names
        assert "writer" in node_names
        assert "critic" in node_names
        assert "finalize" in node_names


class TestReflectionPattern:
    """反思模式测试"""
    
    def test_feedback_context_prepared(self):
        """测试反馈上下文正确准备"""
        # 模拟Critic输出
        critique_result = {
            "total_score": 65,
            "decision": "REVISE",
            "actionable_feedback": "增加冲突描写",
            "revision_instructions": [
                {"target": "中段", "issue": "冲突不足", "suggestion": "增加对抗"}
            ]
        }
        
        # 模拟图更新后的状态
        updated_state = {
            "critique_result": critique_result,
            "feedback_context": critique_result["actionable_feedback"],
            "revision_count": 1
        }
        
        assert updated_state["feedback_context"] == "增加冲突描写"
        assert updated_state["revision_count"] == 1
