import { beforeEach, describe, expect, it, vi } from 'vitest'

const createCheckpointMock = vi.hoisted(() => vi.fn())
const restoreCheckpointMock = vi.hoisted(() => vi.fn())
const callAnalysisAgentMock = vi.hoisted(() => vi.fn())
const processWritingHelperMock = vi.hoisted(() => vi.fn())
const workflowRevisionStartSessionMock = vi.hoisted(() => vi.fn())
const workflowRevisionAnalyzeMock = vi.hoisted(() => vi.fn())
const workflowRevisionGenerateSuggestionsMock = vi.hoisted(() => vi.fn())
const workflowRevisionMarkRevisedMock = vi.hoisted(() => vi.fn())
const workflowRevisionCompareMock = vi.hoisted(() => vi.fn())

vi.mock('../api/workflow/checkpoints', () => ({
  createCheckpoint: createCheckpointMock,
  restoreCheckpoint: restoreCheckpointMock,
}))

vi.mock('../api/intelligence', () => ({
  callAnalysisAgent: callAnalysisAgentMock,
}))

vi.mock('../api/client', () => ({
  processWritingHelper: processWritingHelperMock,
}))

vi.mock('../api/workflow/revision', () => ({
  workflowRevisionStartSession: workflowRevisionStartSessionMock,
  workflowRevisionAnalyze: workflowRevisionAnalyzeMock,
  workflowRevisionGenerateSuggestions: workflowRevisionGenerateSuggestionsMock,
  workflowRevisionMarkRevised: workflowRevisionMarkRevisedMock,
  workflowRevisionCompare: workflowRevisionCompareMock,
}))

import { RevisionOrchestrator } from './revisionOrchestrator'

describe('RevisionOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCheckpointMock.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    restoreCheckpointMock.mockResolvedValue({ success: true, data: { restored: true } })
    callAnalysisAgentMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          readability_score: 70,
          suggestions: [{ title: '增加冲突', reason: '提升张力', severity: 'high' }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          readability_score: 70,
          suggestions: [{ title: '增加冲突', reason: '提升张力', severity: 'high' }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          readability_score: 82,
          suggestions: [{ title: '增加冲突', reason: '提升张力', severity: 'high' }],
        },
      })
    processWritingHelperMock.mockResolvedValue({
      success: true,
      data: { processed_text: '改写后的正文' },
    })
    workflowRevisionStartSessionMock.mockResolvedValue({
      success: true,
      data: {
        session_id: 'revision-session-1',
        status: 'IDLE',
      },
    })
    workflowRevisionAnalyzeMock.mockResolvedValue({
      success: true,
      data: {
        status: 'ANALYZED',
        iteration_number: 1,
      },
    })
    workflowRevisionGenerateSuggestionsMock.mockResolvedValue({
      success: true,
      data: {
        status: 'SUGGESTED',
        iteration_number: 1,
      },
    })
    workflowRevisionMarkRevisedMock.mockResolvedValue({
      success: true,
      data: {
        status: 'REVISED',
      },
    })
    workflowRevisionCompareMock.mockResolvedValue({
      success: true,
      data: {
        status: 'COMPARED',
        iteration_number: 1,
        comparison: { summary: 'Score improved' },
      },
    })
  })

  it('returns revision session metadata alongside the legacy loop result', async () => {
    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 1,
      workspace: {
        schemaVersion: '2026-04-08',
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'Atlas',
          workspaceRoot: '/tmp/atlas',
        },
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: 'chapter-7',
          chapterTitle: null,
          chapterNumber: 7,
        },
        storyBible: {
          storyBibleId: null,
          draftId: null,
          version: null,
          storage: 'workspace',
        },
        knowledge: {
          focusEntityId: null,
          graphEntityIds: [],
          memoryEntryIds: [],
        },
        authority: {
          recordSetId: null,
          activeSceneId: null,
          activeEventId: null,
          activeTimelineId: null,
          consistencyRunId: null,
        },
        workflow: {
          level: 'L3',
          planId: '',
          sessionId: null,
        },
        chat: {
          conversationId: null,
          comparisonEnabled: null,
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: [],
          notes: [],
        },
      },
    })

    const result = await orchestrator.run('原始正文')

    expect(result.sessionId).toBe('cp-1')
    expect(result.revisionSession?.id).toBe('revision-session-1')
    expect(result.revisionSession?.state).toBe('COMPARED')
    expect(result.revisionSession?.comparisonSummary).toBe('Score improved')
  })
})
