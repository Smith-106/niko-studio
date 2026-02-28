# PRD-014 / US-003 Research — Chapter Gate KPI Aggregation Behavior

## Scope

Specify deterministic KPI aggregation behavior across chapter-gate evidence so weekly KPI output is machine-producible without manual interpretation gaps.

## Existing Contract Anchors

- Canonical evidence envelope and trace requirements are defined in `.workflow/evidence/README.md`.
- `release_gate_run` artifacts require `trace.session_id`, `trace.run_id`, `trace.check_id` and `evidence_links`.
- `scripts/release_check_summary.py` already emits machine-readable check payload with deterministic `detail` key-value ordering.

## Aggregation Rule v1 (US-003)

### 1) Input scope
- Aggregation input set = active-session `release_gate_run` snapshots only.
- Eligible item criteria:
  1. `artifact_type == release_gate_run`
  2. trace fields present (`session_id`, `run_id`, `check_id`)
  3. `evidence_links` present and non-empty

### 2) KPI aggregation target
- Aggregate chapter-gate KPI using checks where:
  - `trace.check_id == chapter_gate_scoring_signal` OR
  - output-level `check_id == chapter_gate_scoring_signal` OR
  - output `checks[]` contains `chapter_gate_scoring_signal`

### 3) Deterministic outputs
Signal detail must include stable fields:
- `snapshots_scanned`
- `eligible_release_gate_runs`
- `chapter_gate_checks_linked`
- `aggregation_window`
- `result`

### 4) Decision semantics
- `PASS` when `chapter_gate_checks_linked >= 1`
- otherwise `WARN`
- no manual override branch inside aggregation logic.

## Implementation Guidance

- Keep aggregation as additive signal in `release_check_summary.py`.
- Reuse existing release-gate snapshot scanning/linkage logic to avoid duplicate parsers.
- Keep detail deterministic for weekly machine diffing and trend reporting.

## Risks / Notes

- Weakest point is mixed/invalid snapshot payloads. Preserve invalid-path accounting so WARN reasons stay explicit.
- Do not loosen trace/evidence-link requirements; they are mandatory for auditability.
