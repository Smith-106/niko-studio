# Research Report: PRD-041 US-002 - Guard repeated-run auditability against freshness/trace drift

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Additional repeated-run drift scenarios for freshness/trace details and trace metadata
2. Guard patterns to verify decision-semantics invariance under observability-focused checks

---

## Findings

### Topic 1: Additional repeated-run drift scenarios for freshness/trace details and trace metadata

**Summary:**
Current coverage already enforces strong repeated-run parity for freshness/trace checks across machine payload and release-readiness artifact, but risk remains around future drift in check-row shape and trace schema keys.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Test suite

**Code Evidence:**
- Freshness signal implementation: `scripts/release_check_summary.py:727`
- Quality-level trace signal implementation: `scripts/release_check_summary.py:482`
- Degrade trace signal implementation: `scripts/release_check_summary.py:503`
- Artifact trace envelope: `scripts/release_check_summary.py:175`
- Repeated-run freshness/trace contract test: `tests/unit/scripts/test_release_check_summary.py:2165`

**Observed deterministic guard pattern:**
- Run `main()` twice under deterministic stubs.
- Compare targeted check rows by `check_id` across report payload and artifact payload (`priority`, `blocking`, `status`, `detail`).
- Assert trace shape (`session_id`, `run_id`, path suffixes, `trace_id` prefix).
- Assert per-run `generated_at` alignment between report payload and artifact while allowing cross-run timestamp change.

### Topic 2: Guard patterns to verify decision-semantics invariance under observability-focused checks

**Summary:**
Release decision is still derived strictly from blocking checks (`blocking && status != PASS`), so observability checks (freshness/trace, non-blocking P1) must never affect GO/NO_GO reduction.

**Code Evidence:**
- Blocking-only decision reduction: `scripts/release_check_summary.py:1619`
- Decision assignment: `scripts/release_check_summary.py:1624`
- No-go reason ordering and non-blocker exclusion test: `tests/unit/scripts/test_release_check_summary.py:2285`

**Invariant to preserve:**
- Freshness/trace checks can change observability confidence but cannot independently add `go_no_go_reasons` unless explicitly marked blocking in future contract changes.

---

## Implementation Recommendations

1. **Approach:** Keep implementation test-first and additive in `tests/unit/scripts/test_release_check_summary.py`; avoid runtime contract broadening unless required.
2. **Pattern to Follow:** Use `check_id`-keyed parity assertions for cross-surface checks and shape-based trace assertions (prefix/suffix), not absolute paths.
3. **Key Files to Modify (if implementing further hardening):**
   - `tests/unit/scripts/test_release_check_summary.py`
   - `scripts/release_check_summary.py` (only if schema contract changes are required)
4. **Dependencies:** None.

### Pitfalls to Avoid

- Writing brittle assertions on absolute temp paths for trace fields.
- Asserting only one surface (report or artifact) and missing drift in the other.
- Accidentally promoting observability checks to blocking without updating decision-policy expectations.

---

## Follow-up Research Needed

- [ ] Evaluate whether to add an explicit frozen trace-key-set test for every repeated run scenario (beyond current coverage).

---

## Knowledge Base Updates

### To `knowledge/project/patterns.md`

```markdown
### Repeated-Run Freshness/Trace Drift Guard Pattern
- Context: Release artifacts are regenerated repeatedly and must remain audit-compatible across runs.
- Implementation: Execute deterministic double-run harness, compare check rows by `check_id` across payload/artifact (`priority`, `blocking`, `status`, `detail`), and enforce trace-shape + per-run generated_at alignment.
- Example: `tests/unit/scripts/test_release_check_summary.py:2165`
```

---

## Checklist

- [x] All research topics investigated
- [x] Existing codebase patterns reviewed
- [x] Implementation recommendations documented
- [x] Pitfalls identified
- [x] Knowledge base updates drafted
