# Phase 4 Entry Handoff

## Goal
- Use this session as the current entrypoint for Phase 4 data-layer migration.
- Phase 4 scope is the TypeScript migration and hardening of:
  `src-ts/memory`
  `src-ts/graph`
  `src-ts/store`

## Upstream Status
- Phase 1 infrastructure migration is complete.
- Phase 2 services/search migration is complete and reconciled through:
  `.workflow/active/WFS-phase-2-services-layer-entry-20260404/HANDOFF.md`
- Phase 3 domain-logic migration has converged through:
  `.workflow/active/WFS-phase-3-domain-logic-entry-20260404/HANDOFF.md`
- Latest Phase 3 convergence signal:
  - `QUE-20260404-P3-21` completed
  - `test:phase3` result: `80 files passed, 242 tests passed`
  - scoped coverage: `lines 88.80% | branches 63.62% | functions 83.58% | statements 88.80%`

## Source Context
- Original migration roadmap:
  `.workflow/active/WFS-python-to-typescript-migration-20260329/IMPL_PLAN.md`
- Phase 1 plan overview:
  `.workflow/active/WFS-python-to-typescript-migration-20260329/plan.json`
- Phase 2 reconciled entry:
  `.workflow/active/WFS-phase-2-services-layer-entry-20260404/HANDOFF.md`
- Phase 3 converged entry:
  `.workflow/active/WFS-phase-3-domain-logic-entry-20260404/HANDOFF.md`

## Phase 4 Scope Notes
- `src-ts/memory/*` is the broadest remaining migration surface in the data layer and likely needs sub-slicing by engine, managers, and persistence helpers rather than one broad pass.
- `src-ts/graph/*` contains the public graph engine and manager surfaces, while `src-ts/mcp/services/graph.ts` is an adjacent runtime bridge that is still null-wired and should be treated as an immediate integration boundary.
- `src-ts/store/*` is smaller, but it is contract-sensitive because it couples OpenKL-style file mapping with memory chunking and normalized persistence.

## Entry Recommendation
1. Inventory current direct regression coverage across `memory`, `graph`, and `store` public surfaces.
2. Identify null bridges, no-op adapters, and persistence assumptions that still make the TypeScript data layer weaker than the Python source of truth.
3. Split Phase 4 into at least three workstreams:
   - memory core hardening
   - graph engine and bridge hardening
   - store/OpenKL contract hardening

## Initial Risk View
- Highest risk:
  `src-ts/memory`
- Medium risk:
  `src-ts/graph`
- Smallest surface but still contract-sensitive:
  `src-ts/store`

## Inventory Snapshot
- Current Phase 4 scope inventory:
  `20 files`
  about `397,306` bytes on disk
- Notable weak points found during first inventory pass:
  - `src-ts/mcp/services/graph.ts` still returns `null` from its local engine accessor and falls back to empty/error payloads instead of using the container graph engine
  - Phase 2 handoff still records that MCP memory bypasses the container `IMemoryEngine` contract because the current interface is narrower than the tool surface
  - `src-ts/memory/unified-memory.ts` defaults to local no-op integration adapters, so storage-shadow and multi-store hooks are not yet validated as real call paths
  - direct TypeScript regression entrypoints are currently sparse at the data-layer boundary; the first-pass obvious dedicated coverage surfaced `src-ts/tests/mcp/memory-service.test.ts`, while graph/store direct regression slices are not yet formalized

## Current Testing Snapshot
- Direct data-layer-adjacent test surfaced during entry scan:
  - `src-ts/tests/mcp/memory-service.test.ts`
- Additional indirect coverage exists through container/services tests, but a dedicated reusable Phase 4 baseline does not exist yet.

## Next Formal Queue Candidate
- Queue candidate:
  `QUE-20260404-P4-1`
- Planned execution order:
  1. `P4-001` -> add direct regression coverage for `mcp/services/graph.ts` and patch the null bridge only if tests expose the gap
  2. `P4-002` -> add direct regression coverage for one bounded public graph/store contract, likely `graph/index.ts` or `graph/graph-engine.ts`
  3. `P4-003` -> refresh a reusable `test:phase4` / `test:coverage:phase4` baseline after the first data-layer slices land
- Rationale:
  - the graph MCP bridge is an explicit runtime hole with a bounded public contract, so it is a better first executor target than starting inside the larger memory engine internals
  - a small first queue keeps the Phase 4 entry recoverable while establishing the same regression-first pattern that was used successfully in Phase 3

## Entry Conclusion
- Phase 4 should start from the data-layer boundary rather than from the deepest memory internals.
- The first bounded executor move should prove that graph-facing runtime access is no longer null-wired, then expand into direct graph/store regression slices and a scoped Phase 4 baseline.

## Formal Queue Conversion
- Queue formed:
  `QUE-20260404-P4-1`
- Planned execution order:
  1. `P4-001` -> add direct regression coverage for `mcp/services/graph.ts` and patch the null bridge only if tests expose the gap
  2. `P4-002` -> add direct regression coverage for the public `graph/index.ts` barrel
  3. `P4-003` -> refresh `test:phase4` / `test:coverage:phase4` baseline after the first bounded data-layer slices land
- Rationale:
  - the graph MCP bridge was an explicit runtime hole with a bounded public contract, so it was the safest first executor target
  - the graph barrel regression then establishes a second direct public-surface slice without widening into deeper graph-manager algorithms

## First Implemented Slice
- Files:
  - `src-ts/mcp/services/graph.ts`
  - `src-ts/container/adapters.ts`
  - `src-ts/tests/mcp/graph-service.test.ts`
- What changed:
  - replaced the local null graph engine stub with the real `getGraphEngine()` accessor path
  - added a runtime shape guard so the MCP graph service only binds when the accessor exposes the richer graph service surface
  - extended `GraphEngineAdapter` with bridge methods for:
    - `executeCypher()`
    - `getCharacter()`
    - `getRelationships()`
    - `getForeshadows()`
    - `createEntity()`
    - `createRelation()`
  - added direct regression coverage for all six public graph service helpers plus unavailable-engine fallback behavior
- Verification:
  - `npm.cmd run test -- tests/mcp/graph-service.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Second Implemented Slice
- File:
  `src-ts/tests/graph/index.test.ts`
- What changed:
  - added direct regression coverage for:
    - representative `graph/index.ts` re-exports
    - `CypherParser.parse()` through the public barrel
    - a minimal `GraphEngine` createEntity/getCharacter/executeCypher path reached through the public barrel
- Verification:
  - `npm.cmd run test -- tests/graph/index.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Third Implemented Slice
- Files:
  - `src-ts/package.json`
  - `src-ts/vitest.phase4.config.ts`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - added reusable `npm.cmd run test:phase4` and `npm.cmd run test:coverage:phase4` entrypoints for the first bounded Phase 4 slice set
  - scoped the first Phase 4 coverage gate to:
    - `mcp/services/graph.ts`
    - `graph/index.ts`
  - recorded `QUE-20260404-P4-1` execution and the initial data-layer baseline in the active Phase 4 docs
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `2 files passed, 4 tests passed`
  - scoped coverage: `lines 100% | branches 91.66% | functions 100% | statements 100%`

