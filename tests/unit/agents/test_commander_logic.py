"""
Commander Agent Logic Tests

Tests for CommanderAgent: data models, detect_scene_type(),
dispatch_skills(), dispatch_tasks() for all L1-L5 levels,
integrate_results(), and route() fallback heuristics.
"""

import json
import pytest
from unittest.mock import MagicMock
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda
from src.agents.commander import (
    CommanderAgent,
    TaskAnalysis,
    SceneType,
    TaskAssignment,
    TaskDecomposition,
    CommanderOutput,
)
from src.workflow.levels.types import WorkflowLevel


# ============================================================
# Helper
# ============================================================

def _make_commander():
    """Create a CommanderAgent with a mock LLM."""
    mock_llm = MagicMock()
    return CommanderAgent(llm=mock_llm)


# ============================================================
# Data Model Tests
# ============================================================

class TestDataModels:

    def test_scene_type_values(self):
        assert SceneType.OPENING.value == "opening"
        assert SceneType.DIALOGUE.value == "dialogue"
        assert SceneType.ACTION.value == "action"
        assert SceneType.CLIMAX.value == "climax"
        assert SceneType.ENDING.value == "ending"
        assert SceneType.TRANSITION.value == "transition"
        assert SceneType.WORLDBUILDING.value == "worldbuilding"
        assert SceneType.CHARACTER_FOCUS.value == "character_focus"
        assert SceneType.SUSPENSE.value == "suspense"

    def test_task_analysis(self):
        ta = TaskAnalysis(
            reasoning="Simple fix",
            workflow_level=WorkflowLevel.L1_RAPID,
        )
        assert ta.reasoning == "Simple fix"
        assert ta.workflow_level == WorkflowLevel.L1_RAPID

    def test_task_assignment(self):
        ta = TaskAssignment(
            task_id="task-001",
            agent_type="writer",
            scene_type=SceneType.DIALOGUE,
            instruction="Write dialogue",
            skills=["dialogue-system"],
            context={"level": "L2"},
            depends_on=[],
        )
        assert ta.task_id == "task-001"
        assert ta.agent_type == "writer"
        assert ta.scene_type == SceneType.DIALOGUE
        assert "dialogue-system" in ta.skills

    def test_task_assignment_defaults(self):
        ta = TaskAssignment(
            task_id="t1",
            agent_type="writer",
            scene_type=SceneType.DIALOGUE,
            instruction="test",
        )
        assert ta.skills == []
        assert ta.context == {}
        assert ta.depends_on == []

    def test_task_decomposition(self):
        td = TaskDecomposition(
            scene_type="dialogue",
            subtasks=["write opening", "write response"],
            agent_sequence=["writer", "critic"],
        )
        assert td.scene_type == "dialogue"
        assert len(td.subtasks) == 2

    def test_commander_output(self):
        co = CommanderOutput(
            workflow_level=WorkflowLevel.L3_STANDARD,
            task_assignments=[],
            total_steps=0,
        )
        assert co.workflow_level == WorkflowLevel.L3_STANDARD
        assert co.estimated_tokens == 0


# ============================================================
# detect_scene_type Tests
# ============================================================

