# Research Report: PRD-047 US-001 - Lifecycle regression evidence exports remain deterministic

**Date:** 2026-02-29
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Deterministic export contracts between lifecycle transition windows and release readiness artifact checks
2. Repeated-run assertion strategy for lifecycle evidence export parity across report and artifact surfaces

---

## Findings

### Topic 1: Export contract between lifecycle windows and release artifacts

**Summary:**
The existing release summary suite already enforces machine payload ↔ artifact parity by `check_id` (`priority`, `blocking`, `status`, `detail`) and deterministic reason-list contracts.

For lifecycle regression evidence export, deterministic guarantees should follow the same contract style:

- lifecycle transition evidence extracted in local windows (`prd_completed -> prd_activated -> current_prd_updated`),
- parity asserted across output surfaces using stable IDs.

**Relevant existing contract anchors:**
- `tests/unit/scripts/test_release_check_summary.py:2234-2256` (repeated-run `check_id` parity)
- `tests/unit/scripts/test_release_check_summary.py:2350-2359` (reason-list parity and blocking semantics)
- `tests/unit/scripts/test_release_check_summary.py:2444-2519` (lifecycle transition-window identity/order invariants)

### Topic 2: Repeated-run parity strategy

**Summary:**
The strongest deterministic repeated-run strategy is:

1. compare report/artifact surfaces by `check_id` maps,
2. assert stable tuple identity across repeated extraction passes,
3. allow only expected temporal drift (`generated_at`) while preserving structural parity.

This keeps evidence export auditable without brittle dependence on full changelog position.

---

## Implementation Recommendation

1. Add lifecycle evidence export determinism tests in `tests/unit/scripts/test_release_check_summary.py` using:
   - local transition-window tuples,
   - repeated-pass tuple equality checks,
   - `check_id` parity map assertions.
2. Keep invariants local and ID-keyed:
   - never rely on absolute changelog indices,
   - match by `prdId` + `action` contracts.
3. Preserve existing GO/NO_GO semantics:
   - export evidence checks must not mutate blocking decision reduction behavior.

---

## Risks / Pitfalls

- Global-history positional assertions become brittle as changelog grows.
- Mixing lifecycle and non-lifecycle evidence rows without stable IDs can hide drift.
- Repeated-run checks that ignore payload/artifact map parity may miss export regressions.

---

## Checklist

- [x] Research topics investigated
- [x] Deterministic export contract identified
- [x] Repeated-run parity strategy defined
- [x] Implementation guidance documented