## Current Queue Status
- `QUE-20260404-P4-1` establishes the first reusable Phase 4 regression and scoped coverage baseline.
- The next likely bounded queue should move from graph bridge entrypoints into either:
  - deeper graph engine/manager public behavior
  - memory container-contract reconciliation
  - store/OpenKL contract direct regression slices

## Next Formal Queue
- Queue formed:
  `QUE-20260405-P4-2`
- Planned execution order:
  1. `P4-004` -> reconcile the container memory contract with the MCP memory surface and add accessor-based direct regression coverage
  2. `P4-005` -> add direct regression coverage for the public `memory/index.ts` barrel
  3. `P4-006` -> refresh `test:phase4` / `test:coverage:phase4` baseline after the memory slices land
- Rationale:
  - the remaining explicit Phase 2 carry-over was the memory service bypass around `IMemoryEngine`
  - after reconciling that contract, a direct memory barrel slice provides a second bounded public-surface check without widening into deeper manager internals

## Fourth Implemented Slice
- Files:
  - `src-ts/container/types.ts`
  - `src-ts/container/adapters.ts`
  - `src-ts/mcp/services/memory.ts`
  - `src-ts/tests/mcp/memory-service.test.ts`
  - `src-ts/tests/container/ServiceContainer.test.ts`
- What changed:
  - widened `IMemoryEngine` with the richer MCP-facing memory operations already supported by `UnifiedMemoryEngine`
  - extended `MemoryEngineAdapter` so the container exposes:
    - `add()`
    - rich `search(...)`
    - `getTemporalFacts()`
    - `detectConflicts()`
    - `resolveConflict()`
  - rewired `mcp/services/memory.ts` to use the real `getMemoryEngine()` accessor with runtime shape guarding instead of building a local bypass adapter
  - updated direct regression coverage so MCP memory tests now assert accessor-based wiring and unavailable-engine fallback behavior
  - updated `ServiceContainer` memory mocks so the widened contract remains test-compatible across existing container coverage
- Verification:
  - `npm.cmd run test -- tests/mcp/memory-service.test.ts tests/container/ServiceContainer.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `2 files passed, 84 tests passed`
  - typecheck: passed

## Fifth Implemented Slice
- Files:
  - `src-ts/tests/memory/index.test.ts`
  - `src-ts/memory/unified-memory.ts`
- What changed:
  - added direct regression coverage for:
    - representative `memory/index.ts` re-exports
    - a minimal `UnifiedMemoryEngine` add/getTemporalFacts path reached through the public barrel
  - patched `UnifiedMemoryEngine.getTemporalFacts()` so it handles the row shape returned by SQLite correctly on the direct public path exercised by the new barrel test
- Verification:
  - `npm.cmd run test -- tests/memory/index.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 2 tests passed`
  - typecheck: passed

## Sixth Implemented Slice
- Files:
  - `src-ts/package.json`
  - `src-ts/vitest.phase4.config.ts`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - expanded `test:phase4` to include the bounded memory slices alongside the existing graph slices
  - expanded the scoped Phase 4 coverage gate to include:
    - `mcp/services/memory.ts`
    - `memory/index.ts`
  - recorded `QUE-20260405-P4-2` execution and the refreshed data-layer baseline in the active Phase 4 docs
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `4 files passed, 9 tests passed`
  - scoped coverage: `lines 100% | branches 82.14% | functions 100% | statements 100%`

## Updated Queue Status
- `QUE-20260405-P4-2` closes the explicit Phase 2 carry-over where MCP memory bypassed the container contract.
- The next likely bounded queue should move into either:
  - `store/index.ts` and OpenKL contract direct regression slices
  - deeper `graph-manager` public behavior
  - memory integration-adapter verification beyond the current no-op defaults

## Next Formal Queue
- Queue formed:
  `QUE-20260405-P4-3`
- Planned execution order:
  1. `P4-007` -> add direct regression coverage for `store/openkl-contract.ts`
  2. `P4-008` -> add direct regression coverage for the public `store/index.ts` barrel
  3. `P4-009` -> refresh `test:phase4` / `test:coverage:phase4` baseline after the store/OpenKL slices land
- Rationale:
  - after graph and memory entrypoints converged, the next smallest contract-sensitive public surface was the store/OpenKL layer
  - this queue keeps Phase 4 progression bounded while expanding the reusable data-layer baseline across all three major subdomains

## Seventh Implemented Slice
- File:
  `src-ts/tests/store/openkl-contract.test.ts`
- What changed:
  - added direct regression coverage for:
    - `OpenKLPaths` directory derivation
    - `DocumentMapping` round-trip conversion
    - `OpenKLContract.ingestContent()` public behavior
    - normalized content retrieval, citation persistence, memory file emission, and integrity verification in isolated temp paths
- Verification:
  - `npm.cmd run test -- tests/store/openkl-contract.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Eighth Implemented Slice
- File:
  `src-ts/tests/store/index.test.ts`
- What changed:
  - added direct regression coverage for:
    - representative `store/index.ts` re-exports
    - a minimal `StoreManager` add/get/list/delete path reached through the public barrel
- Verification:
  - `npm.cmd run test -- tests/store/index.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Ninth Implemented Slice
- Files:
  - `src-ts/package.json`
  - `src-ts/vitest.phase4.config.ts`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - expanded `test:phase4` to include the bounded store slices alongside the existing graph and memory slices
  - expanded the scoped Phase 4 coverage gate to include:
    - `store/openkl-contract.ts`
    - `store/index.ts`
  - recorded `QUE-20260405-P4-3` execution and the refreshed data-layer baseline in the active Phase 4 docs
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `6 files passed, 13 tests passed`
  - scoped coverage: `lines 86.56% | branches 71.18% | functions 91.07% | statements 86.56%`

## Tenth Implemented Slice
- File:
  `src-ts/tests/store/openkl-contract.test.ts`
- What changed:
  - added direct regression coverage for:
    - `OpenKLPaths` public directory derivation
    - `DocumentMapping` round-trip conversion
    - `OpenKLContract.ingestContent()` public behavior
    - normalized content retrieval, citation persistence, memory file emission, and integrity verification in isolated temp paths
- Verification:
  - `npm.cmd run test -- tests/store/openkl-contract.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Eleventh Implemented Slice
- File:
  `src-ts/tests/store/index.test.ts`
- What changed:
  - added direct regression coverage for:
    - representative `store/index.ts` re-exports
    - a minimal `StoreManager` add/get/list/delete path reached through the public barrel
