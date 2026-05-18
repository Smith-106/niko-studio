import { type ApiResponse, callApi } from './core'
import { appendWorkspacePayload, type ProjectWorkspaceContext } from './workspace'

export interface NarrativeVisualizationChapterInput {
  content: string
  chapterIndex: number
  chapterNumber?: number
  title?: string
}

export interface NarrativeVisualizationTimelineEvent {
  id: string
  label: string
  chapterIndex: number
  chapterNumber: number
  type: 'turning_point' | 'conflict' | 'warning'
  severity: 'critical' | 'major' | 'minor' | 'info'
  description: string
}

export interface NarrativeVisualizationTimelineData {
  chapters: Array<{
    chapterId: string
    chapterIndex: number
    chapterNumber: number
    title: string
    label: string
    arcPosition: number
    tension: number
    eventCount: number
  }>
  events: NarrativeVisualizationTimelineEvent[]
  summary: string
  empty: boolean
}

export interface NarrativeVisualizationTensionPoint {
  chapterId: string
  chapterIndex: number
  chapterNumber: number
  title: string
  tension: number
  engagement: number
  dominantEmotion: string
  label: string
}

export interface NarrativeVisualizationTensionData {
  points: NarrativeVisualizationTensionPoint[]
  deserts: Array<{
    startChapter: number
    endChapter: number
    length: number
    severity: 'low' | 'medium' | 'high'
  }>
  overallArcScore: number
  summary: string
  empty: boolean
}

export interface NarrativeVisualizationCharacterData {
  nodes: Array<{
    id: string
    name: string
    role: string
    importance: number
    chapterCount: number
  }>
  edges: Array<{
    source: string
    target: string
    type: string
    weight: number
    label: string
  }>
  summary: string
  empty: boolean
}

export interface NarrativeVisualizationBundle {
  timeline: NarrativeVisualizationTimelineData
  tension: NarrativeVisualizationTensionData
  characterGraph: NarrativeVisualizationCharacterData
  meta: {
    chapterCount: number
    generatedAt: string
    hasData: boolean
    source: 'existing-analysis'
  }
}

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
