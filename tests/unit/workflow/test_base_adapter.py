# -*- coding: utf-8 -*-
"""
BaseDomainAdapter Tests

Tests for DomainType, BaseEvaluationResult, BaseDomainAdapter,
AdapterRegistry.
"""

import pytest
from unittest.mock import MagicMock

from src.workflow.adapters.base_adapter import (
    DomainType,
    BaseEvaluationResult,
    BaseDomainAdapter,
    AdapterRegistry,
)
from src.workflow.base_state import BaseState


# ============================================================
# DomainType
# ============================================================

class TestDomainType:

    def test_values(self):
        assert DomainType.NOVEL.value == "novel"
        assert DomainType.CODE.value == "code"
        assert DomainType.KNOWLEDGE.value == "knowledge"
        assert DomainType.CUSTOM.value == "custom"

    def test_from_value(self):
        assert DomainType("novel") == DomainType.NOVEL
        assert DomainType("code") == DomainType.CODE


# ============================================================
# BaseEvaluationResult
# ============================================================

class TestBaseEvaluationResult:

    def test_basic(self):
        result = BaseEvaluationResult(
            decision="APPROVED",
            decision_reason="Good quality",
            total_score=85.0,
            dimension_scores={"L": 9, "O": 8},
            feedback="Well written",
            revision_instructions=[{"target": "writer"}]
        )
        assert result.decision == "APPROVED"
        assert result.total_score == 85.0
        assert result.dimension_scores["L"] == 9
        assert len(result.revision_instructions) == 1

    def test_revise(self):
        result = BaseEvaluationResult(
            decision="REVISE",
            decision_reason="Needs work",
            total_score=50.0,
            dimension_scores={},
            feedback="Fix plot",
            revision_instructions=[]
        )
        assert result.decision == "REVISE"


# ============================================================
# BaseDomainAdapter (concrete subclass for testing)
# ============================================================

class ConcreteDomainAdapter(BaseDomainAdapter):

    def get_domain_type(self):
        return "test"

    def get_state_class(self):
        return dict

    def create_initial_state(self, user_request, **kwargs):
        return {"user_request": user_request}

    def evaluate(self, state):
        return BaseEvaluationResult(
            decision="APPROVED", decision_reason="",
            total_score=100, dimension_scores={},
            feedback="", revision_instructions=[]
        )

    def create_graph(self):
        return MagicMock()


class TestBaseDomainAdapter:

    def test_init_default_config(self):
        adapter = ConcreteDomainAdapter()
        assert adapter.config == {}
        assert adapter.domain == "test"

    def test_init_with_config(self):
        adapter = ConcreteDomainAdapter(config={"pass_score": 90})
        assert adapter.config["pass_score"] == 90

    def test_get_nodes_default(self):
        adapter = ConcreteDomainAdapter()
        assert adapter.get_nodes() == {}

    def test_get_routing_rules_default(self):
        adapter = ConcreteDomainAdapter()
        assert adapter.get_routing_rules() == {}

    def test_should_continue_approved(self):
        adapter = ConcreteDomainAdapter()
        state = {"decision": "APPROVED", "revision_count": 0}
        assert adapter.should_continue(state) == "finalize"

    def test_should_continue_human_review(self):
        adapter = ConcreteDomainAdapter()
        state = {"decision": "HUMAN_REVIEW", "revision_count": 0}
        assert adapter.should_continue(state) == "human_review"

    def test_should_continue_revise(self):
        adapter = ConcreteDomainAdapter()
        state = {"decision": "REVISE", "revision_count": 0}
        assert adapter.should_continue(state) == "revise"

    def test_should_continue_rewrite(self):
        adapter = ConcreteDomainAdapter()
        state = {"decision": "REWRITE", "revision_count": 0}
        assert adapter.should_continue(state) == "revise"

    def test_should_continue_max_revisions(self):
        adapter = ConcreteDomainAdapter()
        state = {"decision": "REVISE", "revision_count": 3, "max_revisions": 3}
        assert adapter.should_continue(state) == "human_review"

    def test_should_continue_unknown(self):
        adapter = ConcreteDomainAdapter()
        state = {"decision": "UNKNOWN", "revision_count": 0}
        assert adapter.should_continue(state) == "continue"

    def test_get_default_config(self):
        adapter = ConcreteDomainAdapter()
        config = adapter.get_default_config()
        assert config["pass_score"] == 80
        assert config["max_revisions"] == 3
        assert config["domain"] == "test"

    def test_merge_config_no_custom(self):
        adapter = ConcreteDomainAdapter()
        merged = adapter.merge_config()
        assert merged["pass_score"] == 80

    def test_merge_config_with_custom(self):
        adapter = ConcreteDomainAdapter()
        merged = adapter.merge_config({"pass_score": 95, "new_key": "val"})
        assert merged["pass_score"] == 95
        assert merged["new_key"] == "val"


class TestBaseDomainAdapterAbstractPassLines:

    def test_abstract_pass_lines_are_executable(self):
        # 直接调用基类抽象方法，覆盖 pass 分支
        dummy = object()

        assert BaseDomainAdapter.get_domain_type(dummy) is None
        assert BaseDomainAdapter.get_state_class(dummy) is None
        assert BaseDomainAdapter.create_initial_state(dummy, "req") is None
        assert BaseDomainAdapter.evaluate(dummy, {}) is None
        assert BaseDomainAdapter.create_graph(dummy) is None


# ============================================================
# AdapterRegistry
# ============================================================

class TestAdapterRegistry:

    def test_register_and_get_with_capabilities(self):
        @AdapterRegistry.register("test_domain_caps", capabilities=("memory-aware", "cli-exposed"))
        class TestAdapter(ConcreteDomainAdapter):
            def get_domain_type(self):
                return "test_domain_caps"

        assert AdapterRegistry.get("test_domain_caps") is TestAdapter
        assert AdapterRegistry.get_capabilities("test_domain_caps") == ["cli-exposed", "memory-aware"]

    def test_list_domains_by_capability(self):
        @AdapterRegistry.register("test_domain_filter_a", capabilities=("strict-governance", "cli-exposed"))
        class TestAdapterA(ConcreteDomainAdapter):
            def get_domain_type(self):
                return "test_domain_filter_a"

        @AdapterRegistry.register("test_domain_filter_b", capabilities=("memory-aware",))
        class TestAdapterB(ConcreteDomainAdapter):
            def get_domain_type(self):
                return "test_domain_filter_b"

        domains = AdapterRegistry.list_domains_by_capability("strict-governance")
        assert "test_domain_filter_a" in domains
        assert "test_domain_filter_b" not in domains

    def test_get_nonexistent(self):
        assert AdapterRegistry.get("nonexistent_xyz") is None

    def test_list_domains(self):
        domains = AdapterRegistry.list_domains()
        assert isinstance(domains, list)
        assert "novel" in domains  # registered by novel_adapter import

    def test_create_adapter(self):
        adapter = AdapterRegistry.create_adapter("novel")
        assert adapter is not None

    def test_create_adapter_nonexistent(self):
        adapter = AdapterRegistry.create_adapter("nonexistent_xyz")
        assert adapter is None

    def test_create_adapter_with_config(self):
        adapter = AdapterRegistry.create_adapter("novel", config={"pass_score": 90})
        assert adapter.config["pass_score"] == 90