- Verification:
  - `npm.cmd run test -- tests/store/index.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Twelfth Implemented Slice
- Files:
  - `src-ts/package.json`
  - `src-ts/vitest.phase4.config.ts`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - expanded `test:phase4` to include the bounded store slices alongside the existing graph and memory slices
  - expanded the scoped Phase 4 coverage gate to include:
    - `store/openkl-contract.ts`
    - `store/index.ts`
  - recorded `QUE-20260405-P4-3` execution and the refreshed data-layer baseline in the active Phase 4 docs
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `6 files passed, 13 tests passed`
  - scoped coverage: `lines 86.56% | branches 71.18% | functions 91.07% | statements 86.56%`

## Updated Queue Status
- `QUE-20260405-P4-3` establishes the first bounded store/OpenKL regression baseline inside Phase 4.
- The next likely bounded queue should move into either:
  - deeper `graph-manager` public behavior
  - no-op integration-adapter verification for memory/store shadow paths
  - broader `store-manager` public behavior beyond the current barrel slice

## Next Formal Queue
- Queue formed:
  `QUE-20260405-P4-4`
- Planned execution order:
  1. `P4-010` -> add direct regression coverage for `graph/graph-manager.ts`
  2. `P4-011` -> add direct regression coverage for `store/store-manager.ts`
  3. `P4-012` -> refresh `test:phase4` / `test:coverage:phase4` baseline after the manager-level slices land
- Rationale:
  - after converging the entrypoint/barrel surfaces, the next bounded public layer is the manager-level graph/store API
  - this queue deepens Phase 4 confidence without widening into integration-adapter or external dependency behavior yet

## Thirteenth Implemented Slice
- File:
  `src-ts/tests/graph/graph-manager.test.ts`
- What changed:
  - added direct regression coverage for bounded `GraphManager` public behavior:
    - entity creation
    - relationship creation
    - `runCypher()` query shape
    - `getEntity()`
    - `findRelatedEntities()`
    - `getEntityStats()`
    - `findShortestPath()`
  - kept the fix bounded to the test when the original query-shape assumption was wrong
- Verification:
  - `npm.cmd run test -- tests/graph/graph-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Fourteenth Implemented Slice
- File:
  `src-ts/tests/store/store-manager.test.ts`
- What changed:
  - added direct regression coverage for bounded `StoreManager` public behavior:
    - `addDocument()`
    - `updateDocument()`
    - `listDocuments()`
    - `searchByContent()`
    - `exportDocument()`
    - `stats()`
    - `deleteDocument()`
- Verification:
  - `npm.cmd run test -- tests/store/store-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Fifteenth Implemented Slice
- Files:
  - `src-ts/package.json`
  - `src-ts/vitest.phase4.config.ts`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - expanded `test:phase4` to include the bounded manager-level graph/store slices
  - kept the scoped Phase 4 coverage gate on the stable entrypoint/barrel/OpenKL subset instead of immediately widening it to manager files, because the new manager regressions are green but not yet coverage-complete enough for the existing threshold gate
  - recorded `QUE-20260405-P4-4` execution and the refreshed manager-level regression baseline in the active Phase 4 docs
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `8 files passed, 15 tests passed`
  - scoped coverage: `lines 86.56% | branches 71.18% | functions 91.07% | statements 86.56%`

## Sixteenth Implemented Slice
- File:
  `src-ts/tests/graph/graph-manager.test.ts`
- What changed:
  - added direct regression coverage for bounded `GraphManager` public behavior:
    - entity creation
    - relationship creation
    - `runCypher()`
    - `getEntity()`
    - `findRelatedEntities()`
    - `getEntityStats()`
    - `findShortestPath()`
  - corrected the test expectation to match the actual alias-wrapped `runCypher()` return shape instead of widening the implementation
- Verification:
  - `npm.cmd run test -- tests/graph/graph-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Seventeenth Implemented Slice
- File:
  `src-ts/tests/store/store-manager.test.ts`
- What changed:
  - added direct regression coverage for bounded `StoreManager` public behavior:
    - `addDocument()`
    - `updateDocument()`
    - `listDocuments()`
    - `searchByContent()`
    - `exportDocument()`
    - `stats()`
    - `deleteDocument()`
- Verification:
  - `npm.cmd run test -- tests/store/store-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  both passed

## Eighteenth Implemented Slice
- Files:
  - `src-ts/package.json`
  - `src-ts/vitest.phase4.config.ts`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - expanded `test:phase4` to include the bounded manager-level graph/store slices
  - kept the scoped Phase 4 coverage gate on the stable entrypoint/barrel/OpenKL subset while still running the manager-level tests in the reusable regression suite
  - recorded `QUE-20260405-P4-4` execution and the refreshed manager-level baseline in the active Phase 4 docs
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `8 files passed, 15 tests passed`
  - scoped coverage: `lines 86.56% | branches 71.18% | functions 91.07% | statements 86.56%`

## Updated Queue Status
- `QUE-20260405-P4-4` establishes the first manager-level graph/store regression baseline inside Phase 4.
- The next likely bounded queue should move into either:
  - memory/store integration-adapter verification beyond the current no-op defaults
  - deeper graph algorithm public behavior not yet covered by the bounded manager slice
  - a broader scoped coverage campaign if Phase 4 needs manager-level files inside the threshold gate

## Next Formal Queue
- Queue formed:
  `QUE-20260405-P4-5`
- Planned execution order:
  1. `P4-013` -> add bounded regression coverage for `createIntegrationAdapters()` so Phase 4 proves default local-first no-op behavior and env-enabled stub selection
  2. `P4-014` -> add bounded regression coverage for `UnifiedMemoryEngine` local-first add plus optional shadow-write fallback under injected adapters
  3. `P4-015` -> refresh `test:phase4` entrypoints and active docs after the adapter-aware slices land
- Rationale:
  - the current Phase 4 gap is no longer the entrypoint barrels but the adapter semantics behind them
  - `src-ts/integrations/adapters.ts` is a bounded public factory that can be verified without widening into downstream MCP search behavior
  - `src-ts/memory/unified-memory.ts` already exposes injected integration adapters, so the next safe continuation is to prove the local-first write path survives disabled, enabled, and failing shadow-write scenarios
  - the existing in-place Phase 4 workspace remains the correct execution context because the continuation depends on the current uncommitted baseline and documentation trail

## Nineteenth Implemented Slice
- File:
  `src-ts/tests/integrations/adapters.test.ts`
- What changed:
  - added bounded regression coverage for the public integration adapter factory through the `integrations` barrel
  - proved the default local-first path returns:
    - `NoopStorageShadowAdapter`
    - `NoopCacheRateLimitAdapter`
    - `NoopSearchAdapter`
    - `NoopGraphProjectionAdapter`
    - `NoopOrchestrationHookAdapter`
  - proved env-enabled flags switch the bounded runtime surface to the matching stub adapters without widening into downstream MCP behavior
- Verification:
  - `npm.cmd test -- tests/integrations/adapters.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 2 tests passed`
  - typecheck: passed

## Twentieth Implemented Slice
- Files:
  - `src-ts/memory/unified-memory.ts`
  - `src-ts/tests/memory/unified-memory.integration-adapters.test.ts`
- What changed:
  - aligned `UnifiedMemoryEngine` to the shared `integrations` contract instead of maintaining a narrower local-only shadow-write type
  - kept the fallback no-op adapter local-first by default while making direct `createIntegrationAdapters()` injection a valid Phase 4 call path
  - added regression coverage for three bounded adapter-aware behaviors:
    - postgres shadow-write disabled -> local write succeeds and no shadow call occurs
    - postgres shadow-write enabled -> injected adapter receives the expected payload
    - postgres shadow-write failure -> warning is emitted but the local SQLite-backed write still succeeds
- Verification:
  - `npm.cmd test -- tests/memory/unified-memory.integration-adapters.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 3 tests passed`
  - typecheck: passed

## Twenty-First Implemented Slice
- Files:
  - `src-ts/package.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - expanded `test:phase4` to include:
    - `tests/integrations/adapters.test.ts`
    - `tests/memory/unified-memory.integration-adapters.test.ts`
  - kept the scoped Phase 4 coverage gate on the stable public subset in `vitest.phase4.config.ts` instead of widening it immediately to adapter internals
  - recorded `QUE-20260405-P4-5` execution and verification results in the active Phase 4 docs
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `10 files passed, 20 tests passed`
  - scoped coverage: `lines 86.56% | branches 71.18% | functions 91.07% | statements 86.56%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-5` is completed and establishes the first adapter-aware Phase 4 regression baseline.
