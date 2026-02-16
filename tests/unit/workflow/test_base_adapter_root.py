# -*- coding: utf-8 -*-
"""
BaseAdapter (workflow root) & BaseWorkflow Tests

Tests for workflow/base_adapter.py (DomainType, BaseEvaluationResult,
BaseDomainAdapter, AdapterRegistry) and workflow/base_workflow.py.
"""

import pytest
from unittest.mock import MagicMock
from typing import Any, Dict, Optional, Type

from src.workflow.base_adapter import (
    DomainType,
    BaseEvaluationResult,
    BaseDomainAdapter,
    AdapterRegistry,
)
from src.workflow.base_state import BaseState, BaseWorkflowConfig
from src.workflow.base_workflow import BaseWorkflow


# ============================================================
# DomainType
# ============================================================

class TestDomainTypeRoot:

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

class TestBaseEvaluationResultRoot:

    def test_basic(self):
        r = BaseEvaluationResult(
            decision="APPROVED",
            decision_reason="Good",
            total_score=90.0,
            dimension_scores={"L": 9, "O": 8},
            feedback="none",
            revision_instructions=[],
        )
        assert r.decision == "APPROVED"
        assert r.total_score == 90.0
        assert r.dimension_scores["L"] == 9

    def test_with_instructions(self):
        r = BaseEvaluationResult(
            decision="REVISE",
            decision_reason="Need work",
            total_score=50.0,
            dimension_scores={},
            feedback="fix plot",
            revision_instructions=[{"target": "writer", "instruction": "rewrite"}],
        )
        assert len(r.revision_instructions) == 1


# ============================================================
# Concrete adapter for testing abstract class
# ============================================================

class _TestAdapter(BaseDomainAdapter):
    def get_domain_type(self) -> str:
        return "test_domain"

    def get_state_class(self) -> Type[BaseState]:
        return dict

    def create_initial_state(self, user_request: str, **kwargs) -> BaseState:
        return {"user_idea": user_request}

    def evaluate(self, state: BaseState) -> BaseEvaluationResult:
        return BaseEvaluationResult(
            decision="APPROVED", decision_reason="ok",
            total_score=100, dimension_scores={},
            feedback="", revision_instructions=[],
        )

    def create_graph(self):
        return MagicMock()


# ============================================================
# BaseDomainAdapter
# ============================================================

class TestBaseDomainAdapterRoot:

    def test_init_no_config(self):
        a = _TestAdapter()
        assert a.config == {}
        assert a.domain == "test_domain"

    def test_init_with_config(self):
        a = _TestAdapter(config={"key": "val"})
        assert a.config == {"key": "val"}

    def test_get_domain_type(self):
        a = _TestAdapter()
        assert a.get_domain_type() == "test_domain"

    def test_get_state_class(self):
        a = _TestAdapter()
        assert a.get_state_class() is dict

    def test_create_initial_state(self):
        a = _TestAdapter()
        state = a.create_initial_state("hello")
        assert state["user_idea"] == "hello"

    def test_evaluate(self):
        a = _TestAdapter()
        result = a.evaluate({})
        assert result.decision == "APPROVED"

    def test_create_graph(self):
        a = _TestAdapter()
        assert a.create_graph() is not None

    def test_get_nodes_default(self):
        a = _TestAdapter()
        assert a.get_nodes() == {}

    def test_get_routing_rules_default(self):
        a = _TestAdapter()
        assert a.get_routing_rules() == {}

    def test_should_continue_approved(self):
        a = _TestAdapter()
        assert a.should_continue({"decision": "APPROVED"}) == "finalize"

    def test_should_continue_human_review(self):
        a = _TestAdapter()
        assert a.should_continue({"decision": "HUMAN_REVIEW"}) == "human_review"

    def test_should_continue_revise(self):
        a = _TestAdapter()
        assert a.should_continue({"decision": "REVISE"}) == "revise"

    def test_should_continue_rewrite(self):
        a = _TestAdapter()
        assert a.should_continue({"decision": "REWRITE"}) == "revise"

    def test_should_continue_max_revisions(self):
        a = _TestAdapter()
        state = {"revision_count": 5, "max_revisions": 3, "decision": "REVISE"}
        assert a.should_continue(state) == "human_review"

    def test_should_continue_unknown(self):
        a = _TestAdapter()
        assert a.should_continue({"decision": "UNKNOWN"}) == "continue"

    def test_should_continue_empty(self):
        a = _TestAdapter()
        assert a.should_continue({}) == "continue"

    def test_get_default_config(self):
        a = _TestAdapter()
        cfg = a.get_default_config()
        assert cfg["pass_score"] == 80
        assert cfg["max_revisions"] == 3
        assert cfg["domain"] == "test_domain"

    def test_merge_config_none(self):
        a = _TestAdapter()
        cfg = a.merge_config(None)
        assert cfg["pass_score"] == 80

    def test_merge_config_override(self):
        a = _TestAdapter()
        cfg = a.merge_config({"pass_score": 90, "extra": True})
        assert cfg["pass_score"] == 90
        assert cfg["extra"] is True


class TestBaseDomainAdapterRootAbstractPassLines:

    def test_abstract_pass_lines_are_executable(self):
        dummy = object()

        assert BaseDomainAdapter.get_domain_type(dummy) is None
        assert BaseDomainAdapter.get_state_class(dummy) is None
        assert BaseDomainAdapter.create_initial_state(dummy, "req") is None
        assert BaseDomainAdapter.evaluate(dummy, {}) is None
        assert BaseDomainAdapter.create_graph(dummy) is None


# ============================================================
# AdapterRegistry
# ============================================================

class TestAdapterRegistryRoot:

    def test_register_and_get(self):
        # Use a unique domain to avoid polluting global state
        @AdapterRegistry.register("_test_root_domain")
        class _TempAdapter(_TestAdapter):
            def get_domain_type(self):
                return "_test_root_domain"

        assert AdapterRegistry.get("_test_root_domain") is _TempAdapter

    def test_get_nonexistent(self):
        assert AdapterRegistry.get("_nonexistent_xyz") is None

    def test_list_domains(self):
        domains = AdapterRegistry.list_domains()
        assert isinstance(domains, list)
        # _test_root_domain registered above
        assert "_test_root_domain" in domains

    def test_create_adapter(self):
        adapter = AdapterRegistry.create_adapter("_test_root_domain")
        assert adapter is not None

    def test_create_adapter_nonexistent(self):
        assert AdapterRegistry.create_adapter("_nonexistent_xyz") is None

    def test_create_adapter_with_config(self):
        adapter = AdapterRegistry.create_adapter("_test_root_domain", config={"key": "val"})
        assert adapter is not None


# ============================================================
# BaseWorkflow
# ============================================================

class _TestWorkflow(BaseWorkflow):
    def run(self, input_data):
        return {"result": input_data}

    def get_state(self):
        return {}


class TestBaseWorkflow:

    def test_init_no_config(self):
        w = _TestWorkflow()
        assert w.config == {}

    def test_init_with_config(self):
        w = _TestWorkflow(config={"mode": "fast"})
        assert w.config["mode"] == "fast"

    def test_run(self):
        w = _TestWorkflow()
        result = w.run("hello")
        assert result["result"] == "hello"

    def test_get_state(self):
        w = _TestWorkflow()
        assert w.get_state() == {}


class TestBaseWorkflowAbstractPassLines:

    def test_abstract_pass_lines_are_executable(self):
        dummy = object()

        assert BaseWorkflow.run(dummy, "input") is None
        assert BaseWorkflow.get_state(dummy) is None
