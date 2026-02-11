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
