# Integration Audit: M28

## Status: PASS (with 2 near-misses)

---

## 1. SHARED INTERFACES

| Interface | Producer | Consumer | Status | Issue |
|-----------|----------|----------|--------|-------|
| GatewayRoute | Phase 2 (health.ts) | Phase 4 (all route tests) | PASS | Consistent type usage across all P4 test files |
| GatewayDeps | Phase 2 (health.ts) | Phase 2 consumers (gateway-state, index, tests) | PASS | Backward-compatible alias maintained; 6 role interfaces available for future narrowing |
| IWorkflowEventRelay | Phase 2 (container/types.ts) | Phase 2 (container/adapters.ts) | PASS | Interface includes broadcast() per deviation note; dynamic import preserves runtime behavior |
| Reader endpoint types | Phase 1 (reader-types.ts) | Phase 1 (reader-routes, reader-services, reader-validation) | PASS | No cross-phase consumer; all P1 internal consumers use consistent types |
| craft-types enums | Phase 2 (craft-types.ts) | Phase 2 (craft-catalog, catalog-loader, narrative analyzers) | PASS | Re-export chain intact; catalog-loader imports types only from craft-types |
| TemplateCategory | Phase 3 (template.ts) | Phase 3 (templateService, TemplateManagerPanel, TemplateBrowserPanel) | PASS | 'plot' added to union; all consumers updated |
| EditorHandle.insertContent | Phase 3 (editorHandle.ts) | Phase 3 (DocumentEditor, NikoEditor) | PASS | Interface extended and implemented consistently |
| VoiceFingerprintResult | Phase 3 (writing-craft API) | Phase 3 (VoiceConsistencyDecorations) | PASS | Type import from API layer matches usage |

### Near-Miss: P1 reader-routes.ts direct import in P2 MCP endpoints/index.ts
- **File**: `src-ts/mcp/endpoints/index.ts:228`
- **Detail**: P2 MCP endpoints index imports directly from `../../reader/mcp/reader-routes` (P1 artifact) rather than through the P1 barrel (`reader/mcp/index.ts`).
- **Impact**: Low. This is a valid import pattern; the P1 barrel (`reader/mcp/index.ts`) was also updated to re-export from reader-routes, so both paths are consistent. However, it bypasses the P1 barrel abstraction, creating a tight coupling between P2 and P1's internal file structure.
- **Severity**: low
- **Fix**: Consider importing from `../../reader/mcp` (P1 barrel) to respect module boundaries, or document the intentional direct import.

### Near-Miss: P2 GatewayDeps alias vs. 6 role interfaces
- **File**: `src-ts/mcp/endpoints/health.ts:64`
- **Detail**: GatewayDeps is now a type alias (intersection of 6 interfaces). No consumer has migrated to the narrower role interfaces. The alias works but the ISP benefit is latent, not realized.
- **Impact**: Low. Backward compatibility is preserved. Future consumers can narrow; existing consumers compile unchanged.
- **Severity**: low
- **Fix**: Add a tracking issue for gradual migration of GatewayDeps consumers to role interfaces.

---

## 2. DEPENDENCY CHAINS

