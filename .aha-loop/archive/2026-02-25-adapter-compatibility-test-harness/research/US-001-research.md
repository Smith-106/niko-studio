# Research Report: US-001 - Define adapter contract test matrix

**Date:** 2026-02-25
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Existing adapter interface patterns and test conventions in this repository
2. Best practice patterns for contract tests that validate interchangeable adapters

---

## Findings

### Topic 1: Existing adapter interface patterns and test conventions in this repository

**Summary:**
The current adapter boundary is stable around a small contract surface: domain identity, state type, state initialization, evaluation result shape, graph construction, registry metadata, and factory wiring. Tests already validate many pieces, but they are spread across adapter-specific test files and not expressed as one explicit matrix.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Existing unit tests

**Repository evidence:**
- Contract base methods and result shape: `src/workflow/adapters/base_adapter.py`
- Concrete implementations: `src/workflow/adapters/novel_adapter.py`, `src/workflow/adapters/code_adapter.py`
- Registry/factory integration: `src/workflow/graph_factory.py`
- Existing tests that can be normalized into matrix rows:
  - `tests/unit/workflow/test_base_adapter.py`
  - `tests/unit/workflow/test_novel_adapter.py`
  - `tests/unit/workflow/test_evaluator_code_adapter.py`
  - `tests/unit/workflow/test_graph_factory.py`

**Observed invariants (candidate matrix rows):**
- All adapters expose domain via `get_domain_type()` and registry lookup is deterministic.
- `create_initial_state(...)` keeps core request fields and carries metadata/resume hints through the boundary.
- `evaluate(...)` always returns `BaseEvaluationResult` with required shape (`decision`, `total_score`, `dimension_scores`, `feedback`, `revision_instructions`).
- Factory can instantiate registered adapters and fails fast on unknown domain.
- Registry capability metadata remains queryable and sorted for deterministic checks.

### Topic 2: Best practice patterns for contract tests that validate interchangeable adapters

**Summary:**
The best fit for this repository is a parameterized contract suite that runs shared assertions against each adapter implementation, with adapter-specific fixtures for setup payloads and expected decisions. This keeps compatibility checks centralized while still allowing domain-specific behavior.

**Sources Consulted:**
- [x] Official documentation
- [x] Existing codebase patterns

**Documentation Notes:**
- Pytest parametrization is the standard way to compare multiple implementations against one API contract.
- Keep assertions focused on observable boundary behavior, not internal implementation steps.
- Use stable IDs and deterministic expected values to keep CI output and diff review clean.

**External references:**
- https://docs.pytest.org/en/stable/example/parametrize.html
- https://docs.pytest.org/how-to/parametrize.html
- https://docs.pytest.org/en/stable/explanation/goodpractices.html

---

## Implementation Recommendations

1. **Approach:** Add a dedicated contract test module that parameterizes across adapters (`novel`, `code`) and validates the shared boundary rows above.
2. **Pattern to Follow:** Reuse current `AdapterRegistry` + `WorkflowFactory` behavior as authoritative boundary contracts.
3. **Key Files to Modify (future implementation phase):**
   - `tests/unit/workflow/test_adapter_contract_matrix.py` (new)
   - Potential small updates in `tests/unit/workflow/test_graph_factory.py` (if needed for capability/domain rows)
4. **Dependencies:** None (pytest tools already in use).

### Pitfalls to Avoid

- Mixing domain-specific quality rules into base contract rows (keep matrix at boundary level).
- Asserting unstable or incidental fields (focus on schema/behavior invariants only).
- Duplicating identical assertions across adapter-specific test files after matrix is introduced.

### Sample Matrix Sketch

```python
@pytest.mark.parametrize("domain", ["novel", "code"], ids=["novel", "code"])
def test_adapter_contract_create_initial_state(domain):
    adapter = WorkflowFactory.create_adapter(domain)
    state = adapter.create_initial_state("req", metadata={"trace": "x"})
    assert isinstance(state, dict)
    assert state

@pytest.mark.parametrize("domain", ["novel", "code"], ids=["novel", "code"])
def test_adapter_contract_evaluate_shape(domain):
    adapter = WorkflowFactory.create_adapter(domain)
    result = adapter.evaluate({})
    assert hasattr(result, "decision")
    assert hasattr(result, "total_score")
    assert isinstance(result.dimension_scores, dict)
```

---

## Follow-up Research Needed

- [ ] None for US-001; current context is sufficient for implementation.

---

## Checklist

- [x] All research topics investigated
- [x] Documentation consulted
- [x] Implementation recommendations documented
- [x] Pitfalls identified
- [x] Knowledge base updates drafted
