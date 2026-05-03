# TASK-006 Summary: Upgrade Consistency Dashboard with per-module score breakdown

**Status**: completed
**Completed**: 2026-05-03
**Duration**: 20min

## Changes

### critic.js (endpoints)
- Added `moduleScores` field to `runConsistencyCheck` return value with per-domain scores: character, timeline, worldview

### evaluation.ts
- Added `moduleScores` field to `ConsistencyCheckResult.combined` type with `{ character: number, timeline: number, worldview: number }`

### EvaluationPanel.tsx
- Extended `buildDimensions()` to accept optional `module_scores` and return `{ core, modules }` instead of flat array
- Updated `buildViewModel` call to destructure `{ core, modules }` from new `buildDimensions` shape
- Added per-module score breakdown section in detailed review area (between dimension analysis and suggestions)
- Added per-module score bars in consistency check result display (character/timeline/worldview)

### useEvaluationData.ts
- Added `modules` field to `EvaluationViewModel` interface

### translations.ts
- Added `evaluationModuleBreakdown` key: '一致性模块评分' (zh) / 'Module Scores' (en)

### EvaluationPanel.test.tsx
- Added `moduleScores` mock data to consistency check test

## Convergence
- EvaluationPanel renders per-module breakdown in both evaluation detail and consistency check result
- Consistency endpoint includes moduleScores breakdown
- Existing 3-score summary unchanged (core dimensions still rendered via result.dimensions)
- buildDimensions() processes module_scores data when available
