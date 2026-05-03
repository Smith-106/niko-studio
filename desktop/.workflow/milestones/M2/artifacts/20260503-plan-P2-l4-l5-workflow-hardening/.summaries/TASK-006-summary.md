# TASK-006: Document remaining issues for M3 follow-up

## Changes
- `.workflow/issues/issues.jsonl`: appended one new line — `ISS-20260502-066` documenting FM-3 mid-`executeChain` interrupt deferral (registered, M2-P2, severity medium)
- `.workflow/scratch/20260503-plan-P2-l4-l5-workflow-hardening/stress-results-l4.json`: added `m3_backlog: []` (no L4 deferrals)
- `.workflow/scratch/20260503-plan-P2-l4-l5-workflow-hardening/stress-results-l5.json`: added `m3_backlog: ["ISS-20260502-066"]`

## Verification
- [x] `failed[]` empty in both stress-results files after TASK-005 — confirmed (L4=0, L5=0)
- [x] `m3_backlog` field present in both files — confirmed (L4=`[]`, L5=`["ISS-20260502-066"]`)
- [x] New issue line parses as valid JSON — `JSON.parse(lastLine)` succeeded
- [x] All 66 lines of `issues.jsonl` parse as valid JSON — verified via `node -e ".forEach((l,i)=>JSON.parse(l))"`
- [x] New issue has all required fields: `id`, `source`, `phase_ref`, `status`, `severity`, `title`, `root_cause`, `affected_files`, `fix_direction`, `defer_reason`, `repro`, `created_at`
- [x] `phase_ref: "M2-P2"` and `source: "stress-test"` set per TASK-006 spec

## Tests
- [x] `node -e "...forEach((l,i)=>{ try{JSON.parse(l)}catch(e){console.error('Bad line',i+1);process.exit(1)} })"` exits 0 — All 66 lines parse

## ID Selection
- Existing IDs all use `ISS-20260502-NNN` pattern (65 entries, 001..065)
- Per task instruction "Next is max+1, zero-padded to 3 digits", chose `ISS-20260502-066` to keep continuity within the established scheme rather than starting a new date bucket. The `20260502` prefix in this codebase appears to be a rolling batch tag, not a strict creation-date constraint.

## What was filed (ISS-20260502-066)
**Title**: L5 Coordinator mid-executeChain interrupt may lose currentUnitIndex

**Root cause**: `Level5Coordinator.executeChain` (level5-coordinator.js:523-569) mutates `state.currentUnitIndex` and `overallProgress` in memory between unit executions. `persistState` is only called at phase boundaries (lines 402, 408, 414, 429), not after each unit completes. A mid-chain interrupt (process kill, unhandled rejection in `_executeUnit`) can lose progress within the executing phase.

**Fix direction**: Add `persistState` call inside `executeChain` after each unit completes (after line 562 unit.state assignment), OR introduce a unit-level checkpoint structure that survives mid-phase interrupts. Add a unit-level test in `level5-coordinator.stress.test.js` that simulates `_executeUnit` throwing partway through.

## Why FM-3 was deferred to M3
Phase 2 stress tests use **phase-boundary** interrupt simulation only — TASK-004 monkey-patches persistState by writing a planning-phase state file, not killing mid-unit. Detecting mid-unit state loss requires a different test fixture (interrupt `_executeUnit` between units 2 and 3 of a 3-unit chain). Out of Phase 2 budget; added to M3 hardening backlog.

## Remaining warnings
`stress-results-l5.json.warnings[]` still contains 1 entry preserved from TASK-004:
> "Test 2 simulates interrupt by pre-writing a planning-phase CoordinatorState file rather than killing a real process. Sufficient to exercise _tryResume + loadState resume path; does not detect mid-process state-machine races (FM-3 secondary aspects)."

This warning is now formally tracked by ISS-20260502-066 in `m3_backlog`.

## Deviations
- None. All convergence criteria satisfied.

## Notes for next phase
- ISS-20260502-066 is the sole M3 carry-forward item from M2-P2 stress testing
- `passed[]` arrays in both stress-results files are unchanged (4 each)
- No source code changes in this task — documentation/tracking only
- Per task instructions, no commit was created
