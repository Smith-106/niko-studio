// 类型真相源：narrative-visualization 7 个类型从 src-ts/ 下沉到 types/ 层（types/ → api/ 层级）。
// api/narrative-visualization.ts 从本文件 re-export，避免 api/ 层直接依赖 src-ts（L-003）。
export type {
  NarrativeVisualizationChapterInput,
  NarrativeVisualizationTimelineEvent,
  NarrativeVisualizationTimelineData,
  NarrativeVisualizationTensionPoint,
  NarrativeVisualizationTensionData,
  NarrativeVisualizationCharacterData,
  NarrativeVisualizationBundle,
} from '../../../src-ts/narrative/types/visualization-types'
