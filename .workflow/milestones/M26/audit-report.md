# Integration Audit: M26 Competitive Differentiation & Reader Simulation Deepening

## Status: FAIL

### Audit Scope
- **Milestone**: M26
- **Date**: 2026-06-21
- **Auditor**: Integration Checker (milestone-level cross-phase)
- **Previous audit**: 2026-06-19 (Phase 1 only, PASS with 2 accepted risks)

### Artifacts Audited

| # | Artifact | Directory | Type | Tasks |
|---|----------|-----------|------|-------|
| 1 | P1 Reader Simulation 2.0 + Anti-AI-Flavor | `.workflow/scratch/20260618-plan-P1-reader-simulation-anti-ai-flavor` | Phase execute | 10 |
| 2 | Fix Remaining Pre-Delivery Risks | `.workflow/scratch/20260619-plan-fix-remaining-risks` | Ad-hoc execute | 4 |
| 3 | NSIS Install + Gateway Startup Debug | `.workflow/scratch/20260620-debug-odyssey-nsis-install-file-lock` | Standalone debug | 5 fixes |
| 4 | Gateway Startup Chain Quality | `.workflow/scratch/20260620-improve-odyssey-gateway-startup-chain` | Standalone improve | 94 findings, 11 fixes |

---

## Interface Checks

| # | Interface | Producer | Consumer | Status | Issue |
|---|-----------|----------|----------|--------|-------|
| 1 | ConsensusReport | P1 (ConsensusEngine.ts) | P1 (frontend reader.ts) | PASS | Frontend re-declaration matches backend shape (items, overallAssessment, criticalIssues, dissentItems, dimensionSummaries) |
| 2 | ConsensusItem | P1 (ConsensusEngine.ts) | P1 (frontend reader.ts, DetailPanel.tsx) | PASS | Both use agreeingPersonas/disagreeingPersonas + location |
| 3 | OverlayMarker | P1 (OverlayBridge.ts) | P1 (frontend reader.ts) | **FAIL** | Shape mismatch -- see GAP-01 |
| 4 | EditorialAnalysis | P1 (DualEngine.ts) | P1 (frontend reader.ts) | **FAIL** | Missing aiFlavor field -- see GAP-02 |
| 5 | ReaderPersona | P1 (PersonaDefinition.ts) | P1 (frontend reader.ts) | **FAIL** | Missing type discriminant + 5 extended fields -- see GAP-03 |
| 6 | /reader/ai-flavor endpoint | P1 (reader-endpoints.ts) | frontend (reader.ts) | **FAIL** | No frontend API function -- see GAP-04 |
| 7 | /reader/de-ai endpoint | P1 (reader-endpoints.ts) | frontend (reader.ts) | **FAIL** | No frontend API function -- see GAP-05 |
| 8 | /reader/compare endpoint | P1 (reader-endpoints.ts) | frontend (reader.ts) | **FAIL** | No frontend API function -- see GAP-06 |
| 9 | RevisionConfig | P1 (revision-loop.ts) | P1 (revision-service.ts) | PASS | quality_goals, target_style, revision_mode all present and optional |
| 10 | Route registration | P1 (reader-endpoints.ts) | Gateway (content.ts) | PASS | All 8 reader endpoints registered with correct methods/patterns |
| 11 | FeedbackAction | P1 (reader-endpoints.ts) | P1 (DetailPanel.tsx) | gap_found | Frontend narrows to 2 actions (missing 'ignore') -- see GAP-07 |
| 12 | Cross-boundary imports | P1 (src-ts) | P1 (desktop/src) | gap_found | 5 production + 7 test files bypass api layer -- see GAP-08 |
| 13 | Gateway shutdown chain | Debug (gateway-bootstrap.ts) | Improve (gateway-control-plane.ts) | PASS | shutdownGatewayControlPlane now calls container.shutdown() + clears global state |
| 14 | CORS cache invalidation | Improve (gateway-http-adapter.ts) | Improve (gateway-control-plane.ts) | PASS | invalidateCorsCache() wired into config reload onChange listener |
| 15 | localhost-only guard | Improve (gateway-request-handler.ts) | Debug (gateway-bootstrap.ts) | PASS | Guard middleware enforced at request handler level; WS upgrade also checks |

