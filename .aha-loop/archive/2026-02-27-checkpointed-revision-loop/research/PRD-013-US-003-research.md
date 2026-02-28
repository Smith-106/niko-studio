# Research Report: PRD-013 / US-003 - Artifact contract parity for UI-triggered runs

**Date:** 2026-02-26
**Status:** Complete

---

## Research Topics

From PRD-013 `US-003.researchTopics`:

1. Existing evidence artifact envelope invariants and deterministic detail serialization
2. Gateway observability payload fields required for parity verification

---

## Findings

### Topic 1: Workflow/UI bridge parity should be asserted as envelope equivalence, not only endpoint reachability

**Summary:**
US-001/US-002 already established forwarding endpoints and stage-control semantic pass-through. For US-003, parity must be machine-checkable as contract-equivalent response envelopes between canonical `/workflow/*` and bridge `/ui/workflow/*` handlers for the same backend return payload.

**Sources Consulted:**
- [x] Existing workflow endpoint handler contracts in gateway
- [x] Existing UI bridge tests and semantic pass-through assertions
- [x] Existing deterministic status/rejection envelope fields in workflow engine
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Canonical workflow endpoint handlers:
  - `src/mcp/gateway.py:2760`
  - `src/mcp/gateway.py:2766`
  - `src/mcp/gateway.py:2776`
  - `src/mcp/gateway.py:2787`
- UI bridge forwarding handlers:
  - `src/mcp/gateway.py:2806`
  - `src/mcp/gateway.py:2812`
  - `src/mcp/gateway.py:2818`
  - `src/mcp/gateway.py:2824`
- Existing bridge behavior tests:
  - `tests/unit/mcp/test_gateway_endpoints.py:1873`
  - `tests/unit/mcp/test_gateway_endpoints.py:1927`
  - `tests/unit/mcp/test_gateway_endpoints.py:1961`

**Implementation implications:**
- Add explicit parity tests comparing decoded JSON payloads from `/workflow/*` and `/ui/workflow/*` handlers under the same mocked backend return payload.
- Keep assertions deterministic (exact dict equality on key/value envelope), avoiding order-sensitive string assertions.

### Topic 2: Observability/rejection fields already provide deterministic parity anchors

**Summary:**
Workflow engine surfaces machine-checkable fields such as `status`, `gate`, `transition_rejection`, `runner_state`, and related reason codes. These fields are suitable as stable parity anchors for US-003 contract checks.

**Sources Consulted:**
- [x] Workflow engine transition and gate response payload boundaries
- [x] Existing workflow tests for rejection/waiting-confirmation envelopes
- [x] Gateway route/execute/lifecycle endpoint payload relay behavior
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Transition/gate payload boundaries:
  - `src/workflow/workflow_engine.py:2042`
  - `src/workflow/workflow_engine.py:2207`
- Existing deterministic payload tests:
  - `tests/unit/workflow/test_workflow_engine.py:627`
  - `tests/unit/workflow/test_workflow_engine.py:875`
- Runtime transport error boundary baseline:
  - `src/cli/commands/runtime.py:19`
  - `src/cli/commands/runtime.py:53`

**Implementation implications:**
- Use these canonical fields in parity test fixtures to ensure UI-triggered results are contract-equivalent with CLI-triggered (workflow endpoint) results.
- Keep bridge disabled-mode checks separate from parity checks (parity applies to enabled forwarding path).

---

## Implementation Recommendations

1. **Approach:**
   - Implement parity tests that invoke both canonical and bridge handlers with identical mocked backend payloads and compare response JSON for equality.

2. **Pattern to Follow:**
   - Machine-checkable parity = `json(workflow_endpoint_response) == json(ui_bridge_endpoint_response)`.
   - Cover representative envelopes: normal execution, waiting confirmation, transition rejection.

3. **Key Files to Modify (next phase):**
   - `tests/unit/mcp/test_gateway_endpoints.py`
   - `.aha-loop/prd.json`
   - `.aha-loop/project.roadmap.json`

4. **Dependencies:**
   - Existing bridge forwarding handlers and UI toggle guard.
   - Existing workflow engine deterministic payload semantics.

### Pitfalls to Avoid

- Verifying only status code and not payload contract equivalence.
- Coupling parity tests to non-deterministic fields (timestamps, mutable trace ids).
- Mixing disabled-bridge behavior with parity equivalence assertions.

---

## Exploration Decision Points

No major architecture split requiring exploration was identified for US-003. Existing handler and payload contracts are sufficient for additive parity checks.

---

## Checklist

- [x] Artifact envelope parity verification anchors mapped
- [x] Gateway observability/rejection payload fields mapped
- [x] Machine-checkable parity assertion strategy defined
- [x] Pitfalls identified
