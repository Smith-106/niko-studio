# Research Report: PRD-045 US-002 - Duplicate and contradictory lifecycle actions are rejected deterministically

**Date:** 2026-02-29
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Duplicate lifecycle-action failure modes in roadmap changelog updates
2. Guard design for contradiction detection between lifecycle actions and pointer state

---

## Findings

### Topic 1: Duplicate lifecycle-action failure modes

**Summary:**
Changelog growth introduces two high-risk duplication patterns:

1. Duplicate activation events for same target PRD within one transition window.
2. Duplicate pointer-update events for same target PRD where one window emits multiple `current_prd_updated` entries.

These patterns can preserve superficial action presence while degrading deterministic auditability.

**Evidence context:**
- Existing deterministic tests cover ordering, contradiction, and repeated extraction stability, but do not yet explicitly reject duplicate action entries per window.
  - `tests/unit/scripts/test_release_check_summary.py:2384`
  - `tests/unit/scripts/test_release_check_summary.py:2413`
  - `tests/unit/scripts/test_release_check_summary.py:2444`
  - `tests/unit/scripts/test_release_check_summary.py:2522`

### Topic 2: Contradiction detection between lifecycle actions and pointer state

**Summary:**
Contradiction detection should bind lifecycle action windows to pointer-state semantics:
- `currentPRD` must not point to a PRD still `pending`.
- Lifecycle window must map one completion to one activation and one pointer update (1:1:1 local contract).
- Any duplicate activation/update in same window should be flagged as contradiction risk.

**Data evidence:**
- Current active milestone and PRD after bootstrap: `.aha-loop/project.roadmap.json:4-8`
- M13 bootstrap lifecycle entries: `.aha-loop/project.roadmap.json:702-738`

---

## Implementation Recommendation

1. Add deterministic duplicate-rejection guard test in `tests/unit/scripts/test_release_check_summary.py`:
   - Construct changelog with duplicate `prd_activated` for same window.
   - Count lifecycle actions per completed-anchor window.
   - Assert duplicate detection flag is true.
2. Add contradiction guard test for duplicate `current_prd_updated` in one window:
   - Validate local action cardinality contract (exactly one activation, one pointer update).
3. Keep checks window-scoped and ID-keyed to avoid brittle global-history assumptions.

---

## Risks / Pitfalls

- Order-only assertions can pass even when duplicate lifecycle actions exist.
- Full-history duplicate scans without window boundaries can over-report false positives.
- Contradiction checks that ignore pointer-state linkage can miss semantically broken transitions.

---

## Checklist

- [x] Research topics investigated
- [x] Duplicate-action failure modes identified
- [x] Contradiction guard strategy defined
- [x] Implementation guidance documented
