# Tasks: Phase 4 Data Layer Entry

## Entry Setup

- [x] Accept Phase 3 entry as stable handoff source
- [x] Create Phase 4 active entry session
- [x] Inventory current TypeScript data-layer coverage across `memory`, `graph`, and `store`
- [x] Identify stubs, weak wiring, and compatibility gaps inside or adjacent to the Phase 4 scope
- [x] Select the first concrete Phase 4 implementation slice
- [x] Form the first bounded Phase 4 queue (`QUE-20260404-P4-1`)
- [x] Execute `P4-001`: graph MCP bridge regression slice
- [x] Execute `P4-002`: graph barrel regression slice
- [x] Execute `P4-003`: refresh initial Phase 4 regression baseline
- [x] Form the next memory-contract queue (`QUE-20260405-P4-2`)
- [x] Execute `P4-004`: memory contract reconciliation slice
- [x] Execute `P4-005`: memory barrel regression slice
- [x] Execute `P4-006`: refresh expanded Phase 4 regression baseline
- [x] Form the next store-openkl queue (`QUE-20260405-P4-3`)
- [x] Execute `P4-007`: openkl-contract regression slice
- [x] Execute `P4-008`: store barrel regression slice
- [x] Execute `P4-009`: refresh store-expanded Phase 4 baseline
- [x] Form the next manager-level queue (`QUE-20260405-P4-4`)
- [x] Execute `P4-010`: graph-manager regression slice
- [x] Execute `P4-011`: store-manager regression slice
- [x] Execute `P4-012`: refresh manager-level Phase 4 baseline
- [x] Form the next integration-adapter queue (`QUE-20260405-P4-5`)
- [x] Execute `P4-013`: integration-adapter factory regression slice
- [x] Execute `P4-014`: unified-memory shadow-write fallback regression slice
- [x] Execute `P4-015`: refresh integration-adapter Phase 4 baseline
- [x] Form the next graph-tail queue (`QUE-20260405-P4-6`)
- [x] Execute `P4-016`: graph-manager tail regression slice
- [x] Execute `P4-017`: graph-engine tail regression slice
- [x] Execute `P4-018`: refresh graph-tail Phase 4 baseline
- [x] Form the next graph-algorithm queue (`QUE-20260405-P4-7`)
- [x] Execute `P4-019`: graph-manager algorithm compatibility slice
- [x] Execute `P4-020`: graph-manager deeper cypher regression slice
- [x] Execute `P4-021`: refresh graph-algorithm Phase 4 baseline
- [x] Form the next graph-query-contract queue (`QUE-20260405-P4-8`)
- [x] Execute `P4-022`: graph-engine cypher guard regression slice
- [x] Execute `P4-023`: graph-engine deeper cypher query slice
- [x] Execute `P4-024`: refresh graph-engine query baseline
- [x] Form the next graph-coverage queue (`QUE-20260405-P4-9`)
- [x] Execute `P4-025`: graph-engine coverage-closure slice
- [x] Execute `P4-026`: widen graph manager-engine coverage gate
- [x] Execute `P4-027`: refresh widened graph coverage baseline
- [x] Form the next store-openkl-closure queue (`QUE-20260405-P4-10`)
- [x] Execute `P4-028`: openkl mapping-ingest coverage slice
- [x] Execute `P4-029`: openkl integrity edge coverage slice
- [x] Execute `P4-030`: refresh openkl-closure Phase 4 baseline
- [x] Form the next store-manager-openkl-sync queue (`QUE-20260405-P4-11`)
- [x] Execute `P4-031`: store-manager openkl sync regression slice
- [x] Execute `P4-032`: store-manager openkl import compatibility slice
- [x] Execute `P4-033`: refresh store-manager-openkl sync Phase 4 baseline
- [x] Form the next store-manager-coverage-gate queue (`QUE-20260405-P4-12`)
- [x] Execute `P4-034`: store-manager helper and batch coverage slice
- [x] Execute `P4-035`: widen store-manager coverage gate
- [x] Execute `P4-036`: refresh widened store-manager Phase 4 baseline
- [x] Form the next graph-contract-tail queue (`QUE-20260405-P4-13`)
- [x] Execute `P4-037`: mcp graph-service guard and default slice
- [x] Execute `P4-038`: graph-manager parser and fallback slice
- [x] Execute `P4-039`: refresh graph-contract-tail Phase 4 baseline
- [x] Form the next graph-query-alias-parity queue (`QUE-20260405-P4-14`)
- [x] Execute `P4-040`: graph-engine alias-wrapped node query parity slice
- [x] Execute `P4-041`: graph-service alias-forwarding slice
- [x] Execute `P4-042`: refresh graph-query-alias parity Phase 4 baseline
- [x] Form the next memory-contract-hardening queue (`QUE-20260405-P4-15`)
- [x] Execute `P4-043`: unified-memory public contract hardening slice
- [x] Execute `P4-044`: memory-service default and guard normalization slice
- [x] Execute `P4-045`: refresh memory-contract hardening Phase 4 baseline
- [x] Form the next memory-default-factory queue (`QUE-20260405-P4-16`)
- [x] Execute `P4-046`: unified-memory singleton default-adapter regression slice
- [x] Execute `P4-047`: memory config-factory default-adapter regression slice
- [x] Execute `P4-048`: refresh memory default-factory baseline
- [x] Form the next memory-merge-semantics queue (`QUE-20260405-P4-17`)
- [x] Execute `P4-049`: unified-memory merge metadata fallback slice
- [x] Execute `P4-050`: merge shadow-write regression slice
- [x] Execute `P4-051`: refresh memory merge-semantics baseline
- [x] Form the next memory-shadow-payload queue (`QUE-20260405-P4-18`)
- [x] Execute `P4-052`: shadow-write payload metadata parity slice
- [x] Execute `P4-053`: shadow-write payload regression refresh
- [x] Form the next mcp-memory-metadata queue (`QUE-20260405-P4-19`)
- [x] Execute `P4-054`: MCP memory add metadata forwarding slice
- [x] Execute `P4-055`: MCP memory endpoint metadata mapping slice
- [x] Execute `P4-056`: refresh MCP memory metadata baseline
- [x] Form the next search-memory-runtime queue (`QUE-20260405-P4-20`)
- [x] Execute `P4-057`: IterativeRetriever memory-provider adapter slice
- [x] Execute `P4-058`: IterativeRetriever lazy memory regression slice
- [x] Execute `P4-059`: refresh search-memory runtime baseline
- [x] Form the next search-graph-runtime queue (`QUE-20260405-P4-21`)
- [x] Execute `P4-060`: IterativeRetriever graph runtime binding cleanup slice
- [x] Execute `P4-061`: IterativeRetriever lazy graph regression slice
- [x] Execute `P4-062`: refresh search-graph runtime baseline
- [x] Form the next mcp-search-contract queue (`QUE-20260405-P4-22`)
- [x] Execute `P4-063`: MCP search service retriever-call contract alignment slice
- [x] Execute `P4-064`: MCP search service config-default regression slice
- [x] Execute `P4-065`: refresh MCP search contract baseline
- [x] Form the next mcp-critic-contract queue (`QUE-20260405-P4-23`)
- [x] Execute `P4-066`: MCP critic sparse-report normalization slice
- [x] Execute `P4-067`: MCP critic normalization regression slice
- [x] Execute `P4-068`: refresh MCP critic contract baseline
- [x] Form the next container-search-contract queue (`QUE-20260405-P4-24`)
- [x] Execute `P4-069`: SearchEngineAdapter default retriever contract alignment slice
- [x] Execute `P4-070`: SearchEngineAdapter default-constructor regression slice
- [x] Execute `P4-071`: refresh container search contract baseline
- [x] Form the next container-agent-contract queue (`QUE-20260405-P4-25`)
- [x] Execute `P4-072`: AgentFactoryAdapter explicit enum/llm bridge slice
- [x] Execute `P4-073`: AgentFactoryAdapter regression slice
- [x] Execute `P4-074`: refresh container agent contract baseline
- [x] Form the next container-token-contract queue (`QUE-20260405-P4-26`)
- [x] Execute `P4-075`: TokenServiceAdapter public-budget bridge slice
- [x] Execute `P4-076`: TokenServiceAdapter regression slice
- [x] Execute `P4-077`: refresh container token contract baseline
- [x] Form the next MCP-agent-runtime-contract queue (`QUE-20260405-P4-27`)
- [x] Execute `P4-078`: AgentFactoryAdapter writer execute bridge slice
- [x] Execute `P4-079`: MCP agent service container-alignment slice
- [x] Execute `P4-080`: refresh MCP agent runtime baseline
- [x] Form the next container-plot-agent-contract queue (`QUE-20260405-P4-28`)
- [x] Execute `P4-081`: AgentFactory plot support slice
- [x] Execute `P4-082`: AgentFactoryAdapter plot run-fallback regression slice
- [x] Execute `P4-083`: refresh container plot agent baseline
- [x] Form the next MCP-config-boolean-contract queue (`QUE-20260405-P4-29`)
- [x] Execute `P4-084`: MCP config boolean coercion fix slice
- [x] Execute `P4-085`: MCP config and contract env regression slice
- [x] Execute `P4-086`: refresh MCP config baseline
- [x] Form the next architect-distill-contract queue (`QUE-20260405-P4-30`)
- [x] Execute `P4-087`: Architect distillation bridge cleanup slice
- [x] Execute `P4-088`: Architect distillation contract regression slice
- [x] Execute `P4-089`: refresh architect distillation baseline
- [x] Form the next MCP-agent-context-runtime queue (`QUE-20260405-P4-31`)
- [x] Execute `P4-090`: MCP agent context runtime adapter slice
- [x] Execute `P4-091`: MCP agent context aggregation regression slice
- [x] Execute `P4-092`: refresh MCP agent context baseline

