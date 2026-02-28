# -*- coding: utf-8 -*-
"""Adapter contract matrix tests for workflow adapter boundaries."""

import pytest

from src.workflow.adapters.base_adapter import AdapterRegistry, BaseEvaluationResult
from src.workflow.graph_factory import WorkflowFactory


CONTRACT_DOMAINS = ["novel", "code"]
REQUEST_FIELD_BY_DOMAIN = {
    "novel": "user_idea",
    "code": "user_request",
}


@pytest.mark.parametrize("domain", CONTRACT_DOMAINS, ids=CONTRACT_DOMAINS)
def test_contract_domain_identity_and_registry_lookup(domain):
    adapter = WorkflowFactory.create_adapter(domain)

    assert adapter is not None
    assert adapter.get_domain_type() == domain

    adapter_class = AdapterRegistry.get(domain)
    assert adapter_class is not None
    assert isinstance(adapter, adapter_class)


@pytest.mark.parametrize("domain", CONTRACT_DOMAINS, ids=CONTRACT_DOMAINS)
def test_contract_create_initial_state_request_and_metadata_passthrough(domain):
    adapter = WorkflowFactory.create_adapter(domain)
    assert adapter is not None

    trace_metadata = {"trace_id": "contract-matrix"}
    state = adapter.create_initial_state("contract request", metadata=trace_metadata)

    assert isinstance(state, dict)
    assert state[REQUEST_FIELD_BY_DOMAIN[domain]] == "contract request"
    assert state.get("metadata", {}).get("trace_id") == "contract-matrix"


@pytest.mark.parametrize("domain", CONTRACT_DOMAINS, ids=CONTRACT_DOMAINS)
def test_contract_evaluate_result_envelope(domain):
    adapter = WorkflowFactory.create_adapter(domain)
    assert adapter is not None

    result = adapter.evaluate({})

    assert isinstance(result, BaseEvaluationResult)
    assert isinstance(result.decision, str)
    assert isinstance(result.total_score, (int, float))
    assert isinstance(result.dimension_scores, dict)
    assert isinstance(result.feedback, str)
    assert isinstance(result.revision_instructions, list)


@pytest.mark.parametrize(
    "domain,expected_capabilities",
    [
        ("novel", ["cli-exposed", "memory-aware", "strict-governance"]),
        ("code", ["cli-exposed", "strict-governance"]),
    ],
    ids=["novel", "code"],
)
def test_contract_registry_capabilities_are_sorted_and_stable(domain, expected_capabilities):
    assert AdapterRegistry.get_capabilities(domain) == expected_capabilities


def test_contract_factory_creation_and_unknown_domain_fail_fast():
    for domain in CONTRACT_DOMAINS:
        graph = WorkflowFactory.create(domain)
        assert graph is not None

    assert WorkflowFactory.create_adapter("unknown-domain") is None

    with pytest.raises(ValueError, match="Unknown domain"):
        WorkflowFactory.create("unknown-domain")