---

## Dependency Health

### Cross-phase circular dependencies: none

Dependency chain flows unidirectionally:
- P1: DualEngine -> ai-flavor-detector, ConsensusEngine (no cycles)
- P1: RevisionService -> ai-templates (no cycles)
- Fix-Risks: independent of P1 reader module
- NSIS debug: gateway_runtime.rs <-> gateway-bootstrap.ts (runtime boundary, not circular import)
- Gateway improve: same chain as debug, no new cycles introduced

### Shared dependency version conflicts: none

Both desktop/ and src-ts/ audited (fix-risks TASK-001). Only low-severity esbuild deferred (ISS-20260619-001/002).

### Cross-phase dependency satisfaction: all satisfied

- P1 TASK-005 (De-AI) depends on TASK-004 (AI-flavor detector): satisfied
- P1 TASK-006 (compare) depends on TASK-002 (ConsensusReport unification): satisfied
- P1 TASK-007 (feedback) depends on TASK-003 (PersonaDefinition extension): satisfied
- P1 TASK-009 (persistence) depends on TASK-007 (feedback store): satisfied
- Gateway improve depends on NSIS debug fixes: satisfied (sequential execution, 54/54 tests pass)

---

## Data Flow Issues

### GAP-01: OverlayMarker type split causes silent data loss [HIGH]

**File**: `desktop/src/api/reader.ts:67-75` vs `src-ts/reader/OverlayBridge.ts:19-29`

The backend `OverlayBridge.OverlayMarker` is consensus-oriented:
```ts
{ id, type, dimension, severity, description, position: {chapterId?, paragraphIndex?}, personaCount, consensusStrength, personaIds: string[] }
```

The frontend `api/reader.ts.OverlayMarker` is highlight-oriented:
```ts
{ personaId, personaName, position: {chapter, paragraph}, reaction, comment, dimension, text }
```

These are fundamentally different types sharing the same name. DetailPanel.tsx imports from OverlayBridge directly (correct shape), but api/reader.ts declares its own incompatible version. If a frontend component uses the api/reader.ts type to consume overlay data from the backend, fields like id, type, severity, consensusStrength would be silently dropped, and personaId/personaName/reaction/comment/text would be undefined.

**Affected phases**: P1 Execute (frontend)
**Severity**: HIGH
**Fix**: Either (a) rename the frontend type to `HighlightMarker` to distinguish from consensus-oriented OverlayMarker, or (b) align the frontend type with the backend OverlayBridge shape and update ReaderOverlayResult accordingly.

### GAP-02: EditorialAnalysis missing aiFlavor causes data loss at boundary [MEDIUM]

**File**: `desktop/src/api/reader.ts:39-44` vs `src-ts/reader/DualEngine.ts:50-56`

Backend has `aiFlavor?: AIFlavorResult` as an optional field. Frontend copy omits it. The aiFlavor data is available in the JSON response but inaccessible via the typed API layer.

**Affected phases**: P1 Execute (frontend)
**Severity**: MEDIUM
**Fix**: Add `aiFlavor?: AIFlavorResult` to frontend EditorialAnalysis, importing or re-declaring the AIFlavorResult type.

### GAP-03: ReaderPersona type drift between api/reader.ts and PersonaSelector [MEDIUM]

**File**: `desktop/src/api/reader.ts:85-98` vs `desktop/src/components/reader/PersonaSelector.tsx`

PersonaSelector.tsx defines its own local `Persona` interface with extended fields (ageGroup, culturalBackground, readingPreference, genrePreference, aiFlavorSensitivity), while api/reader.ts ReaderPersona omits them plus the `type: 'preset' | 'custom'` discriminant. Custom personas with extended fields may have those fields stripped during API round-trips if serialization filters by the narrower type.

