"""
Base State Tests

Tests for DecisionType, DomainType, BaseState, BaseWorkflowConfig,
DEFAULT_BASE_CONFIG, and create_base_state factory.
"""

import pytest
from src.workflow.base_state import (
    DecisionType,
    DomainType,
    BaseState,
    BaseWorkflowConfig,
    DEFAULT_BASE_CONFIG,
    create_base_state,
)


# ============================================================
# Constants Tests
# ============================================================

class TestDecisionType:

    def test_values(self):
        assert DecisionType.APPROVED == "APPROVED"
        assert DecisionType.REVISE == "REVISE"
        assert DecisionType.HUMAN_REVIEW == "HUMAN_REVIEW"
        assert DecisionType.REWRITE == "REWRITE"
        assert DecisionType.FAILED == "FAILED"


class TestDomainType:

    def test_values(self):
        assert DomainType.NOVEL == "novel"
        assert DomainType.CODE == "code"
        assert DomainType.KNOWLEDGE == "knowledge"
        assert DomainType.CUSTOM == "custom"


# ============================================================
# DEFAULT_BASE_CONFIG Tests
# ============================================================

class TestDefaultBaseConfig:

    def test_pass_score(self):
        assert DEFAULT_BASE_CONFIG["pass_score"] == 80

    def test_human_review_score(self):
        assert DEFAULT_BASE_CONFIG["human_review_score"] == 70

    def test_max_revisions(self):
        assert DEFAULT_BASE_CONFIG["max_revisions"] == 3

    def test_auto_approve_timeout(self):
        assert DEFAULT_BASE_CONFIG["auto_approve_timeout"] == 300

    def test_verbose(self):
        assert DEFAULT_BASE_CONFIG["verbose"] is True

    def test_save_intermediate(self):
        assert DEFAULT_BASE_CONFIG["save_intermediate"] is True

    def test_domain_default(self):
        assert DEFAULT_BASE_CONFIG["domain"] == DomainType.CUSTOM


# ============================================================
# create_base_state Tests
# ============================================================

class TestCreateBaseState:

    def test_minimal(self):
        state = create_base_state("test request")
        assert state["user_request"] == "test request"
        assert state["domain"] == DomainType.CUSTOM
        assert state["workflow_level"] == 3
        assert state["current_step"] == "init"
        assert state["revision_count"] == 0
        assert state["errors"] == []
        assert state["requires_human_intervention"] is False

    def test_custom_domain(self):
        state = create_base_state("test", domain=DomainType.NOVEL)
        assert state["domain"] == "novel"

    def test_custom_level(self):
        state = create_base_state("test", workflow_level=5)
        assert state["workflow_level"] == 5

    def test_metadata(self):
        state = create_base_state("test", metadata={"key": "val"})
        assert state["metadata"] == {"key": "val"}

    def test_metadata_default(self):
        state = create_base_state("test")
        assert state["metadata"] == {}

    def test_session_id_generated(self):
        state = create_base_state("test")
        assert len(state["session_id"]) > 0

    def test_unique_session_ids(self):
        s1 = create_base_state("test")
        s2 = create_base_state("test")
        assert s1["session_id"] != s2["session_id"]

    def test_timestamps(self):
        state = create_base_state("test")
        assert state["created_at"] is not None
        assert state["updated_at"] is not None
        assert state["created_at"] == state["updated_at"]

    def test_initial_scores(self):
        state = create_base_state("test")
        assert state["score"] == 0.0

    def test_initial_outputs(self):
        state = create_base_state("test")
        assert state["draft_content"] == ""
        assert state["final_output"] == ""

    def test_tags_empty(self):
        state = create_base_state("test")
        assert state["tags"] == []

    def test_kwargs_passed(self):
        state = create_base_state("test", custom_field="custom_value")
        assert state["custom_field"] == "custom_value"
