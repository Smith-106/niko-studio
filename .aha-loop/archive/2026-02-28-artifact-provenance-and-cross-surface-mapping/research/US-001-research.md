# Research Report: US-001 - Map blocker provenance consistently across report and artifact surfaces

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Current blocker provenance fields in report machine payload and release-readiness artifact checks
2. Field-level mapping invariants established in PRD-038 that must remain compatible

---

## Findings

### Topic 1: Blocker provenance fields across report and artifact surfaces

**Summary:**
Blocker provenance is carried by a shared `checks[]` row contract emitted once by `scripts/release_check_summary.py` and then reused in both machine payload (report JSON block) and release-readiness artifact JSON. The provenance-critical fields are `check_id`, `priority`, `blocking`, `status`, `exit_code`, and `detail`.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Existing tests and fixtures
- [ ] Library source code (`.vendor/...`) (not needed)
- [ ] External documentation (not needed)

**Code references:**
- Shared check row factory: `scripts/release_check_summary.py:68`
- Release artifact includes same check rows: `scripts/release_check_summary.py:162-177`
- P0 blocker rows and deterministic decision reduction path:
  - `scripts/release_check_summary.py:794` (`evidence_completeness_blocker_signal`)
  - `scripts/release_check_summary.py:820` (`gate_score_or_critical_blocker_signal`)
  - `scripts/release_check_summary.py:268` (`runtime_policy_conformance_signal`)
  - `scripts/release_check_summary.py:1126` main reduction path

**Observed provenance-critical rows (US-001 scope):**
- `desktop_check` (P0, blocking)
- `evidence_completeness_blocker_signal` (P0, blocking)
- `gate_score_or_critical_blocker_signal` (P0, blocking)
- `runtime_policy_conformance_signal` (P0, blocking)

### Topic 2: PRD-038 field-level mapping invariants that must remain compatible

**Summary:**
PRD-038 established deterministic cross-surface structure and schema stability. PRD-039/US-001 must preserve this by asserting field parity for provenance-critical rows across report machine payload and artifact `checks[]`, without changing GO/NO_GO semantics.

**Existing invariant tests already in codebase:**
- Artifact envelope and trace schema: `tests/unit/scripts/test_release_check_summary.py:1427`
- Desktop recovery reflected on both surfaces: `tests/unit/scripts/test_release_check_summary.py:1565`
- Repeated-run deterministic stability: `tests/unit/scripts/test_release_check_summary.py:1634`
- Keyset compatibility across report/artifact: `tests/unit/scripts/test_release_check_summary.py:1716`
- Cross-surface blocker provenance mapping parity: `tests/unit/scripts/test_release_check_summary.py:1900`

---

## Implementation Recommendations

1. **Approach:** Keep provenance mapping assertions check-row-based and deterministic (compare row fields across report payload and artifact by `check_id`).
2. **Pattern to Follow:** Reuse machine payload JSON extraction and `check_id -> row` map assertions from existing release summary tests.
3. **Key Files to Modify:**
   - `tests/unit/scripts/test_release_check_summary.py` (if additional guards are needed)
   - `scripts/release_check_summary.py` (only if missing mapping key or invariant violation appears)
4. **Dependencies:** none.

### Pitfalls to Avoid

- Comparing whole report markdown snapshots (brittle); compare machine payload structure instead.
- Introducing non-deterministic detail field ordering in blocker rows.
- Changing blocker reduction semantics while hardening provenance observability.

---

## Follow-up Research Needed

- [ ] Confirm whether future downstream consumers require explicit provenance tuple fields in addition to current `checks[]` row parity.

---

## Checklist

- [x] All research topics investigated
- [x] Relevant source files and tests traced
- [x] PRD-038 compatibility invariants identified
- [x] Implementation recommendations documented
- [x] Pitfalls identified
