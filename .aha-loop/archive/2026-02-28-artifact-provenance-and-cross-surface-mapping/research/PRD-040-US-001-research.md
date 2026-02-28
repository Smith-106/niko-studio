# Research Report: PRD-040 US-001 - Deterministic reason attribution include/exclude invariants

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

1. Decision reduction path for `go_no_go_reasons`
2. Regression guard pattern for mixed blocking outcomes

---

## Findings

### Topic 1: Decision reduction path

`release_check_summary.main()` reduces release decision using blocking checks only:

- `no_go_reasons = [check_id for check in checks if check.blocking and check.status != PASS]`
- `decision = GO` iff `no_go_reasons` is empty, else `NO_GO`

This is the canonical semantic contract and must stay unchanged.

### Topic 2: Mixed-outcome guard pattern

A deterministic regression guard should assert exact include/exclude behavior under mixed outcomes:

- One blocking signal FAIL, peers PASS.
- `go_no_go_reasons` contains only the failing blocking check(s).
- Non-failing blocking checks must be excluded.
- Report payload and release-readiness artifact must agree.

---

## Implementation Recommendations

1. Add deterministic US-001 test in `tests/unit/scripts/test_release_check_summary.py`.
2. Stub one blocking signal as `FAIL` and keep other blocking peers `PASS`.
3. Assert exact reason set equality (not contains-only) across both surfaces.
4. Keep parity assertions by `check_id` for core blocker rows.

### Pitfalls to Avoid

- Avoid changing reduction logic in production code.
- Avoid broad markdown-only assertions that miss machine payload equivalence.

---

## Checklist

- [x] Decision reduction contract mapped
- [x] Mixed-outcome include/exclude strategy defined
- [x] Deterministic test direction confirmed
