# TASK-003: ReaderState (M23) 集成到 TensionCurveView 并标注关键转折点

**Status:** completed
**Wave:** 2

## What was done

### src-ts/narrative/types/visualization-types.ts
- Added optional `readerState` field to `NarrativeVisualizationTensionPoint` with 5 dimensions: engagement, immersion, suspenseTension, cognitiveLoad, curiosity
- Added `highRiskChapters: string[]` field to `NarrativeVisualizationTensionData`

### src-ts/narrative/narrative-visualization.ts
- Imported `analyzeReaderImmersion` from reader-immersion-engine.js
- In `buildNarrativeVisualizationBundle()`, calls `analyzeReaderImmersion()` to get ChapterReaderState per chapter
- Maps ReaderState to TensionPoint.readerState (engagement = avg of curiosity + emotionalInvestment + immersion + suspenseTension)
- Collects chapter IDs where `dropoutRisk > 0.6` into `highRiskChapters[]`

### desktop/src/api/narrative-visualization.ts
- No changes needed — existing `export type` re-exports automatically include new fields

### desktop/src/components/narrative-visualization/TensionCurveView.tsx
- Renders engagement curve (#3b82f6, thin, opacity 0.7) when readerState exists
- Renders immersion curve (#22c55e, thin, opacity 0.7) when readerState exists
- Red diamond markers at high-risk chapters (chapters in highRiskChapters)
- Legend bar showing: tension (main blue), engagement (blue), immersion (green), risk (red diamond)
- Text fallback buttons show immersion + curiosity values when readerState available
- Fully backward compatible — when readerState is absent, only tension curve renders

### Additional fixes (type safety)
- `useVisualizationData.ts` — added `highRiskChapters: []` to empty tension data
- `NarrativeVisualizationPanelContent.test.tsx` — added `highRiskChapters: []` to sample tension data

## Verification

- `src-ts` typecheck: 0 errors
- `desktop` typecheck: 0 errors