# Weekly Review

- Week: 2026-W09
- Owner: core-workflow
- schema_version: weekly-kpi-dashboard.v1
- window_label: 2026-W09

## KPI
- 质量达标率: 5 / 5 = 100%
- 任务完成率: 5 / 5 = 100%

## Completion Stats
- Completed: 5
- Not completed: 0
- Delayed: 0
- Urgent inserted: 0

## Blockers
- None affecting weekly denominator and completion continuity.

## Next Week Priorities
- Keep release blockers isolated and tracked under release evidence path.
- Continue weekly trend updates with stable denominator policy.

## SLO Baseline
- ttft: 1.2 (target: <2.0s)
- e2e: 3.5 (target: <5.0s)
- effective_hit_rate: 0.95 (target: >0.90)
- context_budget_utilization: 0.82 (target: 0.70-0.90)
- gate consistency: yes

## Cycle Time KPI
- baseline_window_days: 7
- measurement_window_days: 7
- baseline_state: ready
- cycle_time_baseline_median: 4.5
- cycle_time_current_median: 4.2
- cycle_time_trend: down
- eligible_samples: 12
- exclusion_reason_codes: no_exclusions_this_period

## Comparability
- comparability_decision: comparable
- chapter_gate_aggregation_result: aggregated

## Self Learning
- reflector: enabled
- curator: enabled
- playbook: active

## Memory Observability
- c_effective: 0.95
- s_final: 0.92
- r_memory: 0.88

## Quality Level Trace
- effective_quality_level: high
- quality_level_used: high

## Degrade Trace
- degrade_reason: none
- degrade_steps: none

## Critical Gate Enforcement
- critical_gate_always_on: true

## Migration & Rollback
- migration: schema_v7_to_v8
- rollback: tested

## Compliance
- rbac: enabled
- audit: enabled
- rollback: tested

## Chapter Gate Snapshot
- quality_score: 99
- publish_recommendation: pass
- critical_issue_count: 0

## Gate Explanation Sample
- Trigger item: `desktop_check` (P0 blocking)
- Trigger threshold/rule: any P0 FAIL => NO_GO
- Evidence path:
  - `release-check-summary.md`
  - `.workflow/evidence/release/release-readiness-artifact.json`
  - `.workflow/evidence/release/2026-02-26-release-path-check.md`
- Interpretation: workflow/evidence completion is READY, but release availability remains blocked by desktop typecheck failure.

## Evidence Links
- evidence_links:
  - .workflow/evidence/weekly/2026-W09-review.md
