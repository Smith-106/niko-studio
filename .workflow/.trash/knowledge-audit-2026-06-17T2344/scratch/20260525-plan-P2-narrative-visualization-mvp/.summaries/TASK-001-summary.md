# TASK-001: 共享类型定义消除 desktop/src/api 与 src-ts/narrative 之间的重复

**Status:** completed
**Wave:** 1

## What was done

Created `src-ts/narrative/types/visualization-types.ts` as the single source of truth for all 7 NarrativeVisualization interfaces:

- `NarrativeVisualizationChapterInput`
- `NarrativeVisualizationTimelineEvent`
- `NarrativeVisualizationTimelineData`
- `NarrativeVisualizationTensionPoint`
- `NarrativeVisualizationTensionData`
- `NarrativeVisualizationCharacterData`
- `NarrativeVisualizationBundle`

Updated both consuming packages to import from the shared types file:

- `src-ts/narrative/narrative-visualization.ts` — removed inline type defs, imports via `./types/visualization-types.js`, re-exports for backward compat
- `desktop/src/api/narrative-visualization.ts` — removed inline type defs, imports via `../../../src-ts/narrative/types/visualization-types`, re-exports for existing desktop consumers

## Verification

- `npx tsc --noEmit -p src-ts/tsconfig.json` exits 0
- `npm run typecheck` in desktop/ exits 0

## Key decisions

- Used `.js` extension in src-ts imports (ESM requirement)
- Added `export type` re-exports in both files for backward compatibility with existing consumers
- Cross-boundary import pattern matches existing projectFileService precedent