# Research Report: PRD-047 US-002 - Changelog/artifact parity drift is detected early

**Date:** 2026-02-29
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Failure scenarios where changelog lifecycle transitions and release artifact mappings diverge
2. Deterministic guard patterns for missing, mismatched, or contradictory parity rows

---

## Findings

### Topic 1: Divergence failure scenarios

**Summary:**
Parity drift can occur even when decision semantics still look stable. The highest-signal divergence scenarios are:

1. Changelog transition tuples are valid, but artifact-side lifecycle parity row has mismatched detail fields.
2. Payload contains lifecycle parity check rows that artifact misses (or vice versa).
3. GO reason lists remain empty while lifecycle parity rows silently diverge.

Existing suite already provides strong parity contract patterns:
- `payload_map` ↔ `artifact_map` comparison by `check_id`
- stable `go_no_go_reasons` parity across surfaces

These should be reused for lifecycle-specific export checks.

### Topic 2: Deterministic guard patterns

**Summary:**
Deterministic drift detection is strongest with:

- ID-keyed checks (`check_id`) instead of positional ordering,
- explicit row-presence assertions on both surfaces,
- exact field equality checks (`priority`, `blocking`, `status`, `detail`),
- reason-list parity assertions as a separate invariant.

This prevents silent parity regression under changelog growth and repeated runs.

---

## Implementation Recommendation

1. Add a lifecycle export parity drift test in `tests/unit/scripts/test_release_check_summary.py` that:
   - defines aligned payload/artifact check rows,
   - introduces one deterministic mismatch (e.g., `detail`) on artifact side,
   - asserts drift is detected.
2. Keep guard local and machine-verifiable:
   - compare by `check_id` maps,
   - avoid full-history positional assumptions.
3. Preserve existing semantics:
   - parity drift guard should not alter GO/NO_GO reduction logic in unrelated checks.

---

## Risks / Pitfalls

- Overfitting to changelog index positions rather than `check_id` linkage.
- Treating reason-list parity as substitute for row parity (they must both be checked).
- Coupling lifecycle export checks to unrelated signal rows, creating brittle tests.

---

## Checklist

- [x] Research topics investigated
- [x] Divergence scenarios identified
- [x] Deterministic guard patterns defined
- [x] Implementation guidance documented
