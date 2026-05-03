# TASK-005 Port-Fix: Wave 1-3 .js → src-ts/ TypeScript

## Goal
Port Wave 1-3 changes — which had been written into the gitignored compiled
sidecar tree at `desktop/src-tauri/bin/sidecar/...` — into the canonical
TypeScript source under `src-ts/` so the changes survive
`build:sidecar:node`. Then rebuild the sidecar so its compiled output reflects
the canonical source.

## Files Modified (in `src-ts/`)

### Core source fixes
- **`src-ts/workflow/levels/level4-brainstorm.ts`**
  - `execute(state, kwargs)` → `async execute(state, kwargs): Promise<BaseState>`
  - Phase-1 call switched from synchronous `this.generateArtifacts(...)` to
    `await this.generateArtifactsAsync(...)`.
  - `generateArtifactsAsync` now wraps each role in
    `Promise.race([analysisPromise, timeoutPromise]).finally(clearTimeout)`
    where `timeoutPromise` rejects with
    `Role ${role} timeout after ${ms}ms` after
    `(config.timeout_per_role ?? 60) * 1000` ms — enforcing the previously
    unused `timeout_per_role` knob.
  - `_analyzeAsRoleAsync` now prefers `writer.generate(prompt, opts)`
    (async) when present so role analyses can truly overlap; falls back to
    sync `_analyzeAsRole(...)` otherwise. The capability check is a defensive
    `typeof writer.generate === 'function'` so the existing
    `IServiceContainer` shape (which only requires `run()`) keeps working.

- **`src-ts/workflow/levels/level5-coordinator.ts`**
  - `_executeWrite(cmd, state)` and `_executeRevise(cmd, state)` are now
    `async ... Promise<Record<string, unknown>>`.
  - The brainstorm branch inside `_executeWrite` awaits
    `brainstorm.execute(nextState)` (it is now async).
  - `_executeRevise` awaits its inner `_executeWrite` call.
  - `_executeUnit` awaits both helpers at the EXECUTE and REVISE branches.

### Existing test updates (async cascade)
- **`src-ts/tests/workflow/level4-brainstorm.test.ts`**
  - The "synthesizes analyses … and approved execute result" case is now
    `async () =>` and `await`s `brainstorm.execute(...)`.
- **`src-ts/tests/workflow/level5-coordinator.test.ts`**
  - The brainstorm spy switched from sync
    `mockImplementation((state) => ({...state, ...}))` to async
    `mockImplementation(async (state) => ({...state, ...}))` so it returns a
    `Promise<BaseState>` matching the new signature.

## Files Created (in `src-ts/tests/workflow/`)

- **`harness/stress-harness.ts`** — TypeScript port of
  `desktop/.../sidecar/workflow/__tests__/harness/stress-harness.js`.
  Exports: `createMockContainer({responses, latency})`,
  `createTempSessionRoot()`, `withTimeout(promise, ms, label)`,
  `validateNoUnhandledRejections()`, `assertSessionState(mgr, id, shape)`.
  Adds proper interfaces (`MockContainer`, `MockAgent`, `TempSessionRoot`,
  `UnhandledRejectionGuard`) and types every public/private surface.
- **`harness/scenarios.ts`** — TS port; exports `l4SequentialRounds(n)`,
  `l5ThreeStepChain()`, `concurrentL4Sessions(count)` plus interfaces
  `L4RoundState`, `L5ChainState`, `L4ConcurrentSessionState`.
- **`harness/stress-harness.test.ts`** — 20 vitest cases mirroring the JS
  self-test, with `as Type` annotations replaced by typed factories.
- **`level4-brainstorm.stress.test.ts`** — 4 vitest cases for L4 stress
  (sequential rounds, 30s budget, concurrent sessions, role-array length
  invariant). `recordPass/recordFail` collector mirrors the JS version, and
  the results JSON path resolves to the same scratch dir
  (`desktop/.workflow/scratch/20260503-plan-P2-l4-l5-workflow-hardening/stress-results-l4.json`)
  by going `process.cwd() / .. / desktop / .workflow / scratch / ...`.
- **`level5-coordinator.stress.test.ts`** — 4 vitest cases for L5 stress
  (3-step E2E persist, mid-chain resume, concurrent persist isolation,
  unhandled-rejection probe).