**Affected phases**: P1 Execute (frontend)
**Severity**: MEDIUM
**Fix**: Add `type` discriminant and 5 extended optional fields to api/reader.ts ReaderPersona.

### GAP-04/05/06: Frontend missing 3 API wrappers [HIGH each]

**File**: `desktop/src/api/reader.ts`

No frontend API functions for:
- POST /reader/ai-flavor (AI flavor detection)
- POST /reader/de-ai (De-AI rewrite)
- POST /reader/compare (A/B comparison)

All three endpoints are fully implemented on backend and registered in routes/content.ts. The i18n module includes translation keys for these features (antiAIFlavor*, deAI*, abTest*), confirming UI is intended. But no callApi wrapper exists in the frontend API layer.

**Affected phases**: P1 Execute (frontend)
**Severity**: HIGH
**Fix**: Add `detectAIFlavor`, `deAIRewrite`, and `compareReader` functions to desktop/src/api/reader.ts with proper request/response types.

### GAP-07: FeedbackAction narrowing [LOW]

**File**: `desktop/src/components/reader/DetailPanel.tsx`

DetailPanel onFeedback prop only allows `'helpful' | 'not_helpful'`, while backend FeedbackRequest allows `'helpful' | 'not_helpful' | 'ignore'`. The 'ignore' case has no UI representation.

**Affected phases**: P1 Execute (frontend)
**Severity**: LOW
**Fix**: Add a "Skip" button for the 'ignore' action, or accept the narrowing as intentional UX design.

### GAP-08: Cross-boundary type imports bypass API layer [MEDIUM]

**Files**: 5 production + 7 test files in desktop/src/ import directly from ../../../../src-ts/ or ../../../src-ts/

Key offenders:
- `ReportGenerator.tsx:3` imports ConsensusReport/ConsensusItem from `../../../../src-ts/reader/ConsensusEngine`
- `DetailPanel.tsx:2-3` imports OverlayMarker/ConsensusReport from `../../../../src-ts/reader/OverlayBridge` and `ConsensusEngine`
- `types/reader.ts` imports from `../../../src-ts/reader/OverlayBridge`

This bypasses the api/reader.ts layer and creates fragile path dependencies. If backend types change, frontend components break at build time with no API layer to absorb the change.

**Affected phases**: P1 Execute (frontend)
**Severity**: MEDIUM
**Fix**: Move needed types into desktop/src/api/reader.ts (or a desktop/src/types/reader.ts) and import from the API layer instead of directly from src-ts/.

### GAP-09: dimensionScores fallback overwrites avgScore [LOW]

**File**: `desktop/src/components/reader/ReportGenerator.tsx`

When backend returns empty dimensionSummaries but provides dimensionScores, the fallback loop writes `report.dimensionSummaries[dimName].avgScore = ds.score` for each persona, overwriting the previous value. Final avgScore reflects the last persona's score, not the average.

**Affected phases**: P1 Execute (frontend)
**Severity**: LOW (rarely triggers; backend always populates dimensionSummaries)
**Fix**: Compute actual average across all persona scores, or remove the fallback path entirely.

### GAP-10: clearReaderStores() async change [LOW]

**File**: `src-ts/reader/mcp/reader-endpoints.ts`

Changed from sync to async in TASK-009 for file deletion. Backward compatible (return value never used for control flow), but fragile -- future code depending on synchronous completion would get a race condition.

**Affected phases**: P1 Execute (backend)
**Severity**: LOW
**Fix**: Document the async contract; no immediate action needed.

---

## API Consistency

### Endpoint-to-Frontend Mapping

