# TASK-002: Build stress test harness — fixtures, validators, instrumentation

## Changes
- `src-tauri/bin/sidecar/workflow/__tests__/harness/stress-harness.js`: created. Exports `createMockContainer`, `createTempSessionRoot`, `withTimeout`, `validateNoUnhandledRejections`, `assertSessionState`. Imports `ContentType` from `../../session/session-manager.js`.
- `src-tauri/bin/sidecar/workflow/__tests__/harness/scenarios.js`: created. Exports `l4SequentialRounds(n)`, `l5ThreeStepChain()`, `concurrentL4Sessions(count)`. Uses `randomUUID` from `node:crypto` for unique session ids.
- `src-tauri/bin/sidecar/workflow/__tests__/harness/stress-harness.test.js`: created. 20 vitest smoke tests covering every export.
- `src-tauri/bin/sidecar/tests/globalTeardown.ts`: created (deviation — see below).

## Verification
- [x] `stress-harness.js` exists and exports the 5 required names — confirmed via successful import in test.
- [x] `scenarios.js` exists and exports the 3 required names — confirmed via successful import in test.
- [x] `stress-harness.test.js` exists.
- [x] `cd src-tauri/bin/sidecar && npx vitest run workflow/__tests__/harness/stress-harness.test.js` exits 0.
- [x] `cd src-tauri/bin/sidecar && npx vitest run workflow/__tests__/harness/` (full convergence verification) exits 0.

## Tests
- [x] `npx vitest run workflow/__tests__/harness/stress-harness.test.js`: **20/20 passed** in 84ms (1 test file, 20 tests, exit 0).
- Tests cover: `createMockContainer` (5 tests — shape, mapped responses, fallback, latency); `createTempSessionRoot` (3 tests — creation, uniqueness, cleanup); `withTimeout` (2 tests — pass-through, timeout label); `validateNoUnhandledRejections` (2 tests — pass=true, listener removal); `assertSessionState` (4 tests — present keys, missing key, invalid JSON, empty string); scenarios (4 tests — l4 carry-forward, l4 zero, l5 shape+uuid, concurrent unique ids).

## Deviations
- **Created `src-tauri/bin/sidecar/tests/globalTeardown.ts`** outside the declared task scope (`src-tauri/bin/sidecar/workflow/__tests__`). The bundled `src-tauri/bin/sidecar/vitest.config.js` references `tests/globalTeardown.ts` via `globalSetup`, but the file was missing in this compiled tree (it lives only in `src-ts/tests/globalTeardown.ts`). Without the shim, **no** vitest run inside `src-tauri/bin/sidecar/` can succeed — including the spec's exact convergence command. The shim mirrors the source-tree implementation: best-effort `closeAllPools()` import, no-op on failure. This is a pre-existing infrastructure gap surfaced by this task; flagging for follow-up to ensure the build pipeline copies `tests/` into the sidecar bundle (or for the sidecar dir to be regenerated from `src-ts/`).

## Notes for TASK-003 / TASK-004
- Import paths from a sibling `__tests__/level4-stress.test.js` or `level5-stress.test.js`: `from './harness/stress-harness.js'` and `from './harness/scenarios.js'`.
- `createMockContainer` returns the exact shape consumed by L4/L5 levels: `container.getAgent(type, opts).generate(prompt)`. Pass `responses` keyed by `AgentType` string values (e.g. `{ writer: '...', critic: '...' }`).
- `assertSessionState` requires a real or fake `sessionMgr` with a `read(sessionId, ContentType.STATE)` method returning a JSON string. The harness re-exports nothing from `session-manager.js` — TASK-003/004 must import `SessionManager` and `ContentType` directly when they need a real manager.
- `withTimeout` rejection message format: `Timeout: <label> after <ms>ms` — useful for assertion in fail-fast paths.
- `validateNoUnhandledRejections().stop()` returns `{pass, errors}`; `errors` retains rejection reasons for diagnostic logging.
- All scenario builders are pure data factories — they do not init sessions. Callers of `concurrentL4Sessions` must `sessionMgr.init(state.session_id, ...)` for each before invoking the level.
- The harness deliberately does not depend on `BaseAgent` or any concrete agent implementation — keep this constraint when extending it so L4/L5 stress tests stay isolated from agent runtime details.
- **Heads up**: future test runs in `src-tauri/bin/sidecar/` rely on the `tests/globalTeardown.ts` shim created here. If a re-bundle of the sidecar overwrites or deletes the `tests/` dir, this file must be re-created (or the source-tree `src-ts/tests/globalTeardown.ts` must be copied as part of the build).