- The scoped coverage gate intentionally remains on the stable entrypoint subset while the broader adapter and manager internals continue to be exercised through the reusable regression suite.
- The next likely bounded queue should move into either:
  - deeper graph algorithm public behavior not yet covered by the current manager slices
  - a dedicated manager-level coverage campaign if Phase 4 needs `graph-manager` / `store-manager` / adapter internals inside the threshold gate
  - broader multi-store integration semantics beyond the current local-first shadow-write proof

## Next Formal Queue
- Queue formed:
  `QUE-20260405-P4-6`
- Planned execution order:
  1. `P4-016` -> extend direct regression coverage for the remaining `GraphManager` public tail: update, directional relationship lookup, search, and delete cleanup
  2. `P4-017` -> add a dedicated `GraphEngine` tail regression slice for search, relation filtering, foreshadow retrieval, and mutation/delete behavior
  3. `P4-018` -> refresh `test:phase4` entrypoints and active docs after the graph-tail slices land
- Rationale:
  - the Phase 4 gap had moved away from entrypoint barrels and toward the remaining graph public methods that were still unexercised directly
  - `GraphManager` already had an initial manager slice, so the next bounded move was to close its CRUD/search tail before widening into deeper algorithms
  - `GraphEngine` still exposed public search, relationship, foreshadow, and mutation methods without direct regression coverage, making it the next safest bounded continuation
  - the existing in-place Phase 4 workspace remained the correct execution context because the continuation depends on the current uncommitted baseline and documentation trail

## Twenty-Second Implemented Slice
- File:
  `src-ts/tests/graph/graph-manager.test.ts`
- What changed:
  - extended direct regression coverage for the remaining `GraphManager` public tail:
    - `updateEntity()`
    - `getRelationships()` for `in`, `out`, and `both`
    - `searchEntities()`
    - `deleteRelationship()`
    - `deleteEntity()`
  - proved relationship cleanup remains bounded when deleting a relationship or deleting an entity with attached edges
  - added a bounded missing-entity false-path check for update/delete behavior
- Verification:
  - `npm.cmd test -- tests/graph/graph-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 2 tests passed`
  - typecheck: passed

## Twenty-Third Implemented Slice
- Files:
  - `src-ts/graph/graph-engine.ts`
  - `src-ts/tests/graph/graph-engine.test.ts`
- What changed:
  - added direct regression coverage for the remaining `GraphEngine` public tail:
    - `searchEntitiesByName()`
    - `createRelation()`
    - `getRelationships()` with relation-type filtering
    - `getForeshadows()`
    - `updateEntity()`
    - `deleteEntity()`
  - fixed the relationship-type filter query by parenthesizing the source/target predicate before appending `AND r.type = ?`, so filtered lookups no longer leak unrelated outbound relations
  - added bounded missing-entity error-path coverage for create/update/delete flows
- Verification:
  - `npm.cmd test -- tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 2 tests passed`
  - typecheck: passed

## Twenty-Fourth Implemented Slice
- Files:
  - `src-ts/package.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - expanded `test:phase4` to include:
    - `tests/graph/graph-engine.test.ts`
  - kept the scoped Phase 4 coverage gate on the stable public subset in `vitest.phase4.config.ts` instead of widening it immediately to manager/engine internals
  - recorded `QUE-20260405-P4-6` execution and verification results in the active Phase 4 docs and queue metadata
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 23 tests passed`
  - scoped coverage: `lines 86.56% | branches 71.18% | functions 91.07% | statements 86.56%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-6` is completed and establishes the first graph-tail regression baseline across both `GraphManager` and `GraphEngine`.
- The scoped coverage gate intentionally remains on the stable entrypoint subset while manager and engine internals continue to run inside the reusable regression suite.
- The next likely bounded queue should move into either:
  - deeper graph algorithm public behavior, especially subgraph extraction and path/search edge cases not yet exercised directly
  - a deliberate Phase 4 coverage-gate widening campaign if `graph-manager` / `graph-engine` should enter threshold enforcement
  - broader multi-store integration semantics beyond the current local-first adapter proof

## Next Formal Queue
- Queue formed:
  `QUE-20260405-P4-7`
- Planned execution order:
  1. `P4-019` -> extend direct regression coverage for GraphManager shortest-path edge cases and the lower-case `getSubgraph()` compatibility path used by adjacent callers
  2. `P4-020` -> deepen the bounded GraphManager `runCypher()` slice with CREATE, property-filter, and relationship-pattern regression
  3. `P4-021` -> refresh the active Phase 4 baseline and queue metadata after the graph-algorithm slices land
- Rationale:
  - the Phase 4 gap had moved from manager CRUD tails into deeper graph-manager algorithm and query behavior that was still only thinly exercised
  - adjacent narrative code already expected a lower-case `getSubgraph()` call path, so proving and preserving that compatibility was a bounded, high-signal next step
  - `GraphManager.runCypher()` already exposed a supported CREATE/MATCH subset, making deeper direct regression safer than widening immediately into broader GraphEngine query work
  - the existing in-place Phase 4 workspace remained the correct execution context because the continuation depends on the current uncommitted baseline and documentation trail

## Twenty-Fifth Implemented Slice
- Files:
  - `src-ts/graph/graph-manager.ts`
  - `src-ts/tests/graph/graph-manager.test.ts`
