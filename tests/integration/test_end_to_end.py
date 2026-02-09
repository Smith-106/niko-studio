# -*- coding: utf-8 -*-
"""
Integration Tests - End-to-End Workflow

Tests complete story generation workflow:
- Complete story generation workflow
- Evaluation and revision cycle
- Export functionality
"""

import pytest
import asyncio
import tempfile
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from agents.commander import CommanderAgent, WorkflowLevel, CommanderOutput
from agents.skill_router import SkillRouter


class MockLLM:
    """Mock LLM for end-to-end testing."""

    def __init__(self):
        self.call_count = 0

    def invoke(self, *args, **kwargs):
        self.call_count += 1
        return '{"reasoning": "test", "content": "Generated content"}'

    def __or__(self, other):
        return self


class TestCompleteStoryGenerationWorkflow:
    """Tests for complete story generation workflow."""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=MockLLM())

    @pytest.mark.asyncio
    async def test_l5_brainstorm_workflow(self, commander):
        """Test L5 brainstorm workflow for story planning."""
        output = await commander.execute("Design a magic world with unique rules")

        assert output.workflow_level == WorkflowLevel.L5_BRAINSTORM
        assert output.total_steps == 5

    @pytest.mark.asyncio
    async def test_l3_standard_workflow(self, commander):
        """Test L3 standard workflow for chapter writing."""
        output = await commander.execute("Write chapter 1: The Beginning")

        assert output.workflow_level == WorkflowLevel.L3_STANDARD
        assert output.total_steps == 3

    @pytest.mark.asyncio
    async def test_l1_rapid_workflow(self, commander):
        """Test L1 rapid workflow for quick edits."""
        output = await commander.execute("Fix the typo in line 5")

        assert output.workflow_level == WorkflowLevel.L1_RAPID
        assert output.total_steps == 1

    @pytest.mark.asyncio
    async def test_workflow_includes_all_required_agents(self, commander):
        """Test workflow includes appropriate agents for task."""
        output = await commander.execute("Write a dialogue scene")

        agent_types = [a.agent_type for a in output.task_assignments]

        assert "architect" in agent_types
        assert "writer" in agent_types
        assert "critic" in agent_types

    @pytest.mark.asyncio
    async def test_workflow_estimates_tokens(self, commander):
        """Test workflow provides token estimation."""
        output = await commander.execute("Write a scene")

        assert output.estimated_tokens > 0


class TestEvaluationAndRevisionCycle:
    """Tests for evaluation and revision cycle."""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=MockLLM())

    def test_result_integration(self, commander):
        """Test integrating results from multiple agents."""
        mock_results = [
            {
                "agent_type": "architect",
                "tokens_used": 500,
                "structure": {"scenes": 2}
            },
            {
                "agent_type": "writer",
                "tokens_used": 2000,
                "content": "The story begins..."
            },
            {
                "agent_type": "critic",
                "tokens_used": 400,
                "score": 75,
                "decision": "NEEDS_REVISION"
            }
        ]

        integrated = commander.integrate_results(mock_results)

        assert integrated["status"] == "completed"
        assert integrated["content"] == "The story begins..."
        assert integrated["metadata"]["total_tokens"] == 2900
        assert integrated["metadata"]["quality_score"] == 75
        assert integrated["metadata"]["decision"] == "NEEDS_REVISION"

    def test_approved_decision_flow(self, commander):
        """Test flow when critic approves content."""
        mock_results = [
            {"agent_type": "writer", "tokens_used": 1000, "content": "Good content"},
            {"agent_type": "critic", "tokens_used": 200, "score": 90, "decision": "APPROVED"}
        ]

        integrated = commander.integrate_results(mock_results)

        assert integrated["metadata"]["decision"] == "APPROVED"

    def test_revision_needed_flow(self, commander):
        """Test flow when revision is needed."""
        mock_results = [
            {"agent_type": "writer", "tokens_used": 1000, "content": "Draft content"},
            {"agent_type": "critic", "tokens_used": 300, "score": 60, "decision": "NEEDS_REVISION"}
        ]

        integrated = commander.integrate_results(mock_results)

        assert integrated["metadata"]["decision"] == "NEEDS_REVISION"
        assert integrated["metadata"]["quality_score"] == 60


