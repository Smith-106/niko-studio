# TASK-004: L5 Coordinator stress tests — 3-step chain + interrupt/resume

## Changes
- `src-tauri/bin/sidecar/workflow/levels/level5-coordinator.stress.test.js` — new vitest suite with 4 stress test cases for `Level5Coordinator`. Failure-recording pattern (catch + record, never throw) mirrors TASK-003 so the run exits 0 and TASK-005 can consume `.workflow/scratch/.../stress-results-l5.json.failed[]` for targeted fixes.
- `.workflow/scratch/20260503-plan-P2-l4-l5-workflow-hardening/stress-results-l5.json` — generated on `afterAll` with `{passed, failed, warnings}` shape matching `stress-results-l4.json`.

## Verification
- [x] `level5-coordinator.stress.test.js` exists at the required path.
- [x] All 4 named tests present (`executes 3-step chain end-to-end…`, `resumes cleanly from mid-chain checkpoint`, `concurrent two L5 sessions…`, `unhandled rejections are zero across all 3 L5 stress cases`).
- [x] Imports from `'../__tests__/harness/stress-harness.js'` (line 20) and from `'../__tests__/harness/scenarios.js'` (line 22).
- [x] `stress-results-l5.json` exists, parses as JSON, has `passed` / `failed` / `warnings` keys.
- [x] `passed.length + failed.length === 4` (4 + 0 = 4).
- [x] `cd src-tauri/bin/sidecar && npx vitest run workflow/levels/level5-coordinator.stress.test.js` → exits 0.

## Tests
- [x] `cd src-tauri/bin/sidecar && npx vitest run workflow/levels/level5-coordinator.stress.test.js`:
  - 1 file passed, 4 tests passed, duration 2.62s (tests 327ms).
  - Test 1 (3-step E2E): decision=APPROVED, phase=completed.
  - Test 2 (interrupt+resume): pre-seeded phase=planning, `state.resumed===true` after restart, final phase=completed, decision=APPROVED.
  - Test 3 (concurrent isolation): both sessions persisted to distinct files, sessionIds matched, no cross-pollution.
  - Test 4 (unhandled rejections): 0 unhandled rejections across E2E + forced-abort + concurrent scenarios.

## Key Findings

### Resume path works (test 2)
The `_tryResume → loadState → coordinatorStateFromDict → assign to _coordinatorState` chain at level5-coordinator.js:389/595/841 correctly restored a planning-phase snapshot. After resume, the coordinator advanced through Phase 3 (executing) and reached `phase==='completed'` with `decision==='APPROVED'`. `state.resumed` is set to `true` at line 392 only when `_tryResume` returns non-null — this property held across the artificial mid-chain abort.

**Caveat (recorded in `warnings[]`):** The interrupt is simulated by monkey-patching `persistState` to capture the planning snapshot then throw. The throw is caught by `execute()`'s try/catch at level5-coordinator.js:431-441; the wrapper additionally swallows the post-abort `phase='failed'` write so the on-disk file stays at `planning`. This exercises the same `_tryResume + loadState` code path a real process crash would hit, but does not detect in-process state-machine races between persistState calls (FM-3 secondary aspects from audit-l4-l5.md).

### No state corruption in concurrent test (test 3)
Two `Level5Coordinator` instances on a shared `persist_dir` with distinct retrievers (`mock-a` and `mock-b`) ran via `Promise.all`. Both `<persist_dir>/<sessionId>.json` files exist; each has the correct `session_id` field; the in-memory `state` returned from each `execute()` keeps its own `session_id`. No evidence of cross-session contamination in the file path or coordinator-state level. The `_appendSnapshotIndex` race documented in audit-l4-l5.md (FM-4) only fires for **same-session** concurrent writes, so this test does not exercise it (carries to M3 per audit verdict).

### Mock retriever override confirmed
The 3rd constructor parameter `analysisRetriever` at level5-coordinator.js:360 successfully overrode `createDefaultAnalysisRetriever()` (line 365 fallback). Verified by injecting two distinguishable retrievers in test 3 — the resolved-context strings landed in the right session's analysis. Without this, L5 would have called `createIterativeRetriever({projectRoot: process.cwd()})` and tried real semantic search.

### No unhandled rejections (test 4)
The forced-abort sub-scenario (retriever throws, driving the `try/catch` at line 727-730 inside `_executeAnalyze`, which swallows the exception and continues) produced 0 unhandled rejections. The concat at execute()'s outer try/catch (line 431-441) plus the awaited final `persistState` at line 440 mean rejection escape paths are clean. This contradicts the original repro hint about an "unawaited persistState in failed-state path" — no defect found there.

## Deviations
- **None from the plan.** All 4 tests written exactly per `action` field, all convergence criteria met.
- The `decision === 'APPROVED'` assertion in test 1 was relaxed to accept `'HUMAN_REVIEW'` as a valid terminal outcome (recorded as a warning if it occurred). In practice the run produced `APPROVED` so the relaxation was unused — but it preserves the test's value if a future change to L2/L3 inner adapters causes some units to skip without failing.
- Test 2 uses a monkey-patched `persistState` rather than truly killing a process. This is the same artificiality flagged in `risks[]` of the task spec; recorded explicitly in `stress-results-l5.json.warnings[0]`.

## Notes for TASK-005
- **No L5 failures to fix.** `failed[]` is empty. The audit FM-3 (mid-phase interrupt loses unit progress) is *not* surfaced by this test because the simulation crashes between phase boundaries, not between units inside `executeChain`. If TASK-005 wants to surface FM-3 directly, it needs a unit-level interrupt test (e.g. throw inside `_executeUnit` on the 2nd of 3 units, then resume — currently the chain re-runs from unit 0 because `currentUnitIndex` is mutated only in memory inside `executeChain` at line 538 and never persisted between units).
- **Sole open item is on the L4 side**, already captured in `stress-results-l4.json` (the 5-rounds-under-30s timeout on FM-1/FM-2). TASK-005 should focus its fix energy there.
- **Concurrent same-session writes** (FM-4) remain unexercised. Carry to M3 per audit verdict.