| Dependency | Required By | Provided By | Status | Issue |
|------------|-------------|-------------|--------|-------|
| reader-routes (P1) | P2 MCP endpoints/index.ts | P1 TASK-002 | PASS | Import resolves; 8 handlers exported |
| reader-types (P1) | P1 internal modules | P1 TASK-002 | PASS | No external consumer dependency |
| reader-services (P1) | P1 internal modules, P1 barrel | P1 TASK-003 | PASS | getCustomPersonaStoreReady exported |
| reader-validation (P1) | P1 reader-routes | P1 TASK-002 | PASS | DIMENSION_TO_PARAM available |
| IWorkflowEventRelay (P2) | P2 container/adapters.ts | P2 TASK-001 | PASS | Dynamic import + interface decouples static dependency |
| craft-types (P2) | P2 catalog-loader, narrative analyzers | P2 TASK-003 | PASS | Type-only import breaks cycle |
| craft-catalog getters (P2) | P2 narrative analyzers, tests | P2 TASK-004 | PASS | All 18 const->getter conversions applied |
| GatewayDeps re-export (P2) | P2 gateway-state.ts -> index.ts | P2 TASK-002 | PASS | Re-export chain: gateway-state -> index.ts |
| @tiptap/core (P3) | P3 VoiceConsistencyMark, NikoEditor | P3 package.json | PASS | Mark.create pattern matches ShowTellMark |
| @tauri-apps/api/window (P3) | P3 DocumentEditor dirty check | P3 optional dep | PASS | Conditional dynamic import with try/catch |
| template:apply event (P3) | P3 DocumentEditor | P3 TemplateManagerPanel/TemplateBrowserPanel | PASS | CustomEvent dispatch/listener pattern consistent |
| plotTemplateService (P3) | P3 templateService | P3 TASK-002 | PASS | PLOT_BUILTINS merged into listTemplates |
| vitest@3.2.6 (P4) | P4 all test files | P4 package.json | PASS | Version matches existing test infrastructure |
| GatewayRoute type (P4) | P4 all route tests | P2/P4 shared | PASS | Imported consistently from mcp/types or endpoints |

### Cross-Phase Dependency Analysis

**P1 -> P2**: No direct dependency. P1 (reader endpoints) and P2 (architecture decoupling) operate on disjoint code areas. P2's MCP endpoints/index.ts imports P1's reader-routes, but this is a pre-existing dependency that P1's shim/barrel changes preserved.

**P2 -> P1**: No direct dependency. P2 does not import or reference any P2-modified files from P1.

**P3 -> P1/P2**: No direct dependency. P3 (desktop UI) is a separate workspace (`desktop/`) with no imports from `src-ts/` reader or architecture modules. P3's `analyzeVoiceConsistency` API call goes through the writing-craft API layer, not directly to P1 reader modules.

**P4 -> P1/P2/P3**: P4 test files import route modules from `src-ts/mcp/routes/`. P4's content-routes-additional.test.ts covers P1's reader endpoints (`/reader/analyze`, `/reader/personas`, etc.) as part of the content route contract tests. This is correct — P4 tests the route registration, not the handler implementation. No P4 code imports P3 desktop files.

**P2 -> P3**: No dependency. P2 backend modules do not reference P3 UI code.

**P1 -> P3/P4**: No dependency. P1 reader modules are backend-only.

---

## 3. DATA CONTRACTS

| Contract | Producer | Consumer | Status | Issue |
|----------|----------|----------|--------|-------|
| AnalyzeRequest | P1 reader-types.ts | P1 reader-routes.ts | PASS | Fields: personaIds, content, focusAreas, dimension, etc. |
| FeedbackRequest | P1 reader-types.ts | P1 reader-routes.ts | PASS | Fields: feedbackId, personaId, dimension, action, helpful |
| CompareRequest | P1 reader-types.ts | P1 reader-routes.ts | PASS | Fields: versionA, versionB, personaIds |
| DeAIRequest/DeAIResponse | P1 reader-types.ts | P1 reader-routes.ts | PASS | Fields: content, targetStyle, tone |
| CreatePersonaRequest | P1 reader-types.ts | P1 reader-routes.ts | PASS | Fields: name, focusAreas, biases, weights |
| customPersonaStore | P1 reader-services.ts | P1 reader-routes.ts | PASS | Ready guard via getCustomPersonaStoreReady() |
| IWorkflowEventRelay | P2 container/types.ts | P2 container/adapters.ts | PASS | initialize(server), broadcast(event), close() |
| GatewayDeps (6-way intersection) | P2 health.ts | P2 gateway-state.ts, tests | PASS | Alias preserves shape; no field changes |
| craft-catalog enum values | P2 craft-types.ts | P2 narrative analyzers | PASS | Enum values unchanged; only access pattern changed (const -> getter) |
| TemplateCategory union | P3 template.ts | P3 templateService, UI panels | PASS | 'plot' added; all switch statements updated |
| VoiceConsistencyMark attributes | P3 VoiceConsistencyMark.ts | P3 VoiceConsistencyDecorations.tsx | PASS | data-voice-consistency + data-severity |
| editorIsDirty state | P3 uiSlice.ts | P3 DocumentEditor.tsx | PASS | Selector useDocumentEditorState exposes field |
| template:apply event detail | P3 TemplateManagerPanel.tsx | P3 DocumentEditor.tsx | PASS | { templateId, content } shape |
| listTools response | P2 health.ts | P4 all-tools.test.ts | PASS | 8 categories: memory, graph, search, workflow, critic, agent, skills, writing_helper |

