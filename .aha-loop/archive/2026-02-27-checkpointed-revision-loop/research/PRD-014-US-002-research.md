# PRD-014 / US-002 Research — Comparable-Quality Rubric and Scoring

## Scope

Define machine-consumable comparable-quality rubric rules so cycle-time improvements are counted only when quality remains comparable.

## Existing Contract Anchors

- `scripts/release_check_summary.py` already contains deterministic quality-related signals:
  - `quality_level_trace_signal`
  - `degrade_trace_signal`
  - `chapter_gate_scoring_signal`
- `docs/quality/QUALITY_CRITERIA.md` defines:
  - quality pass threshold `>=99%`
  - no critical issue for chapter DoD
  - traceability requirement for evaluated samples.

## Rubric v1 (US-002)

Comparable quality is `PASS` when all conditions hold:
1. `quality_score >= 99.0`
2. `critical_issue_count == 0`
3. `publish_recommendation == pass`
4. `effective_quality_level` and `quality_level_used` are both present and equal
5. If degrade markers exist, both `degrade_reason` and `degrade_steps` must be present (deterministic trace completeness)

Otherwise rubric status = `WARN`.

## Machine-Consumable Output Fields

Signal detail should include stable key ordering with at least:
- `rubric_version`
- `quality_score`
- `threshold`
- `critical_issue_count`
- `publish_recommendation`
- `quality_level_match`
- `degrade_trace_complete`
- `decision`

## Implementation Guidance

- Add rubric as additive signal in `release_check_summary.py`.
- Reuse existing parsing patterns (`_extract_metric_value`, regex for recommendation/critical count/quality levels).
- Keep detail string deterministic via `_format_detail_pairs`.
- Keep rubric non-blocking (`P1`) for now; it is KPI comparability evidence, not a hard runtime P0 gate.

## Risks / Notes

- Missing quality-level fields should fail comparability (`WARN`) even when score is high.
- Rubric must remain contract-compatible and avoid schema rewrites in existing evidence artifacts.