## Build Result
`cd src-ts && npm run build` — exit 0, no TS errors.
`cd src-ts && npm run typecheck` — exit 0, no errors.

## Test Result
- `npm run test -- workflow/harness/stress-harness` — **20/20 pass**.
- `npm run test -- workflow/level4-brainstorm.stress workflow/level5-coordinator.stress` — **8/8 pass**.
  - Notably the "5 rounds within 30s" L4 case completed in ~7.5 s — proving
    the parallel `generateArtifactsAsync` path is now wired in (would have
    been ~37.5 s sequential).
- `npm run test -- workflow/level4-brainstorm.test workflow/level5-coordinator.test` — **8/8 pass** (existing unit tests survived the async cascade).
- `npm run test -- workflow/` — **425/426 pass**. The single failure is in
  `tests/workflow/workflow-engine.test.ts` (`DESTRUCTIVE_STEP_NAMES`
  expecting `'revise'`) and is **pre-existing** — `git diff HEAD` shows no
  modifications to `workflow-engine.ts` or its test file. Unrelated to this
  port.

## Sidecar Rebuild
`cd desktop && npm run build:sidecar:node` — completed successfully
(stage dir refreshed, prod deps hydrated, native trim ran). The compiled
bundle now reflects the async fix:
- `desktop/src-tauri/bin/sidecar/workflow/levels/level4-brainstorm.js:221`
  → `const analyses = await this.generateArtifactsAsync(...)`.
- Same file, line 312 → `Promise.race([analysisPromise, timeoutPromise])`.
- `level5-coordinator.js:660` → `result = await this._executeWrite(...)`.
- `level5-coordinator.js:666` → `result = await this._executeRevise(...)`.
- `level5-coordinator.js:757` → `async _executeWrite(cmd, state)`.
- `level5-coordinator.js:773` → `const updated = await brainstorm.execute(...)`.
- `level5-coordinator.js:833` → `async _executeRevise(cmd, state)`.

## Leftover Compiled-Only Artifacts (cleaned up by rebuild)
The sidecar rebuild **removed** the following files because they were never
in canonical source — they only existed in the compiled tree from Wave 2/3:
- `desktop/src-tauri/bin/sidecar/workflow/__tests__/harness/stress-harness.js` (gone)
- `desktop/src-tauri/bin/sidecar/workflow/__tests__/harness/scenarios.js` (gone)
- `desktop/src-tauri/bin/sidecar/workflow/__tests__/harness/stress-harness.test.js` (gone)
- `desktop/src-tauri/bin/sidecar/workflow/levels/level4-brainstorm.stress.test.js` (gone)
- `desktop/src-tauri/bin/sidecar/workflow/levels/level5-coordinator.stress.test.js` (gone)

This is the desired end state: `src-ts/tests/` is excluded from `tsc` and
the sidecar bundle only ships compiled production code, so harness + stress
tests live exclusively under `src-ts/tests/workflow/...` going forward.

## Translation Notes (any non-clean ports)
- The `MockContainer.getAgent` return type uses `MockAgent` (just
  `{generate(prompt): Promise<string>}`). The L4 stress test's container
  shape is *richer* — it adds `run({prompt, mode, role})` returning
  `{content}` to satisfy the synchronous fallback path inside
  `_analyzeAsRoleAsync`. This is captured as a local `L4MockAgent`/
  `L4MockContainer` interface inside `level4-brainstorm.stress.test.ts`
  rather than expanding the harness's general `MockAgent`, since only the
  L4 stress test exercises both code paths.
- The `Level4Brainstorm` constructor is invoked as
  `new Level4Brainstorm({}, container as never)` in the stress test —
  matches the existing `level4-brainstorm.test.ts` style.
  `IServiceContainer` requires `run(input): Record<string, unknown>` and the
  stress container returns `{content: string}` which is structurally
  compatible.
- `coordinatorStateFromDict` was not re-imported in the stress test
  (unlike the .js version) because we don't need it — only
  `coordinatorStateToDict` and the `CoordinatorState` type are used.

## Status
- All convergence criteria met.
- Source of truth restored: `src-ts/` is now the durable home for the
  Wave 1-3 fix, and `desktop/src-tauri/bin/sidecar/` is regenerable from it.
- No commit was created (per user instruction — Wave 1-3 + this port will
  ship as one atomic).
