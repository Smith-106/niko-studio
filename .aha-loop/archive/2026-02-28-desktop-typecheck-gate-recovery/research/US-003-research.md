# Research Report: US-003 - Keep post-refresh policy-runtime conformance passing

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Current policy-runtime conformance signal dependencies on evidence outputs
2. Regression checks needed to prove release semantics are unchanged after refresh

---

## Findings

### Topic 1: Policy-runtime conformance dependencies

**Summary:**
`runtime_policy_conformance_signal` is a P0 blocking check and directly participates in final GO/NO_GO reduction.

**Code-level dependencies observed:**
- `scripts/release_check_summary.py:1322` invokes `runtime_policy_conformance_signal()`.
- `scripts/release_check_summary.py:1426-1432` injects it into checks as `priority=P0`, `blocking=true`.
- `scripts/release_check_summary.py:1619-1624` applies deterministic reduction (`blocking && status!=PASS` => NO_GO reason).

### Topic 2: Regression checks for unchanged release semantics

**Summary:**
Post-refresh safety requires asserting both conformance check status and final reduction outputs across report payload and artifact, without altering policy contract logic.

**Required guard assertions:**
- `runtime_policy_conformance_signal` row remains `P0`, `blocking=true`, `status=PASS`.
- `decision` remains `GO` and `go_no_go_reasons=[]` when all blocking checks pass.
- `runtime_policy_conformance_signal` is not incorrectly included in `go_no_go_reasons` under PASS state.

---

## Implementation Recommendations

1. Add a main-path deterministic test on `release_summary.main()` under all-pass stubs.
2. Parse report machine payload + artifact checks and assert runtime-policy row invariants (`P0`, blocking, PASS).
3. Assert final reduction invariants remain `GO` with empty reasons.
4. Keep release policy semantics unchanged (test-only coverage additions).

### Pitfalls to Avoid

- Do not overfit to command-output text when machine payload/artifact contracts already capture required semantics.
- Do not downgrade blocking semantics for runtime policy checks.

---

## Checklist

- [x] Runtime policy dependency chain mapped
- [x] Deterministic semantic-preservation assertions defined
- [x] Test-only implementation strategy confirmed
