# TASK-001: Intelligence Service + API + Slice

**Status:** completed

## What was done

Created the full writing intelligence backend layer:

- `src/api/intelligence.ts` — Analysis API module with `callAnalysisAgent()` that sends module-specific prompts to the gateway agent via `agentGetContext`
- `src/services/intelligenceService.ts` — Orchestration service with `analyzeProject()`, `getCachedAnalysis()`, `invalidateAnalysis()`. Chapter-by-chapter analysis with SHA-256 content_hash caching in Tauri appDataDir
- `src/stores/app/intelligenceSlice.ts` — Zustand slice with `analysisResults`, `isAnalyzing`, `analysisProgress`, `analysisError` state and `startAnalysis`, `loadCachedResult`, `clearAnalysis` actions
- Types: `AnalysisModule` ('character_arc'|'pacing'|'consistency'|'readability'), `AnalysisResult` in `src/api/intelligence.ts`

## Key decisions

- Frontend-orchestrated analysis via existing gateway (no new sidecar endpoints)
- Content hash invalidation reuses `hashContent()` from projectFileService
- Sequential chapter processing with progress callback for UI feedback
- Cache stored at `projects/{projectId}/analysis/{module}.json` in Tauri appDataDir

## Files modified/created

- `src/api/intelligence.ts` (new)
- `src/services/intelligenceService.ts` (new)
- `src/stores/app/intelligenceSlice.ts` (new)
- `src/stores/app/appStore.ts` (modified — added slice)

## Verification

- `npx tsc --noEmit` passes with zero errors in all new files
- All exported functions verified present via grep
