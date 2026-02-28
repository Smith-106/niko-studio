# Research Report: PRD-046 US-002 - Completion timestamp monotonicity is machine-verifiable

**Date:** 2026-02-29
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Monotonicity constraints between prd `completedAt`/milestone `completedAt` and lifecycle changelog timestamps
2. Deterministic failure scenarios for timestamp drift detection

---

## Findings

### Topic 1: Monotonicity constraints

**Summary:**
For closure auditability, timestamp consistency should be asserted on two linked surfaces:

- PRD closure surface: `prd.completedAt` must align with the matching `changelog` event where `action=prd_completed` and `prdId` matches.
- Milestone closure surface: `milestone.completedAt` must not be earlier than the latest child PRD `completedAt` among completed children.

**Current evidence (M13):**
- `PRD-045.completedAt`: `.aha-loop/project.roadmap.json:673` (`2026-02-29T02:10:00Z`)
- Matching changelog event: `.aha-loop/project.roadmap.json:702-705` (`prd_completed`, `prdId=PRD-045`, same timestamp)

These show the intended machine-checkable contract:
- `prd.completedAt == timestamp(prd_completed where prdId == prd.id)`
- `milestone.completedAt >= max(child_prd.completedAt)` (when milestone is completed)

### Topic 2: Deterministic drift-detection scenarios

**Summary:**
The strongest deterministic drift guards are local and ID-keyed:

1. PRD-level mismatch: `completedAt` differs from its own `prd_completed` timestamp.
2. Milestone-level non-monotonicity: `milestone.completedAt` earlier than latest completed child PRD timestamp.

These should be asserted with fixed ISO timestamps and no dependency on full-history changelog ordering.

---

## Implementation Recommendation

1. Add PRD timestamp-alignment tests in `tests/unit/scripts/test_release_check_summary.py`:
   - one aligned control case,
   - one drift-detection case.
2. Add milestone monotonicity tests:
   - one non-drift control (`milestone.completedAt >= max(child completedAt)`),
   - one non-monotonic drift case (`milestone.completedAt < max(child completedAt)`).
3. Keep assertions deterministic:
   - fixed ISO-8601 `Z` timestamps,
   - PRD-ID keyed event matching,
   - local transition scope only.

---

## Risks / Pitfalls

- Matching `prd_completed` by position instead of `prdId` can misclassify drift when changelog grows.
- Comparing milestone timestamp against pending/no-completion children introduces noisy false positives.
- Mixing unrelated historical completion events weakens deterministic guarantees.

---

## Checklist

- [x] Research topics investigated
- [x] Monotonicity constraints formalized
- [x] Deterministic drift scenarios defined
- [x] Test-oriented implementation guidance documented
