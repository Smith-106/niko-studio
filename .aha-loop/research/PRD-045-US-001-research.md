# Research Report: PRD-045 US-001 - Lifecycle event ordering and identity stay deterministic under repeated updates

**Date:** 2026-02-29
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Lifecycle transition-window patterns for `prd_completed`/`prd_activated`/`current_prd_updated` under repeated updates
2. Deterministic ID-keyed assertion strategies for lifecycle event identity linkage

---

## Findings

### Topic 1: Transition-window patterns under repeated updates

**Summary:**
Current roadmap lifecycle traces use repeated transition windows where each window should preserve stable local ordering and identity linkage:

`prd_completed -> prd_activated -> current_prd_updated`

Under repeated updates, reliability is highest when each window is validated independently (window-scoped invariants) instead of relying on global historical position.

**Data Evidence:**
- Active window bootstrap for current M13/PRD-045 activation exists in `.aha-loop/project.roadmap.json:702-738`.
- Prior windows (`PRD-043 -> PRD-044`, `PRD-042 -> PRD-043`) preserve the same action contract shape in `.aha-loop/project.roadmap.json:759-789`.

**Invariants observed:**
- `activated.prdId == current_prd_updated.prdId` within a window.
- `completed.prdId != activated.prdId` within a window.
- Action order remains deterministic within each transition window.

### Topic 2: ID-keyed assertion strategies for identity linkage

**Summary:**
Existing guard style in release-summary tests already favors deterministic contract assertions at local scope:
- pointer order guard: `tests/unit/scripts/test_release_check_summary.py:2384`
- contradiction detection guard: `tests/unit/scripts/test_release_check_summary.py:2413`
- multi-window lifecycle stability guard: `tests/unit/scripts/test_release_check_summary.py:2444`

The strongest next-step strategy is to explicitly assert per-window PRD-ID linkage parity and ensure repeated pass extraction is identical (idempotent extraction), while keeping tests insensitive to unrelated historical changelog growth.

---

## Implementation Recommendation

1. Add deterministic repeated-window extraction guard in `tests/unit/scripts/test_release_check_summary.py`:
   - Build changelog payload with at least two transition windows.
   - Parse transition windows via `prd_completed` anchors.
   - Assert each window action order is exact and ID linkage is valid.
2. Add identity-stability assertion:
   - Running the same extraction/parity mapping twice yields identical structured window tuples.
3. Keep assertions window-scoped and ID-keyed; avoid brittle full-history global index assertions.

---

## Risks / Pitfalls

- Full-history positional assertions become brittle as changelog grows and prepends new events.
- Action-name-only checks miss identity drift (`activated.prdId` vs `current_prd_updated.prdId` mismatch).
- Over-constraining unrelated event types in the same changelog can cause false negatives.

---

## Checklist

- [x] Research topics investigated
- [x] Transition-window patterns mapped
- [x] ID-keyed deterministic assertion strategy selected
- [x] Implementation guidance documented