- What changed:
  - extended direct regression coverage for deeper `GraphManager` algorithm behavior:
    - same-node shortest-path behavior
    - disconnected no-path behavior
    - radius-bounded `getSubGraph()` extraction
    - lower-case `getSubgraph()` compatibility behavior expected by adjacent callers
  - added a bounded compatibility alias so `getSubgraph()` delegates to the existing `getSubGraph()` implementation
- Verification:
  - `npm.cmd test -- tests/graph/graph-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 4 tests passed`
  - typecheck: passed

## Twenty-Sixth Implemented Slice
- File:
  `src-ts/tests/graph/graph-manager.test.ts`
- What changed:
  - deepened direct `GraphManager.runCypher()` regression coverage for the supported public query subset:
    - CREATE node queries
    - JSON-property `CONTAINS` filtering
    - relationship-pattern MATCH queries returning `source` / `relationship` / `target`
  - kept the change bounded to the existing supported syntax subset instead of widening into a broader Cypher rewrite
- Verification:
  - `npm.cmd test -- tests/graph/graph-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 4 tests passed`
  - typecheck: passed

## Twenty-Seventh Implemented Slice
- Files:
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
  - `.workflow/issues/queues/index.json`
- What changed:
  - kept `test:phase4` and `vitest.phase4.config.ts` unchanged because the deeper GraphManager slices extend the already-included regression file rather than introducing a new entrypoint
  - recorded `QUE-20260405-P4-7` execution and verification results in the active Phase 4 docs and queue metadata
  - retained the scoped Phase 4 coverage gate on the stable public entrypoint subset instead of widening it immediately to manager/engine internals
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 25 tests passed`
  - scoped coverage: `lines 86.56% | branches 71.18% | functions 91.07% | statements 86.56%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-7` is completed and establishes the first deeper GraphManager algorithm/query regression baseline inside Phase 4.
- The scoped coverage gate intentionally remains on the stable entrypoint subset while deeper manager behavior continues to run inside the reusable regression suite.
- The next likely bounded queue should move into either:
  - broader GraphEngine query-contract semantics and guard behavior beyond the current minimal barrel/tail coverage
  - a deliberate Phase 4 coverage-gate widening campaign if `graph-manager` / `graph-engine` should enter threshold enforcement
  - broader multi-store integration semantics beyond the current local-first adapter proof

## Twenty-Eighth Implemented Slice
- File:
  `src-ts/tests/graph/graph-engine.test.ts`
- What changed:
  - extended direct `GraphEngine.executeCypher()` regression coverage for the bounded public guard and typed-node query subset:
    - non-string input rejection
    - empty query rejection
    - oversized query rejection
    - non-MATCH query rejection
    - typed `MATCH (n:Type) RETURN n`
    - JSON-backed equality filtering such as `MATCH (n:Event) WHERE n.severity = 'high' RETURN n`
  - confirmed the guard and typed-node behavior was already stable through the public API, so no implementation change was required for this slice alone
- Verification:
  - `npm.cmd test -- tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 4 tests passed`
  - typecheck: passed

## Twenty-Ninth Implemented Slice
- Files:
  - `src-ts/graph/graph-engine.ts`
  - `src-ts/tests/graph/graph-engine.test.ts`
- What changed:
  - deepened direct `GraphEngine.executeCypher()` regression coverage for the documented and already-adjacent public query subset:
    - `MATCH (a:Character)-[r:KNOWS]->(b:Character) RETURN a, r, b`
    - `MATCH (n)-[r*1..2]-(m) WHERE n.name CONTAINS 'Alice' RETURN m, r`
  - routed relationship-pattern and traversal-like MATCH queries before the simpler typed-node parser so relationship queries no longer collapse into `MATCH (n:Type)` results
  - added bounded relationship-pattern execution that returns `source` / `relationship` / `target` structures through the public GraphEngine API
  - added bounded traversal execution that returns `m` plus the discovered relationship path list `r`, which stabilizes the existing `GraphEngineAdapter.traverse()` call path without widening into a full Cypher engine
  - normalized GraphEngine entity result mapping through a shared helper while preserving the local-first SQLite implementation
- Verification:
  - `npm.cmd test -- tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 4 tests passed`
  - typecheck: passed

## Thirtieth Implemented Slice
- Files:
  - `.workflow/issues/solutions/P4-022.jsonl`
  - `.workflow/issues/solutions/P4-023.jsonl`
  - `.workflow/issues/solutions/P4-024.jsonl`
  - `.workflow/issues/queues/QUE-20260405-P4-8.json`
  - `.workflow/issues/queues/index.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - formed and recorded the executable `QUE-20260405-P4-8` queue for the deeper GraphEngine query-contract continuation
  - kept `src-ts/package.json` and `src-ts/vitest.phase4.config.ts` unchanged because this queue deepens the already-included `tests/graph/graph-engine.test.ts` slice rather than introducing a new Phase 4 entrypoint or widening the threshold gate
  - recorded the refreshed Phase 4 baseline and retained the scoped coverage posture on the stable public entrypoint subset
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 27 tests passed`
  - scoped coverage: `lines 86.56% | branches 71.18% | functions 91.07% | statements 86.56%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-8` is completed and establishes the first deeper GraphEngine query-contract regression baseline inside Phase 4, including the traversal-like adapter call path.
- The scoped coverage gate intentionally remains on the stable entrypoint subset while deeper manager and engine behavior continues to run inside the reusable regression suite.
- The next likely bounded queue should move into either:
  - a deliberate Phase 4 coverage-gate widening campaign if `graph-manager` / `graph-engine` should enter threshold enforcement
  - broader multi-store integration semantics beyond the current local-first adapter proof
  - explicit GraphEngine/GraphManager query-parity work if downstream callers need closer result-shape alignment

## Thirty-First Implemented Slice
- File:
  `src-ts/tests/graph/graph-engine.test.ts`
- What changed:
  - extended the direct GraphEngine regression slice to close the remaining bounded coverage gaps relevant to the public contract:
    - config-driven construction via `DATA_DIR` and `fromConfig()`
    - plugin registration deduplication, load handling, and health reporting
    - timeline hydration through `getCharacter(..., true, true)`
    - local-first Neo4j projection success/failure fallbacks
    - bounded helper and guard branches such as oversized name patterns and limited relationship/traversal queries
  - kept the additions inside the existing GraphEngine test file instead of introducing a new Phase 4 entrypoint
- Verification:
  - `npm.cmd test -- tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `2 files passed, 10 tests passed`
  - typecheck: passed

## Thirty-Second Implemented Slice
- Files:
  - `src-ts/tests/graph/graph-manager.test.ts`
  - `src-ts/vitest.phase4.config.ts`
- What changed:
  - added direct regression coverage for the legacy `addEntity()` / `addRelation()` compatibility aliases in `GraphManager`
  - widened the official Phase 4 coverage include list to add:
    - `graph/graph-manager.ts`
    - `graph/graph-engine.ts`
  - kept `src-ts/package.json` unchanged because the widened gate relies on the already-included graph regression files inside `test:phase4`