class TestDetectSceneType:

    def test_opening_chinese(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("写一个开头") == SceneType.OPENING

    def test_opening_english(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("Write an opening scene") == SceneType.OPENING

    def test_dialogue(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("写一段对话") == SceneType.DIALOGUE

    def test_action(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("写一段战斗场景") == SceneType.ACTION

    def test_action_english(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("Write a fight scene") == SceneType.ACTION

    def test_climax(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("写高潮部分") == SceneType.CLIMAX

    def test_ending(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("写结尾") == SceneType.ENDING

    def test_transition(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("写一段过渡") == SceneType.TRANSITION

    def test_worldbuilding(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("描写世界观设定") == SceneType.WORLDBUILDING

    def test_character_focus(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("深入角色内心") == SceneType.CHARACTER_FOCUS

    def test_suspense(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("制造悬念") == SceneType.SUSPENSE

    def test_default_dialogue(self):
        cmd = _make_commander()
        # No matching keywords -> default to DIALOGUE
        assert cmd.detect_scene_type("write something") == SceneType.DIALOGUE

    def test_prologue(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("prologue section") == SceneType.OPENING

    def test_mystery(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("add mystery elements") == SceneType.SUSPENSE

    def test_chase(self):
        cmd = _make_commander()
        assert cmd.detect_scene_type("write a chase scene") == SceneType.ACTION


# ============================================================
# dispatch_skills Tests
# ============================================================

class TestDispatchSkills:

    def test_opening_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.OPENING)
        assert "opening-craft" in skills
        assert "tension-scene" in skills
        assert "character-forge" in skills

    def test_dialogue_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.DIALOGUE)
        assert "dialogue-system" in skills
        assert "show-dont-tell" in skills

    def test_action_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.ACTION)
        assert "action-craft" in skills

    def test_climax_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.CLIMAX)
        assert "conflict-escalation" in skills

    def test_ending_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.ENDING)
        assert "ending-craft" in skills

    def test_transition_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.TRANSITION)
        assert "transition-craft" in skills

    def test_worldbuilding_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.WORLDBUILDING)
        assert "worldview-craft" in skills

    def test_character_focus_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.CHARACTER_FOCUS)
        assert "character-forge" in skills
        assert "four-selves" in skills

    def test_suspense_skills(self):
        cmd = _make_commander()
        skills = cmd.dispatch_skills(SceneType.SUSPENSE)
        assert "suspense-craft" in skills
        assert "misdirection-twist" in skills

    def test_all_scene_types_have_skills(self):
        cmd = _make_commander()
        for scene_type in SceneType:
            skills = cmd.dispatch_skills(scene_type)
            assert len(skills) >= 2, f"{scene_type} has fewer than 2 skills"


# ============================================================
# dispatch_tasks Tests
# ============================================================

class TestDispatchTasks:

    def test_l1_rapid_single_writer(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("fix typo", WorkflowLevel.L1_RAPID)
        assert len(tasks) == 1
        assert tasks[0].agent_type == "writer"
        assert tasks[0].context["level"] == "L1"
        assert len(tasks[0].skills) <= 2
        assert tasks[0].depends_on == []

    def test_l2_lite_single_writer(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("write a short paragraph", WorkflowLevel.L2_LITE)
        assert len(tasks) == 1
        assert tasks[0].agent_type == "writer"
        assert tasks[0].context["level"] == "L2"
        assert tasks[0].context["target_words"] == 800

    def test_l3_standard_three_agents(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("write a full chapter", WorkflowLevel.L3_STANDARD)
        assert len(tasks) == 3
        agent_types = [t.agent_type for t in tasks]
        assert agent_types == ["architect", "writer", "critic"]
        # Check dependency chain
        assert tasks[0].depends_on == []
        assert tasks[1].depends_on == ["task-001"]
        assert tasks[2].depends_on == ["task-002"]

    def test_l3_standard_context(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("write chapter", WorkflowLevel.L3_STANDARD)
        assert tasks[1].context["target_words"] == 2000
        assert tasks[0].context["level"] == "L3"

    def test_l4_brainstorm_five_agents(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("brainstorm story ideas", WorkflowLevel.L4_BRAINSTORM)
        assert len(tasks) == 5
        agent_types = [t.agent_type for t in tasks]
        assert agent_types == ["worldbuilding", "character", "architect", "writer", "critic"]

    def test_l4_brainstorm_dependencies(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("brainstorm", WorkflowLevel.L4_BRAINSTORM)
        # worldbuilding and character are parallel (no deps)
        assert tasks[0].depends_on == []
        assert tasks[1].depends_on == []
        # architect depends on both
        assert "task-001" in tasks[2].depends_on
        assert "task-002" in tasks[2].depends_on
        # writer depends on architect
        assert tasks[3].depends_on == ["task-003"]
        # critic depends on writer
        assert tasks[4].depends_on == ["task-004"]

    def test_l5_brainstorm_alias(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("brainstorm", WorkflowLevel.L5_BRAINSTORM)
        assert len(tasks) == 5  # Same as L4

    def test_l5_coordinator_five_agents(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("write full novel", WorkflowLevel.L5_COORDINATOR)
        assert len(tasks) == 5
        agent_types = [t.agent_type for t in tasks]
        assert agent_types == ["worldbuilding", "character", "architect", "writer", "critic"]

    def test_l5_coordinator_context(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("full novel", WorkflowLevel.L5_COORDINATOR)
        assert tasks[3].context["target_words"] == 3000
        assert tasks[0].context["level"] == "L5"

    def test_l5_coordinator_dependencies(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("full novel", WorkflowLevel.L5_COORDINATOR)
        assert tasks[0].depends_on == []
        assert tasks[1].depends_on == []
        assert set(tasks[2].depends_on) == {"task-001", "task-002"}
        assert tasks[3].depends_on == ["task-003"]
        assert tasks[4].depends_on == ["task-004"]

    def test_l5_coordinator_critic_has_extra_skill(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("full novel", WorkflowLevel.L5_COORDINATOR)
        critic = tasks[4]
        assert "deus-ex-machina" in critic.skills

    def test_task_ids_are_sequential(self):
        cmd = _make_commander()
        tasks = cmd.dispatch_tasks("write chapter", WorkflowLevel.L3_STANDARD)
        ids = [t.task_id for t in tasks]
        assert ids == ["task-001", "task-002", "task-003"]


# ============================================================
# integrate_results Tests
# ============================================================

class TestIntegrateResults:

    def test_empty_results(self):
        cmd = _make_commander()
        result = cmd.integrate_results([])
        assert result["status"] == "completed"
        assert result["content"] == ""
        assert result["metadata"]["agents_invoked"] == []
        assert result["metadata"]["total_tokens"] == 0

    def test_writer_content_captured(self):
        cmd = _make_commander()
        results = [
            {"agent_type": "writer", "content": "Story text here", "tokens_used": 500},
        ]
        result = cmd.integrate_results(results)
        assert result["content"] == "Story text here"
        assert result["metadata"]["total_tokens"] == 500

    def test_critic_score_captured(self):
        cmd = _make_commander()
        results = [
            {"agent_type": "critic", "score": 85, "decision": "APPROVED", "tokens_used": 200},
        ]
        result = cmd.integrate_results(results)
        assert result["metadata"]["quality_score"] == 85
        assert result["metadata"]["decision"] == "APPROVED"

    def test_multiple_agents(self):
        cmd = _make_commander()
        results = [
            {"agent_type": "architect", "tokens_used": 300},
            {"agent_type": "writer", "content": "Chapter content", "tokens_used": 1000},
            {"agent_type": "critic", "score": 90, "decision": "APPROVED", "tokens_used": 200},
        ]
        result = cmd.integrate_results(results)
        assert result["content"] == "Chapter content"
        assert result["metadata"]["quality_score"] == 90
        assert result["metadata"]["total_tokens"] == 1500
        assert len(result["metadata"]["agents_invoked"]) == 3

    def test_unknown_agent_type(self):
        cmd = _make_commander()
        results = [
            {"agent_type": "unknown", "tokens_used": 100},
        ]
        result = cmd.integrate_results(results)
        assert "unknown" in result["metadata"]["agents_invoked"]
        assert result["content"] == ""

    def test_missing_tokens_defaults_to_zero(self):
        cmd = _make_commander()
        results = [
            {"agent_type": "writer", "content": "text"},
        ]
        result = cmd.integrate_results(results)
        assert result["metadata"]["total_tokens"] == 0


# ============================================================
# route() fallback heuristics Tests
# ============================================================

class TestRouteFallback:

    def _make_failing_commander(self):
        """Create commander whose LLM always fails, triggering heuristics."""
        mock_llm = MagicMock()
        # Make the pipe operator raise to trigger fallback
        mock_llm.__or__ = MagicMock(side_effect=RuntimeError("LLM unavailable"))
        cmd = CommanderAgent(llm=mock_llm)
        return cmd

    def test_typo_routes_to_l1(self):
        cmd = self._make_failing_commander()
        assert cmd.route("fix typo in chapter 3") == WorkflowLevel.L1_RAPID

    def test_fix_routes_to_l1(self):
        cmd = self._make_failing_commander()
        assert cmd.route("fix grammar issues") == WorkflowLevel.L1_RAPID

    def test_polish_routes_to_l1(self):
        cmd = self._make_failing_commander()
        assert cmd.route("polish this paragraph") == WorkflowLevel.L1_RAPID

    def test_chinese_fix_routes_to_l1(self):
        cmd = self._make_failing_commander()
        assert cmd.route("修复错别字") == WorkflowLevel.L1_RAPID

    def test_paragraph_routes_to_l2(self):
        cmd = self._make_failing_commander()
        assert cmd.route("write a short paragraph") == WorkflowLevel.L2_LITE

    def test_snippet_routes_to_l2(self):
        cmd = self._make_failing_commander()
        assert cmd.route("write a snippet") == WorkflowLevel.L2_LITE

    def test_chinese_paragraph_routes_to_l2(self):
        cmd = self._make_failing_commander()
        assert cmd.route("写一个段落") == WorkflowLevel.L2_LITE

    def test_brainstorm_routes_to_l5_brainstorm(self):
        cmd = self._make_failing_commander()
        assert cmd.route("brainstorm character ideas") == WorkflowLevel.L5_BRAINSTORM

    def test_chinese_brainstorm_routes_to_l5(self):
        cmd = self._make_failing_commander()
        assert cmd.route("头脑风暴一下") == WorkflowLevel.L5_BRAINSTORM

    def test_outline_routes_to_l5_brainstorm(self):
        cmd = self._make_failing_commander()
        assert cmd.route("create a story outline") == WorkflowLevel.L5_BRAINSTORM

    def test_chinese_worldview_routes_to_l5(self):
        cmd = self._make_failing_commander()
        assert cmd.route("设计世界观") == WorkflowLevel.L5_BRAINSTORM

    def test_project_routes_to_l5_coordinator(self):
        cmd = self._make_failing_commander()
        assert cmd.route("manage the full project") == WorkflowLevel.L5_COORDINATOR

    def test_novel_routes_to_l5_coordinator(self):
        cmd = self._make_failing_commander()
        assert cmd.route("write the full novel") == WorkflowLevel.L5_COORDINATOR

    def test_default_routes_to_l3(self):
        cmd = self._make_failing_commander()
        assert cmd.route("do something unspecified") == WorkflowLevel.L3_STANDARD

    def test_keyword_priority_fix_over_brainstorm(self):
        """fix keyword should match L1 before brainstorm keywords."""
        cmd = self._make_failing_commander()
        # "fix" is checked before "character"
        assert cmd.route("fix character description") == WorkflowLevel.L1_RAPID


class TestRouteLlmPaths:

    def test_route_without_llm_uses_heuristics(self):
        cmd = CommanderAgent(llm=None)
        assert cmd.route("write full novel project") == WorkflowLevel.L5_COORDINATOR

    def test_route_with_runnable_lambda_llm(self):
        payload = {"workflow_level": 3, "reasoning": "llm chose standard"}

        def llm_ok(_):
            return AIMessage(content=json.dumps(payload))

        cmd = CommanderAgent(llm=RunnableLambda(llm_ok))

        def should_not_fallback(_):
            raise AssertionError("fallback should not be used")

        cmd._route_by_heuristics = should_not_fallback
        assert cmd.route("compose chapter") == WorkflowLevel.L3_STANDARD


# ============================================================
# CommanderAgent.run() Tests
# ============================================================

class TestRun:

    def test_extract_task_description_from_dict_keys(self):
        cmd = _make_commander()
        assert cmd._extract_task_description({"user_request": "  hello  "}) == "hello"
        assert cmd._extract_task_description({"user_idea": " idea "}) == "idea"
        assert cmd._extract_task_description({"task": " task text "}) == "task text"

    def test_run_requires_task_description(self):
        cmd = _make_commander()
        with pytest.raises(ValueError, match="task_description is required"):
            cmd.run("   ")

    def test_run_requires_valid_input_type(self):
        cmd = _make_commander()
        with pytest.raises(TypeError, match="input_data must be str or dict"):
            cmd.run(123)

    def test_run_executes_and_returns_output(self):
        cmd = _make_commander()
        out = cmd.run("Write a short paragraph")
        assert isinstance(out, CommanderOutput)
        assert out.total_steps > 0


# ============================================================
# SCENE_SKILL_MAP completeness Tests
# ============================================================

class TestSceneSkillMap:

    def test_all_scene_types_mapped(self):
        for scene_type in SceneType:
            assert scene_type in CommanderAgent.SCENE_SKILL_MAP, \
                f"{scene_type} not in SCENE_SKILL_MAP"

    def test_all_skills_are_strings(self):
        for scene_type, skills in CommanderAgent.SCENE_SKILL_MAP.items():
            for skill in skills:
                assert isinstance(skill, str), \
                    f"Non-string skill in {scene_type}: {skill}"
