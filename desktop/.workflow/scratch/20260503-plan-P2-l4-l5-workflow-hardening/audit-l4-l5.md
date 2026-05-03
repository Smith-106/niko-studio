# Audit: L4 / L5 / SessionManager / ResumeStrategy

**Audited at:** 2026-05-03
**Scope:** TASK-001 of PLN-006 (M2 Phase 2 entry audit)
**Files read:**
- `src-tauri/bin/sidecar/workflow/levels/level4-brainstorm.js` (671 LOC)
- `src-tauri/bin/sidecar/workflow/levels/level5-coordinator.js` (932 LOC)
- `src-tauri/bin/sidecar/workflow/session/session-manager.js` (376 LOC)
- `src-tauri/bin/sidecar/workflow/session/resume-strategy.js` (537 LOC)
- `src-tauri/bin/sidecar/workflow/levels/base-level.js` (17 LOC)

**Verdict:** Phase 2 hardening targets are reachable; 7 failure modes identified, 4 of which the stress harness must exercise to clear Phase 2 success criteria (SC-1 no-hang, SC-2 resume-clean, SC-3 isolation).

---

## L4 Brainstorm State Machine

**Class:** `Level4Brainstorm` (level4-brainstorm.js:179). No persistence; state is the caller-owned `state` object mutated via `state.current_step`.

### Internal phase chain (one `execute()` call)

| # | Phase | `state.current_step` set | Method | File:line |
|---|-------|--------------------------|--------|-----------|
| 1 | Parallel role analysis | `'brainstorm'` | `generateArtifacts` (sequential `for`) | level4-brainstorm.js:220-221 |
| 2 | Synthesis | `'synthesize'` | `synthesize` | level4-brainstorm.js:224-225 |
| 3 | Specification gen | `'specification'` | `generateSpecification` | level4-brainstorm.js:228-230 |
| 4 | Verify | `'verify'` | `_verifySpecification` | level4-brainstorm.js:233-234 |

Terminal `state.decision` set at line 238 (`'APPROVED'` | `'HUMAN_REVIEW'`) or line 245 (`'FAILED'` on caught exception).

### 5-round model (user-confirmed)

L4 has no internal loop. The "5-round" semantic is the **caller** re-invoking `execute()` up to 5 times with an accumulating `state.context`. Rounds are sequential — the round counter, max-round enforcement, and timeout-per-round live entirely in the caller, not in `Level4Brainstorm`. Defaults: `max_revisions: 5`, `pass_score: 85` (level4-brainstorm.js:254-255).

### Parallelism gap (sync vs async)

- `generateArtifacts` (line 271) — **sequential** `for` loop over roles, used by sync `execute()` at line 221.
- `generateArtifactsAsync` (line 299) — `Promise.allSettled` over roles. **Not called from `execute()`.**
- Net: `Level4Brainstorm.execute()` is sync; `max_parallel: 4` (line 257) is dead config.

### Per-role failure handling

`generateArtifacts` catches per-role exceptions (line 280) and pushes a placeholder analysis with score 0. So one role throwing does not fail the round; the whole `try` at line 218 only catches re-throws from `synthesize` / `generateSpecification` / `_verifySpecification`.

### Timeout enforcement

`timeout_per_role: 60` is read at line 273 into a local `timeoutPerRole`, **never used**. `_analyzeAsRole` (line 413) does a synchronous `writer.run(...)` with no timer, no AbortSignal. → Hang risk if the agent runtime blocks.

---

## L5 Coordinator Phase Machine

**Class:** `Level5Coordinator` (level5-coordinator.js:351). State persisted via `persistState()` at every phase boundary.

### `_coordinatorState.phase` transitions

| From | To | Trigger | persistState after | File:line |
|------|----|---------|--------------------|-----------|
| (constructor) | `'init'` | `createCoordinatorState` | — | :235, :363, :395 |
| `'init' \| 'analyzing'` | `'analyzing'` | enter Phase 1 block | yes | :399-402 |
| `'analyzing'` | `'planning'` | enter Phase 2 block | yes | :405-408 |
| `'planning'` | `'executing'` | enter Phase 3 block | yes | :411-414 |
| `'executing'` | `'completed'` | `_allUnitsCompleted()` true | yes (final) | :417-421, :429 |
| `'executing'` | (stays) | not all done → `decision='HUMAN_REVIEW'` | yes (final) | :423-425, :429 |
| any | `'failed'` | thrown exception | yes (best-effort) | :432-440 |

