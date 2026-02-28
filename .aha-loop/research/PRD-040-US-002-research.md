# Research Report: PRD-040 US-002 - Cross-surface reason parity and deterministic ordering

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From PRD-040 US-002 `researchTopics`:

1. Cross-surface reason-attribution invariants established by PRD-039 that must remain stable
2. Best way to assert deterministic reason ordering and parity between machine report payload and release-readiness artifact

---

## Findings

### Topic 1: Stable invariants from PRD-039

`release_check_summary.main()` builds a single canonical `checks[]` list, then derives:

- `go_no_go_reasons = [check_id for check in checks if check.blocking and check.status != PASS]`
- `decision = GO` iff reason list empty, else `NO_GO`

Because report machine payload and release-readiness artifact both consume the same reduced output, regression risk is attribution drift from future refactors, not current reduction semantics.

### Topic 2: Deterministic ordering/parity guard

Most robust deterministic guard pattern:

- Force two blocking checks to `FAIL` in known list order.
- Keep at least one non-blocking check present and `PASS`.
- Assert exact reason list equality (`==`) across report payload and artifact.
- Assert non-blocking check exclusion from `go_no_go_reasons`.
- Assert parity by `check_id` on `priority/blocking/status/detail` for targeted rows.

This catches include/exclude drift, ordering drift, and cross-surface divergence simultaneously.

---

## Implementation Recommendations

1. Reuse deterministic test harness in `tests/unit/scripts/test_release_check_summary.py`.
2. Keep `checks[]`-order-aligned expectation for reasons.
3. Maintain strict equality assertions for reason lists on both surfaces.
4. Avoid production code changes; test-only hardening.

### Pitfalls to Avoid

- Avoid `contains`-only checks for reasons (misses ordering and extras).
- Avoid markdown snapshot assertions without machine payload assertions.

---

## Checklist

- [x] Cross-surface invariants mapped
- [x] Ordering/parity assertion strategy defined
- [x] Deterministic implementation path confirmed
