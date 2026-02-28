# Research Report: PRD-043 US-001 - Session trace continuity stays stable across routed execution paths

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Session/run/state trace propagation path in workflow engine state persistence and gate approval traces
2. Existing deterministic continuity tests for session_id, run_id, checkpoint_trace, and state_trace_id

---

## Findings

### Topic 1: Session/run/state trace propagation path

**Summary:**
Trace continuity in workflow runtime is anchored by a stable per-plan session ID, persisted state snapshot trace IDs, and gate approval trace references. The critical link is `_approval_trace_ref` reading `state_trace_id` from persisted state and writing it into gate approval events.

**Code Evidence:**
- Session identity source: `src/workflow/workflow_engine.py:718`
- State snapshot trace generation (`state_trace_id`): `src/workflow/workflow_engine.py:838`
- Persisted state write path: `src/workflow/workflow_engine.py:871`
- Resume metadata read (`state_trace_id`): `src/workflow/workflow_engine.py:921`
- Gate trace payload (`session_id/run_id/state_trace_id`): `src/workflow/workflow_engine.py:744`

### Topic 2: Existing deterministic continuity test coverage

**Summary:**
Current tests already cover key continuity fragments (session-id stability, snapshot run trace, checkpoint trace persistence), but lacked a direct assertion that gate approval trace continuity aligns with persisted state snapshot trace in the same waiting-confirmation boundary.

**Code Evidence:**
- Session ID determinism: `tests/unit/workflow/test_workflow_engine.py:100`
- Generation snapshot trace (`session_id/run_id`) checks: `tests/unit/workflow/test_workflow_engine.py:237`
- State snapshot + `state_trace_id` checks: `tests/unit/workflow/test_workflow_engine.py:1763`
- Checkpoint trace persistence checks: `tests/unit/workflow/test_workflow_engine.py:1809`

**Gap Identified:**
- Missing direct guard for `gate_approval_trace.payload.trace.state_trace_id` parity against persisted `.data/state.json` and runtime return surface under waiting-confirmation path.

---

## Implementation Recommendation

1. Add a deterministic test at workflow engine level for waiting-confirmation flow:
   - Trigger waiting confirmation with destructive recommendation.
   - Capture latest gate approval event.
   - Assert trace parity:
     - `trace.session_id == _session_id_for_plan(plan_id)`
     - `trace.run_id == f"run-{plan_id}"`
     - `trace.state_trace_id == persisted_state.state_trace_id`
     - `trace.state_trace_id == execute_result.state_trace_id`
2. Keep assertions ID-based and schema-focused (no temp-path strictness) to avoid brittleness.

---

## Risks / Pitfalls

- Verifying only session/run IDs may miss state trace drift after persistence refactors.
- Verifying only state payload may miss gate-surface divergence.
- Over-asserting audit event ordering across unrelated events can cause brittle failures.

---

## Checklist

- [x] Research topics investigated
- [x] Trace propagation path mapped
- [x] Existing tests audited
- [x] Missing continuity guard identified
- [x] Implementation guidance documented
