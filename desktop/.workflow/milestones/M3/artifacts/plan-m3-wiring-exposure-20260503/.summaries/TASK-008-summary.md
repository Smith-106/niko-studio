# TASK-008: Wire NarrativePatternDetector + WritingSessionCluster to analysis endpoints

**Status**: completed
**Duration**: 40min
**Wave**: 3

## What was done

Created full-stack analysis feature wiring — MCP endpoints, service layer, frontend API, and route registration for narrative pattern detection and writing session clustering.

### Files created
- `src-tauri/bin/sidecar/mcp/services/analysis.js` — Service layer with lazy-initialized NarrativePatternDetector (graph engine Cypher adapter) and WritingSessionCluster
- `src-tauri/bin/sidecar/mcp/endpoints/analysis.js` — 2 endpoint handlers: analysisPatternsEndpoint, analysisSessionsEndpoint
- `src/api/analysis.ts` — Frontend API with DetectedPattern/SessionCluster interfaces + detectPatterns/clusterSessions functions

### Files modified
- `src-tauri/bin/sidecar/mcp/endpoints/index.js` — Added analysis endpoint barrel exports
- `src-tauri/bin/sidecar/mcp/routes/content.js` — Added 2 analysis route registrations (POST /analysis/patterns, POST /analysis/sessions)

### Key design decisions
- **Graph engine adapter for NarrativePatternDetector**: Detector requires a `store` with `getEntitiesByTypes()`. Created a lightweight adapter in the service layer that translates type queries into Cypher via `getGraphEngine().executeCypher()`.
- **Service singleton pattern**: Both detector and clusterer use lazy init with module-level singletons (matches foreshadow/character patterns).

## Verification
- 860 tests pass (npx vitest run)
- TypeScript compiles cleanly (no new errors)
- Convergence criteria met: endpoints exist, call correct analysis modules, frontend API exports typed functions

## Convergence checklist
- [x] New analysis endpoint file exists in src-tauri/bin/sidecar/mcp/endpoints/
- [x] Endpoint exposes POST /analysis/patterns calling NarrativePatternDetector
- [x] Endpoint exposes POST /analysis/sessions calling WritingSessionCluster
- [x] Frontend API file exports analysis functions
- [x] Analysis results are consumable by frontend UI