- Verification:
  - `npm.cmd test -- tests/graph/graph-manager.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `2 files passed, 10 tests passed`
  - widened coverage: `lines 92.63% | branches 76.59% | functions 96.21% | statements 92.63%`
  - typecheck: passed

## Thirty-Third Implemented Slice
- Files:
  - `.workflow/issues/solutions/P4-025.jsonl`
  - `.workflow/issues/solutions/P4-026.jsonl`
  - `.workflow/issues/solutions/P4-027.jsonl`
  - `.workflow/issues/queues/QUE-20260405-P4-9.json`
  - `.workflow/issues/queues/index.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - formed and recorded the executable `QUE-20260405-P4-9` queue for the graph coverage-widening continuation
  - refreshed the active Phase 4 baseline so the widened graph manager/engine coverage posture is now the official reusable default
  - advanced the next continuation recommendation beyond coverage widening toward multi-store semantics, graph query parity, or deeper store/OpenKL branch behavior
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 29 tests passed`
  - widened coverage: `lines 92.63% | branches 76.59% | functions 96.21% | statements 92.63%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-9` is completed and establishes the widened Phase 4 graph manager/engine coverage baseline.
- The official Phase 4 coverage gate now includes the stable graph entrypoints plus `graph-manager.ts` and `graph-engine.ts`, and the widened command remains above threshold.
- The next likely bounded queue should move into either:
  - broader multi-store integration semantics beyond the current local-first adapter proof
  - explicit GraphEngine/GraphManager query-parity work if downstream callers need closer result-shape alignment
  - deeper store/OpenKL branch semantics if the next goal is raising the lowest remaining Phase 4 branch surface

## Thirty-Fourth Implemented Slice
- File:
  `src-ts/tests/store/openkl-contract.test.ts`
- What changed:
  - extended the direct OpenKL regression slice to cover the bounded compatibility and ingestion paths that were still keeping the store contract surface thin:
    - persisted mapping compatibility defaults from JSONL records missing `source_type` or `metadata`
    - blank and invalid mapping-line tolerance plus unreadable mapping-store recovery during initialization
    - `ingestFile()` missing-source and unsupported-extension validation
    - autogenerated document IDs, normalize-disabled behavior, and the bounded CRUD/list/iteration fallbacks already present in the public contract
  - kept the additions inside the existing OpenKL regression file and confirmed no implementation patch was required for this slice
- Verification:
  - `npm.cmd test -- tests/store/openkl-contract.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 7 tests passed`
  - typecheck: passed

## Thirty-Fifth Implemented Slice
- File:
  `src-ts/tests/store/openkl-contract.test.ts`
- What changed:
  - deepened the direct OpenKL regression slice to cover the remaining bounded persistence and integrity edge branches:
    - public ingest/delete behavior when mapping append/save persistence logs an error
    - `createMemory()` defaults when topics or metadata are omitted
    - `getCitation()` null return for missing citations
    - `verifyIntegrity()` reporting for missing files, hash mismatches, orphaned source files, and a missing sources directory
  - verified the formerly weakest store surface is no longer thin through the OpenKL-focused coverage command, without changing the `OpenKLContract` implementation
- Verification:
  - `npm.cmd test -- tests/store/openkl-contract.test.ts`
  - `npm.cmd run test:coverage:phase4 -- tests/store/openkl-contract.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 7 tests passed`
  - OpenKL-focused coverage: `store/openkl-contract.ts -> lines 97.99% | branches 92.85% | functions 100% | statements 97.99%`
  - typecheck: passed

## Thirty-Sixth Implemented Slice
- Files:
  - `.workflow/issues/solutions/P4-028.jsonl`
  - `.workflow/issues/solutions/P4-029.jsonl`
  - `.workflow/issues/solutions/P4-030.jsonl`
  - `.workflow/issues/queues/QUE-20260405-P4-10.json`
  - `.workflow/issues/queues/index.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - formed and recorded the executable `QUE-20260405-P4-10` queue for the store/OpenKL branch-closure continuation
  - refreshed the active Phase 4 baseline so the improved OpenKL contract posture is now the official reusable default
  - advanced the next continuation recommendation beyond contract-level store coverage closure toward multi-store semantics, query parity, or store-manager synchronization work
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 34 tests passed`
  - official coverage: `lines 96.77% | branches 82.13% | functions 100% | statements 96.77%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-10` is completed and closes the previously weakest `store/openkl-contract.ts` branch surface.
- The official Phase 4 coverage gate remains above threshold while `store/openkl-contract.ts` now sits at `97.99% lines | 92.85% branches | 100% functions | 97.99% statements`.
- The next likely bounded queue should move into either:
  - broader multi-store integration semantics beyond the current local-first adapter proof
  - explicit GraphEngine/GraphManager query-parity work if downstream callers need closer result-shape alignment
  - deeper store-manager/OpenKL synchronization semantics now that the contract surface itself is no longer the weakest store target

## Thirty-Seventh Implemented Slice
- File:
  `src-ts/tests/store/store-manager.test.ts`
- What changed:
  - extended the direct StoreManager regression slice to cover the bounded `syncWithOpenKL()` contract beyond the earlier CRUD-only public surface:
    - `source_type` passthrough when StoreManager metadata already classifies a document
    - fallback `source_type: 'store'` when local metadata does not classify a document
    - per-document error aggregation while the sync loop continues
    - metadata payload assertions that pin `format` and `chunk_count` to the actual StoreManager document state instead of stale metadata
  - kept the additions inside the existing StoreManager regression file and used the new sync assertions to expose a real metadata-precedence contract mismatch
- Verification:
  - `npm.cmd test -- tests/store/store-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 3 tests passed`
  - typecheck: passed

## Thirty-Eighth Implemented Slice
- Files:
  - `src-ts/store/store-manager.ts`
  - `src-ts/tests/store/store-manager.test.ts`
- What changed:
  - patched `syncWithOpenKL()` so the emitted OpenKL metadata always keeps the actual local document `format` and `chunk_count`, even if stale keys exist inside `doc.metadata`
  - patched `importFromOpenKL()` so top-level OpenKL `source_type` is preserved in imported StoreManager metadata, preventing round-trip synchronization from silently degrading imported documents back to `source_type: 'store'`
  - expanded the direct StoreManager regression file to cover duplicate skipping, fallback path handling, and source-type preservation during OpenKL import
- Verification:
  - `npm.cmd test -- tests/store/store-manager.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `1 file passed, 3 tests passed`
  - typecheck: passed

