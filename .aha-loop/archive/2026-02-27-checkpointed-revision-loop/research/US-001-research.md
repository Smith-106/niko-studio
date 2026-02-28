# Research Report: US-001 - Define triage lifecycle states

**Date:** 2026-02-25
**Status:** Complete

---

## Research Topics

From PRD-012 `US-001.researchTopics`:

1. Current workflow status/step transition maps reusable for triage lifecycle constraints
2. Existing machine-checkable rejection payload and audit patterns for invalid transitions

---

## Findings

### Topic 1: Existing transition allowlists already provide canonical lifecycle policy primitives

**Summary:**
Workflow engine already centralizes runner and step lifecycle policies via explicit allowlists and guard functions. This pattern can be reused to define triage lifecycle states without introducing parallel or ad-hoc transition validators.

**Sources Consulted:**
- [x] Workflow transition maps and guard boundaries
- [x] Lifecycle action mapping and transition rejection behavior
- [x] Existing transition regression tests
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Canonical transition allowlists:
  - `src/workflow/workflow_engine.py:70`
  - `src/workflow/workflow_engine.py:83`
- Lifecycle action mapping and guard invocation:
  - `src/workflow/workflow_engine.py:1813`
  - `src/workflow/workflow_engine.py:1838`
- Deterministic transition rejection strings:
  - `src/workflow/workflow_engine.py:938`
  - `src/workflow/workflow_engine.py:1309`
- Existing transition-guard tests:
  - `tests/unit/workflow/test_workflow_engine.py:587`
  - `tests/unit/workflow/test_workflow_engine.py:1406`

**Implementation implications:**
- Define triage lifecycle states as explicit allowlists and route all transitions through one guard path.
- Keep policy centralized and deterministic to avoid drift between runtime response and persisted audit/state.

### Topic 2: Machine-checkable rejection payload + audit patterns are established and reusable

**Summary:**
Invalid transitions already emit deterministic machine-checkable rejection context in both response payload (`transition_rejection`) and audit events (`*_transition_rejected`, `gate_approval_trace`) including stable keys like `from`, `to`, `reason`, `reason_code` and trace linkage. This can be reused directly for triage transition rejection semantics.

**Sources Consulted:**
- [x] Transition rejection payload contracts in workflow engine
- [x] Gate approval trace/audit append boundaries
- [x] Existing audit-focused regression tests
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Lifecycle rejection response payload shape:
  - `src/workflow/workflow_engine.py:1846`
- Transition rejection audit events:
  - `src/workflow/workflow_engine.py:927`
  - `src/workflow/workflow_engine.py:1298`
- Additive gate approval trace event helper:
  - `src/workflow/workflow_engine.py:718`
  - `src/workflow/workflow_engine.py:735`
- Tests asserting machine-checkable rejection and approval trail:
  - `tests/unit/workflow/test_workflow_engine.py:593`
  - `tests/unit/workflow/test_workflow_engine.py:611`
  - `tests/unit/workflow/test_workflow_engine.py:1428`

**Implementation implications:**
- Reuse existing rejection payload vocabulary (`reason_code`, `from`, `to`) for triage state machine errors.
- Persist triage rejection and approval outcomes through existing audit append path; do not create a separate triage log channel.

---

## Implementation Recommendations

1. **Approach:**
   - Add explicit triage lifecycle states and allowed transitions in one canonical map.
   - Reuse the existing transition guard + audit path to reject invalid triage transitions with machine-checkable reasons.

2. **Pattern to Follow:**
   - Centralized allowlist policy + additive response/audit fields.
   - Deterministic reason-code vocabulary shared across runtime payload and audit evidence.

3. **Key Files to Modify (next phases):**
   - `src/workflow/workflow_engine.py`
   - `tests/unit/workflow/test_workflow_engine.py`

4. **Dependencies:**
   - Reuse existing workflow transition/audit primitives and state persistence boundaries.
   - No new dependencies required.

### Pitfalls to Avoid

- Splitting triage transition validation between multiple functions or layers.
- Using free-form text-only rejection messages without stable machine-checkable keys.
- Introducing parallel triage persistence artifacts that diverge from audit/state trace contracts.

---

## Exploration Decision Points

No major architecture split requiring parallel exploration was identified for US-001. Existing transition guard and audit primitives are sufficient for direct additive implementation.

---

## Checklist

- [x] Transition allowlist and guard boundaries mapped
- [x] Rejection payload + audit evidence patterns mapped
- [x] Additive implementation direction for triage lifecycle policy defined
- [x] Pitfalls identified
