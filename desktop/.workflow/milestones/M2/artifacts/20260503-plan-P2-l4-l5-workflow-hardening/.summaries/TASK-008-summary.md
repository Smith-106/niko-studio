# TASK-008 — Full Regression Suite Summary

**Verdict:** PASS — Phase 2 introduces no regressions.

## Frontend (desktop, npm test --run)

- 84 test files, 860 tests, **0 failures**, 82.47s
- **Exact match** to Phase 1 TST-004 baseline (860/860, 84 files)

## Sidecar (src-ts, npm run test)

- 223 test files, 2338 tests
- 219 file pass / 2334 test pass
- **4 failures, all classified as pre-existing or environmental:**
  1. `gateway-benchmark.test.ts > benchmarks POST /chat (validation)` — environmental (needs running LLM provider)
  2. `ServiceContainer.test.ts > should handle initialization timeout` — pre-existing 5s flake (TASK-007 confirmed)
  3. `knowledge-manager.test.ts > checkHealth returns empty when no providers` — pre-existing; reproduced after `git stash` of all Phase 2 source changes at d81d013 baseline
  4. `workflow-engine.test.ts > DESTRUCTIVE_STEP_NAMES contains expected step names` — pre-existing missing export (TASK-007 confirmed)
- Duration 42.09s

## Phase 2 Test Additions (all passing)

- `harness/stress-harness.test.ts` — 20/20 self-tests
- `level4-brainstorm.stress.test.ts` — 4/4 (5-round budget 7.5s vs 30s budget after async fix)
- `level5-coordinator.stress.test.ts` — 4/4
- `level5-coordinator.integration.test.ts` — 2/2 (smoke passes; e2e gracefully skipped on missing fastembed model)

## Verdict Detail

`baseline_match = (frontend.total >= 860) && (frontend.failed === 0)` = **true**

`regressions = []`

## Pre-Existing Verification

For the knowledge-manager failure (the only one not previously classified by TASK-007), verified by:
1. `git stash` at HEAD=d81d013 (saving graph-manager.ts/gateway-control-plane.ts/integration test changes)
2. Re-run `npx vitest run tests/knowledge/knowledge-manager.test.ts -t 'checkHealth returns empty'`
3. Result: still failed with same `{embedding_local: false}` vs `{}` mismatch
4. Conclusion: not introduced by Phase 2

## Deferred to M3

- ISS-20260502-066: L5 mid-executeChain interrupt may lose currentUnitIndex (filed by TASK-006)

## Files

- Report: `desktop/.workflow/scratch/20260503-plan-P2-l4-l5-workflow-hardening/regression-report.json`
- This summary: `desktop/.workflow/scratch/20260503-plan-P2-l4-l5-workflow-hardening/.summaries/TASK-008-summary.md`