### Near-Miss: P4 content-routes-additional.test.ts reader route count
- **File**: `src-ts/tests/mcp/routes/content-routes-additional.test.ts`
- **Detail**: P4 asserts contentRoutes has 66 routes total. P1 added 8 reader routes. If P1 adds more reader routes in future, P4's hardcoded count will fail.
- **Impact**: Low. This is a contract test by design — it catches route count changes. But the coupling means P4 tests are sensitive to P1 route additions.
- **Severity**: low
- **Fix**: Consider deriving the expected count from the route module itself, or document that P4 tests must be updated when P1 adds/removes reader routes.

---

## 4. API CONSISTENCY

| API | Phase | Status | Issue |
|-----|-------|--------|-------|
| Reader MCP endpoints (8 routes) | P1 | PASS | Methods, patterns, handlers consistent with pre-split behavior |
| Health endpoints (GatewayDeps) | P2 | PASS | Interface split into 6 role types; alias preserves API |
| Gateway bootstrap | P2 | PASS | Import path changed container -> composition-root; no functional change |
| craft-catalog getters | P2 | PASS | 18 getters return same data as previous const exports |
| VoiceConsistency API (writing-craft) | P3 | PASS | analyzeVoiceConsistency returns VoiceFingerprintResult |
| TemplateService.listTemplates | P3 | PASS | Returns merged builtins including plot category |
| DocumentEditor dirty check | P3 | PASS | beforeunload + onCloseRequested both check editorIsDirty |
| Route contract tests (agents/m10/m11) | P4 | PASS | Pattern, method, handler shape assertions consistent with existing tests |
| Content route additional tests | P4 | PASS | 11 groups covered; 66 total routes asserted |
| GET /tools (listTools) | P4 | PASS | 8 categories + specific tool names asserted |
| coverage-gap-scanner | P4 | PASS | Zero-dependency regex parser; --check mode exits 0/1 correctly |

---

## 5. CONFIGURATION

| Config | Phase | Status | Issue |
|--------|-------|--------|-------|
| src-ts tsconfig.json | P1/P2/P4 | PASS | No changes; strict TypeScript maintained |
| desktop tsconfig.json | P3 | PASS | No changes |
| src-ts package.json (coverage:gap script) | P4 | PASS | ts-node --esm pattern matches existing scripts |
| vitest config | P4 | PASS | No new config needed; existing test runner |
| ESM imports | All | PASS | All phases use ESM; postprocess step handles .js extensions |
| Barrel files | P1/P2 | PASS | P1: reader/mcp/index.ts updated; P2: gateway-state.ts re-export chain intact |

---

## 6. ERROR HANDLING

| Error Flow | Phase | Status | Issue |
|------------|-------|--------|-------|
| Input validation errors | P1 | PASS | validateStringArray, validateEnum, validateStringLength with MAX_* constants |
| customPersonaStore race condition | P1 | PASS | getCustomPersonaStoreReady() guard in 3 endpoint handlers |
| Dynamic import failure (IWorkflowEventRelay) | P2 | PASS | require() in synchronous initialize(); runtime error if module missing |
| craft-catalog reload | P2 | PASS | reloadCatalog() clears cache; getters re-load on next call |
| Tauri API unavailable (web build) | P3 | PASS | try/catch + dynamic import; silently falls back to beforeunload only |
| template:apply missing content | P3 | PASS | DocumentEditor ignores events with missing content (tested) |
| editor handle null | P3 | PASS | DocumentEditor does nothing when handle is null (tested) |
| coverage-gap-scanner parse errors | P4 | PASS | Node 24 TypeScript syntax issue mitigated (JSDoc comment fix) |
| scanner --check exit code | P4 | PASS | exit(1) on gaps, exit(0) on clean |

