# PRD-015 / US-002 Research — Baseline/Current/Trend Aggregation from Canonical Evidence

## Scope

Define deterministic aggregation rules for weekly dashboard KPI values so:
- baseline/current medians are sourced from canonical evidence,
- trend/readiness signaling is machine-consumable,
- no manual interpretation branch is introduced.

## Existing Contract Anchors

- `scripts/release_check_summary.py` already defines canonical KPI-related schema fields and deterministic output formatting.
- Existing field anchors already validated in current checks:
  - `baseline_state` (`ready|insufficient_sample|not_ready`)
  - `cycle_time_baseline_median`
  - `cycle_time_current_median`
  - `cycle_time_trend` (`up|down|flat`)
  - `window_label` (`YYYY-Www`)
- Deterministic output contract remains `key=value` ordered detail fields via `_format_detail_pairs(...)`.

## Canonical Aggregation Policy (US-002)

### Inputs

Use canonical evidence corpus under weekly/quality evidence directories with explicit markers:
- `window_label`
- `baseline_state`
- `cycle_time_baseline_median`
- `cycle_time_current_median`
- `cycle_time_trend`

### Deterministic Rules

- Baseline/current values are accepted only when numeric markers are present.
- Trend is accepted only from constrained enum (`up|down|flat`).
- Readiness follows explicit baseline state (`ready|insufficient_sample|not_ready`).
- Missing required markers must produce deterministic WARN path with explicit missing list.
- No manual override branch is permitted.

## Implementation Guidance

- Extend release summary checks with an additive non-blocking `P1` signal for rollup readiness/consistency (US-002 implementation phase).
- Reuse `_missing_required_patterns(...)` + `_format_detail_pairs(...)` to preserve deterministic failure semantics and stable ordering.
- Keep aggregation math/value derivation bounded to canonical evidence fields only; avoid introducing heuristic fallback values.

## Risks / Notes

- If baseline/current fields are partially present, trend may appear valid while rollup is not; signal must treat partial payload as non-ready.
- Keep US-002 focused on aggregation/readiness validation contract; comparability join remains US-003 scope.
