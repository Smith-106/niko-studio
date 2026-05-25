import { type ApiResponse, callApi } from './core'
import { appendWorkspacePayload, type ProjectWorkspaceContext } from './workspace'
import type {
  NarrativeVisualizationChapterInput,
  NarrativeVisualizationBundle,
} from '../../../src-ts/narrative/types/visualization-types'

export type {
  NarrativeVisualizationChapterInput,
  NarrativeVisualizationTimelineEvent,
  NarrativeVisualizationTimelineData,
  NarrativeVisualizationTensionPoint,
  NarrativeVisualizationTensionData,
  NarrativeVisualizationCharacterData,
  NarrativeVisualizationBundle,
} from '../../../src-ts/narrative/types/visualization-types'

export async function getNarrativeVisualization(
  payload: {
    chapters: NarrativeVisualizationChapterInput[]
    chapterMeta?: Array<{ chapterNumber?: number; title?: string }>
    relationshipRoot?: string
    workspace?: ProjectWorkspaceContext
  },
): Promise<ApiResponse<{ success: boolean; data: NarrativeVisualizationBundle }>> {
  return callApi(
    '/analysis/narrative-visualization',
    'POST',
    appendWorkspacePayload(
      {
        chapters: payload.chapters,
        chapterMeta: payload.chapterMeta,
        relationshipRoot: payload.relationshipRoot,
      },
      payload.workspace,
    ),
  )
}
