# PRD-016 / US-001 Research — Deterministic Evidence Completeness Blocking

## Scope

Define deterministic, machine-checkable release-evidence completeness blocking contract that prevents publish when required evidence artifacts are missing.

## Existing Contract Anchors

- `scripts/release_check_summary.py` already emits deterministic machine payload (`checks[]`) and blocking decisions (`P0` + blocking flag).
- Existing non-blocking evidence checks already available:
  - `evidence_coverage_signal`
  - `evidence_freshness_signal`
  - `tasks_completion_signal`
- Existing hard blockers already enforced:
  - `critical_conflict_blocker_signal`
  - `unresolved_triage_blocker_signal`

## Deterministic Blocking Policy (US-001)

- Evidence completeness blocker should be explicit and deterministic.
- Missing required evidence classes must produce `FAIL` on blocking check.
- Required evidence classes should include at minimum:
  - weekly review evidence presence
  - quality evidence presence
  - machine-readable release-check payload availability
- No manual override branch is allowed.

## Implementation Guidance

- Add a dedicated blocking `P0` check in release summary for evidence completeness contract.
- Reuse deterministic detail formatting (`_format_detail_pairs`) and explicit missing-class output.
- Keep policy additive: do not remove existing checks; enforce blocker as canonical gate for publish.

## Risks / Notes

- Partial evidence may look healthy in non-blocking summary checks; blocker must remain authoritative for publish decision.
- Keep this story scoped to evidence presence/completeness contract only; score threshold logic remains existing gate behavior.