### persistState call sites

5 calls in `execute()`:
- line 402 — after Phase 1 (analyzing)
- line 408 — after Phase 2 (planning)
- line 414 — after Phase 3 (executing chain finished)
- line 429 — final commit (timestamp + decision)
- line 440 — failed-state best-effort write

`persistState` itself (line 573) writes **two** sinks sequentially:
1. file at `${persistDir}/${sessionId}.json` via `writeFile` (line 579, non-atomic — no temp+rename)
2. `SessionManager.write(sessionId, 'state', ...)` (line 585, also non-atomic, also triggers `_appendSnapshotIndex`)

Either write failing logs `console.warn` and **continues** — no rollback, no error propagation to `execute()`.

### Resume entry point

- `_tryResume(sessionId)` at line 389 (called early in `execute()`).
- Loads via `loadState` (line 595) which tries SessionManager first (line 598), falls back to file (line 609).
- Returns `null` if `phase === 'completed' || phase === 'failed'` (line 843) — terminal sessions never resume, so a re-invoke creates a fresh state at line 395.

### Mid-phase interrupt windows

The phase-boundary persistence pattern means **anything** between two `persistState` calls is unrecoverable beyond the last persisted phase:
- crash inside `_analyzeRequirementsPhase` after `phase='analyzing'` at line 400 but before `persistState` at line 402 → resume re-runs analyze (idempotent; analyze is pure → safe).
- crash inside `_executeChainPhase` between line 412 (phase set) and line 414 (persistState) — chain may have **partially executed units** with their `state` mutations not persisted; resume re-runs the entire chain. Per-unit progress (`currentUnitIndex` at line 538, `overallProgress` at line 539) is mutated in memory but **never persisted between units** — only at chain end.

---

## SessionManager Isolation Guarantees

**Class:** `SessionManager` (session-manager.js:57). Per-session subdirectory under `activePath`/`archivedPath`.

### Path isolation (good)

- `_assertValidSessionId` (line 72) — strict regex `^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$` blocks path-traversal in session id.
- `_resolvePath` (line 305) — resolves template, then asserts `parentDir.startsWith(baseResolved + path.sep)` (line 314). Escape attempt throws.
- Per-session dirs created at `init` (line 79-83): `chapters/`, `.data/`, `.data/characters/`.

### Concurrency guarantees (none)

| Operation | File:line | Atomicity | Race window |
|-----------|-----------|-----------|-------------|
| `_appendSnapshotIndex` | :348-368 | **read-JSON → push → writeFileSync** | concurrent writers to same session lose entries |
| `_saveSessionInfo` | :328-333 | full-file `writeFileSync` | last-writer-wins on `session.json` |
| `_updateTimestamp` | :369-375 | load + save | races against any other `_saveSessionInfo` caller |
| `appendAudit` | :144-152 | `appendFileSync` (POSIX-atomic for small writes) | — (the single safe path) |
| `archive` / `restore` | :153-178 | `renameSync` then `_saveSessionInfo` | rename atomic; status update racy |

