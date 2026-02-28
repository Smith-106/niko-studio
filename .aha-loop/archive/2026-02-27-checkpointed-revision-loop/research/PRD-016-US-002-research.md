# PRD-016 / US-002 Research — Deterministic Gate-Score / Critical-Issue Blocking

## Scope

Define deterministic blocking contract for publish when gate score fails or critical issues remain unresolved.

## Existing Contract Anchors

- Existing blocking signals in `scripts/release_check_summary.py`:
  - `critical_conflict_blocker_signal` (`P0`, blocking)
  - `unresolved_triage_blocker_signal` (`P0`, blocking)
- Existing gate-scoring signal:
  - `chapter_gate_scoring_signal` (`P1`, non-blocking currently, with deterministic detail fields including decision/no_go semantics)
- Final decision contract:
  - Any `blocking=true` check with non-PASS status contributes to `go_no_go_reasons` and `decision=NO_GO`.

## Deterministic Blocking Policy (US-002)

- Publish should be blocked when either condition holds:
  - Critical issues unresolved (already represented by existing P0 blockers), or
  - Chapter gate score indicates no-go.
- Blocking reasons must remain machine-readable and deterministic (`check_id` + stable detail ordering).
- No parallel interpretation branch should be introduced.

## Implementation Guidance

- Promote/compose deterministic gate-score blocker semantics as additive P0 check (without breaking existing scoring signal outputs).
- Reuse existing `chapter_gate_scoring_signal` detail fields (`decision=no_go|go`) and explicit status override patterns.
- Keep hard blockers explicit in checks array with predictable `check_id` values for downstream automation.

## Risks / Notes

- Directly changing existing scoring signal priority may impact historical dashboards; prefer additive blocker signal composition to preserve backward compatibility.
- Ensure blocker emits clear reason code even when upstream scoring data is partially missing.
