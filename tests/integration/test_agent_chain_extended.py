# -*- coding: utf-8 -*-
"""
Integration Tests - Extended Agent Chain

Tests agent collaboration patterns:
- Commander -> Architect -> Writer chain
- Writer -> Critic revision loop
- Skill injection during execution
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, List
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from agents.commander import (
    CommanderAgent,
    WorkflowLevel,
    SceneType,
    TaskAssignment,
)
from agents.skill_router import SkillRouter


class MockLLMResponse:
    """Mock LLM response for testing."""

    def __init__(self, content: str):
        self.content = content

    def __str__(self):
        return self.content


class MockLLM:
    """Mock LLM for chain testing."""

    def __init__(self, responses: List[str] = None):
        self.responses = responses or ['{"reasoning": "test", "result": "ok"}']
        self.call_count = 0

    def invoke(self, *args, **kwargs):
        response = self.responses[min(self.call_count, len(self.responses) - 1)]
        self.call_count += 1
        return MockLLMResponse(response)

    def __or__(self, other):
        return MockChain(self, other)


class MockChain:
    """Mock LangChain chain."""

    def __init__(self, llm, parser):
        self.llm = llm
        self.parser = parser

    def invoke(self, *args, **kwargs):
        return self.llm.invoke(*args, **kwargs)


class TestCommanderArchitectWriterChain:
    """Tests for Commander -> Architect -> Writer chain."""

    @pytest.fixture
    def mock_llm(self):
        return MockLLM()

    @pytest.fixture
    def commander(self, mock_llm):
        return CommanderAgent(llm=mock_llm)

    def test_commander_routes_to_l3_for_chapter(self, commander):
        """Test Commander routes chapter writing to L3."""
        level = commander.route("Write chapter 3: The Confrontation")

        assert level == WorkflowLevel.L3_STANDARD

    def test_commander_dispatches_architect_first(self, commander):
        """Test Commander dispatches Architect before Writer in L3."""
        assignments = commander.dispatch_tasks(
            "Write a dialogue scene",
            WorkflowLevel.L3_STANDARD
        )

        agent_types = [a.agent_type for a in assignments]

        assert agent_types[0] == "architect"
        assert "writer" in agent_types
        assert agent_types.index("architect") < agent_types.index("writer")

    def test_writer_depends_on_architect(self, commander):
        """Test Writer task depends on Architect completion."""
        assignments = commander.dispatch_tasks(
            "Write scene",
            WorkflowLevel.L3_STANDARD
        )

        architect_task = next(a for a in assignments if a.agent_type == "architect")
        writer_task = next(a for a in assignments if a.agent_type == "writer")

        assert architect_task.task_id in writer_task.depends_on

    @pytest.mark.asyncio
    async def test_chain_produces_output(self, commander):
        """Test full chain produces CommanderOutput."""
        output = await commander.execute("Write a brief scene")

        assert output is not None
        assert output.workflow_level in list(WorkflowLevel)
        assert len(output.task_assignments) > 0


class TestWriterCriticRevisionLoop:
    """Tests for Writer -> Critic revision loop."""

    @pytest.fixture
    def mock_llm(self):
        return MockLLM()

    @pytest.fixture
    def commander(self, mock_llm):
        return CommanderAgent(llm=mock_llm)

    def test_critic_follows_writer(self, commander):
        """Test Critic task follows Writer in L3 workflow."""
        assignments = commander.dispatch_tasks(
            "Write dialogue",
            WorkflowLevel.L3_STANDARD
        )

        agent_types = [a.agent_type for a in assignments]

        assert "writer" in agent_types
        assert "critic" in agent_types
        assert agent_types.index("writer") < agent_types.index("critic")

    def test_critic_depends_on_writer(self, commander):
        """Test Critic depends on Writer output."""
        assignments = commander.dispatch_tasks(
            "Write scene",
            WorkflowLevel.L3_STANDARD
        )

        writer_task = next(a for a in assignments if a.agent_type == "writer")
        critic_task = next(a for a in assignments if a.agent_type == "critic")

        assert writer_task.task_id in critic_task.depends_on

    def test_revision_metadata_in_critic_task(self, commander):
        """Test Critic task includes revision context."""
        assignments = commander.dispatch_tasks(
            "Write and review scene",
            WorkflowLevel.L3_STANDARD
        )

        critic_task = next(a for a in assignments if a.agent_type == "critic")

        # Critic should have evaluation context
        assert critic_task.context is not None


class TestSkillInjectionDuringExecution:
    """Tests for skill injection during workflow execution."""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=MockLLM())

    @pytest.fixture
    def skill_router(self):
        return SkillRouter()

    def test_dialogue_scene_injects_dialogue_skills(self, commander):
        """Test dialogue scene gets dialogue-related skills."""
        scene_type = commander.detect_scene_type("Write a conversation between A and B")
        skills = commander.dispatch_skills(scene_type)

        assert "dialogue-system" in skills

    def test_action_scene_injects_action_skills(self, commander):
        """Test action scene gets action-related skills."""
        # Use 'fight' keyword which is recognized by the scene type detector
        scene_type = commander.detect_scene_type("Write an intense fight scene")
        skills = commander.dispatch_skills(scene_type)

        assert "action-craft" in skills, f"Expected 'action-craft' in skills, got: {skills}"

    def test_climax_scene_injects_tension_skills(self, commander):
        """Test climax scene gets tension-related skills."""
        scene_type = commander.detect_scene_type("Write the story climax")
        skills = commander.dispatch_skills(scene_type)

        assert "conflict-escalation" in skills
        assert "tension-arc" in skills

    def test_skills_included_in_task_assignment(self, commander):
        """Test skills are included in task assignments."""
        assignments = commander.dispatch_tasks(
            "Write a dialogue scene",
            WorkflowLevel.L3_STANDARD
        )

        writer_task = next(a for a in assignments if a.agent_type == "writer")

        assert len(writer_task.skills) > 0

    def test_skill_router_lists_available_skills(self, skill_router):
        """Test SkillRouter lists available skills."""
        skills = skill_router.list_all_skills()

        # SkillRouter returns dict with skill details, not a flat list
        assert isinstance(skills, (list, dict))
        assert len(skills) > 0


class TestAgentChainErrorHandling:
    """Tests for error handling in agent chains."""

    @pytest.fixture
    def commander(self):
        return CommanderAgent(llm=MockLLM())

    def test_empty_task_handled(self, commander):
        """Test empty task is handled gracefully."""
        level = commander.route("")

        # Should default to some level
        assert level in list(WorkflowLevel)

    def test_unknown_scene_type_defaults(self, commander):
        """Test unknown scene type defaults to DIALOGUE."""
        scene_type = commander.detect_scene_type("Some random text")

        assert scene_type == SceneType.DIALOGUE

    def test_l1_single_task(self, commander):
        """Test L1 workflow has single task."""
        assignments = commander.dispatch_tasks(
            "Fix typo",
            WorkflowLevel.L1_RAPID
        )

        assert len(assignments) == 1
        assert assignments[0].agent_type == "writer"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
