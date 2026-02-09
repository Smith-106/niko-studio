# -*- coding: utf-8 -*-
"""
Integration Tests - CCW 6-Field Protocol

Tests for the Claude Code Workflow (CCW) 6-Field Prompt Protocol implementation:
- PURPOSE: High-level goal
- TASK: Specific action
- MODE: Operational mode
- CONTEXT: Relevant evidence
- EXPECTED: Output format
- RULES: Constraints and guidelines

This test suite validates:
1. CCW protocol format compliance across all agents
2. Protocol integration with L1-L5 workflow levels
3. Message format and response validation
4. Workflow routing logic correctness
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch, AsyncMock
from typing import Dict, Any
import re

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from agents.base import BaseAgent, TokenUsage, BudgetConfig, BudgetExceededError
from agents.commander import CommanderAgent, WorkflowLevel, SceneType, TaskAssignment


class ConcreteTestAgent(BaseAgent):
    """Concrete implementation for testing BaseAgent"""

    def run(self, input_data: Any) -> Any:
        return {"status": "success", "input": input_data}


class TestCCW6FieldProtocol:
    """CCW 6-Field Protocol Tests"""

    @pytest.fixture
    def agent(self):
        return ConcreteTestAgent(name="TestAgent")

    def test_construct_prompt_has_all_six_fields(self, agent):
        """Test that construct_prompt includes all 6 CCW fields"""
        prompt = agent.construct_prompt(
            purpose="Analyze user request",
            task="Classify the request complexity",
            mode="analysis",
            context="User wants to write a chapter",
            expected="Structured JSON output",
            rules="Follow L1-L5 classification"
        )

        assert "PURPOSE:" in prompt
        assert "TASK:" in prompt
        assert "MODE:" in prompt
        assert "CONTEXT:" in prompt
        assert "EXPECTED:" in prompt
        assert "RULES:" in prompt

    def test_construct_prompt_field_values(self, agent):
        """Test that field values are correctly embedded"""
        purpose = "Test Purpose Value"
        task = "Test Task Value"
        mode = "execution"
        context = "Test Context Value"
        expected = "Test Expected Value"
        rules = "Test Rules Value"

        prompt = agent.construct_prompt(
            purpose=purpose,
            task=task,
            mode=mode,
            context=context,
            expected=expected,
            rules=rules
        )

        assert purpose in prompt
        assert task in prompt
        assert mode in prompt
        assert context in prompt
        assert expected in prompt
        assert rules in prompt

    def test_construct_prompt_multiline_values(self, agent):
        """Test prompt construction with multiline values"""
        rules = """
        - Rule 1: Follow existing patterns
        - Rule 2: Use consistent naming
        - Rule 3: Include error handling
        """

        prompt = agent.construct_prompt(
            purpose="Implement feature",
            task="Create new component",
            mode="write",
            context="Project uses TypeScript",
            expected="Working implementation",
            rules=rules
        )

        assert "Rule 1" in prompt
        assert "Rule 2" in prompt
        assert "Rule 3" in prompt

    def test_construct_prompt_chinese_content(self, agent):
        """Test prompt construction with Chinese content"""
        prompt = agent.construct_prompt(
            purpose="分析用户请求",
            task="将请求分类到合适的工作流级别",
            mode="analysis",
            context="用户想要写一个章节",
            expected="结构化的JSON输出",
            rules="遵循L1-L5分类规则"
        )

        assert "分析用户请求" in prompt
        assert "工作流级别" in prompt

    def test_construct_prompt_field_order(self, agent):
        """Test that CCW fields appear in correct order"""
        prompt = agent.construct_prompt(
            purpose="Test",
            task="Test",
            mode="analysis",
            context="Test",
            expected="Test",
            rules="Test"
        )

        # Verify field order
        purpose_pos = prompt.find("PURPOSE:")
        task_pos = prompt.find("TASK:")
        mode_pos = prompt.find("MODE:")
        context_pos = prompt.find("CONTEXT:")
        expected_pos = prompt.find("EXPECTED:")
        rules_pos = prompt.find("RULES:")

        assert purpose_pos < task_pos < mode_pos < context_pos < expected_pos < rules_pos

    def test_construct_prompt_empty_values(self, agent):
        """Test prompt construction with empty values"""
        prompt = agent.construct_prompt(
            purpose="",
            task="",
            mode="",
            context="",
            expected="",
            rules=""
        )

        # Should still have all fields
        assert "PURPOSE:" in prompt
        assert "TASK:" in prompt
        assert "MODE:" in prompt
        assert "CONTEXT:" in prompt
        assert "EXPECTED:" in prompt
        assert "RULES:" in prompt

    def test_construct_prompt_special_characters(self, agent):
        """Test prompt with special characters"""
        prompt = agent.construct_prompt(
            purpose="Test with 'quotes' and \"double quotes\"",
            task="Handle <xml> tags and &ampersands",
            mode="analysis",
            context="Path: C:\\Users\\test or /home/user",
            expected="JSON with {brackets} and [arrays]",
            rules="Use regex like ^pattern$ and \\d+"
        )

        assert "'quotes'" in prompt
        assert '"double quotes"' in prompt
        assert "<xml>" in prompt


class TestCCWProtocolModeValidation:
    """CCW Protocol Mode Validation Tests"""

    @pytest.fixture
    def agent(self):
        return ConcreteTestAgent(name="ModeTestAgent")

    def test_analysis_mode_prompt(self, agent):
        """Test analysis mode prompt construction"""
        prompt = agent.construct_prompt(
            purpose="Analyze code patterns",
            task="Find similar implementations",
            mode="analysis",
            context="Reviewing authentication module",
            expected="Pattern report",
            rules="Read-only, no modifications"
        )

        assert "MODE: analysis" in prompt

    def test_write_mode_prompt(self, agent):
        """Test write mode prompt construction"""
        prompt = agent.construct_prompt(
            purpose="Implement feature",
            task="Create login component",
            mode="write",
            context="Using React + TypeScript",
            expected="Working component file",
            rules="Follow existing patterns"
        )

        assert "MODE: write" in prompt

    def test_planning_mode_prompt(self, agent):
        """Test planning mode prompt construction"""
        prompt = agent.construct_prompt(
            purpose="Design system architecture",
            task="Create component hierarchy",
            mode="planning",
            context="New microservice",
            expected="Architecture diagram",
            rules="Consider scalability"
        )

        assert "MODE: planning" in prompt

    def test_execution_mode_prompt(self, agent):
        """Test execution mode prompt construction"""
        prompt = agent.construct_prompt(
            purpose="Execute workflow",
            task="Run chapter generation pipeline",
            mode="execution",
            context="L3 workflow active",
            expected="Generated chapter content",
            rules="Follow Plan-Act pattern"
        )

        assert "MODE: execution" in prompt

    def test_review_mode_prompt(self, agent):
        """Test review mode prompt construction"""
        prompt = agent.construct_prompt(
            purpose="Review generated content",
            task="Evaluate chapter quality",
            mode="review",
            context="Chapter 1 draft complete",
            expected="Quality score and feedback",
            rules="Use 8-dimension LOCK matrix"
        )

        assert "MODE: review" in prompt


class TestCommanderCCWIntegration:
    """Commander Agent CCW Protocol Integration Tests"""

    @pytest.fixture
    def mock_llm(self):
        return Mock()

    @pytest.fixture
    def commander(self, mock_llm):
        return CommanderAgent(llm=mock_llm)

    def test_commander_uses_ccw_protocol(self, commander):
        """Test that Commander constructs CCW-compliant prompts"""
        # Access the construct_prompt method
        prompt = commander.construct_prompt(
            purpose="Analyze the user's request to determine workflow level",
            task="Classify the request into one of the defined workflow levels",
            mode="analysis",
            context="User Request: 'Write chapter 3'",
            expected="Structured analysis with reasoning and workflow level",
            rules="Use L1_RAPID, L3_STANDARD, L5_BRAINSTORM definitions"
        )

        # Verify all 6 fields are present
        assert prompt.count("PURPOSE:") == 1
        assert prompt.count("TASK:") == 1
        assert prompt.count("MODE:") == 1
        assert prompt.count("CONTEXT:") == 1
        assert prompt.count("EXPECTED:") == 1
        assert prompt.count("RULES:") == 1

    def test_commander_routing_fallback(self, commander):
        """Test Commander falls back to heuristics when LLM fails"""
        # The mock LLM will cause an exception, triggering fallback
        result = commander.route("Fix typo in chapter 1")

        assert result == WorkflowLevel.L1_RAPID

    def test_commander_routing_l3_fallback(self, commander):
        """Test Commander routes to L3 by default"""
        result = commander.route("Write an exciting scene")

        assert result == WorkflowLevel.L3_STANDARD

    def test_commander_routing_l5_fallback(self, commander):
        """Test Commander routes to L5 for worldbuilding"""
        result = commander.route("Design the world setting and character backgrounds")

        assert result == WorkflowLevel.L5_BRAINSTORM

    def test_commander_routing_polish_keywords(self, commander):
        """Test Commander routes to L1 for polish keywords"""
        polish_tasks = [
            "Polish this paragraph",
            "Correct the grammar",
            "Fix the typos",
        ]

        for task in polish_tasks:
            result = commander.route(task)
            assert result == WorkflowLevel.L1_RAPID, f"Failed for: {task}"

    def test_commander_routing_brainstorm_keywords(self, commander):
        """Test Commander routes to L5 for brainstorm keywords"""
        brainstorm_tasks = [
            "Plan the story arc",
            "Design the world setting",
            "Create character backgrounds",
            "Brainstorm plot ideas",
        ]

        for task in brainstorm_tasks:
            result = commander.route(task)
            assert result == WorkflowLevel.L5_BRAINSTORM, f"Failed for: {task}"


class TestCCWProtocolPerLevel:
    """CCW Protocol Tests Per Workflow Level"""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=Mock())

    def test_l1_ccw_format(self, commander):
        """Test L1 tasks use correct CCW format"""
        assignments = commander.dispatch_tasks("Fix typo", WorkflowLevel.L1_RAPID)

        assert len(assignments) == 1
        task = assignments[0]

        # L1 should have minimal context
        assert task.context.get("level") == "L1"
        assert task.context.get("max_tokens") == 500

    def test_l3_ccw_format(self, commander):
        """Test L3 tasks use correct CCW format"""
        assignments = commander.dispatch_tasks("Write chapter 1", WorkflowLevel.L3_STANDARD)

        assert len(assignments) == 3

        # Verify each task has proper CCW fields
        for task in assignments:
            assert task.task_id is not None
            assert task.agent_type in ["architect", "writer", "critic"]
            assert task.instruction is not None
            assert isinstance(task.skills, list)
            assert task.context.get("level") == "L3"

    def test_l5_ccw_format(self, commander):
        """Test L5 tasks use correct CCW format"""
        assignments = commander.dispatch_tasks("Design world", WorkflowLevel.L5_BRAINSTORM)

        assert len(assignments) == 5

        # Verify each task has proper CCW fields
        for task in assignments:
            assert task.task_id is not None
            assert task.agent_type in ["worldbuilding", "character", "architect", "writer", "critic"]
            assert task.instruction is not None
            assert isinstance(task.skills, list)
            assert task.context.get("level") == "L5"

    def test_l1_single_agent_pattern(self, commander):
        """Test L1 uses single-agent pattern"""
        assignments = commander.dispatch_tasks("Quick fix", WorkflowLevel.L1_RAPID)

        assert len(assignments) == 1
        assert assignments[0].agent_type == "writer"
        assert assignments[0].depends_on == []

    def test_l3_chain_pattern(self, commander):
        """Test L3 uses architect -> writer -> critic chain"""
        assignments = commander.dispatch_tasks("Write scene", WorkflowLevel.L3_STANDARD)

        agent_types = [a.agent_type for a in assignments]
        assert agent_types == ["architect", "writer", "critic"]

        # Verify dependency chain
        assert assignments[0].depends_on == []
        assert assignments[1].depends_on == ["task-001"]
        assert assignments[2].depends_on == ["task-002"]

    def test_l5_parallel_context_pattern(self, commander):
        """Test L5 uses parallel context gathering"""
        assignments = commander.dispatch_tasks("Create story", WorkflowLevel.L5_BRAINSTORM)

        worldbuilding = next(a for a in assignments if a.agent_type == "worldbuilding")
        character = next(a for a in assignments if a.agent_type == "character")

        # Both should run in parallel (no dependencies)
        assert worldbuilding.depends_on == []
        assert character.depends_on == []

        # Architect depends on both
        architect = next(a for a in assignments if a.agent_type == "architect")
        assert "task-001" in architect.depends_on
        assert "task-002" in architect.depends_on


class TestTokenCostEstimation:
    """Token Cost Estimation Tests (Part of CCW Budget Control)"""

    @pytest.fixture
    def agent(self):
        return ConcreteTestAgent(
            name="CostAgent",
            config={
                "model": "gpt-4o",
                "max_cost_per_request": 0.5,
                "max_cost_per_session": 5.0
            }
        )

    def test_count_tokens(self, agent):
        """Test token counting"""
        text = "Hello, this is a test sentence."
        tokens = agent.count_tokens(text)

        assert tokens > 0
        assert isinstance(tokens, int)

    def test_count_tokens_chinese(self, agent):
        """Test token counting for Chinese text"""
        text = "这是一个中文测试句子。"
        tokens = agent.count_tokens(text)

        assert tokens > 0

    def test_count_tokens_empty(self, agent):
        """Test token counting for empty string"""
        tokens = agent.count_tokens("")
        assert tokens == 0

    def test_count_tokens_long_text(self, agent):
        """Test token counting for long text"""
        long_text = "This is a test sentence. " * 100
        tokens = agent.count_tokens(long_text)

        assert tokens > 100  # Should be more than word count

    def test_estimate_cost(self, agent):
        """Test cost estimation"""
        usage = agent.estimate_cost("Write a short paragraph about nature.")

        assert isinstance(usage, TokenUsage)
        assert usage.input_tokens > 0
        assert usage.output_tokens > 0
        assert usage.estimated_cost > 0

    def test_estimate_cost_with_output_tokens(self, agent):
        """Test cost estimation with explicit output tokens"""
        usage = agent.estimate_cost(
            "Write a story",
            estimated_output_tokens=1000
        )

        assert usage.output_tokens == 1000

    def test_check_budget_within_limits(self, agent):
        """Test budget check passes when within limits"""
        usage = TokenUsage(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            estimated_cost=0.001
        )

        passed, warning = agent.check_budget(usage)

        assert passed is True

    def test_check_budget_exceeds_request_limit(self, agent):
        """Test budget check fails when exceeding request limit"""
        usage = TokenUsage(
            input_tokens=100000,
            output_tokens=50000,
            total_tokens=150000,
            estimated_cost=10.0  # Exceeds max_cost_per_request
        )

        with pytest.raises(BudgetExceededError):
            agent.check_budget(usage, raise_on_exceed=True)

    def test_check_budget_warning_threshold(self, agent):
        """Test budget check returns warning at threshold"""
        usage = TokenUsage(
            input_tokens=1000,
            output_tokens=500,
            total_tokens=1500,
            estimated_cost=0.45  # 90% of 0.5 limit
        )

        passed, warning = agent.check_budget(usage, raise_on_exceed=False)

        assert passed is True
        assert warning is not None
        assert "approaching" in warning.lower()

    def test_record_usage(self, agent):
        """Test usage recording"""
        usage = TokenUsage(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            estimated_cost=0.01
        )

        agent.record_usage(usage)
        summary = agent.get_usage_summary()

        assert summary["request_count"] == 1
        assert summary["total_cost"] == 0.01

    def test_record_multiple_usages(self, agent):
        """Test recording multiple usages"""
        for i in range(3):
            usage = TokenUsage(
                input_tokens=100,
                output_tokens=50,
                total_tokens=150,
                estimated_cost=0.01
            )
            agent.record_usage(usage)

        summary = agent.get_usage_summary()

        assert summary["request_count"] == 3
        assert summary["total_cost"] == 0.03

    def test_reset_session(self, agent):
        """Test session reset"""
        usage = TokenUsage(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            estimated_cost=0.01
        )
        agent.record_usage(usage)

        agent.reset_session()
        summary = agent.get_usage_summary()

        assert summary["request_count"] == 0
        assert summary["total_cost"] == 0.0


class TestTaskAssignment:
    """Task Assignment Protocol Tests"""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=Mock())

    def test_task_assignment_structure(self, commander):
        """Test TaskAssignment has correct CCW fields"""
        assignments = commander.dispatch_tasks(
            "Write a dialogue scene",
            WorkflowLevel.L3_STANDARD
        )

        assert len(assignments) > 0

        for assignment in assignments:
            assert hasattr(assignment, 'task_id')
            assert hasattr(assignment, 'agent_type')
            assert hasattr(assignment, 'scene_type')
            assert hasattr(assignment, 'instruction')
            assert hasattr(assignment, 'skills')
            assert hasattr(assignment, 'context')
            assert hasattr(assignment, 'depends_on')

    def test_l1_task_assignment(self, commander):
        """Test L1 produces single writer task"""
        assignments = commander.dispatch_tasks(
            "Fix grammar",
            WorkflowLevel.L1_RAPID
        )

        assert len(assignments) == 1
        assert assignments[0].agent_type == "writer"
        assert assignments[0].depends_on == []

    def test_l3_task_assignment_chain(self, commander):
        """Test L3 produces architect -> writer -> critic chain"""
        assignments = commander.dispatch_tasks(
            "Write chapter 1",
            WorkflowLevel.L3_STANDARD
        )

        assert len(assignments) == 3

        agent_types = [a.agent_type for a in assignments]
        assert agent_types == ["architect", "writer", "critic"]

        # Check dependencies
        assert assignments[0].depends_on == []
        assert assignments[1].depends_on == ["task-001"]
        assert assignments[2].depends_on == ["task-002"]

    def test_l5_task_assignment_full_pipeline(self, commander):
        """Test L5 produces full 5-agent pipeline"""
        assignments = commander.dispatch_tasks(
            "Design magic system",
            WorkflowLevel.L5_BRAINSTORM
        )

        assert len(assignments) == 5

        agent_types = [a.agent_type for a in assignments]
        assert "worldbuilding" in agent_types
        assert "character" in agent_types
        assert "architect" in agent_types
        assert "writer" in agent_types
        assert "critic" in agent_types

    def test_task_assignment_has_skills(self, commander):
        """Test task assignments include skills"""
        assignments = commander.dispatch_tasks(
            "Write dialogue",
            WorkflowLevel.L3_STANDARD
        )

        for assignment in assignments:
            assert isinstance(assignment.skills, list)
            assert len(assignment.skills) > 0

    def test_task_assignment_has_instruction(self, commander):
        """Test task assignments include instructions"""
        task_desc = "Write a battle scene"
        assignments = commander.dispatch_tasks(
            task_desc,
            WorkflowLevel.L3_STANDARD
        )

        for assignment in assignments:
            assert assignment.instruction is not None
            assert len(assignment.instruction) > 0


class TestSceneTypeSkillMapping:
    """Scene Type to Skill Mapping Tests"""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=Mock())

    def test_detect_dialogue_scene(self, commander):
        """Test dialogue scene detection"""
        scene = commander.detect_scene_type("Write a conversation between hero and mentor")

        # Should detect dialogue or default
        assert isinstance(scene, SceneType)

    def test_detect_action_scene(self, commander):
        """Test action scene detection"""
        scene = commander.detect_scene_type("Write a fight scene")

        assert scene == SceneType.ACTION

    def test_detect_worldbuilding_scene(self, commander):
        """Test worldbuilding scene detection"""
        scene = commander.detect_scene_type("Describe the world setting")

        assert scene == SceneType.WORLDBUILDING

    def test_detect_opening_scene(self, commander):
        """Test opening scene detection"""
        scene = commander.detect_scene_type("Write the opening of the story")

        assert scene == SceneType.OPENING

    def test_detect_climax_scene(self, commander):
        """Test climax scene detection"""
        scene = commander.detect_scene_type("Write the showdown between hero and villain")

        assert scene == SceneType.CLIMAX

    def test_detect_ending_scene(self, commander):
        """Test ending scene detection"""
        scene = commander.detect_scene_type("Write the ending of the story")

        assert scene == SceneType.ENDING

    def test_detect_suspense_scene(self, commander):
        """Test suspense scene detection"""
        scene = commander.detect_scene_type("Write a mystery scene with suspense")

        assert scene == SceneType.SUSPENSE

    def test_detect_chinese_scene_types(self, commander):
        """Test Chinese scene type detection"""
        test_cases = [
            ("写一段对话场景", SceneType.DIALOGUE),
            ("描写战斗场面", SceneType.ACTION),
            ("设计世界观", SceneType.WORLDBUILDING),
            ("写高潮部分", SceneType.CLIMAX),
            ("设置悬念", SceneType.SUSPENSE),
        ]

        for task, expected_type in test_cases:
            scene = commander.detect_scene_type(task)
            assert scene == expected_type, f"Failed for: {task}"

    def test_dispatch_skills_for_scene(self, commander):
        """Test skill dispatch for scene types"""
        for scene_type in SceneType:
            skills = commander.dispatch_skills(scene_type)

            assert isinstance(skills, list)
            assert len(skills) > 0

    def test_dialogue_skills(self, commander):
        """Test dialogue scene gets appropriate skills"""
        skills = commander.dispatch_skills(SceneType.DIALOGUE)

        assert "dialogue-system" in skills

    def test_action_skills(self, commander):
        """Test action scene gets appropriate skills"""
        skills = commander.dispatch_skills(SceneType.ACTION)

        assert "action-craft" in skills

    def test_worldbuilding_skills(self, commander):
        """Test worldbuilding scene gets appropriate skills"""
        skills = commander.dispatch_skills(SceneType.WORLDBUILDING)

        assert "worldview-craft" in skills

    def test_suspense_skills(self, commander):
        """Test suspense scene gets appropriate skills"""
        skills = commander.dispatch_skills(SceneType.SUSPENSE)

        assert "suspense-craft" in skills


class TestCCWProtocolResponseFormat:
    """CCW Protocol Response Format Tests"""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=Mock())

    def test_integrate_results_format(self, commander):
        """Test result integration produces correct format"""
        results = [
            {
                "agent_type": "architect",
                "content": "Structure plan",
                "tokens_used": 100
            },
            {
                "agent_type": "writer",
                "content": "Written chapter content",
                "tokens_used": 500
            },
            {
                "agent_type": "critic",
                "score": 8.5,
                "decision": "ACCEPT",
                "tokens_used": 150
            }
        ]

        output = commander.integrate_results(results)

        assert output["status"] == "completed"
        assert output["content"] == "Written chapter content"
        assert output["metadata"]["quality_score"] == 8.5
        assert output["metadata"]["decision"] == "ACCEPT"
        assert output["metadata"]["total_tokens"] == 750
        assert len(output["metadata"]["agents_invoked"]) == 3

    def test_integrate_results_empty(self, commander):
        """Test result integration with empty results"""
        output = commander.integrate_results([])

        assert output["status"] == "completed"
        assert output["content"] == ""
        assert output["metadata"]["agents_invoked"] == []

    def test_integrate_results_partial(self, commander):
        """Test result integration with partial results"""
        results = [
            {
                "agent_type": "writer",
                "content": "Some content",
                "tokens_used": 200
            }
        ]

        output = commander.integrate_results(results)

        assert output["status"] == "completed"
        assert output["content"] == "Some content"
        assert output["metadata"]["total_tokens"] == 200


class TestCCWProtocolMessageFormat:
    """CCW Protocol Message Format Validation Tests"""

    @pytest.fixture
    def agent(self):
        return ConcreteTestAgent(name="FormatTestAgent")

    def test_prompt_format_regex(self, agent):
        """Test prompt follows correct format with regex"""
        prompt = agent.construct_prompt(
            purpose="Test purpose",
            task="Test task",
            mode="analysis",
            context="Test context",
            expected="Test expected",
            rules="Test rules"
        )

        # Verify format using regex
        assert re.search(r"PURPOSE:\s*.+", prompt) is not None
        assert re.search(r"TASK:\s*.+", prompt) is not None
        assert re.search(r"MODE:\s*.+", prompt) is not None
        assert re.search(r"CONTEXT:\s*.+", prompt) is not None
        assert re.search(r"EXPECTED:\s*.+", prompt) is not None
        assert re.search(r"RULES:\s*.+", prompt) is not None

    def test_prompt_no_duplicate_fields(self, agent):
        """Test prompt has no duplicate fields"""
        prompt = agent.construct_prompt(
            purpose="Test",
            task="Test",
            mode="analysis",
            context="Test",
            expected="Test",
            rules="Test"
        )

        assert prompt.count("PURPOSE:") == 1
        assert prompt.count("TASK:") == 1
        assert prompt.count("MODE:") == 1
        assert prompt.count("CONTEXT:") == 1
        assert prompt.count("EXPECTED:") == 1
        assert prompt.count("RULES:") == 1


class TestCCWProtocolWithWorkflowEngine:
    """CCW Protocol Integration with WorkflowEngine Tests"""

    @pytest.fixture
    def tmp_workspace(self, tmp_path):
        return tmp_path

    @pytest.fixture
    def engine(self, tmp_workspace):
        from workflow.workflow_engine import WorkflowEngine
        return WorkflowEngine(workspace=str(tmp_workspace))

    @pytest.mark.asyncio
    async def test_l1_workflow_ccw_integration(self, engine):
        """Test L1 workflow follows CCW protocol"""
        result = await engine.route("回答一个简单问题")

        assert result["level"] == "L1"
        assert "简单问答" in result["description"]

        # L1 should have minimal steps
        template = result["suggested_workflow"]
        assert len(template) == 1

    @pytest.mark.asyncio
    async def test_l3_workflow_ccw_integration(self, engine):
        """Test L3 workflow follows CCW protocol"""
        result = await engine.route("写一章：主角的冒险")

        assert result["level"] == "L3"

        # L3 should have full pipeline
        template = result["suggested_workflow"]
        step_names = [s["name"] for s in template]

        assert "analyze" in step_names
        assert "generate_draft" in step_names
        assert "evaluate" in step_names

    @pytest.mark.asyncio
    async def test_l5_workflow_ccw_integration(self, engine):
        """Test L5 workflow follows CCW protocol"""
        result = await engine.route("规划全书大纲")

        assert result["level"] == "L5"

        # L5 should have planning steps
        template = result["suggested_workflow"]
        step_names = [s["name"] for s in template]

        assert "concept" in step_names
        assert "outline" in step_names
        assert "character_design" in step_names

    @pytest.mark.asyncio
    async def test_plan_follows_ccw_structure(self, engine):
        """Test plan creation follows CCW structure"""
        plan = await engine.plan("写第一章", level="L3")

        assert "plan_id" in plan
        assert "steps" in plan
        assert "level" in plan
        assert plan["level"] == "L3"

        # Each step should have proper structure
        for step in plan["steps"]:
            assert "id" in step
            assert "name" in step
            assert "description" in step
            assert "dependencies" in step
            assert "status" in step

    @pytest.mark.asyncio
    async def test_execute_follows_ccw_protocol(self, engine):
        """Test execution follows CCW protocol"""
        plan = await engine.plan("回答问题", level="L1")
        result = await engine.execute(plan["plan_id"])

        assert "status" in result
        assert result["status"] == "completed"
        assert "result" in result


class TestCCWProtocolEdgeCases:
    """CCW Protocol Edge Case Tests"""

    @pytest.fixture
    def agent(self):
        return ConcreteTestAgent(name="EdgeCaseAgent")

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=Mock())

    def test_very_long_task_description(self, commander):
        """Test handling very long task descriptions"""
        long_task = "Write a chapter about the hero's journey. " * 50
        level = commander.route(long_task)

        # Should still route correctly
        assert level in [WorkflowLevel.L1_RAPID, WorkflowLevel.L3_STANDARD, WorkflowLevel.L5_BRAINSTORM]

    def test_unicode_in_task(self, commander):
        """Test handling unicode characters in task"""
        unicode_task = "Write about the hero's journey to 北京 and 東京"
        level = commander.route(unicode_task)

        assert level is not None

    def test_mixed_language_task(self, commander):
        """Test handling mixed language task"""
        mixed_task = "Write 一章 about the hero 的冒险"
        level = commander.route(mixed_task)

        assert level is not None

    def test_prompt_with_newlines(self, agent):
        """Test prompt with newline characters"""
        prompt = agent.construct_prompt(
            purpose="Line1\nLine2\nLine3",
            task="Task\nwith\nnewlines",
            mode="analysis",
            context="Context\nhere",
            expected="Expected\noutput",
            rules="Rule1\nRule2"
        )

        # Should preserve newlines
        assert "Line1" in prompt
        assert "Line2" in prompt

    def test_prompt_with_tabs(self, agent):
        """Test prompt with tab characters"""
        prompt = agent.construct_prompt(
            purpose="Purpose\twith\ttabs",
            task="Task\there",
            mode="analysis",
            context="Context",
            expected="Expected",
            rules="Rules"
        )

        assert "\t" in prompt


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