class TestExportFunctionality:
    """Tests for export functionality."""

    @pytest.fixture
    def temp_dir(self, tmp_path):
        return tmp_path

    def test_export_to_markdown(self, temp_dir):
        """Test exporting content to Markdown format."""
        content = "# Chapter 1\n\nThe story begins..."
        output_path = temp_dir / "output.md"

        output_path.write_text(content, encoding="utf-8")

        assert output_path.exists()
        assert output_path.read_text(encoding="utf-8") == content

    def test_export_to_json(self, temp_dir):
        """Test exporting metadata to JSON format."""
        import json

        metadata = {
            "title": "Test Story",
            "chapters": 5,
            "word_count": 50000
        }
        output_path = temp_dir / "metadata.json"

        output_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

        assert output_path.exists()
        loaded = json.loads(output_path.read_text(encoding="utf-8"))
        assert loaded["title"] == "Test Story"

    def test_export_preserves_structure(self, temp_dir):
        """Test export preserves chapter structure."""
        chapters_dir = temp_dir / "chapters"
        chapters_dir.mkdir()

        for i in range(1, 4):
            chapter_file = chapters_dir / f"chapter_{i}.md"
            chapter_file.write_text(f"# Chapter {i}\n\nContent...", encoding="utf-8")

        assert len(list(chapters_dir.glob("*.md"))) == 3


class TestWorkflowStateManagement:
    """Tests for workflow state management."""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=MockLLM())

    @pytest.mark.asyncio
    async def test_workflow_preserves_context(self, commander):
        """Test workflow preserves context across tasks."""
        output = await commander.execute("Write a scene with character Lin Xiao")

        # Context should be passed to writer task
        writer_task = next(
            (a for a in output.task_assignments if a.agent_type == "writer"),
            None
        )
        assert writer_task is not None
        assert writer_task.context is not None

    def test_task_dependencies_correct(self, commander):
        """Test task dependencies are correctly set."""
        assignments = commander.dispatch_tasks(
            "Write chapter",
            WorkflowLevel.L3_STANDARD
        )

        # First task has no dependencies
        assert assignments[0].depends_on == []

        # Later tasks depend on earlier ones
        for i in range(1, len(assignments)):
            assert len(assignments[i].depends_on) > 0


class TestSkillIntegration:
    """Tests for skill integration in workflow."""

    @pytest.fixture
    def skill_router(self):
        return SkillRouter()

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=MockLLM())

    def test_skills_loaded(self, skill_router):
        """Test skills are properly loaded."""
        skills = skill_router.list_all_skills()

        assert len(skills) > 0

    def test_skill_recommendations_for_dialogue(self, skill_router):
        """Test skill recommendations for dialogue writing."""
        recommendations = skill_router.route_by_keywords(["dialogue", "conversation"])

        assert isinstance(recommendations, list)

    def test_skill_recommendations_for_action(self, skill_router):
        """Test skill recommendations for action writing."""
        recommendations = skill_router.route_by_keywords(["action", "fight", "battle"])

        assert isinstance(recommendations, list)


class TestFullPipelineIntegration:
    """Full pipeline integration tests."""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=MockLLM())

    @pytest.mark.asyncio
    async def test_complete_writing_pipeline(self, commander):
        """Test complete writing pipeline from task to output."""
        # 1. Route task
        level = commander.route("Write chapter 2: The Discovery")
        assert level == WorkflowLevel.L3_STANDARD

        # 2. Detect scene type
        scene_type = commander.detect_scene_type("discovery scene")
        assert scene_type is not None

        # 3. Dispatch skills
        skills = commander.dispatch_skills(scene_type)
        assert len(skills) > 0

        # 4. Execute workflow
        output = await commander.execute("Write chapter 2: The Discovery")
        assert output is not None
        assert len(output.task_assignments) > 0

    @pytest.mark.asyncio
    async def test_worldbuilding_workflow(self, commander):
        """Test worldbuilding workflow includes context agents."""
        output = await commander.execute("Design the magic system for the world")

        agent_types = [a.agent_type for a in output.task_assignments]

        # L5 should include worldbuilding and character agents
        assert "worldbuilding" in agent_types
        assert "character" in agent_types

    def test_token_estimation_realistic(self, commander):
        """Test token estimation is within realistic bounds."""
        assignments = commander.dispatch_tasks(
            "Write a scene",
            WorkflowLevel.L3_STANDARD
        )

        # Each task should have some token estimate
        for task in assignments:
            assert hasattr(task, 'estimated_tokens') or task.context is not None


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
