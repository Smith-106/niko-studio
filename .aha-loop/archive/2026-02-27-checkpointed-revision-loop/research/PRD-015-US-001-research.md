# PRD-015 / US-001 Research — Weekly KPI Dashboard Artifact Schema

## Scope

Define deterministic, machine-consumable weekly KPI dashboard schema that includes:
- cycle-time baseline/current/trend,
- quality comparability status,
- readiness metadata.

## Existing Contract Anchors

- `scripts/release_check_summary.py` already emits machine-readable release check payload (`checks[]`) with deterministic `detail` key ordering.
- Existing KPI-related signals that can be referenced by dashboard schema:
  - `cycle_time_kpi_measurement_signal`
  - `comparable_quality_rubric_signal`
  - `chapter_gate_evidence_linkage_signal`
- Evidence envelope requirements (`.workflow/evidence/README.md`) provide stable trace and evidence-link constraints.

## Weekly Dashboard Schema v1

Required deterministic fields:
- `schema_version` (`weekly_kpi_dashboard.v1`)
- `window_label` (e.g. `YYYY-Www`)
- `baseline_state` (`ready|insufficient_sample|not_ready`)
- `cycle_time_baseline_median`
- `cycle_time_current_median`
- `cycle_time_trend`
- `comparability_decision` (`comparable|not_comparable`)
- `chapter_gate_aggregation_result` (`aggregated|insufficient_data`)
- `evidence_links`

## Deterministic Policy

- Stable key ordering in machine detail output (`key=value` pairs).
- No manual override branch in schema validation logic.
- Schema signal is additive and must not rewrite existing evidence contracts.

## Implementation Guidance

- Add a dedicated signal in release summary (`weekly_kpi_dashboard_schema_signal`) that validates presence/readiness of required schema fields using existing evidence corpus parsing patterns.
- Attach it as non-blocking `P1` check, preserving current gate behavior.
- Add unit tests for both complete-schema PASS and missing-fields WARN cases.

## Risks / Notes

- Missing window/readiness fields can silently break weekly automation; signal must fail deterministically with explicit missing list.
- Keep this as schema-level validation only; value aggregation math stays in later PRD-015 stories.
