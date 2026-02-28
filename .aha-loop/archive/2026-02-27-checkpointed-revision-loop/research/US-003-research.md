# Research Report: US-003 - Persist gate approval trail

**Date:** 2026-02-25
**Status:** Complete

---

## Research Topics

From PRD-011 `US-003.researchTopics`:

1. Existing risk gate decision payload and confirmation token flow
2. Audit log/event append path for deterministic gate decision evidence

---

## Findings

### Topic 1: Risk gate decision/confirmation flow is already centralized with deterministic payload shape

**Summary:**
Gate decisions are produced in one canonical method (`_evaluate_risk_gate`) and consumed in `execute(...)` with deterministic response payload (`decision`, `reason`, `blocking`, `confirm_required`, `confirmed`). Confirmation flow already emits `confirm_trace` audit events, redacts token values, and returns stable machine fields suitable for approval trail persistence.

**Sources Consulted:**
- [x] Risk gate evaluation and execute integration
- [x] Confirmation trace and token-redaction behavior
- [x] Existing gate-flow regression tests
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Canonical risk gate evaluation output:
  - `src/workflow/workflow_engine.py:971`
  - `src/workflow/workflow_engine.py:1010`
- Gate decision + confirmation handling in execution path:
  - `src/workflow/workflow_engine.py:1951`
  - `src/workflow/workflow_engine.py:1968`
  - `src/workflow/workflow_engine.py:2020`
- Redaction and token handling:
  - `src/workflow/workflow_engine.py:953`
  - `src/workflow/workflow_engine.py:956`
- Existing test coverage for confirm-trace behavior:
  - `tests/unit/workflow/test_workflow_engine.py:1283`
  - `tests/unit/workflow/test_workflow_engine.py:1301`

**Implementation implications:**
- Approval trail should be additive metadata over existing gate output/audit flow, not a parallel gate state store.
- Persist approval context using stable machine keys (decision, confirmed, reason, reason_code, actor/source) with deterministic mapping.

### Topic 2: Audit append path already provides deterministic persistence boundary for gate evidence

**Summary:**
Audit persistence is centralized via `_append_audit_event(...)` and backed by `SessionManager.append_audit(...)`, producing deterministic per-event JSON lines. Multiple gate-related events (`confirm_trace`, `wave_gate_trace`, `runner_state_transition_rejected`) already use this path, which is the right boundary for a persisted approval trail linked to session/plan trace identifiers.

**Sources Consulted:**
- [x] Audit append implementation and state artifact mapping
- [x] Existing gate-related audit events
- [x] Existing audit assertions in workflow tests
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Audit append boundary:
  - `src/workflow/workflow_engine.py:702`
  - `src/workflow/workflow_engine.py:710`
- State artifact trace anchors (`state_trace_id`, audit artifact path):
  - `src/workflow/workflow_engine.py:735`
  - `src/workflow/workflow_engine.py:774`
- Existing gate evidence events:
  - `src/workflow/workflow_engine.py:1970`
  - `src/workflow/workflow_engine.py:2058`
  - `src/workflow/workflow_engine.py:1265`
- Existing test assertions over audit persistence:
  - `tests/unit/workflow/test_workflow_engine.py:599`
  - `tests/unit/workflow/test_workflow_engine.py:603`
  - `tests/unit/workflow/test_workflow_engine.py:1363`

**Implementation implications:**
- Persist gate approval trail as additive audit event payload fields with deterministic reason codes and trace linkage (`plan_id`, `session_id`, `state_trace_id`/step identifiers).
- Keep event append path singular and deterministic to avoid duplicate or divergent approval evidence channels.

---

## Implementation Recommendations

1. **Approach:**
   - Introduce additive gate approval trail payloads/events at existing gate decision boundaries (`confirm_trace` + lifecycle transition rejection boundary + wave gate boundary).
   - Ensure each approval/rejection carries machine-checkable fields (`decision`, `reason_code`, `confirmed`, `action`, `from`, `to`, deterministic trace refs).

2. **Pattern to Follow:**
   - Reuse `_append_audit_event(...)` as the sole persistence route for gate evidence.
   - Preserve existing response and audit event contracts; only append optional fields.

3. **Key Files to Modify (next phases):**
   - `src/workflow/workflow_engine.py`
   - `tests/unit/workflow/test_workflow_engine.py`

4. **Dependencies:**
   - Reuse existing session trace/artifact boundaries and gate decision helpers.
   - No new dependencies required.

### Pitfalls to Avoid

- Adding a second approval datastore outside audit/state persistence primitives.
- Storing approval reasons only in free-form text without stable reason codes.
- Emitting non-deterministic payload keys/order that weakens machine parsing and regression assertions.

---

## Exploration Decision Points

No major architecture split requiring parallel exploration was identified for US-003. Existing gate decision flow + audit append boundaries are sufficient for direct additive implementation.

---

## Checklist

- [x] Risk gate decision + confirmation token flow mapped
- [x] Canonical audit append path and gate-evidence events mapped
- [x] Additive approval trail persistence strategy defined
- [x] Pitfalls identified
