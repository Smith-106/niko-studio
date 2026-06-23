# TASK-001 Summary: types/narrative-visualization.ts 真相源 + api/ re-export

**Status**: ✅ Completed
**Convergence**: 3/3 criteria passed

## Files Changed

1. **Created**: `desktop/src/types/narrative-visualization.ts` — 7 个类型从 `src-ts/narrative/types/visualization-types` re-export（NarrativeVisualizationChapterInput, TimelineEvent, TimelineData, TensionPoint, TensionData, CharacterData, Bundle）
2. **Modified**: `desktop/src/api/narrative-visualization.ts` — L3-6 import + L8-16 export type from 改为 `../types/narrative-visualization`（消除 api 层直接 src-ts import）

## Convergence Evidence

- `types/narrative-visualization.ts` 含 7 个 export type 语句 ✓ (7 matches)
- `grep 'from.*src-ts' api/narrative-visualization.ts` 返回 0 行 ✓
- `grep "from '../types/narrative-visualization'" api/narrative-visualization.ts` 返回 2 行（import + export type） ✓

## Deviations

None.
