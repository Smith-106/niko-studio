# Research Report: US-002 - Ensure deterministic and machine-verifiable evidence mapping

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Canonical evidence-link provenance keys required by downstream consumers
2. Repeatability constraints for cross-surface machine-verification checks

---

## Findings

### Topic 1: Canonical evidence-link provenance keys

**Summary:**
Evidence-link provenance is represented through specific linkage checks in `release_check_summary` and consumed as canonical `checks[]` rows in both report payload and release-readiness artifact.

**Canonical check IDs and detail keys:**
- `feedback_artifact_linkage_signal`
  - detail keys: `snapshots_scanned`, `linked_feedback_artifacts`, `invalid_snapshots`
- `conflict_artifact_linkage_signal`
  - detail keys: `snapshots_scanned`, `linked_conflict_artifacts`, `critical_conflicts_linked`, `invalid_snapshots`
- `chapter_gate_evidence_linkage_signal`
  - detail keys: `snapshots_scanned`, `eligible_release_gate_runs`, `chapter_gate_checks_linked`, `aggregation_window`, `result`, `invalid_snapshots`

All three are emitted as `check_id` rows and persisted uniformly into report machine payload and release-readiness artifact `checks[]`.

### Topic 2: Repeatability constraints for machine verification

**Summary:**
Deterministic verification should assert cross-surface parity by `check_id` and stable detail content/ordering for provenance-critical evidence-link rows.

**Repeatability constraints:**
- Use `check_id`-keyed row matching instead of positional assumptions.
- Assert `priority`, `blocking`, `status`, and `detail` parity across report/artifact rows.
- Keep deterministic stubbed signal outputs when validating exact detail strings.
- Prefer structural/path-shape assertions for environment-variant paths.

---

## Implementation Recommendations

1. Add US-002 main-path test to assert cross-surface parity for evidence-link provenance rows:
   - `feedback_artifact_linkage_signal`
   - `conflict_artifact_linkage_signal`
   - `chapter_gate_evidence_linkage_signal`
2. Stub all three linkage signals to deterministic PASS outputs with explicit detail strings.
3. Assert row parity (`priority`, `blocking`, `status`, `detail`) by `check_id` between payload and artifact.
4. Keep release decision semantics assertions (`GO`, empty `go_no_go_reasons`) unchanged.

### Pitfalls to Avoid

- Avoid markdown text snapshot assertions for provenance checks.
- Avoid introducing policy semantic coupling while extending observability assertions.

---

## Checklist

- [x] Canonical evidence-link provenance keys mapped
- [x] Repeatability constraints documented
- [x] Deterministic US-002 test strategy defined
