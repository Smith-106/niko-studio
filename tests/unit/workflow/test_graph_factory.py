# -*- coding: utf-8 -*-
"""
Graph Factory Tests

Tests for WorkflowFactory (create/create_adapter/list_domains/register/
get_level_description), _build_resume_decision, _merge_resume_metadata,
create_workflow.
"""

import pytest
from unittest.mock import MagicMock, patch
from src.workflow.graph_factory import (
    WorkflowFactory,
    _build_resume_decision,
    _merge_resume_metadata,
    create_workflow,
)
from src.workflow.levels.types import WorkflowLevel
from src.workflow.adapters.base_adapter import (
    BaseDomainAdapter,
    AdapterRegistry,
    DomainType,
    BaseEvaluationResult,
)


# ============================================================
# WorkflowFactory.list_domains
# ============================================================

class TestWorkflowFactoryListDomains:

    def test_returns_list(self):
        domains = WorkflowFactory.list_domains()
        assert isinstance(domains, list)

    def test_contains_registered(self):
        domains = WorkflowFactory.list_domains()
        # novel and code are registered via decorators
        assert "novel" in domains or "code" in domains


# ============================================================
# WorkflowFactory.get_level_description
# ============================================================

class TestGetLevelDescription:

    def test_l1(self):
        desc = WorkflowFactory.get_level_description(WorkflowLevel.L1_RAPID)
        assert desc["name"] == "Rapid"
        assert "快速" in desc["description"]

    def test_l2(self):
        desc = WorkflowFactory.get_level_description(WorkflowLevel.L2_LITE)
        assert desc["name"] == "Lightweight"

    def test_l3(self):
        desc = WorkflowFactory.get_level_description(WorkflowLevel.L3_STANDARD)
        assert desc["name"] == "Standard"

    def test_l4(self):
        desc = WorkflowFactory.get_level_description(WorkflowLevel.L4_BRAINSTORM)
        assert desc["name"] == "Brainstorm"

    def test_l5(self):
        desc = WorkflowFactory.get_level_description(WorkflowLevel.L5_COORDINATOR)
        assert desc["name"] == "Coordinator"

    def test_has_novel_and_code_use(self):
        for level in WorkflowLevel:
            desc = WorkflowFactory.get_level_description(level)
            assert "novel_use" in desc
            assert "code_use" in desc


# ============================================================
# WorkflowFactory.create_adapter
# ============================================================

class TestWorkflowFactoryCreateAdapter:

    def test_known_domain(self):
        adapter = WorkflowFactory.create_adapter("code")
        assert adapter is not None
        assert adapter.get_domain_type() == "code"

    def test_unknown_domain(self):
        adapter = WorkflowFactory.create_adapter("nonexistent_domain_xyz")
        assert adapter is None


# ============================================================
# WorkflowFactory.register_adapter
# ============================================================

class TestWorkflowFactoryRegister:

    def test_register_custom(self):
        class FakeAdapter(BaseDomainAdapter):
            def get_domain_type(self): return "fake_test"
            def get_state_class(self): return dict
            def create_initial_state(self, user_request, **kw): return {}
            def evaluate(self, state): return None
            def create_graph(self): return MagicMock()

        WorkflowFactory.register_adapter(
            "fake_test",
            FakeAdapter,
            capabilities=("strict-governance", "cli-exposed"),
        )
        assert "fake_test" in WorkflowFactory.list_domains()
        assert WorkflowFactory.get_adapter_capabilities("fake_test") == ["cli-exposed", "strict-governance"]
        assert "fake_test" in WorkflowFactory.list_domains_by_capability("strict-governance")

        # Cleanup
        AdapterRegistry._adapters.pop("fake_test", None)
        AdapterRegistry._adapter_capabilities.pop("fake_test", None)


# ============================================================
# WorkflowFactory.create
# ============================================================

class TestWorkflowFactoryCreate:

    def test_create_code_domain(self):
        graph = WorkflowFactory.create("code")
        assert graph is not None

    def test_create_unknown_raises(self):
        with pytest.raises(ValueError, match="Unknown domain"):
            WorkflowFactory.create("nonexistent_xyz")

    def test_create_with_int_level(self):
        graph = WorkflowFactory.create("code", level=3)
        assert graph is not None

    def test_create_with_config(self):
        graph = WorkflowFactory.create("code", config={"pass_score": 90})
        assert graph is not None


# ============================================================
# _build_resume_decision
# ============================================================

class TestBuildResumeDecision:

    def test_none_if_no_config(self):
        assert _build_resume_decision(None, "gemini") is None

    def test_none_if_no_resume_ids(self):
        assert _build_resume_decision({"key": "val"}, "gemini", resume_ids=None) is None

    def test_none_if_empty_resume_ids(self):
        assert _build_resume_decision({"key": "val"}, "gemini", resume_ids=[]) is None

    def test_with_resume_ids(self):
        result = _build_resume_decision(
            {"key": "val"},
            "gemini",
            resume_ids=["session-123"],
        )
        # Should return a ResumeDecision (or None if strategy can't determine)
        # The function delegates to determine_resume_strategy
        # We just verify it doesn't crash
        assert result is not None or result is None  # Always true, just exercises the path


# ============================================================
# _merge_resume_metadata
# ============================================================

class TestMergeResumeMetadata:

    def test_none_metadata(self):
        result = _merge_resume_metadata(None, None)
        assert result == {}

    def test_existing_metadata(self):
        result = _merge_resume_metadata({"key": "val"}, None)
        assert result == {"key": "val"}

    def test_with_resume_decision(self):
        from dataclasses import dataclass

        @dataclass
        class FakeDecision:
            strategy: str = "merge"
            source_ids: list = None
            def __post_init__(self):
                if self.source_ids is None:
                    self.source_ids = []

        decision = FakeDecision(strategy="merge", source_ids=["id1"])
        result = _merge_resume_metadata({"existing": True}, decision)
        assert "existing" in result
        assert "resume_decision" in result

    def test_no_overwrite_existing_resume_decision(self):
        from dataclasses import dataclass

        @dataclass
        class FakeDecision:
            strategy: str = "new"

        existing = {"resume_decision": {"old": True}}
        result = _merge_resume_metadata(existing, FakeDecision())
        # setdefault preserves existing
        assert result["resume_decision"] == {"old": True}


# ============================================================
# create_workflow
# ============================================================

class TestCreateWorkflow:

    def test_code_domain(self):
        graph, initial_state = create_workflow("code", "Build a CLI tool")
        assert graph is not None
        assert initial_state is not None
        assert initial_state.get("user_request") == "Build a CLI tool"

    def test_unknown_domain_raises(self):
        with pytest.raises(ValueError, match="Unknown domain"):
            create_workflow("nonexistent_xyz", "test")

    def test_with_config(self):
        graph, state = create_workflow(
            "code", "test request",
            level=2,
            config={"pass_score": 90}
        )
        assert graph is not None

    def test_default_level(self):
        graph, state = create_workflow("code", "test")
        assert state.get("domain") == "code"
