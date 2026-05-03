# TASK-003: L4 Brainstorm stress tests — 5 sequential rounds + concurrent sessions

## Changes
- `src-tauri/bin/sidecar/workflow/levels/level4-brainstorm.stress.test.js` (new): 4-test vitest suite covering 5-round sequential execution, 30s timeout guard, two-session isolation, and memory/role-count check. Tests use the recording-not-throwing pattern — every catch records to `results.failed[]` and the suite still exits 0.
- `.workflow/scratch/20260503-plan-P2-l4-l5-workflow-hardening/stress-results-l4.json` (new): structured findings consumed by TASK-005.

## Verification
- [x] File `level4-brainstorm.stress.test.js` exists at the expected path.
- [x] Contains test name `'runs 5 sequential rounds without unhandled rejections'` (line 104).
- [x] Contains test name `'concurrent two L4 sessions on shared session root preserve isolation'` (line 193).
- [x] Imports from `'../__tests__/harness/stress-harness.js'` (line 19).
- [x] `stress-results-l4.json` exists, parses, has keys `passed`, `failed`, `warnings`.
- [x] `cd src-tauri/bin/sidecar && npx vitest run workflow/levels/level4-brainstorm.stress.test.js` → 4 passed (vitest), exit 0.
- [x] `passed.length (3) + failed.length (1) === 4`.

## Tests
- [x] `cd src-tauri/bin/sidecar && npx vitest run workflow/levels/level4-brainstorm.stress.test.js` → **Test Files: 1 passed (1); Tests: 4 passed (4); Duration: 39.48s**.

## Findings (per stress-results-l4.json)

### passed[] (3)
1. **runs 5 sequential rounds without unhandled rejections** — clean. No unhandled promise rejection across 5 rounds. `state.errors` empty after each call. `state.role_analyses` array populated each round.
2. **concurrent two L4 sessions on shared session root preserve isolation** — clean. Two `Level4Brainstorm.execute()` calls on independent state objects against a shared `SessionManager(tempRoot)` produce distinct `role_analyses` arrays (no shared-by-reference). Each session's `session.json` exists at `<root>/active/<id>/session.json`. **Note**: This passes only because `Level4Brainstorm` itself does not touch `SessionManager` or any shared global cache (verified vs audit FM-5). The audit's actual FM-5 risk lives in `Level5Coordinator` via `createDefaultAnalysisRetriever()` and surfaces only when L5 wraps L4 — TASK-004 (L5 stress) covers that.
3. **memory check: round 5 state.role_analyses length matches expected role count** — clean. After 5 sequential `execute()` invocations, `state.role_analyses.length === getDefaultRoles().length === 5`. No duplication (state is overwritten, not appended to, at line 222).

### failed[] (1) — FM-1 surfaced as expected
1. **5 rounds complete within 30s total** — `Timeout: L4-5-rounds exceeded 30000ms after round 5/5 (elapsed 37500ms)`.
   - **file_line**: `level4-brainstorm.js:271-294`
   - **Root cause**: Confirms audit FM-1 + FM-2. With per-role writer latency = 1500ms and 5 default roles, sequential `for`-loop in `generateArtifacts` (line 274) produces 1500ms × 5 roles × 5 rounds = 37500ms wall clock. The async sibling `generateArtifactsAsync` at line 299 (`Promise.allSettled` parallel) is **not invoked** by `execute()`. `timeout_per_role: 60` config (line 258) is read at line 273 into `timeoutPerRole` and immediately dropped — no `Promise.race` against an `AbortSignal` or timer. A wedged role agent therefore stalls a round indefinitely.
   - **repro hint** (for TASK-005): "generateArtifacts is sequential (for-loop); generateArtifactsAsync at :299 unused. timeout_per_role read at :273 then dropped. Wire execute() to generateArtifactsAsync + Promise.race(timeout)."

## Deviations
- **Test-suite uses wall-clock measurement instead of `withTimeout` for FM-1 detection.** `Level4Brainstorm.execute()` is synchronous and the busy-wait writer mock blocks the event loop; an async `setTimeout(...)` from `withTimeout` cannot fire until after the sync work returns, defeating the timeout race. The test instead checks `Date.now() - start > 30000` between rounds and throws (recorded as failure). `withTimeout` is still imported per the spec contract but unused at the call site. **Vitest test timeout** was raised to 60000ms via `test('...', fn, 60000)` so the 37.5s sequential run can complete and record the finding (default 5s would have killed the test outside the try/catch and produced a false hard-fail).
- **`buildL4Container()` helper added inside the test file.** The shared `createMockContainer` from `stress-harness.js` exposes only `generate(prompt)` (async, returns string), but Level4Brainstorm calls `writer.run({...})` (sync, returns `{content}`). Wrapping locally was cleaner than extending the shared harness for an L4-specific signature.
- **`session_id` sanitization** — `concurrentL4Sessions(2)` returns `randomUUID()` which contains hyphens but starts with hex digits (valid). I added a defensive `replace(/[^A-Za-z0-9_-]/g, '-')` anyway in case the scenarios helper changes.

## Notes for downstream
- **TASK-005 inputs**: One ranked fix surfaced — `Level4Brainstorm.execute()` should call `generateArtifactsAsync` and add per-role `Promise.race(timer)` keyed off `config.timeout_per_role * 1000`. After that fix, this test file's `5 rounds complete within 30s total` should move from `failed[]` to `passed[]` automatically because the dual setup (sync busy-wait writer + sync execute()) becomes async-friendly under `_analyzeAsRoleAsync`.
- **No touch on globalTeardown.ts** — file already present from TASK-002; vitest startup clean.
- **Per-test timeout pattern**: Used `test(name, fn, 60000)` only on the one slow test; the other three run in <30ms each.

## Compliance
- No commit created (per instruction).
- File modifications stayed inside `scope: src-tauri/bin/sidecar/workflow/levels` and `focus_paths`.
- All 4 named test cases present and reported.