| Endpoint | Backend | Frontend | Status |
|----------|--------|----------|--------|
| POST /reader/analyze | rsAnalyzeEndpoint | analyzeReader() | PASS |
| GET /reader/personas | rsGetPersonasEndpoint | getReaderPersonas() | PASS |
| POST /reader/personas/custom | rsCreateCustomPersonaEndpoint | createCustomPersona() | PASS |
| POST /reader/overlay | rsGetOverlayEndpoint | getReaderOverlay() | PASS |
| POST /reader/feedback | rsFeedbackEndpoint | submitFeedback() | PASS |
| POST /reader/ai-flavor | rsAIFlavorEndpoint | **MISSING** | FAIL |
| POST /reader/de-ai | rsDeAIEndpoint | **MISSING** | FAIL |
| POST /reader/compare | rsCompareEndpoint | **MISSING** | FAIL |

### Key/field naming consistency: verified

- Foreshadowing consistently uses `state` (not `status`) across graph endpoints and foreshadowing module
- Character profile uses hybrid flat+nested structure (consistent within codebase)

---

## Configuration Compatibility

| Config | Artifacts Involved | Status | Notes |
|--------|-------------------|--------|-------|
| NIKO_GATEWAY_PORT | NSIS debug, Gateway improve | PASS | parseIntSafe() + Number.isFinite() guard in validateConfig(); ephemeral port drop in gateway_runtime.rs |
| CORS origins | Gateway improve | PASS | _cachedCorsOrigins cache + invalidateCorsCache() on config reload |
| Health probe timeout | Gateway improve | PASS | Concurrent tokio::join! probes reduce cold start from ~6s to ~2s |
| localhost-only guard | NSIS debug, Gateway improve | PASS | Enforced at request handler + WS upgrade level |
| LLM env vars (API_KEY, BASE_URL, MODEL) | P1 (RevisionService) | PASS | HTTPS enforcement + 30s AbortSignal.timeout added per SEC-003 fix direction |
| NIKO_WORKSPACE_ROOT | P1 (reader-endpoints.ts) | PASS | Used for custom persona persistence path |
| reader-personas.json | P1 (reader-endpoints.ts) | PASS | Auto-create directory, graceful degradation on parse failure |

---

## Error Handling

| Boundary | Artifacts | Status | Notes |
|----------|-----------|--------|-------|
| headersSent check | Gateway improve (gateway-request-handler.ts:188) | PASS | `if (!res.headersSent) { writeHead+end } else { res.destroy() }` |
| parseInt NaN guard | NSIS debug (config/index.ts, gateway-bootstrap.ts) | PASS | parseIntSafe() replaces 6 parseInt() calls; Number.isFinite() in validateConfig() |
| listen() EADDRINUSE | NSIS debug (gateway-bootstrap.ts:46) | PASS | server.on('error', reject) with EADDRINUSE detection |
| kill() PID polling | NSIS debug (gateway_runtime.rs:465) | PASS | OpenProcess + 3s timeout polling on Windows |
| createDefaultConfigFile try-catch | NSIS debug (config/index.ts) | PASS | try/catch with log.warn fallback |
| unhandledRejection handler | Gateway improve (gateway-bootstrap.ts:123) | PASS | Global handler logs but does not terminate |
| LLM fetch timeout + HTTPS | P1 (revision-service.ts) | PASS | HTTPS enforcement + 30s AbortSignal.timeout |
| File I/O (personas) | P1 (reader-endpoints.ts) | PASS | loadCustomPersonas catches parse failure; saveCustomPersonas auto-creates dir |
| shutdown cleanup | Gateway improve | PASS | container.shutdown() + WS relay close + rate limiter stop + 5s forced exit |
| WS upgrade rejection | Gateway improve (gateway-ws.ts) | PASS | 403 Forbidden + socket.destroy() on rejected upgrades |

**Deferred error handling items** (from NSIS debug and Gateway improve):
- _initSchema try-catch (5 instances in unified-memory, workflow-state-store, memory-mcp, writing-session-cluster, graph-engine) -- deferred per D1 decision
- ConsensusEngine division by zero (CORR-003) -- accepted risk, ISS-20260621-011 proposed
- WS close+terminate race (H17) -- low priority, deferred