## Thirty-Ninth Implemented Slice
- Files:
  - `.workflow/issues/solutions/P4-031.jsonl`
  - `.workflow/issues/solutions/P4-032.jsonl`
  - `.workflow/issues/solutions/P4-033.jsonl`
  - `.workflow/issues/queues/QUE-20260405-P4-11.json`
  - `.workflow/issues/queues/index.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - formed and recorded the executable `QUE-20260405-P4-11` queue for the safe StoreManager/OpenKL synchronization continuation
  - left `src-ts/package.json` and `src-ts/vitest.phase4.config.ts` unchanged because this queue extends an already-included regression file and does not widen the official coverage gate
  - explicitly recorded that broader multi-store work in `src-ts/memory/unified-memory.ts` was deferred this round because that file already carries active uncommitted integration edits in the shared workspace
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 36 tests passed`
  - official coverage: `lines 96.77% | branches 82.13% | functions 100% | statements 96.77%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-11` is completed and stabilizes the StoreManager/OpenKL sync-import round-trip contract without widening the official coverage gate.
- The official Phase 4 coverage baseline remains above threshold, while the StoreManager regression file now covers bounded OpenKL sync metadata precedence, duplicate skipping, fallback path handling, and `source_type` preservation.
- The next likely bounded queue should move into either:
  - broader multi-store integration semantics once the active `src-ts/memory/unified-memory.ts` edits are reconciled
  - explicit GraphEngine/GraphManager query-parity work if downstream callers need closer result-shape alignment
  - a deliberate StoreManager coverage-gate widening campaign if `store-manager.ts` should enter official threshold enforcement

## Fortieth Implemented Slice
- File:
  `src-ts/tests/store/store-manager.test.ts`
- What changed:
  - expanded the direct StoreManager regression slice to cover the public helper and batch surface that previously kept `store/store-manager.ts` below the official Phase 4 threshold gate:
    - exported format helpers and `Document` compatibility paths
    - `DocumentFilter` positive and mismatch branches
    - `importFile()` missing-source validation
    - `getChunks()`, `rechunkDocument()`, `getAllChunks()`, and `searchChunks()`
    - `importDirectory()` recursive import/error aggregation, `exportAll()`, and `clearAll()` confirmation behavior
  - kept the work inside the existing StoreManager regression file so the broader coverage push stayed bounded to the already-selected store surface
- Verification:
  - `npm.cmd test -- tests/store/store-manager.test.ts`
- Result:
  - regression: `1 file passed, 6 tests passed`

## Forty-First Implemented Slice
- Files:
  - `src-ts/tests/store/store-manager.test.ts`
  - `src-ts/vitest.phase4.config.ts`
- What changed:
  - extended the direct StoreManager regression file again to cover `loadFileContent()` YAML/default/PDF/DOCX branches and the `importBinaryFile()` copy-original compatibility path
  - widened the official Phase 4 coverage include list to add `store/store-manager.ts` once the direct StoreManager slice reached threshold-safe coverage
- Verification:
  - `npm.cmd test -- tests/store/store-manager.test.ts --coverage --config vitest.phase4.config.ts --coverage.include store/store-manager.ts`
- Result:
  - targeted StoreManager coverage: `store/store-manager.ts -> lines 96.4% | branches 84.3% | functions 100% | statements 96.4%`

## Forty-Second Implemented Slice
- Files:
  - `.workflow/issues/solutions/P4-034.jsonl`
  - `.workflow/issues/solutions/P4-035.jsonl`
  - `.workflow/issues/solutions/P4-036.jsonl`
  - `.workflow/issues/queues/QUE-20260405-P4-12.json`
  - `.workflow/issues/queues/index.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - formed and recorded the executable `QUE-20260405-P4-12` queue for the StoreManager coverage-gate widening continuation
  - refreshed the active Phase 4 baseline after officially adding `store/store-manager.ts` to `src-ts/vitest.phase4.config.ts`
  - kept the broader multi-store continuation deferred because `src-ts/memory/unified-memory.ts` still carries active uncommitted integration edits in the shared workspace
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 39 tests passed`
  - official coverage: `lines 96.68% | branches 82.72% | functions 100% | statements 96.68%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-12` is completed and widens the official Phase 4 coverage gate to include `store/store-manager.ts`.
- The store slice now keeps both `store/openkl-contract.ts` and `store/store-manager.ts` above threshold, with `store-manager.ts` sitting at `96.4% lines | 84.3% branches | 100% functions | 96.4% statements`.
- The next likely bounded queue should move into either:
  - broader multi-store integration semantics once the active `src-ts/memory/unified-memory.ts` edits are reconciled
  - explicit GraphEngine/GraphManager query-parity work if downstream callers need closer result-shape alignment now that the StoreManager gate widening has landed

## Forty-Third Implemented Slice
- File:
  `src-ts/tests/mcp/graph-service.test.ts`
- What changed:
  - extended the direct MCP graph-service regression slice to cover the remaining public guard/default contract tails:
    - rejection of partial engine objects that expose only part of the graph surface
    - `graphAddEntity()` defaulting `properties` from `null` to `{}`
    - `graphAddRelation()` defaulting omitted properties to `{}`
  - kept the queue safely test-only on the service bridge surface rather than editing the already-dirty graph implementation files in the shared workspace
- Verification:
  - `npm.cmd test -- tests/mcp/graph-service.test.ts tests/graph/graph-manager.test.ts`
- Result:
  - targeted regression: `2 files passed, 11 tests passed`

## Forty-Fourth Implemented Slice
- File:
  `src-ts/tests/graph/graph-manager.test.ts`
- What changed:
  - expanded the direct GraphManager regression slice to cover the remaining parser and fallback contract edges that were still thin:
    - `CypherParser` type detection for `DELETE`, `SET`, and `UNKNOWN` queries
    - `runCypher()` raw SQL reader/write/error fallback behavior
    - `findRelatedEntities()` zero-depth and zero-limit edges
    - `searchEntities()` fallback from FTS failure to the LIKE path
  - confirmed these public compatibility paths were already stable, so no GraphManager implementation patch was required for this queue
- Verification:
  - `npm.cmd test -- tests/mcp/graph-service.test.ts tests/graph/graph-manager.test.ts`
- Result:
  - targeted regression: `2 files passed, 11 tests passed`

## Forty-Fifth Implemented Slice
- Files:
  - `.workflow/issues/solutions/P4-037.jsonl`
  - `.workflow/issues/solutions/P4-038.jsonl`
  - `.workflow/issues/solutions/P4-039.jsonl`
  - `.workflow/issues/queues/QUE-20260405-P4-13.json`
  - `.workflow/issues/queues/index.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - formed and recorded the executable `QUE-20260405-P4-13` queue for the graph contract-tail continuation
  - refreshed the active Phase 4 baseline after landing the graph MCP guard/default and GraphManager parser/fallback regressions
  - explicitly kept the queue test-only because `src-ts/graph/graph-engine.ts`, `src-ts/graph/graph-manager.ts`, and `src-ts/mcp/services/graph.ts` already carry active uncommitted implementation edits in this shared workspace
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 43 tests passed`
  - official coverage: `lines 97.52% | branches 84.16% | functions 100% | statements 97.52%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-13` is completed and closes the remaining thin MCP graph-service guard/default branches while deepening GraphManager parser/fallback contract coverage.
