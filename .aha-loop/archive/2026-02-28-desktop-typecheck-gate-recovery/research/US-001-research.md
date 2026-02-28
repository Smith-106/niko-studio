# Research Report: US-001 - Refresh release summary and evidence artifacts for recovered desktop_check

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Current release summary and release-readiness artifact fields that encode desktop_check recovery
2. Existing tests and fixtures validating artifact schema compatibility and trace metadata

---

## Findings

### Topic 1: Fields encoding recovered desktop_check state

**Summary:**
Recovered desktop state is represented through deterministic check entries in both report payload and release-readiness artifact. The key row remains `desktop_check` with `P0`, `blocking=true`, and `status=PASS` under recovery.

**Code references:**
- `scripts/release_check_summary.py:1365-1372` defines `desktop_check` check contract (`P0`, `blocking=True`).
- `scripts/release_check_summary.py:1627-1632` machine payload includes `checks[]`, `decision`, and `go_no_go_reasons`.
- `scripts/release_check_summary.py:1718-1724` writes release-readiness artifact from same deterministic payload source.

### Topic 2: Existing schema compatibility guards

**Summary:**
Schema contract is already guarded by unit tests for artifact structure and trace metadata. US-001 should refresh evidence assertions by adding explicit desktop-check recovery presence checks in machine/artifact outputs.

**Existing tests:**
- `tests/unit/scripts/test_release_check_summary.py:1427` validates artifact trace schema and deterministic metadata shape.
- `tests/unit/scripts/test_release_check_summary.py:1460` validates persisted artifact contract fields.
- Recent PRD-037 tests validate transition semantics and main-path stability.

---

## Implementation Recommendations

1. Add one focused test to assert recovered desktop_check PASS row appears in both:
   - report machine payload `checks[]`
   - release-readiness artifact `checks[]`
2. Keep schema compatibility checks structural (required keys + stable value invariants), avoid timestamp coupling.
3. Reuse deterministic stubs from existing main-path tests.

### Pitfalls to Avoid

- Do not mutate release policy rules while refreshing evidence assertions.
- Do not assert full report text snapshots; assert machine payload structures.

---

## Checklist

- [x] Recovery encoding fields mapped
- [x] Existing schema guards identified
- [x] Implementation plan prepared for contract refresh verification