---

## Recommendations

### HIGH priority (fix before next release)

1. **GAP-01**: Unify OverlayMarker type between frontend api/reader.ts and backend OverlayBridge.ts. Rename one or align shapes.
2. **GAP-04/05/06**: Add 3 missing frontend API functions (detectAIFlavor, deAIRewrite, compareReader) to desktop/src/api/reader.ts.
3. **CORR-003**: Add empty array guard in ConsensusEngine.calculateDimensionSummaries() (already proposed as ISS-20260621-011).

### MEDIUM priority (fix in next iteration)

4. **GAP-02**: Add aiFlavor?: AIFlavorResult to frontend EditorialAnalysis in api/reader.ts.
5. **GAP-03**: Extend frontend ReaderPersona with type discriminant and 5 extended optional fields.
6. **GAP-08**: Eliminate cross-boundary imports. Move ConsensusReport, ConsensusItem, OverlayMarker types into desktop/src/api/reader.ts or desktop/src/types/reader.ts.
7. **ARCH-001**: Fix ReportGenerator.tsx and DetailPanel.tsx to import types from API layer, not directly from src-ts/.

### LOW priority (technical debt)

8. **GAP-07**: Add 'ignore' action UI to DetailPanel or document the intentional narrowing.
9. **GAP-09**: Fix dimensionScores fallback avgScore computation in ReportGenerator.tsx.
10. **MAINT-002**: Extract shared AI template patterns (ISS-20260621-010 proposed).
11. **SEC-003 remaining**: Verify HTTPS enforcement + timeout are in place (fix direction was documented in P1 retrospective; verify actual code matches).

---

## Gap Count and Severity Breakdown

| Severity | Count | Gap IDs |
|----------|-------|--------|
| HIGH | 4 | GAP-01 (OverlayMarker split), GAP-04 (/ai-flavor missing), GAP-05 (/de-ai missing), GAP-06 (/compare missing) |
| MEDIUM | 3 | GAP-02 (aiFlavor missing), GAP-03 (ReaderPersona drift), GAP-08 (cross-boundary imports) |
| LOW | 3 | GAP-07 (FeedbackAction narrowing), GAP-09 (fallback avgScore), GAP-10 (async clearReaderStores) |
| Informational | 0 | -- |

**Total gaps: 10 (4 HIGH, 3 MEDIUM, 3 LOW)**

**Overall Status: FAIL** -- 4 HIGH-severity interface gaps mean the frontend cannot fully consume the backend reader simulation APIs that were implemented in P1. The backend is complete and internally consistent; the frontend API layer was not updated to expose all new endpoints and types created in P1.

### Change from Previous Audit (2026-06-19)

The previous P1-only audit assessed PASS with 2 accepted risks. This milestone-level audit reveals a FAIL because:
1. Previous audit treated missing API wrappers as "near-miss" (frontend components not yet built). At milestone boundary, these are now gaps -- the i18n keys confirm UI intent exists.
2. Previous audit noted OverlayMarker as PASS, but deeper inspection reveals the frontend api/reader.ts type and backend OverlayBridge.ts type are fundamentally different shapes sharing the same name.
3. Previous audit did not verify whether frontend EditorialAnalysis/ReaderPersona types were synchronized with backend post-P1 extension.
4. The NSIS debug and gateway improve artifacts introduce no cross-artifact integration issues (they are self-contained within the gateway startup chain), but they do verify that previously deferred SEC-003 fix direction (HTTPS+timeout for LLM fetch) was actually implemented in revision-service.ts -- confirming this accepted risk is now resolved.

---

*Report generated by Integration Checker at milestone boundary.*
*All findings verified against actual code artifacts in C:\Users\niko\Desktop\工作目录\niko-studio.*
