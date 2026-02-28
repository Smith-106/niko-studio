# Research Report: PRD-046 US-001 - Root updatedAt reflects lifecycle updates deterministically

**Date:** 2026-02-29
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. `updatedAt` synchronization patterns between root roadmap metadata and changelog transitions
2. Deterministic assertions for stale-`updatedAt` detection under repeated lifecycle updates

---

## Findings

### Topic 1: updatedAt synchronization patterns

**Summary:**
`project.roadmap.json` uses root-level `updatedAt` as the coarse timeline marker, while transition details are recorded in `changelog` (`prd_completed`, `prd_activated`, `current_prd_updated`).

For deterministic governance, `updatedAt` should be synchronized with the latest lifecycle transition batch timestamp.

**Current evidence:**
- Root `updatedAt`: `.aha-loop/project.roadmap.json:8` (`2026-02-29T02:10:00Z`)
- Latest transition batch (`PRD-045 -> PRD-046`): `.aha-loop/project.roadmap.json:702-717` (`2026-02-29T02:10:00Z`)

This alignment demonstrates the intended invariant:
- `updatedAt >= max(changelog transition timestamps in latest batch)`

### Topic 2: stale-updatedAt detection strategy

**Summary:**
Stale-`updatedAt` drift appears when lifecycle events advance but root metadata does not. The strongest deterministic guard is to compare:

1. latest relevant transition timestamp,
2. root `updatedAt`,
3. active pointer transition (`current_prd_updated`) target consistency.

Existing lifecycle tests already cover ordering/identity/duplication/contradiction behavior:
- `tests/unit/scripts/test_release_check_summary.py:2444`
- `tests/unit/scripts/test_release_check_summary.py:2522`
- `tests/unit/scripts/test_release_check_summary.py:2616`
- `tests/unit/scripts/test_release_check_summary.py:2658`

Gap for US-001:
- Missing explicit deterministic stale-`updatedAt` guard test.

---

## Implementation Recommendation

1. Add `updatedAt` freshness guard test in `tests/unit/scripts/test_release_check_summary.py`:
   - Build payload where latest `current_prd_updated.timestamp` is newer than root `updatedAt`.
   - Assert stale condition is detected.
2. Add non-stale control case:
   - `updatedAt` equals latest transition timestamp and guard passes.
3. Keep checks local and deterministic:
   - Use fixed ISO timestamps and ID-keyed transition windows.

---

## Risks / Pitfalls

- Comparing against unrelated historical events can produce false stale signals.
- Using only `prd_completed` without pointer update may miss active-state drift.
- Global-history positional assumptions are brittle as changelog grows.

---

## Checklist

- [x] Research topics investigated
- [x] updatedAt synchronization invariant identified
- [x] stale-updatedAt deterministic guard strategy defined
- [x] Implementation guidance documented
