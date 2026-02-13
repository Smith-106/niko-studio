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
        assert result["human_review_status"] == "pending"
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


class TestDistillationNodeAdapter:

    @pytest.mark.asyncio
    async def test_distillation_error(self):
        adapter = NovelAdapter()
        mock_node_instance = MagicMock()
        mock_node_instance.process.side_effect = RuntimeError("fail")

        with patch("src.workflow.graph.DistillationNode", return_value=mock_node_instance):
            state = {"draft_content": "text", "errors": []}
            result = await adapter.distillation_node(state)
            assert "errors" in result


# ============================================================
# create_graph
# ============================================================

class TestCreateGraph:

    def test_creates_graph(self):
        adapter = NovelAdapter()
        graph = adapter.create_graph()
        assert graph is not None