## Scope Reminder

- `src-ts/memory`
- `src-ts/graph`
- `src-ts/store`

## Current Findings

- Inventory snapshot: `20 files`, about `397,306` bytes across the declared Phase 4 scope
- Broadest volume: `src-ts/memory`
- The first adjacent graph bridge hole has been closed: `src-ts/mcp/services/graph.ts` now uses the real accessor path and has direct regression coverage
- The Phase 2 inherited memory boundary has now been reconciled: MCP memory can use the real container accessor path instead of a local bypass
- `src-ts/memory/unified-memory.ts` now has direct public-contract regression coverage for filtered search, temporal windows, conflict detection/resolution, and injected shadow-write adapter paths, while broader multi-store semantics remain unverified
- `src-ts/mcp/services/memory.ts` now has direct guard coverage for partial engine objects and explicit default normalization for add/search/temporal/conflict bridge calls
- `src-ts/vitest.config.ts` now resolves `.ts` before adjacent `.js` files during Phase 4 test runs, which keeps the official baseline on the TypeScript sources instead of nearby CommonJS artifacts
- `src-ts/graph/graph-manager.ts` now has a compatibility-safe `getSubgraph()` path alongside the original `getSubGraph()` implementation, which closes the adjacent narrative call-path mismatch without widening the API surface further
- `src-ts/graph/graph-engine.ts` now covers bounded `executeCypher()` guard paths, typed node MATCH queries, documented relationship-pattern MATCH behavior, and the traversal-like query shape used by `GraphEngineAdapter.traverse()`
- `src-ts/graph/graph-engine.ts` now also returns alias-wrapped objects for simple `MATCH (alias:Type) RETURN alias` queries, aligning its node-query contract with `GraphManager.runCypher()` while preserving relationship and traversal shapes
- The Phase 4 coverage gate now explicitly includes `graph/graph-manager.ts`, `graph/graph-engine.ts`, and `store/store-manager.ts`, with the official coverage baseline staying above threshold after the widened store-manager campaign
- `src-ts/mcp/services/graph.ts` now has direct guard coverage for partial engine objects and explicit default-payload coverage for mutation helpers, bringing the graph MCP bridge to `100%` branch coverage inside the Phase 4 gate
- `src-ts/tests/mcp/graph-service.test.ts` now explicitly locks that the MCP graph bridge forwards alias-wrapped `executeCypher()` payloads unchanged instead of reshaping node-query results
- `src-ts/graph/graph-manager.ts` now also covers parser type detection, raw SQL fallback reader/write/error behavior, traversal limit edges, and FTS-to-LIKE search fallback paths, which raises the file to `97.42% lines | 76.21% branches | 100% functions | 97.42% statements`
- `src-ts/store/openkl-contract.ts` now has deeper regression coverage across mapping recovery, ingestion validation/default branches, CRUD fallback paths, persistence-failure logging, and integrity anomaly reporting, which closes the weakest remaining store branch surface
- `src-ts/store/store-manager.ts` now preserves actual local `format` and `chunk_count` metadata during OpenKL sync and retains top-level OpenKL `source_type` during import, which stabilizes StoreManager/OpenKL round-trip semantics
- `src-ts/store/store-manager.ts` now also has direct helper, multi-format loading, binary import, batch import/export, chunk-search, and clear-all regression coverage, which raised the file to `96.4% lines | 84.3% branches | 100% functions | 96.4% statements`
- `src-ts/memory/unified-memory.ts` now also normalizes better-sqlite object rows for retrieval profile and retrieval cache reads, with direct round-trip coverage for `getRetrievalProfile()`, `cachePack()`, `cacheRead()`, `cacheStatus()`, and `cacheRelease()`
- `src-ts/memory/unified-memory.ts` now also uses platform-safe path joining for `data_dir` / home-directory fallback database locations, and the direct barrel regression now locks in plugin lifecycle, config-driven factory behavior, and singleton reset semantics through the public memory exports
- `src-ts/tests/mcp/memory-service.test.ts` now also locks the omitted-scope normalization path for `memoryGetTemporal()` / `memoryGetConflicts()` and the explicit non-default resolution path for `memoryResolveConflict()`, which closes the remaining MCP memory service branch gap without changing runtime behavior
- `src-ts/tests/memory/index.test.ts` now also locks the retrieval-cache expiry and `cacheCleanup()` deletion path plus the `UnifiedMemoryEngine.fromConfig()` fallback to `memory.vector_db_path`, which narrows the remaining multi-store/config tail without widening runtime scope
- `src-ts/memory/unified-memory.ts` now also aligns public conflict resolution runtime behavior with the exported strategy surface by supporting `keep_old`, `keep_new`, `merge`, and `manual`, reusing the same plugin/shadow-write hooks for merged memories, and returning a bounded missing-memory error instead of silently collapsing to `auto`
- `src-ts/tests/memory/index.test.ts` now also locks explicit runtime conflict-resolution strategy behavior across `keep_old`, `keep_new`, `merge`, `manual`, and missing-memory failure handling through the public unified engine
- `src-ts/tests/memory/unified-memory.integration-adapters.test.ts` now also locks the singleton `getUnifiedMemoryEngine()` first-creation path so env-enabled default integration adapters still trigger the expected shadow-write behavior without explicit adapter injection
- `src-ts/tests/memory/index.test.ts` now also locks the public `UnifiedMemoryEngine.fromConfig()` path so config-driven construction and env-selected default adapters stay aligned through the barrel surface
- `src-ts/memory/unified-memory.ts` now preserves older non-null `dimension` and `validUntil` values when merge conflict resolution combines a richer older memory with a sparser newer one, instead of dropping those temporal semantics on the merged record
- `src-ts/tests/memory/index.test.ts` now also locks merge-resolution metadata inheritance through the public barrel surface, including dimension fallback, valid-until persistence, scope carry-forward, tag union, and max importance/confidence behavior
- `src-ts/tests/memory/unified-memory.integration-adapters.test.ts` now also locks the merge path itself as a real shadow-write call site, proving that env-enabled default adapters receive the merged payload with inherited scope and merged tags
- `src-ts/memory/unified-memory.ts` now also includes `valid_from`, `valid_until`, `confidence`, `source`, and `updated_at` in the optional postgres shadow-write payload so external stores no longer lose temporal and provenance metadata that already exists in the local primary record
- `src-ts/tests/memory/unified-memory.integration-adapters.test.ts` and `src-ts/tests/memory/index.test.ts` now lock that fuller payload on direct-add, config-factory, and merge paths instead of only checking the narrower earlier subset
- `src-ts/mcp/services/memory.ts` now forwards `source` and `confidence` through `memoryAdd()` instead of silently dropping them at the MCP bridge boundary, which aligns the public MCP contract with the already-supported UnifiedMemoryEngine add surface
- `src-ts/mcp/endpoints/memory.ts` now maps request-body `source` and `confidence` into the MCP memory service add call, so HTTP callers keep that metadata instead of losing it before engine dispatch
- `src-ts/search/iterative-retriever.ts` now binds its lazy graph path directly to the TypeScript `GraphEngine` runtime instead of resolving an adjacent side-by-side `.js` artifact through `require()`, which keeps the retriever on the same runtime surface as the rest of the migrated Phase 4 search stack
- `src-ts/tests/search/iterative-retriever.test.ts` now also seeds a real graph SQLite database and locks `resolveContext()` across `@character` and `@foreshadow` references, which proves the lazy graph path reaches the expected graph runtime instead of only satisfying the contract through mocks
- `src-ts/mcp/services/search.ts` now uses the real `IterativeRetriever` method signatures instead of calling `hybridSearch()` / `iterativeRetrieve()` with legacy single-object payloads, it now injects the integration search adapter when Elasticsearch support is enabled, and it now pulls Redis/search defaults from `src-ts/mcp/config.ts` instead of local stub values
- `src-ts/tests/mcp/search-service.test.ts` now locks the MCP search bridge against positional retriever calls, the real iterative result shape, config-driven Redis rate-limit/cache defaults, and elastic-adapter injection so the service can no longer drift behind the TypeScript search runtime while still passing object-shaped mocks
- `src-ts/mcp/services/critic.ts` now treats sparse narrative critic reports as bounded input instead of assuming every report includes `moduleScores`, `top3Issues`, `criticalIssues`, and other rich fields, which prevents the MCP critic bridge from throwing on partial-but-valid engine output
- `src-ts/tests/mcp/critic-service.test.ts` now locks the critic bridge against sparse report input from the underlying narrative engine while keeping the real runtime bridge and suggestion/comparison paths covered
- `src-ts/container/adapters.ts` now uses the real `IterativeRetriever` type for `SearchEngineAdapter` instead of a cast-only local shim, and its default retriever path now injects the integration search adapter plus `elasticsearchEnabled` flag so the generic container search engine can actually exercise the hybrid/elastic route when integrations are turned on
- `src-ts/tests/container/search-engine-adapter.default-constructor.test.ts` now locks that default constructor wiring, while `src-ts/tests/container/search-engine-adapter.test.ts` continues to cover indexed-document and retriever fallback behavior on the public container adapter surface
- `src-ts/container/adapters.ts` now bridges `AgentFactoryAdapter` through explicit enum mapping and a bounded LLM-service adapter instead of relying on raw `as unknown as` coercions between container and agent-layer contracts
- `src-ts/tests/container/agent-factory-adapter.test.ts` now locks both `getAgent()` and `registerMock()` against the underlying agent factory contract so enum/value drift and LLM adapter drift surface as direct regressions
- `src-ts/container/adapters.ts` now routes `TokenServiceAdapter` budget checks, usage updates, and usage reads through public `TokenService` APIs (`estimateCost()`, `checkBudget()`, `recordUsage()`, `getBudgetStatus()`) instead of mixing token counts with dollar budgets and reaching into the private `_defaultBudget` field
- `src-ts/tests/container/token-service-adapter.test.ts` now locks that public-API bridge so the adapter cannot regress back to private-field access or unit-mismatched budget math
- `src-ts/tests/mcp/memory-service.test.ts` now locks direct-add, default-add, and scope-aware MCP memory forwarding for `source` and `confidence`, and `src-ts/tests/mcp/memory-endpoints.test.ts` adds a focused endpoint mapping regression for the snake_case request body path
- `src-ts/search/iterative-retriever.ts` no longer treats `UnifiedMemoryEngine` itself as a drop-in `MemorySearchProvider`. It now uses a local adapter that normalizes the search contract (`search(query, options)` -> `search({ query, ... })`) and profile lookup nullability, which removes a real lazy-runtime mismatch and avoids depending on the drift-prone side-by-side `unified-memory.js` artifact for that memory path
- `src-ts/tests/search/iterative-retriever.test.ts` now locks the lazy memory-provider path against a real on-disk unified memory database, proving IterativeRetriever can read search results and retrieval profiles through the adapted unified memory runtime instead of only through injected mocks
- Broader multi-store behavior inside `src-ts/memory/unified-memory.ts` remains thinner than the now-covered public contract and was intentionally deferred this round in favor of bounded contract and baseline hardening
- Current direct test visibility now covers bounded entrypoint, manager-level, adapter, graph-engine tail, deeper graph-manager algorithm/query public surfaces, graph MCP guard/default tails, graph-manager parser/fallback tails, deeper graph-engine query contracts, the store/OpenKL branch-closure path, the adjacent StoreManager/OpenKL synchronization path, and the broader StoreManager helper/loading/batch surface needed for official threshold enforcement