- The graph slice now keeps `mcp/services/graph.ts` at `100%` branch coverage and raises `graph/graph-manager.ts` to `97.42% lines | 76.21% branches | 100% functions | 97.42% statements` without needing an implementation patch.
- The next likely bounded queue should move into either:
  - broader multi-store integration semantics once the active `src-ts/memory/unified-memory.ts` edits are reconciled
  - a deeper GraphEngine/GraphManager result-shape parity pass if downstream callers need closer alignment beyond the current guard/default/parser/fallback coverage

## Forty-Sixth Implemented Slice
- Files:
  - `src-ts/graph/graph-engine.ts`
  - `src-ts/tests/graph/graph-engine.test.ts`
  - `src-ts/tests/graph/index.test.ts`
- What changed:
  - resolved the remaining simple-node query parity gap by wrapping `GraphEngine.executeCypher()` results under the requested `RETURN` alias for `MATCH (alias:Type) RETURN alias` style queries
  - kept relationship-match and traversal-match payloads unchanged, so this patch only touched the bounded node-query contract
  - refreshed the direct GraphEngine and graph-barrel regressions to assert alias-wrapped node-query results, including a non-`n` alias through the public barrel
- Verification:
  - `npm.cmd test -- tests/graph/graph-engine.test.ts tests/graph/index.test.ts`
- Result:
  - targeted regression: `2 files passed, 7 tests passed`

## Forty-Seventh Implemented Slice
- File:
  `src-ts/tests/mcp/graph-service.test.ts`
- What changed:
  - tightened the direct MCP graph-service regression slice so `graphQuery()` now explicitly forwards alias-wrapped `executeCypher()` results unchanged
  - kept this follow-up bounded to bridge coverage rather than widening into new service implementation work
- Verification:
  - `npm.cmd test -- tests/mcp/graph-service.test.ts tests/graph/graph-engine.test.ts tests/graph/index.test.ts`
- Result:
  - targeted regression: `3 files passed, 11 tests passed`

## Forty-Eighth Implemented Slice
- Files:
  - `.workflow/issues/solutions/P4-040.jsonl`
  - `.workflow/issues/solutions/P4-041.jsonl`
  - `.workflow/issues/solutions/P4-042.jsonl`
  - `.workflow/issues/queues/QUE-20260405-P4-14.json`
  - `.workflow/issues/queues/index.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - formed and recorded the executable `QUE-20260405-P4-14` queue for the graph query alias-parity continuation
  - refreshed the active Phase 4 baseline after landing the bounded GraphEngine alias-parity patch and graph-service forwarding regression
  - kept broader graph parity beyond alias wrapping deferred because the adjacent graph implementation surface still carries active uncommitted edits in this shared workspace
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 43 tests passed`
  - official coverage: `lines 97.49% | branches 83.95% | functions 100% | statements 97.49%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-14` is completed and closes the simple node-query alias-shape gap between `GraphEngine.executeCypher()` and `GraphManager.runCypher()` without changing relationship or traversal payload contracts.
- The graph slice now keeps `graph/graph-engine.ts` at `97.29% lines | 85.35% branches | 100% functions | 97.29% statements`, while `mcp/services/graph.ts` still holds `100%` branch coverage inside the Phase 4 gate.
- The next likely bounded queue should move into either:
  - broader multi-store integration semantics once the active `src-ts/memory/unified-memory.ts` edits are reconciled
  - deeper GraphEngine/GraphManager parity work on the remaining entity-result differences beyond alias wrapping if downstream callers need even closer alignment

## Forty-Ninth Implemented Slice
- Files:
  - `src-ts/tests/memory/index.test.ts`
  - `src-ts/memory/unified-memory.ts`
  - `src-ts/memory/unified-memory.js`
  - `src-ts/memory/query-cache.ts`
  - `src-ts/memory/query-cache.js`
- What changed:
  - extended the direct memory barrel regression so the public UnifiedMemoryEngine path now locks in:
    - filtered `search()` behavior through layer, dimension, entity, and `atTime`
    - temporal-window filtering through `getTemporalFacts()`
    - conflict detection and resolution through the real engine surface
  - fixed the bounded memory runtime gaps the new real-engine regressions exposed:
    - query-cache singleton initialization on first cached search
    - better-sqlite object-row normalization in search/conflict paths
    - local no-op cache and adapter/runtime compatibility inside the public memory engine surface
- Verification:
  - `npm.cmd test -- tests/memory/index.test.ts tests/mcp/memory-service.test.ts`
- Result:
  - targeted regression: `2 files passed, 9 tests passed`

## Fiftieth Implemented Slice
- File:
  `src-ts/tests/mcp/memory-service.test.ts`
- What changed:
  - tightened the direct MCP memory-service regression slice so the public bridge now explicitly covers:
    - default payload normalization for `memoryAdd()` and `memorySearch()`
    - default `atTime` and `resolution` normalization for temporal/conflict helpers
    - rejection of partial memory-engine objects that do not satisfy the full public surface
  - kept this follow-up bounded to bridge coverage instead of widening into new MCP implementation work
- Verification:
  - `npm.cmd test -- tests/memory/index.test.ts tests/mcp/memory-service.test.ts`
- Result:
  - targeted regression: `2 files passed, 9 tests passed`

## Fifty-First Implemented Slice
- Files:
  - `src-ts/vitest.config.ts`
  - `.workflow/issues/solutions/P4-043.jsonl`
  - `.workflow/issues/solutions/P4-044.jsonl`
  - `.workflow/issues/solutions/P4-045.jsonl`
  - `.workflow/issues/queues/QUE-20260405-P4-15.json`
  - `.workflow/issues/queues/index.json`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/TODO_LIST.md`
  - `.workflow/active/WFS-phase-4-data-layer-entry-20260404/HANDOFF.md`
- What changed:
  - formed and recorded the executable `QUE-20260405-P4-15` queue for the bounded memory-contract hardening continuation
  - switched Vitest to TypeScript-first extension resolution so the official Phase 4 suite exercises `src-ts` sources instead of adjacent CommonJS `.js` artifacts
  - refreshed the active Phase 4 baseline after the memory public-contract hardening and bridge guard/default coverage landed
- Verification:
  - `npm.cmd run test:phase4`
  - `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts`
  - `npm.cmd run typecheck`
- Result:
  - regression: `11 files passed, 47 tests passed`
  - official coverage: `lines 97.49% | branches 85.23% | functions 100% | statements 97.49%`
  - typecheck: passed

## Updated Queue Status
- `QUE-20260405-P4-15` is completed and hardens the public memory contract without widening into full multi-store implementation work.
- The memory slice now keeps the direct barrel, MCP bridge, and adapter-aware memory regressions green while the official Phase 4 baseline stays above threshold with the TS-first Vitest harness.
- The next likely bounded queue should move into either:
  - broader multi-store integration semantics inside `src-ts/memory/unified-memory.ts` now that the public contract is stable
  - a dedicated runtime artifact cleanup pass if non-Vitest entrypoints also need the same source-first protection against the side-by-side CommonJS `.js` files