---

## Dependency Health

- **Cross-phase circular dependencies**: None detected. P1, P2, P3, P4 operate on disjoint module trees with no import cycles across phase boundaries.
- **Shared dependency version conflicts**: None. All phases use the same TypeScript (5.7.2), vitest (3.2.6), and Node.js versions.
- **Import resolution**: All verified imports resolve correctly:
  - P2 -> P1: `../../reader/mcp/reader-routes` (src-ts/mcp/endpoints/index.ts:228)
  - P2 internal: `../composition-root/gateway-control-plane` (src-ts/mcp/gateway-bootstrap.ts)
  - P2 internal: `../container/types` (src-ts/container/adapters.ts)
  - P2 internal: `./craft-types` (src-ts/narrative/writing-craft/catalog-loader.ts)
  - P3 internal: `../../../api/writing-craft` (desktop/src/components/editor/extensions/VoiceConsistencyDecorations.tsx)
  - P4 -> P2: `../../mcp/endpoints/health.js` (src-ts/tests/mcp/all-tools.test.ts)

---

## Data Flow Issues

- **None identified**. All phase boundaries are clean:
  - P1 (backend reader) -> no downstream consumer within M28
  - P2 (backend architecture) -> no downstream consumer within M28
  - P3 (frontend UI) -> no upstream dependency on P1/P2
  - P4 (test coverage) -> tests P1/P2 route registrations but does not import handler implementations

---

## Near-Misses (Fragile but Working)

1. **P2 MCP endpoints/index.ts direct import of P1 reader-routes** (low severity)
   - Bypasses P1 barrel abstraction. If P1 restructures internal files, P2 breaks.
   - Fix: Import from `../../reader/mcp` (P1 barrel) instead.

2. **P4 content-routes-additional.test.ts hardcoded route count (66)** (low severity)
   - Couples P4 tests to P1 route count. Future P1 additions will break P4.
   - Fix: Document the dependency or derive count dynamically.

3. **P2 GatewayDeps alias unused for narrowing** (low severity)
   - 6 role interfaces created but no consumer narrowed. ISP benefit unrealized.
   - Fix: Create tracking issue for gradual migration.

4. **P3 VoiceConsistencyDecorations uses `analyzeVoiceConsistency` API** (low severity)
   - If P1 changes the reader API shape, P3's writing-craft API layer must adapt.
   - This is an existing architectural boundary, not a new M28 gap.

---

## Recommendations

1. **Document P1->P2 import boundary**: Add a comment in `src-ts/mcp/endpoints/index.ts` explaining the direct import from `reader-routes` vs. the P1 barrel.

2. **Add P4 route count to P1 checklist**: When adding reader routes in future, include updating `content-routes-additional.test.ts` expected count in the task definition.

3. **GatewayDeps narrowing tracking**: Create a low-priority issue to migrate GatewayDeps consumers to role interfaces (e.g., health endpoints only need IHealthEngineAccess + IServiceRegistryAccess).

4. **Shim removal timeline**: P1's `reader-endpoints.ts` shim has a TODO (ISS-20260621-013). Ensure this issue is scheduled before the shim accumulates technical debt.

5. **P3-P1 API contract documentation**: The `analyzeVoiceConsistency` API bridges P3 (UI) and P1 (reader backend indirectly via writing-craft). Document this contract to prevent future drift.

---

## Gap Summary

| Severity | Count | Description |
|----------|-------|-------------|
| HIGH | 0 | None |
| MEDIUM | 0 | None |
| LOW | 3 | Near-misses: direct import bypass, hardcoded test count, unused ISP interfaces |
| INFO | 1 | Existing P3-P1 API boundary (not a new gap) |

**Total gaps found: 0 (all findings are near-misses / low-severity fragility)**

**Overall Status: PASS**
