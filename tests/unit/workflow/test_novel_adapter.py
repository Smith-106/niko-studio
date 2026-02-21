# -*- coding: utf-8 -*-
"""
NovelAdapter Tests

Tests for NovelAdapter: init, domain type, state class, create_initial_state,
evaluate, route functions, node functions (mocked), create_graph.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from src.workflow.adapters.novel_adapter import NovelAdapter
from src.workflow.adapters.base_adapter import (
    BaseDomainAdapter,
    DomainType,
    BaseEvaluationResult,
    AdapterRegistry,
)


# ============================================================
# NovelAdapter basics
# ============================================================

class TestNovelAdapterBasics:

    def test_domain_type(self):
        adapter = NovelAdapter()
        assert adapter.get_domain_type() == "novel"
        assert adapter.domain == "novel"

    def test_is_base_domain_adapter(self):
        adapter = NovelAdapter()
        assert isinstance(adapter, BaseDomainAdapter)

    def test_state_class(self):
        adapter = NovelAdapter()
        cls = adapter.get_state_class()
        assert cls is not None

    def test_registered_in_registry(self):
        adapter_cls = AdapterRegistry.get("novel")
        assert adapter_cls is NovelAdapter


# ============================================================
# create_initial_state
# ============================================================

class TestCreateInitialState:

    def test_basic(self):
        adapter = NovelAdapter()
        state = adapter.create_initial_state("写一个悬疑故事")
        assert state is not None
        assert state.get("user_idea") == "写一个悬疑故事"

    def test_default_genre(self):
        adapter = NovelAdapter()
        state = adapter.create_initial_state("idea")
        assert state.get("genre") == "悬疑"

    def test_custom_genre(self):
        adapter = NovelAdapter()
        state = adapter.create_initial_state("idea", genre="科幻")
        assert state.get("genre") == "科幻"

    def test_target_chapters(self):
        adapter = NovelAdapter()
        state = adapter.create_initial_state("idea", target_chapters=10)
        assert state.get("target_chapters") == 10

    def test_target_wordcount(self):
        adapter = NovelAdapter()
        state = adapter.create_initial_state("idea", target_wordcount=100000)
        assert state.get("target_wordcount") == 100000

    def test_with_metadata(self):
        adapter = NovelAdapter()
        state = adapter.create_initial_state("idea", metadata={"key": "val"})
        meta = state.get("metadata", {})
        assert meta.get("key") == "val"

    def test_with_resume_decision(self):
        adapter = NovelAdapter()
        state = adapter.create_initial_state(
            "idea",
            resume_decision={"action": "continue"}
        )
        meta = state.get("metadata", {})
        assert "resume_decision" in meta


# ============================================================
# evaluate
# ============================================================

class TestEvaluate:

    def test_evaluate_approved(self):
        adapter = NovelAdapter()
        state = {
            "critique_result": {
                "decision": "APPROVED",
                "decision_reason": "Good",
                "total_score": 90,
                "lock_analysis": {"scores": {"L": 9, "O": 8}},
                "actionable_feedback": "None",
                "revision_instructions": [],
            }
        }
        result = adapter.evaluate(state)
        assert isinstance(result, BaseEvaluationResult)
        assert result.decision == "APPROVED"
        assert result.total_score == 90

    def test_evaluate_empty_critique(self):
        adapter = NovelAdapter()
        state = {}
        result = adapter.evaluate(state)
        assert result.decision == "REVISE"
        assert result.total_score == 0

    def test_evaluate_dimension_scores(self):
        adapter = NovelAdapter()
        state = {
            "critique_result": {
                "decision": "REVISE",
                "decision_reason": "",
                "total_score": 60,
                "lock_analysis": {"scores": {"L": 7, "O": 6, "C": 5, "K": 4}},
                "actionable_feedback": "Fix plot",
                "revision_instructions": [{"target": "writer"}],
            }
        }
        result = adapter.evaluate(state)
        assert result.dimension_scores["L"] == 7
        assert result.feedback == "Fix plot"


# ============================================================
# route_after_commander
# ============================================================

class TestRouteAfterCommander:

    def test_rapid_mode(self):
        adapter = NovelAdapter()
        state = {"workflow_level": "rapid"}
        assert adapter.route_after_commander(state) == "writer"

    def test_standard_mode(self):
        adapter = NovelAdapter()
        state = {"workflow_level": "standard"}
        assert adapter.route_after_commander(state) == "architect"

    def test_default_mode(self):
        adapter = NovelAdapter()
        state = {}
        assert adapter.route_after_commander(state) == "architect"


# ============================================================
# route_after_writer
# ============================================================

class TestRouteAfterWriter:

    def test_distillation_enabled(self):
        adapter = NovelAdapter()
        state = {"draft_content": "some draft"}
        assert adapter.route_after_writer(state) == "distillation"

    def test_skip_when_already_distilled(self):
        adapter = NovelAdapter()
        state = {"draft_content": "draft", "distillation_result": {}}
        assert adapter.route_after_writer(state) == "critic"

    def test_skip_when_no_draft(self):
        adapter = NovelAdapter()
        state = {}
        assert adapter.route_after_writer(state) == "critic"

    def test_skip_when_disabled(self):
        adapter = NovelAdapter(config={"enable_distillation": False})
        state = {"draft_content": "draft"}
        assert adapter.route_after_writer(state) == "critic"


# ============================================================
# route_after_critic
# ============================================================

class TestRouteAfterCritic:

    def test_approved(self):
        adapter = NovelAdapter(config={
            "pass_score": 80, "min_c_score": 7,
            "max_revisions": 3, "human_review_score": 70
        })
        state = {
            "critique_result": {
                "decision": "APPROVED",
                "total_score": 90,
                "lock_analysis": {"C": {"score": 8}}
            },
            "revision_count": 0
        }
        assert adapter.route_after_critic(state) == "finalize"

    def test_high_score_pass(self):
        adapter = NovelAdapter(config={
            "pass_score": 80, "min_c_score": 7,
            "max_revisions": 3, "human_review_score": 70
        })
        state = {
            "critique_result": {
                "decision": "REVISE",
                "total_score": 85,
                "lock_analysis": {"C": {"score": 8}}
            },
            "revision_count": 0
        }
        assert adapter.route_after_critic(state) == "finalize"

    def test_max_revisions(self):
        adapter = NovelAdapter(config={
            "pass_score": 80, "min_c_score": 7,
            "max_revisions": 3, "human_review_score": 70
        })
        state = {
            "critique_result": {"decision": "REVISE", "total_score": 50, "lock_analysis": {}},
            "revision_count": 3
        }
        assert adapter.route_after_critic(state) == "human_reviewer"

    def test_rewrite_decision(self):
        adapter = NovelAdapter(config={
            "pass_score": 80, "min_c_score": 7,
            "max_revisions": 3, "human_review_score": 70
        })
        state = {
            "critique_result": {"decision": "REWRITE", "total_score": 30, "lock_analysis": {}},
            "revision_count": 0
        }
        assert adapter.route_after_critic(state) == "human_reviewer"

    def test_revise_low_score(self):
        adapter = NovelAdapter(config={
            "pass_score": 80, "min_c_score": 7,
            "max_revisions": 3, "human_review_score": 70
        })
        state = {
            "critique_result": {"decision": "REVISE", "total_score": 50, "lock_analysis": {}},
            "revision_count": 1
        }
        assert adapter.route_after_critic(state) == "writer"

    def test_human_review_decision(self):
        adapter = NovelAdapter(config={
            "pass_score": 80, "min_c_score": 7,
            "max_revisions": 3, "human_review_score": 70
        })
        state = {
            "critique_result": {"decision": "HUMAN_REVIEW", "total_score": 72, "lock_analysis": {}},
            "revision_count": 1
        }
        assert adapter.route_after_critic(state) == "human_reviewer"


# ============================================================
# human_review_node
# ============================================================

class TestHumanReviewNode:

    def test_basic(self):
        adapter = NovelAdapter()
        state = {
            "critique_result": {"total_score": 75, "decision": "HUMAN_REVIEW", "decision_reason": "边界"},
            "draft_content": "draft text",
            "revision_count": 2
        }
        result = adapter.human_review_node(state)
        assert result["requires_human_intervention"] is True
        assert result["human_review_status"] == "review_required"
        assert result["human_review_notes"] == "边界"
        assert result["final_content"] == "draft text"
        assert result["final_score"] == 75


# ============================================================
# finalize_node
# ============================================================

class TestFinalizeNode:

    def test_basic(self):
        adapter = NovelAdapter()
        state = {
            "draft_content": "final text",
            "critique_result": {"total_score": 92}
        }
        result = adapter.finalize_node(state)
        assert result["final_content"] == "final text"
        assert result["final_score"] == 92

    def test_empty_state(self):
        adapter = NovelAdapter()
        result = adapter.finalize_node({})
        assert result["final_content"] == ""
        assert result["final_score"] == 0


# ============================================================
# _get_llm
# ============================================================

class TestGetLlm:

    @patch("src.workflow.adapters.novel_adapter.get_config")
    def test_no_keys_raises(self, mock_config):
        mock_cfg = MagicMock()
        mock_cfg.agent.google_api_key = None
        mock_cfg.agent.openai_api_key = None
        mock_config.return_value = mock_cfg
        adapter = NovelAdapter()
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(RuntimeError, match="无法初始化 LLM"):
                adapter._get_llm()

    @patch("src.workflow.adapters.novel_adapter.get_config")
    def test_google_key(self, mock_config):
        mock_cfg = MagicMock()
        mock_cfg.agent.google_api_key = "test-key"
        mock_cfg.agent.openai_api_key = None
        mock_config.return_value = mock_cfg
        adapter = NovelAdapter()

        mock_llm = MagicMock()
        with patch("langchain_google_genai.ChatGoogleGenerativeAI", return_value=mock_llm):
            result = adapter._get_llm()
            assert result is mock_llm

    @patch("src.workflow.adapters.novel_adapter.get_config")
    def test_openai_key_fallback(self, mock_config):
        mock_cfg = MagicMock()
        mock_cfg.agent.google_api_key = None
        mock_cfg.agent.openai_api_key = "openai-key"
        mock_config.return_value = mock_cfg
        adapter = NovelAdapter()

        with patch.dict("os.environ", {}, clear=True):
            mock_llm = MagicMock()
            with patch("langchain_openai.ChatOpenAI", return_value=mock_llm):
                result = adapter._get_llm()
                assert result is mock_llm


# ============================================================
# async node functions (mocked LLM)
# Note: _get_llm() is called OUTSIDE the try block in all nodes,
# so we must let it succeed and mock the agent methods inside try.
# ============================================================

class TestCommanderNode:

    @pytest.mark.asyncio
    async def test_commander_error(self):
        adapter = NovelAdapter()
        mock_llm = MagicMock()
        mock_agent = MagicMock()
        mock_agent.route.side_effect = RuntimeError("route fail")

        with patch.object(adapter, '_get_llm', return_value=mock_llm), \
             patch("src.agents.commander.CommanderAgent", return_value=mock_agent):
            state = {"user_idea": "test", "errors": []}
            result = await adapter.commander_node(state)
            assert "errors" in result
            assert result["workflow_level"] == "standard"


class TestArchitectNode:

    @pytest.mark.asyncio
    async def test_architect_error(self):
        adapter = NovelAdapter()
        mock_llm = MagicMock()
        mock_agent = MagicMock()
        mock_agent.plan = AsyncMock(side_effect=RuntimeError("plan fail"))

        with patch.object(adapter, '_get_llm', return_value=mock_llm), \
             patch("src.agents.architect.ArchitectAgent", return_value=mock_agent):
            state = {"user_idea": "test", "errors": []}
            result = await adapter.architect_node(state)
            assert "errors" in result
            assert result.get("requires_human_intervention") is True


class TestWriterNode:

    @pytest.mark.asyncio
    async def test_writer_error(self):
        adapter = NovelAdapter()
        mock_llm = MagicMock()
        mock_agent = MagicMock()
        mock_agent.write = AsyncMock(side_effect=RuntimeError("write fail"))

        with patch.object(adapter, '_get_llm', return_value=mock_llm), \
             patch("src.agents.writer.WriterAgent", return_value=mock_agent), \
             patch("src.agents.writer.WriterInput"):
            state = {
                "user_idea": "test",
                "errors": [],
                "revision_count": 0,
                "draft_version": 0,
                "current_scene": {},
            }
            result = await adapter.writer_node(state)
            assert "errors" in result


class TestCriticNode:

    @pytest.mark.asyncio
    async def test_critic_error(self):
        adapter = NovelAdapter()
        mock_llm = MagicMock()
        mock_agent = MagicMock()
        mock_agent.review = AsyncMock(side_effect=RuntimeError("review fail"))

        with patch.object(adapter, '_get_llm', return_value=mock_llm), \
             patch("src.agents.critic.CriticAgent", return_value=mock_agent):
            state = {
                "draft_content": "text",
                "revision_count": 0,
                "current_scene": {},
                "errors": [],
            }
            result = await adapter.critic_node(state)
            assert "errors" in result




class TestGetLlmFallbackExceptions:

    @patch("src.workflow.adapters.novel_adapter.get_config")
    def test_google_import_exception_branch(self, mock_config):
        mock_cfg = MagicMock()
        mock_cfg.agent.google_api_key = "google-key"
        mock_cfg.agent.openai_api_key = None
        mock_config.return_value = mock_cfg

        adapter = NovelAdapter()
        with patch.dict("os.environ", {}, clear=True), \
             patch("langchain_google_genai.ChatGoogleGenerativeAI", side_effect=Exception("google init failed")):
            with pytest.raises(RuntimeError, match="无法初始化 LLM"):
                adapter._get_llm()

    @patch("src.workflow.adapters.novel_adapter.get_config")
    def test_openai_import_exception_branch(self, mock_config):
        mock_cfg = MagicMock()
        mock_cfg.agent.google_api_key = None
        mock_cfg.agent.openai_api_key = "openai-key"
        mock_config.return_value = mock_cfg

        adapter = NovelAdapter()
        with patch.dict("os.environ", {}, clear=True), \
             patch("langchain_openai.ChatOpenAI", side_effect=Exception("openai init failed")):
            with pytest.raises(RuntimeError, match="无法初始化 LLM"):
                adapter._get_llm()


class TestNodeSuccessPaths:

    @pytest.mark.asyncio
    async def test_commander_success(self):
        adapter = NovelAdapter()
        mock_llm = MagicMock()

        level = MagicMock()
        level.value = "standard"
        scene_type = MagicMock()
        scene_type.value = "chapter"

        assignment = MagicMock()
        assignment.context = {
            "scene_detection_confidence": 0.66,
            "fallback_used": False,
            "matched_keywords": {"scene": ["chapter"], "route": []},
        }
        assignment.model_dump.return_value = {"agent": "writer", "task": "draft"}

        mock_agent = MagicMock()
        mock_agent.route.return_value = level
        mock_agent.detect_scene_type.return_value = scene_type
        mock_agent.dispatch_skills.return_value = ["outline", "foreshadow"]
        mock_agent.dispatch_tasks.return_value = [assignment]

        with patch.object(adapter, "_get_llm", return_value=mock_llm), \
             patch("src.agents.commander.CommanderAgent", return_value=mock_agent):
            result = await adapter.commander_node({"user_idea": "idea"})

        assert result["workflow_level"] == "standard"
        assert result["scene_type"] == "chapter"
        assert result["scene_detection_confidence"] == 0.66
        assert result["fallback_used"] is False
        assert result["matched_keywords"]["scene"] == ["chapter"]
        assert result["dispatched_skills"] == ["outline", "foreshadow"]
        assert result["task_assignments"] == [{"agent": "writer", "task": "draft"}]

    @pytest.mark.asyncio
    async def test_architect_success(self):
        adapter = NovelAdapter()
        mock_llm = MagicMock()

        scene_card = MagicMock()
        scene_card.model_dump.return_value = {"id": "SCENE-001", "title": "opening"}

        lock_analysis = MagicMock()
        lock_analysis.total_score = 30
        lock_analysis.model_dump.return_value = {"total_score": 30}

        blueprint = MagicMock()
        blueprint.scene_cards = [scene_card]
        blueprint.lock_analysis = lock_analysis
        blueprint.model_dump.return_value = {"blueprint": True}

        mock_agent = MagicMock()
        mock_agent.plan = AsyncMock(return_value=blueprint)

        with patch.object(adapter, "_get_llm", return_value=mock_llm), \
             patch("src.agents.architect.ArchitectAgent", return_value=mock_agent):
            result = await adapter.architect_node({"user_idea": "idea"})

        assert result["story_blueprint"] == {"blueprint": True}
        assert result["lock_analysis"] == {"total_score": 30}
        assert result["scene_cards"][0]["id"] == "SCENE-001"
        assert result["current_scene"]["id"] == "SCENE-001"

    @pytest.mark.asyncio
    async def test_writer_success_with_feedback_context(self):
        adapter = NovelAdapter()
        mock_llm = MagicMock()

        class _WriterInput:
            def __init__(self, **kwargs):
                for k, v in kwargs.items():
                    setattr(self, k, v)

        writer_result = MagicMock()
        writer_result.content = "new draft"
        writer_result.wordcount = 1234
        writer_result.sensory_types_used = ["视觉", "听觉"]
        writer_result.forbidden_words_found = ["禁用词"]
        writer_result.sections_needing_review = ["段落 2"]
        writer_result.metadata = {"warnings": ["demo-warning"]}

        captured = {}

        async def _write(inp):
            captured["input"] = inp
            return writer_result

        mock_agent = MagicMock()
        mock_agent.write = _write

        with patch.object(adapter, "_get_llm", return_value=mock_llm), \
             patch("src.agents.writer.WriterAgent", return_value=mock_agent), \
             patch("src.agents.writer.WriterInput", _WriterInput):
            state = {
                "revision_count": 1,
                "draft_version": 1,
                "feedback_context": "请增强冲突",
                "current_scene": {
                    "scene_id": "CH01-SC01",
                    "chapter_num": 1,
                    "pov_character": "A",
                    "objective": "obj",
                    "conflict": "conf",
                    "outcome": "+",
                    "plot_beat": "beat",
                    "emotional_arc": "平静→激烈",
                    "sensory_guidance": {},
                    "foreshadows_to_plant": [],
                    "foreshadows_to_harvest": [],
                },
                "character_profiles": [],
                "world_settings": {},
                "errors": [],
            }
            result = await adapter.writer_node(state)

        assert result["draft_content"] == "new draft"
        assert result["draft_version"] == 2
        assert result["draft_wordcount"] == 1234
        assert result["writer_metadata"] == {"warnings": ["demo-warning"]}
        assert result["writer_self_check"]["forbidden_words"] == ["禁用词"]
        assert "请根据以上反馈重写内容" in captured["input"].previous_content

    @pytest.mark.asyncio
    async def test_distillation_success(self):
        adapter = NovelAdapter(config={"distillation_template": "full"})

        updated_state = {
            "distillation_result": {
                "entities_count": 3,
                "relations_count": 2,
                "events_count": 1,
                "template": "full",
            },
            "distillation_state": {"ok": True},
        }

        mock_node = MagicMock()
        mock_node.process.return_value = updated_state

        with patch("src.workflow.graph.DistillationNode", return_value=mock_node), \
             patch("src.workflow.graph.DistillationTemplate.from_string", return_value=MagicMock()):
            result = await adapter.distillation_node({"draft_content": "text"})

        assert result["distillation_result"]["entities_count"] == 3
        assert result["distillation_state"]["ok"] is True

    @pytest.mark.asyncio
    async def test_distillation_exception_warning(self):
        adapter = NovelAdapter(config={"distillation_template": "full"})

        mock_node = MagicMock()
        mock_node.process.side_effect = RuntimeError("distill fail")

        with patch("src.workflow.graph.DistillationNode", return_value=mock_node), \
             patch("src.workflow.graph.DistillationTemplate.from_string", return_value=MagicMock()):
            result = await adapter.distillation_node({"draft_content": "text", "errors": []})

        assert "errors" in result
        assert any("Distillation warning" in err for err in result["errors"])

    @pytest.mark.asyncio
    async def test_critic_success(self):
        adapter = NovelAdapter()
        mock_llm = MagicMock()

        instruction = MagicMock()
        instruction.model_dump.return_value = {"target": "writer", "hint": "加强冲突"}

        review_result = MagicMock()
        review_result.total_score = 86
        review_result.lock_score = 32
        review_result.style_score = 30
        review_result.logic_score = 24
        review_result.decision = "REVISE"
        review_result.actionable_feedback = "加强冲突"
        review_result.revision_instructions = [instruction]
        review_result.model_dump.return_value = {
            "total_score": 86,
            "decision": "REVISE",
            "actionable_feedback": "加强冲突",
        }

        mock_agent = MagicMock()
        mock_agent.review = AsyncMock(return_value=review_result)

        with patch.object(adapter, "_get_llm", return_value=mock_llm), \
             patch("src.agents.critic.CriticAgent", return_value=mock_agent):
            state = {
                "draft_content": "draft",
                "current_scene": {"id": "S1"},
                "character_profiles": [],
                "world_settings": {},
                "draft_version": 2,
                "revision_count": 1,
                "revision_history": [],
            }
            result = await adapter.critic_node(state)

        assert result["critique_result"]["total_score"] == 86
        assert result["revision_count"] == 2
        assert result["feedback_context"] == "加强冲突"
        assert result["revision_history"][0]["score"] == 86
        assert result["revision_instructions"] == [{"target": "writer", "hint": "加强冲突"}]

class TestCreateGraph:

    def test_creates_graph(self):
        adapter = NovelAdapter()
        graph = adapter.create_graph()
        assert graph is not None
