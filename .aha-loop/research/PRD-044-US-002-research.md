# Research Report: PRD-044 US-002 - Activation/closure lifecycle sequence remains auditable and stable

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Lifecycle changelog event ordering patterns for `prd_completed` / `prd_activated` / `current_prd_updated`
2. Deterministic assertion strategy for activation/closure sequence stability

---

## Findings

### Topic 1: Lifecycle changelog ordering patterns

**Summary:**
The roadmap lifecycle contract is represented in `.aha-loop/project.roadmap.json` changelog with repeated transition windows. For the current active transition (`PRD-043 -> PRD-044`), the expected auditable order is:

1. `prd_completed` for previous PRD
2. `prd_activated` for next PRD
3. `current_prd_updated` for next PRD

**Data Evidence:**
- Current pointer and active PRD: `.aha-loop/project.roadmap.json:5-6`
- Active M12 PRD set with `PRD-044` in progress: `.aha-loop/project.roadmap.json:643-651`
- Current transition window (`PRD-043 -> PRD-044`): `.aha-loop/project.roadmap.json:658-673`

**Observed pattern constraints:**
- `prd_activated.prdId` must equal `current_prd_updated.prdId` within one transition window.
- `prd_completed.prdId` must be different from target activated PRD in the same window.
- Timestamp ordering should be monotonic within a window (`completed <= activated <= current_prd_updated`).

### Topic 2: Deterministic assertion strategy for sequence stability

**Summary:**
The most stable guard strategy is transition-window assertions (local invariants) rather than global full-history ordering assertions. This prevents brittle failures from unrelated historic changelog tail growth while still catching semantic drift.

**Existing test surface context:**
- Pointer transition order guard: `tests/unit/scripts/test_release_check_summary.py:2384`
- Contradictory pointer-state detection guard: `tests/unit/scripts/test_release_check_summary.py:2413`

**Gap identified for US-002:**
- No deterministic repeated-window lifecycle stability guard that validates two or more transition windows with identical contract shape.

---

## Implementation Recommendation

1. Add a deterministic multi-window lifecycle guard test in `tests/unit/scripts/test_release_check_summary.py`:
   - Build two transition windows with the same action contract.
   - Assert action order per window is exactly:
     `prd_completed -> prd_activated -> current_prd_updated`.
   - Assert `activated.prdId == current_prd_updated.prdId` and `completed.prdId != activated.prdId`.
2. Keep assertions ID-keyed and window-scoped; avoid full changelog global position constraints.
3. Re-run targeted release summary tests including existing pointer and non-blocking WARN semantic invariance checks to prevent regression.

---

## Risks / Pitfalls

- Enforcing total-order on the entire historical changelog can become flaky when archival events are prepended/appended.
- Validating only action names without `prdId` relationships can miss lifecycle mismatch regressions.
- Using strict absolute-path/line-position assumptions in governance tests increases brittleness without additional contract value.

---

## Checklist

- [x] Research topics investigated
- [x] Lifecycle ordering pattern mapped
- [x] Deterministic strategy selected (window-scoped, ID-keyed)
- [x] Implementation guidance documented
