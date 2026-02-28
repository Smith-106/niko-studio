# Research Report: US-003 - Harden observability without changing GO/NO_GO semantics

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Decision reduction paths that consume provenance-linked blocker data
2. Regression guard patterns for preserving GO/NO_GO policy behavior

---

## Findings

### Topic 1: Decision reduction paths

**Summary:**
Release decision reduction is a strict, centralized contract in `release_check_summary.main()`.

**Contract path:**
- `checks[]` is assembled from all signals, including provenance-related linkage rows and blocking P0 signals.
- `no_go_reasons` is reduced as: `check.blocking == true and check.status != PASS`.
- `decision` is `GO` iff `no_go_reasons` is empty, otherwise `NO_GO`.

This means observability/provenance hardening must not alter blocking flags or status semantics for existing checks unless explicitly intended.

### Topic 2: Regression guard patterns

**Summary:**
Safe guard patterns for US-003 should validate attribution precision under mixed outcomes and ensure unaffected checks are not falsely attributed in blocker reasons.

**Recommended regression assertions:**
- Force one blocking provenance-related signal to FAIL while key P0 peers PASS.
- Assert `decision == NO_GO` and `go_no_go_reasons` contains only the failing blocking check(s).
- Assert non-failing blocking checks remain excluded from `go_no_go_reasons`.
- Keep checks cross-surface aligned via report payload + artifact verification.

---

## Implementation Recommendations

1. Add US-003 mixed-outcome deterministic test in `test_release_check_summary.py`.
2. Stub deterministic outputs so only one chosen blocking signal fails (e.g., `evidence_completeness_blocker_signal=FAIL`) while others pass.
3. Assert both surfaces:
   - `decision=NO_GO`
   - reason inclusion/exclusion set is precise.
4. Preserve existing policy semantics; test-only changes.

### Pitfalls to Avoid

- Avoid modifying blocking flags or decision code path while adding observability assertions.
- Avoid over-broad assertions that only check decision and miss reason attribution precision.

---

## Checklist

- [x] Decision reduction dependency path mapped
- [x] Regression guard strategy defined
- [x] US-003 deterministic implementation direction confirmed
