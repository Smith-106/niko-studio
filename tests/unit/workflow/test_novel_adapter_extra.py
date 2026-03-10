# -*- coding: utf-8 -*-
"""NovelAdapter routing and evaluate tests."""

import pytest
from unittest.mock import MagicMock, patch


class TestNovelAdapterRouting:
    @pytest.fixture()
    def adapter(self):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            mock_cfg.return_value = MagicMock()
            from src.workflow.adapters.novel_adapter import NovelAdapter
            a = NovelAdapter(config={"enable_distillation": True})
        return a

    def test_get_domain_type(self, adapter):
        assert adapter.get_domain_type() == "novel"

    def test_route_after_commander_rapid(self, adapter):
        state = {"workflow_level": "rapid"}
        assert adapter.route_after_commander(state) == "writer"

    def test_route_after_commander_standard(self, adapter):
        state = {"workflow_level": "standard"}
        assert adapter.route_after_commander(state) == "architect"

    def test_route_after_commander_default(self, adapter):
        state = {}
        assert adapter.route_after_commander(state) == "architect"

    def test_route_after_writer_distillation(self, adapter):
        state = {"draft_content": "some text"}
        assert adapter.route_after_writer(state) == "distillation"

    def test_route_after_writer_no_draft(self, adapter):
        state = {"draft_content": ""}
        assert adapter.route_after_writer(state) == "critic"

    def test_route_after_writer_already_distilled(self, adapter):
        state = {"draft_content": "text", "distillation_result": {}}
        assert adapter.route_after_writer(state) == "critic"

    def test_route_after_writer_distill_disabled(self):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            mock_cfg.return_value = MagicMock()
            from src.workflow.adapters.novel_adapter import NovelAdapter
            a = NovelAdapter(config={"enable_distillation": False})
        state = {"draft_content": "text"}
        assert a.route_after_writer(state) == "critic"

    def test_evaluate(self, adapter):
        state = {
            "critique_result": {
                "decision": "ACCEPT",
                "decision_reason": "good",
                "total_score": 85,
                "lock_analysis": {"scores": {"plot": 9}},
                "actionable_feedback": "nice",
                "revision_instructions": ["fix x"],
            }
        }
        result = adapter.evaluate(state)
        assert result.decision == "ACCEPT"
        assert result.total_score == 85

    def test_evaluate_defaults(self, adapter):
        state = {}
        result = adapter.evaluate(state)
        assert result.decision == "REVISE"
        assert result.total_score == 0

    def test_context_governance_missing_payload_defaults_true(self, adapter):
        assert adapter._context_governance_passed({}) is True

    def test_context_governance_enabled_empty_payload_branch(self):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            mock_cfg.return_value = MagicMock()
            from src.workflow.adapters.novel_adapter import NovelAdapter
            adapter = NovelAdapter(config={"enable_context_governance": True})

        assert adapter._context_governance_passed({"context_governance": {}}) is True

    def test_context_governance_thresholds_branch(self):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            mock_cfg.return_value = MagicMock()
            from src.workflow.adapters.novel_adapter import NovelAdapter
            adapter = NovelAdapter(config={"enable_context_governance": True})
        state = {
            "context_governance": {
                "retrieval_hit_rate": 0.0,
                "context_budget_utilization": 0.0,
            }
        }
        assert adapter._context_governance_passed(state) is False

    def test_reflection_helper_revision_required_and_curator_no_candidates(self):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            mock_cfg.return_value = MagicMock()
            from src.workflow.adapters.novel_adapter import NovelAdapter
            adapter = NovelAdapter(config={"enable_self_learning_loop": True})

        reflection = adapter._build_reflection_from_critic(
            {
                "decision": "REVISE",
                "total_score": 70,
                "actionable_feedback": "",
                "lock_analysis": {"L": {"score": 6}, "C": {"score": 6}},
            },
            revision_count=1,
            revision_history=[],
        )
        assert reflection["failure_type"] == "revision_required"
        assert reflection["avoid_next_round"]

        curated = adapter._curate_playbook_candidates(
            state={"self_learning": {"playbook": {"rules": ["existing"]}}},
            critique_result={"actionable_feedback": "   "},
            reflection={"avoid_next_round": []},
        )
        assert curated["curator"]["applied"] is False
        assert curated["curator"]["reason"] == "no_candidates"

    def test_reflection_human_review_and_inject_guard_branches(self):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            mock_cfg.return_value = MagicMock()
            from src.workflow.adapters.novel_adapter import NovelAdapter
            adapter = NovelAdapter(config={"enable_self_learning_loop": True})

        reflection = adapter._build_reflection_from_critic(
            {
                "decision": "HUMAN_REVIEW",
                "total_score": 40,
                "actionable_feedback": "Need manual check",
                "lock_analysis": {"C": {"score": 10}},
            },
            revision_count=2,
            revision_history=[{"score": 40}],
        )
        assert reflection["failure_type"] == "human_review"

        class _WriterInput:
            previous_content = ""

        writer_input = _WriterInput()
        adapter._inject_playbook_into_writer_input(
            writer_input,
            state={"self_learning": {"playbook": {"rules": ["   "]}}},
        )
        assert writer_input.previous_content == ""

    def test_curate_playbook_non_list_rules_and_trim_to_max(self):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            mock_cfg.return_value = MagicMock()
            from src.workflow.adapters.novel_adapter import NovelAdapter
            adapter = NovelAdapter(
                config={
                    "enable_self_learning_loop": True,
                    "self_learning_max_rules": 1,
                }
            )

        with patch.object(
            adapter,
            "_get_self_learning_state",
            return_value={"playbook": {"rules": "invalid"}},
        ):
            curated = adapter._curate_playbook_candidates(
                state={"self_learning": {"playbook": {"rules": "invalid"}}},
                critique_result={"actionable_feedback": "focus"},
                reflection={"avoid_next_round": ["rule-a", "rule-b"]},
            )
        assert curated["curator"]["applied"] is True
        assert curated["curator"]["rule_count"] == 1

    def test_inject_playbook_into_writer_input_non_list_rules_branch(self):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            mock_cfg.return_value = MagicMock()
            from src.workflow.adapters.novel_adapter import NovelAdapter
            adapter = NovelAdapter(config={"enable_self_learning_loop": True})

        class _WriterInput:
            previous_content = "keep"

        writer_input = _WriterInput()
        with patch.object(
            adapter,
            "_get_self_learning_state",
            return_value={"playbook": {"rules": "invalid"}},
        ):
            adapter._inject_playbook_into_writer_input(writer_input, state={})

        assert writer_input.previous_content == "keep"

    def test_inject_playbook_into_writer_input_noop_branches(self, adapter):
        class _WriterInput:
            previous_content = ""

        writer_input = _WriterInput()

        adapter._inject_playbook_into_writer_input(
            writer_input,
            state={"self_learning": {"playbook": {"rules": []}}},
        )
        assert writer_input.previous_content == ""

    def test_create_initial_state(self, adapter):
        with patch("src.workflow.adapters.novel_adapter.create_initial_state") as mock_cis:
            mock_cis.return_value = {"user_idea": "test"}
            state = adapter.create_initial_state("test idea", genre="科幻")
            mock_cis.assert_called_once()
            assert state["user_idea"] == "test"

    def test_create_initial_state_with_resume(self, adapter):
        with patch("src.workflow.adapters.novel_adapter.create_initial_state") as mock_cis:
            mock_cis.return_value = {}
            adapter.create_initial_state("test", resume_decision="continue")
            call_kwargs = mock_cis.call_args[1]
            assert "resume_decision" in call_kwargs.get("metadata", {})

    def test_get_llm_no_keys(self, adapter):
        with patch("src.workflow.adapters.novel_adapter.get_config") as mock_cfg:
            cfg = MagicMock()
            cfg.agent.google_api_key = None
            cfg.agent.openai_api_key = None
            mock_cfg.return_value = cfg
            with patch.dict("os.environ", {}, clear=True):
                with pytest.raises(RuntimeError, match="无法初始化"):
                    adapter._get_llm()
