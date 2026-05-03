# TASK-005: Fix discovered issues from L4/L5 stress runs

## Changes
- `src-tauri/bin/sidecar/workflow/levels/level4-brainstorm.js`:
  - Made `execute(state, kwargs)` `async` and switched it to `await this.generateArtifactsAsync(...)` (was the unused parallel variant; the sync `generateArtifacts` is preserved untouched for backward compat).
  - Wired `config.timeout_per_role` (default 60s) into `generateArtifactsAsync`: each role analysis is wrapped in `Promise.race([analysisPromise, timeoutPromise])` with a `setTimeout`-rejecting timer; the timer is cleared in `.finally`. Timeout failures degrade gracefully into a placeholder analysis (same shape as the existing catch path) — no throw.
  - Reworked `_analyzeAsRoleAsync` to prefer `writer.generate(prompt, {mode, role})` when the agent exposes that async API, so role analyses truly overlap under `Promise.allSettled`. Falls back to the synchronous `_analyzeAsRole` (which uses `writer.run({...})`) for writers that only expose the sync interface — preserves backward compatibility.
- `src-tauri/bin/sidecar/workflow/levels/level4-brainstorm.d.ts`:
  - `execute(...)` return type changed from `BaseState` to `Promise<BaseState>` to match the new async signature.
- `src-tauri/bin/sidecar/workflow/levels/level5-coordinator.js`:
  - `_executeWrite(cmd, state)` made `async`; the inner `brainstorm.execute(nextState)` call is now `await`ed.
  - `_executeRevise(cmd, state)` made `async`; its inner `_executeWrite(...)` call is `await`ed.
  - Inside the already-`async` `_executeUnit`: `_executeWrite` and `_executeRevise` invocations now `await`ed (commandType EXECUTE and REVISE branches).
- `src-tauri/bin/sidecar/workflow/levels/level4-brainstorm.stress.test.js`:
  - Test 1 (`runs 5 sequential rounds without unhandled rejections`) and Test 4 (`memory check: round 5 ...`) callbacks made `async`; their `level4.execute(state)` calls now `await`ed.
  - Test 2 (`5 rounds complete within 30s total`) was already async; its inner call now `await`ed.
  - Test 3 (concurrent two L4 sessions) needed no change — its `Promise.resolve().then(() => level4.execute(state))` chain auto-flattens the returned Promise.

## Verification

### Convergence criteria
- [x] `level4-brainstorm.js:221` now reads `await this.generateArtifactsAsync(...)`.
- [x] `execute(state, kwargs)` declared as `async`.
- [x] `generateArtifactsAsync` includes `Promise.race([analysisPromise, timeoutPromise])` with a `setTimeout`-based per-role timeout (`config.timeout_per_role * 1000` ms; default 60s).
- [x] L4 stress test exits 0 with all 4 tests recorded as passed; `stress-results-l4.json.failed[]` is empty.
- [x] L5 stress test still passes 4/4 — no regression.
- [x] Grep for `test.skip|@ts-ignore|eslint-disable` in `src-tauri/bin/sidecar/workflow/` returns only the pre-existing `eslint-disable-next-line no-empty` (in the test mock's busy-wait); 0 new suppressions.

## Tests

### Before fix (baseline from stress-results-l4.json)
- L4: 1 of 4 tests in `failed[]` — `5 rounds complete within 30s total`, error `Timeout: L4-5-rounds exceeded 30000ms after round 5/5 (elapsed 37500ms)` (sequential 5 rounds × 5 roles × 1500ms busy-wait).

### After fix
- L4: `cd src-tauri/bin/sidecar && npx vitest run workflow/levels/level4-brainstorm.stress.test.js` → exit 0, 4/4 tests recorded passed. The previously-failing test now reports `5 rounds finished in 7534ms (under 30s budget)` — a ~5x speedup (37500ms → 7534ms) from true parallelism via `Promise.allSettled` over async writers.
- L5 regression: `cd src-tauri/bin/sidecar && npx vitest run workflow/levels/level5-coordinator.stress.test.js` → exit 0, 4/4 still passing. No `failed[]` entries introduced.
- Combined run (both files): exit 0, 8/8 tests pass in 9.44s.

## Deviations
- **Updated `_analyzeAsRoleAsync` body in addition to the two minimal changes spelled out in the task brief.** The prior implementation was effectively `return this._analyzeAsRole(...)` — synchronous-in-an-async-wrapper, which still serializes role busy-waits in the test mock and therefore couldn't make the `5 rounds in 30s` convergence criterion pass. Routing through `writer.generate()` (an async API the existing IAgent factory mock already exposes) was the smallest extension needed for the timeout/parallelism fix to actually deliver the test pass; the sync `writer.run()` path is preserved as a fallback so production agents that only expose the sync interface continue to work unchanged.
- Updated `level4-brainstorm.stress.test.js` so tests 1, 2, and 4 `await level4.execute(...)` after the async refactor. This was within the spirit of "verify all callers `await` execute()" called out in the task spec.

## Notes
- L5 deferrals (FM-3 mid-`executeChain` interrupt) explicitly remain deferred per user clarification — TASK-006 will file them as M3 issues, not this task.
- `fix_commit: null` recorded in `stress-results-l4.json` per task instruction (the user requested no commit in this task).
- The sync `generateArtifacts` method is intentionally untouched and remains exported for any external caller still depending on the synchronous flow.