The `_appendSnapshotIndex` race is the one that bites under L5 concurrent persist: every `write` (line 141) AND every `appendAudit` (line 150) calls it. If two L5 sessions ever share a session id (they shouldn't, but bug paths exist) the index file silently loses entries.

### Cross-session isolation

- Different `sessionId` → different directory → no shared state in SessionManager itself.
- BUT: shared global state lives elsewhere — see Failure Mode 5 below (graph-manager singleton in Phase 1).

### L5 ↔ SessionManager coupling

- `Level5Coordinator` instantiates `SessionManager` via adapter at line 21 (`createSessionManagerAdapter`) — adapter only wires `init`/`write`/`read` for `'state'` content type.
- `SessionManager.init` is called in a try/catch at level5-coordinator.js:381-388 — failure swallowed into `state.warnings`. Continues even if the per-session dir was not created.

---

## ResumeStrategy Modes

| Mode | Class | File:line | Behavior | Used by L5? |
|------|-------|-----------|----------|-------------|
| `NATIVE` | `NativeResumeStrategy` | :131-222 | CLI `--resume <native_id>` via `.native_mapping.json` | indirectly via Hybrid |
| `PROMPT_CONCAT` | `PromptConcatStrategy` | :226-347 | Slice last N turns, prepend as YAML/JSON/PLAIN prefix | indirectly via Hybrid |
| `HYBRID` | `HybridStrategy` | :351-422 | Try native, fall back to concat | yes (resolver default for multi-merge) |
| `DISABLED` | (resolver only) | :438 | No resume IDs → return `DISABLED` | trivially |

Note: **L5 itself does not invoke ResumeStrategy.** L5 resume goes through `loadState`/SessionManager (level5-coordinator.js:595). ResumeStrategy is the chain-orchestration layer above L5 (caller-owned) for `/maestro` workflows. The harness must distinguish:
- L5-internal mid-phase resume → `_tryResume` + `loadState` path
- Multi-step chain resume → `ResumeStrategyResolver.determineStrategy` (resume-strategy.js:436)

### Hybrid fallback chain (resume-strategy.js:366-384)

1. `nativeStrategy.canResume` true → `nativeStrategy.resume` → on throw, log warning, fall through.
2. `concatStrategy.canResume` true → `concatStrategy.resume` with `metadata.fallback_used = true`.
3. Both fail → throw "Cannot resume session".

### Checkpoint cap

Both `NativeResumeStrategy.saveCheckpoint` (line 218) and `PromptConcatStrategy.saveCheckpoint` (line 287) hard-cap at `slice(-10)`. Older checkpoints are silently dropped — irrecoverable after the 11th checkpoint. The `HybridStrategy.saveCheckpoint` delegates to `concatStrategy` (line 386) — native checkpoint file is **never written** in hybrid mode, breaking native resume on a hybrid-only session.

### Native session ID storage

`.native_mapping.json` at `${basePath}/.native_mapping.json` (resume-strategy.js:141). Loaded once at constructor (line 138). On read failure → `console.warn`, **map silently empty** (line 146-148). On disk delete between save and resume → next resume call gets `nativeId = null` → `canResume` false → falls back to concat.

### Resolver decision matrix (resume-strategy.js:436-503)

| Inputs | Result strategy | Branch |
|--------|----------------|--------|
| no resumeIds | `DISABLED` | :437 |
| 1 id, no customId, cross-tool | `PROMPT_CONCAT` | :447-454 |
| 1 id, no customId, native supported, native id present | `NATIVE` | :459-467 |
| 1 id, no customId, no native id | `PROMPT_CONCAT` (with `fallback_strategy`) | :469-475 |
| customId present | `PROMPT_CONCAT` (fork) | :478-486 |
| >1 ids | `HYBRID` (merge) | :488-495 |
| else | `PROMPT_CONCAT` | :497-502 |

---

## Suspected Failure Modes

| # | Symptom | Suspect file:line | Repro hint | Severity |
|---|---------|-------------------|------------|----------|
| 1 | L4 5-round can hang on slow role; whole round blocks because `generateArtifacts` is sequential | level4-brainstorm.js:271-294 (sequential `for`); level4-brainstorm.js:221 (sync execute calls sync variant) | Inject 5 default roles where one writer.run sleeps 30s. Wall-clock >> 30s instead of ~6s parallel. Phase 2 SC-1 "no-hang" fails. | **High** — primary Phase 2 SC-1 risk |
| 2 | L4 per-role timeout never enforced — a wedged agent stalls execute() forever | level4-brainstorm.js:258 (`timeout_per_role: 60` in default config); level4-brainstorm.js:273 (`timeoutPerRole` read but unused); level4-brainstorm.js:417 (`writer.run` no timer/AbortSignal) | Stub writer.run to never resolve (or for sync path: never return). Round hangs forever. No `signal`, no `Promise.race(timeout)`. | **High** — root of FM-1 |
| 3 | L5 mid-phase interrupt loses in-flight unit progress | level5-coordinator.js:402 → :408 → :414 gaps; level5-coordinator.js:538-539 (per-unit progress mutated only in memory inside `executeChain`) | Inject `process.exit(1)` between units inside `executeChain` (e.g. after first unit completes). Resume re-runs entire chain from unit 0; `currentUnitIndex` lost. Phase 2 SC-2 "3-step resume clean" fails if test asserts unit-level resume. | **High** — direct Phase 2 SC-2 risk |
| 4 | SessionManager snapshot-index race silently drops entries on concurrent same-session writes | session-manager.js:348-368 (read-JSON → push → writeFileSync) | Two `persistState` calls (e.g. L5 phase 1 and phase 2 firing close together if `execute()` were re-entrant, or two adapters sharing a sessionId) → race; final `snapshot-index.json` has only one of the two new entries. | **Medium** — observable as audit-log gaps; correctness, not crash |
| 5 | Concurrent L4 sessions collide on shared graph-manager state (Phase 1 singleton) | external: graph-manager Phase 1 `searchEntities` at graph-manager.js:919 referenced from M1 audit; not isolated per-session in current adapters | Spin two L4 sessions in parallel calling `_executeAnalyze` (level5-coordinator.js:698) → both hit shared `createDefaultAnalysisRetriever()` (level5-coordinator.js:39) using `process.cwd()` projectRoot. Stale embeddings + overlapping retrieves. Phase 2 SC-3 "concurrent isolation" fails. | **High** — direct Phase 2 SC-3 risk |
| 6 | ResumeStrategy native session id loss across `.native_mapping.json` corruption/delete | resume-strategy.js:140-149 (silent fallback to empty map); resume-strategy.js:160-162 (`getNativeSessionId` returns null silently) | `rm .writing/sessions/.native_mapping.json` between save and resume → next `HybridStrategy.resume` falls through to concat with `fallback_used: true`. No error surfaced; user sees "resumed" but native CLI link is gone. | **Medium** — graceful degradation by design, but no telemetry signal |
| 7 | `HybridStrategy.saveCheckpoint` only writes concat checkpoints; native cannot resume after hybrid-only run | resume-strategy.js:385-387 (`saveCheckpoint` delegates to `concatStrategy` only) | Run a session with HybridStrategy, save N checkpoints, kill process, instantiate fresh `NativeResumeStrategy` for same sessionId → `getLatestCheckpoint` returns null because checkpoint file populated by concat is the same file but native never registered native_id at save time. `canResume` false. | **Low/Medium** — design quirk, not Phase 2-blocking |

### Coverage map vs Phase 2 success criteria

| SC | Failure modes blocking |
|----|-----------------------|
| SC-1 L4 5-round no-hang | FM-1, FM-2 |
| SC-2 L5 3-step resume clean | FM-3 |
| SC-3 concurrent L4 isolation | FM-5 (and FM-4 as secondary) |
| SC-4 remaining issues documented | FM-4, FM-6, FM-7 (carry to M3) |

### Out-of-Phase-2 (defer to M3)

- FM-4 snapshot-index race — not a hang/crash, currently unobservable in single-session usage
- FM-6 native_mapping silent fallback — needs telemetry, not a fix
- FM-7 hybrid checkpoint asymmetry — needs design discussion (single vs dual checkpoint file)

---

## Inputs for downstream tasks

**TASK-002 (harness fixtures):** must include
- L4 fixture with one slow role (FM-1, FM-2)
- L5 fixture that crashes mid-`executeChain` between units (FM-3)
- Two-session L4 fixture sharing project root (FM-5)

**TASK-005 (fix candidates, ranked):**
1. Wire `Level4Brainstorm.execute()` to call `generateArtifactsAsync` + add per-role `Promise.race(timeout)` (closes FM-1 + FM-2)
2. Persist `currentUnitIndex` after every unit in `executeChain` (closes FM-3)
3. Per-session AnalysisRetriever (closes FM-5)

**TASK-008 (docs/known-issues):** carry FM-4, FM-6, FM-7 forward.