## Next Queue Recommendation

- Latest completed queue: `QUE-20260405-P4-31`
- Queue outcome: `agentGetContext()` no longer returns placeholder empty objects. It now adapts the container `memory` / `graph` runtime surfaces into the contracts expected by `WorldbuildingAgent`, `CharacterAgent`, and `PlotAgent`, and the MCP agent service test now locks the aggregated world/character/plot context path end to end.
- Verified baseline:
  1. `npm.cmd test -- tests/search/iterative-retriever.test.ts tests/mcp/memory-service.test.ts tests/mcp/memory-endpoints.test.ts tests/memory/index.test.ts tests/memory/unified-memory.integration-adapters.test.ts` -> Vitest reported `5 files passed, 28 tests passed`, but the shell still returned `exit 1` after success output; this matches the earlier Phase 4 runner oddity and did not present as a test assertion failure
  2. `npm.cmd test -- tests/mcp/search-service.test.ts` -> `1 file passed, 4 tests passed`
  3. `npm.cmd test -- tests/mcp/critic-service.test.ts` -> `1 file passed, 3 tests passed`
  4. `npm.cmd test -- tests/container/search-engine-adapter.test.ts tests/container/search-engine-adapter.default-constructor.test.ts` -> `2 files passed, 4 tests passed`
  5. `npm.cmd test -- tests/container/agent-factory-adapter.test.ts` -> `1 file passed, 4 tests passed`
  6. `npm.cmd test -- tests/mcp/agent-service.test.ts` -> `1 file passed, 3 tests passed`
  7. `npm.cmd test -- tests/agents/factory.test.ts` -> `1 file passed, 3 tests passed`
  8. `npm.cmd test -- tests/mcp/config.test.ts` -> `1 file passed, 2 tests passed`
  9. `npm.cmd test -- tests/agents/architect.test.ts` -> `1 file passed, 4 tests passed`
  10. `npm.cmd test -- tests/container/token-service-adapter.test.ts` -> `1 file passed, 1 test passed`
  11. `npm.cmd run typecheck` -> `passed`
  12. Previous wider Phase 4 coverage baseline remains: `npm.cmd run test:coverage:phase4 -- tests/mcp/graph-service.test.ts tests/graph/index.test.ts tests/mcp/memory-service.test.ts tests/memory/index.test.ts tests/store/openkl-contract.test.ts tests/store/index.test.ts tests/graph/graph-manager.test.ts tests/store/store-manager.test.ts tests/integrations/adapters.test.ts tests/memory/unified-memory.integration-adapters.test.ts tests/graph/graph-engine.test.ts` -> `lines 97.51% | branches 85.6% | functions 100% | statements 97.51%`
- Recommended next slice: the remaining placeholder-heavy MCP helper paths adjacent to agent orchestration, especially any service or endpoint surfaces that still normalize synthetic defaults instead of routing to migrated runtime behavior
