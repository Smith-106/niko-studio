# Weekly Review

- Week: 2026-W08
- Owner: core-workflow
- schema_version: weekly-kpi-dashboard.v1
- window_label: 2026-W08

## KPI
- 质量达标率: 4 / 4 = 100%
- 任务完成率: 4 / 4 = 100%

## Completion Stats
- Completed: 4
- Not completed: 0
- Delayed: 0
- Urgent inserted: 0

## Blockers
- Desktop release check still reports TypeScript errors in desktop package (`NO_GO` at release level).

## Next Week Priorities
- Keep evidence continuity and close second-week completion record.
- Track desktop check remediation separately from PDD evidence closure.

## SLO Baseline
- ttft: 1.3 (target: <2.0s)
- e2e: 3.8 (target: <5.0s)
- effective_hit_rate: 0.93 (target: >0.90)
- context_budget_utilization: 0.78 (target: 0.70-0.90)
- gate consistency: yes

## Cycle Time KPI
- baseline_window_days: 7
- measurement_window_days: 7
- baseline_state: ready
- cycle_time_baseline_median: 4.8
- cycle_time_current_median: 4.5
- cycle_time_trend: down
- eligible_samples: 8
- exclusion_reason_codes: none (missing_timestamps: 0)

## Comparability
- comparability_decision: comparable
- chapter_gate_aggregation_result: aggregated

## Self Learning
- reflector: enabled
- curator: enabled
- playbook: active

## Memory Observability
- c_effective: 0.94
- s_final: 0.91
- r_memory: 0.87

## Quality Level Trace
- effective_quality_level: high
- quality_level_used: high

## Degrade Trace
- degrade_reason: none
- degrade_steps: none

## Critical Gate Enforcement
- critical_gate_always_on: true

## Migration & Rollback
- migration: none
- rollback: none

## Compliance
- rbac: enabled
- audit: enabled
- rollback: tested

## Chapter Gate Snapshot
- quality_score: 99
- publish_recommendation: pass
- critical_issue_count: 0

## Gate Explanation Sample
- Trigger item: desktop_check
- Trigger threshold/rule: TypeScript compilation
- Evidence path:
  - release-check-summary.md
- Interpretation: Desktop TypeScript errors blocking release.

## Evidence Links
- evidence_links:
  - .workflow/evidence/weekly/2026-W08-review.md
