# PRD-015 / US-003 Research — Comparability Exposure Alongside Cycle-Time Trend

## Scope

Define deterministic, additive output contract to expose quality comparability status together with cycle-time trend in weekly dashboard artifacts.

## Existing Contract Anchors

- Existing comparable-quality signal: `comparable_quality_rubric_signal` already emits deterministic machine fields including:
  - `decision` (`comparable|not_comparable`)
  - `quality_level_match`
  - `degrade_trace_complete`
  - `quality_score`, `threshold`, `critical_issue_count`, `publish_recommendation`
- Existing cycle-time trend/readiness fields already validated by schema/rollup signals:
  - `cycle_time_trend`
  - `baseline_state`
  - baseline/current medians
- Release check payload (`checks[]`) and detail formatting (`_format_detail_pairs`) are deterministic and contract-stable.

## Deterministic Join Policy

- Comparability exposure must remain additive; do not alter existing rubric signal semantics.
- Dashboard join should reference canonical comparability decision and trend/readiness fields from the same evidence corpus.
- Missing comparability/trend linkage markers must produce deterministic WARN outputs with explicit missing list.
- No manual interpretation branch is allowed.

## Implementation Guidance

- Add additive non-blocking `P1` signal for combined visibility (US-003 implementation phase).
- Reuse existing pattern helpers and ordered detail output to keep machine-diff stability.
- Emit explicit fields for:
  - comparability decision
  - cycle-time trend
  - readiness/linkage completeness status
  - missing linkage fields

## Risks / Notes

- If comparability is present but trend/readiness is missing, UI may overstate confidence; combined signal should guard against partial joins.
- Keep this story focused on output visibility contract; avoid expanding into new scoring logic.
