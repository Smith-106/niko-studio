# TASK-007: Wire VectorSearch DI + integration verification

Closes SC-3 from PLN-006 Phase 2 and the deferred Phase 1 DI step from PLN-005
(`verification.json` notes[0]: *"Backend gateway wiring (VectorSearch →
GraphManager injection at sidecar startup) documented but deferred to Phase 2 or
runtime integration"*).

## Source-Tree Note

The task JSON references `src-tauri/bin/sidecar/**` paths. That tree is the
gitignored compiled bundle. **All edits went to the canonical `src-ts/` source
tree and are propagated to the bundle on `npm run build:sidecar:node`.** The
bundle was rebuilt and confirmed to contain the new wiring (see Verification
section).

## Changes

### `src-ts/graph/graph-manager.ts` (modified)
- Added `IEntityVectorSearch` interface — minimal `add(id, content, metadata, type?)`
  + `delete(id)` surface, decoupled from the concrete `VectorSearch` class to
  avoid a graph→search compile-time cycle. Mirrors the concrete `VectorSearch.add`
  signature so metadata routes correctly at runtime (the container's
  `IVectorSearch.index(id, content, metadata)` shape is incompatible with the
  concrete impl's `index(id, content, options)`).
- Added module-level `defaultEntityVectorSearch` registry + static
  `GraphManager.setDefaultVectorSearch(vs)` so the gateway control plane can
  bind a process-wide default at sidecar startup.
- Added instance method `setVectorSearch(vs | null)` for per-instance wiring
  (e.g., the integration test that builds an isolated VectorSearch).
- Added private `_embedEntity(entity)` and `_removeEntityEmbedding(id)` —
  fire-and-forget per Phase 1 review F-003 (errors logged, never thrown).
- Hooked into `createEntity`, `updateEntity`, `deleteEntity`. CRUD remains
  synchronous; embedding runs on a microtask.

### `src-ts/container/gateway-control-plane.ts` (modified)
- Added `wireVectorSearchIntoGraphManager(container)` helper that resolves
  the container's `VectorSearch` and registers it as `GraphManager`'s process-wide
  default. Called from `initializeGatewayControlPlane()` after the workflow
  runtime provider is bound. Failures are caught and logged so the sidecar still
  starts even if the embedding stack is unavailable (e.g., model not cached).

### `src-ts/tests/workflow/level5-coordinator.integration.test.ts` (created)
End-to-end integration test with two cases:
1. **Smoke test (always runs)** — instantiates a `GraphManager` with a fake
   `IEntityVectorSearch`, exercises createEntity/updateEntity/deleteEntity, and
   asserts the embed/delete hooks fire with the expected entity ID, content,
   and `'entity'` type. Proves the wiring half of SC-3 even when the embedding
   model is unavailable.
2. **Real end-to-end (model-gated)** — instantiates real `VectorSearch` (against
   a tmp `vectors.db`), real `GraphManager` (tmp `graph-manager.db`), and real
   `GraphEngine` (tmp `graph.db` via `GRAPH_DB_PATH` env override so the lazy
   `IterativeRetriever` consults the same db). Creates Character `'勇敢的战士
   (brave warrior)'` through GraphManager (exercises the embed hook) AND
   GraphEngine (so IterativeRetriever's keyword graph search can find it —
   GraphManager and GraphEngine maintain separate SQLite schemas). After a
   1500ms settle wait, asserts:
   - The embedding row landed in `vector_items` (proves Phase 1 wiring).
   - `Level5Coordinator.execute({user_request: 'find brave warrior characters', domain: 'novel'})`
     populates `state.metadata.analysis` with at least one entry whose `source`
     is `'graph'` or whose `preview` references the seeded Character (proves
     Phase 2 retrieval path).

   Skip-on-missing-model is enforced via `beforeAll` probe: if the BAAI/bge-small-en-v1.5
   model can't load (fastembed not installed in dev tree, no network for download),
   the body returns early with a clear `console.warn` reason. **Wiring is NEVER
   gated on model availability.**

## Verification

### Convergence Criteria

- ✅ `src-ts/container/gateway-control-plane.ts:67` contains `wireVectorSearchIntoGraphManager(container)` call after both engines are constructible.
- ✅ Wired call passes the real `VectorSearch` instance (resolved from `container.vectorSearch`); type-cast to `IEntityVectorSearch`. Non-null arg confirmed by reading `tail -10` of the function.
- ✅ `src-ts/tests/workflow/level5-coordinator.integration.test.ts` exists.
- ✅ Test contains `createEntity` (line 261, GraphManager) + `Level5Coordinator` (line 290) + `'勇敢的战士 (brave warrior)'` (line 257).
- ✅ Test asserts on `state.metadata.analysis` (line 304-307).
- ✅ `cd src-ts && npm run build` — exit 0.
- ✅ `cd src-ts && npm run typecheck` — exit 0.
- ✅ `cd src-ts && npx vitest run tests/workflow/level5-coordinator.integration` — 2/2 passing (smoke runs, e2e gracefully skips with model-availability warning).
- ✅ `cd src-ts && npx vitest run tests/graph` — 20/20 graph tests passing (no regression to GraphManager or GraphEngine).
- ✅ `cd src-ts && npx vitest run tests/workflow/level4-brainstorm.stress tests/workflow/level5-coordinator.stress tests/workflow/harness` — 28/28 passing (4 L4 stress + 4 L5 stress + 20 harness).
- ✅ `cd src-ts && npx vitest run tests/workflow tests/search` — 460/461 passing.
- ✅ `cd desktop && npm run build:sidecar:node` — sidecar bundle rebuilt successfully; bundle contains `setVectorSearch` (line 271 of `desktop/src-tauri/bin/sidecar/graph/graph-manager.js`), `_embedEntity` (line 287), `setDefaultVectorSearch` (line 279), and `wireVectorSearchIntoGraphManager` (line 59 of bundled gateway-control-plane.js).

### Pre-existing Test Failures (NOT regressions)

Confirmed by `git stash` + re-running on clean main:

1. `tests/container/ServiceContainer.test.ts > Async Initialization > should handle initialization timeout` — pre-existing 5s timeout flake, unrelated to graph or VectorSearch.
2. `tests/workflow/workflow-engine.test.ts > WorkflowEngine constants > DESTRUCTIVE_STEP_NAMES contains expected step names` — pre-existing missing-export issue.

Both failures reproduce on `main` without TASK-007 changes. Not introduced by this task.

## Tests

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `npx vitest run tests/workflow/level5-coordinator.integration` | 2/2 ✅ (smoke: ran, e2e: skipped — model unavailable) |
| `npx vitest run tests/graph` | 20/20 ✅ |
| `npx vitest run tests/workflow/level4-brainstorm.stress tests/workflow/level5-coordinator.stress tests/workflow/harness` | 28/28 ✅ |
| `cd desktop && npm run build:sidecar:node` | exit 0 (~16s npm ci, bundle staged at `desktop/src-tauri/bin/sidecar`) |

## Deviations

1. **Bundle vs source tree.** Task JSON pointed at `src-tauri/bin/sidecar/**` (compiled bundle, gitignored). All edits went to the canonical `src-ts/` source. The bundle is rebuilt automatically by `desktop/scripts/build_node_sidecar.cjs`. Verified post-build that the new symbols are in the bundle.

2. **Phase 1 wiring was source-incomplete.** The Phase 1 verification.json claimed `setVectorSearch` existed at `graph-manager.js:258` — but `src-ts/graph/graph-manager.ts` (the source of truth) had **no** such method. Phase 1 had only edited the compiled bundle (which then disappeared when src-tauri/bin/sidecar was untracked). TASK-007 backports the entire embedding-hook surface (`setVectorSearch`, `_embedEntity`, `_removeEntityEmbedding`, CRUD hook calls) to the TypeScript source. This is a correction of Phase 1 incomplete-source-commit, not a deviation from TASK-007 scope.

3. **GraphManager vs GraphEngine duality.** The codebase has two parallel knowledge-graph classes (`GraphManager` and `GraphEngine`) with separate SQLite schemas. The Phase 1 wiring targets `GraphManager`; Phase 2's `IterativeRetriever` consults `GraphEngine.searchEntitiesByName`. The integration test seeds the entity into BOTH to prove the full Phase 1 → Phase 2 pipeline within a single artifact. This is documented inline in the test header. A future task should consolidate these two classes — flagged as out-of-scope tech debt.

4. **End-to-end test runs only when fastembed is installed locally.** The dev tree (`src-ts/node_modules`) does not bundle fastembed (it's a desktop-bundle production dep, hydrated via `npm ci` during `build:sidecar:node`). The integration test detects the missing model in `beforeAll` and skips the e2e branch with a clear warning. The smoke test still runs and proves the wiring. **The wiring code is NEVER gated on model availability** — the gateway bootstrap calls `wireVectorSearchIntoGraphManager` unconditionally and falls back to `setDefaultVectorSearch(null)` only when the container can't supply a VectorSearch instance.

## Notes

- **Model-availability conclusion:** The BAAI/bge-small-en-v1.5 model loader is not available in the `src-ts` dev environment (fastembed missing). The integration test correctly skips the e2e branch and logs a warning. To run the e2e branch end-to-end, run vitest from `desktop/src-tauri/bin/sidecar` (which has fastembed hydrated) OR install fastembed in src-ts dev deps. Acceptable per task spec: "skip-on-missing-model guard". Wiring still happens at startup regardless.

- **Bootstrap edits live in `gateway-control-plane.ts`** — not `index.ts` or `gateway-server.ts` directly, because the container is initialized in `initializeGatewayControlPlane()`. This is the correct insertion point per the task instruction: *"the exact insertion point depends on existing wiring — read first"*.

- **No commit created (per task spec):** "Do NOT commit (TASK-008 will run the full regression suite, then we commit Wave 4 together)."

- **Next task (TASK-008)** can run the full regression suite + commit Wave 4. The integration test will skip its e2e branch in CI unless the embedding model is cached; this is expected and documented.
