# Research Report: US-002 - Enforce deterministic handoff transitions

**Date:** 2026-02-25
**Status:** Complete

---

## Research Topics

From PRD-011 `US-002.researchTopics`:

1. Current runner transition guards and lifecycle state machine constraints
2. Existing handoff package generation and blocked/pending transition semantics

---

## Findings

### Topic 1: Transition policy is already centralized and deterministic

**Summary:**
Workflow lifecycle and step transitions are governed by explicit allowlists in one canonical path. Invalid transitions are rejected with stable error messages, and step rejections are also appended to audit events with machine-checkable payload fields (`from`, `to`, `reason`).

**Sources Consulted:**
- [x] Workflow engine transition maps
- [x] Transition guard implementation
- [x] Existing lifecycle/transition regression tests
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Central allowlist definitions:
  - `src/workflow/workflow_engine.py:70`
  - `src/workflow/workflow_engine.py:83`
- Runner transition guard + deterministic failure string:
  - `src/workflow/workflow_engine.py:1255`
  - `src/workflow/workflow_engine.py:1259`
- Step transition rejection audit payload + deterministic failure string:
  - `src/workflow/workflow_engine.py:908`
  - `src/workflow/workflow_engine.py:919`
- Existing regression assertions:
  - `tests/unit/workflow/test_workflow_engine.py:587`
  - `tests/unit/workflow/test_workflow_engine.py:591`
  - `tests/unit/workflow/test_workflow_engine.py:1344`
  - `tests/unit/workflow/test_workflow_engine.py:1352`

**Implementation implications:**
- Reuse `_set_runner_state(...)` and `_transition_step_state(...)` as the only authoritative transition-guard paths.
- Extend rejection responses additively with machine-checkable reason payloads instead of adding parallel validation branches.

### Topic 2: Handoff package already encodes deterministic pending/blocked semantics

**Summary:**
Handoff generation is centralized in `_create_handoff_package(...)` and persisted through `_persist_handoff_package(...)`. Pending steps are computed from non-`done` states, and blocked semantics are derived deterministically from `status == "failed"`. Current ownership metadata (`stage_owner`, `ownership_model`, `phase_owners`) is already included and tested.

**Sources Consulted:**
- [x] Handoff package assembly/persistence implementation
- [x] Lifecycle triggers that emit handoff package
- [x] Existing handoff payload regression tests
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Handoff package assembly and blocked derivation:
  - `src/workflow/workflow_engine.py:444`
  - `src/workflow/workflow_engine.py:454`
  - `src/workflow/workflow_engine.py:469`
- Handoff persistence + audit emission:
  - `src/workflow/workflow_engine.py:486`
  - `src/workflow/workflow_engine.py:538`
- Lifecycle trigger points (`pause`/`stop`):
  - `src/workflow/workflow_engine.py:1831`
  - `src/workflow/workflow_engine.py:1832`
- Existing payload assertions:
  - `tests/unit/workflow/test_workflow_engine.py:594`
  - `tests/unit/workflow/test_workflow_engine.py:601`
  - `tests/unit/workflow/test_workflow_engine.py:603`
  - `tests/unit/workflow/test_workflow_engine.py:605`

**Implementation implications:**
- Keep handoff transition policy in the existing lifecycle path, and derive blocked/pending semantics from canonical step state only.
- For invalid lifecycle actions/transitions, return machine-checkable rejection structure while preserving existing deterministic fields and handoff payload contract.

---

## Implementation Recommendations

1. **Approach:**
   - Introduce one additive transition validation adapter around existing guard calls (`_set_runner_state`, `_transition_step_state`) so all rejection reasons come from a single path.
   - Keep error output deterministic and machine-checkable by encoding rejection reason keys in lifecycle/step rejection responses.

2. **Pattern to Follow:**
   - Preserve explicit transition allowlists as canonical policy source.
   - Preserve additive schema evolution: add optional rejection metadata fields, do not alter existing handoff/state envelope keys.

3. **Key Files to Modify (next phases):**
   - `src/workflow/workflow_engine.py`
   - `tests/unit/workflow/test_workflow_engine.py`

4. **Dependencies:**
   - Reuse current state snapshot + audit + handoff package pipelines.
   - No new external dependencies required.

### Pitfalls to Avoid

- Splitting transition validation logic across multiple code paths.
- Encoding rejection causes only in free-form strings without stable reason keys.
- Introducing a second handoff store or alternate blocked/pending derivation logic.

---

## Exploration Decision Points

No major architecture split requiring parallel exploration was identified for US-002. Existing transition maps, lifecycle guards, and handoff assembly paths are sufficient for direct additive implementation.

---

## Checklist

- [x] Runner/step transition allowlist and guard path mapped
- [x] Invalid transition rejection behavior + current tests mapped
- [x] Handoff pending/blocked semantics and trigger points mapped
- [x] Additive implementation direction and pitfalls captured
