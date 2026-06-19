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
const loggerLogMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())

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

vi.mock('../utils/logger', () => ({
  logger: {
    log: loggerLogMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
    debug: vi.fn(),
    info: vi.fn(),
  },
}))

import { RevisionOrchestrator, type Suggestion } from './revisionOrchestrator'

function createWorkspace() {
  return {
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
      level: 'L3' as const,
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
  }
}

function queueEvaluationResponses(
  ...responses: Array<
    | {
      score: number
      suggestions?: unknown[]
      success?: true
    }
    | {
      success: false
    }
    | {
      reject: Error
    }
  >
) {
  callAnalysisAgentMock.mockReset()
  for (const response of responses) {
    if ('reject' in response) {
      callAnalysisAgentMock.mockRejectedValueOnce(response.reject)
      continue
    }

    if (response.success === false) {
      callAnalysisAgentMock.mockResolvedValueOnce({
        success: false,
        error: 'evaluation failed',
      })
      continue
    }

    callAnalysisAgentMock.mockResolvedValueOnce({
      success: true,
      data: {
        readability_score: response.score,
        suggestions: response.suggestions ?? [],
      },
    })
  }
}

function createSuggestion(
  title: string,
  reason: string,
  severity: Suggestion['severity'] = 'medium',
): { title: string; reason: string; severity: Suggestion['severity'] } {
  return { title, reason, severity }
}

describe('RevisionOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCheckpointMock.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    restoreCheckpointMock.mockResolvedValue({ success: true, data: { restored: true } })
    processWritingHelperMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'Revised body text' },
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
    queueEvaluationResponses(
      { score: 70, suggestions: [createSuggestion('Increase conflict', 'Raise tension', 'high')] },
      { score: 70, suggestions: [createSuggestion('Increase conflict', 'Raise tension', 'high')] },
      { score: 82, suggestions: [createSuggestion('Increase conflict', 'Raise tension', 'high')] },
    )

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 1,
      workspace: createWorkspace(),
    })

    const result = await orchestrator.run('Original body text')

    expect(result).toMatchObject({
      sessionId: 'cp-1',
      reason: 'max_iterations',
      revisionSession: {
        id: 'revision-session-1',
        state: 'COMPARED',
        comparisonSummary: 'Score improved',
      },
    })
    expect(processWritingHelperMock).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Original body text',
      mode: 'rewrite',
      instruction: expect.stringContaining('Suggestion: Increase conflict'),
    }))
  })

  it('stops immediately when the target score is already reached', async () => {
    queueEvaluationResponses({
      score: 90,
      suggestions: [createSuggestion('Polish style', 'Tighten tone', 'low')],
    })

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 3,
      workspace: createWorkspace(),
    })

    const result = await orchestrator.run('Strong draft')

    expect(result).toMatchObject({
      initialScore: 9,
      finalScore: 9,
      iterations: 1,
      completed: true,
      reason: 'target_reached',
      sessionId: 'cp-1',
    })
    expect(workflowRevisionAnalyzeMock).not.toHaveBeenCalled()
    expect(processWritingHelperMock).not.toHaveBeenCalled()
  })

  it('returns an error result when the initial evaluation cannot be produced', async () => {
    queueEvaluationResponses({ success: false })

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
      workspace: createWorkspace(),
    })

    const result = await orchestrator.run('Broken draft')

    expect(result).toEqual({
      initialContent: 'Broken draft',
      revisedContent: 'Broken draft',
      initialScore: 0,
      finalScore: 0,
      iterations: 0,
      completed: false,
      reason: 'error',
      sessionId: null,
      revisionSession: null,
    })
    expect(loggerErrorMock).toHaveBeenCalled()
  })

  it('falls back to chapter-unknown when no workspace chapter or workflow session is available', async () => {
    queueEvaluationResponses({ success: false })

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 1,
    })

    await orchestrator.run('Untethered draft')

    expect(workflowRevisionStartSessionMock).toHaveBeenCalledWith(
      'chapter-unknown',
      'Untethered draft',
      undefined,
      undefined,
    )
  })

  it('returns no_improvement when the fresh evaluation has no suggestions to act on', async () => {
    queueEvaluationResponses(
      { score: 70, suggestions: [createSuggestion('Improve structure', 'Tighten outline', 'medium')] },
      { score: 70, suggestions: [] },
    )

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
      workspace: createWorkspace(),
    })

    const result = await orchestrator.run('Plateaued draft')

    expect(result).toMatchObject({
      finalScore: 7,
      iterations: 1,
      completed: true,
      reason: 'no_improvement',
      sessionId: 'cp-1',
    })
    expect(processWritingHelperMock).not.toHaveBeenCalled()
  })

  it('returns no_improvement when the revised content evaluates worse than the previous pass', async () => {
    queueEvaluationResponses(
      { score: 70, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
      { score: 70, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
      { score: 65, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
    )
    processWritingHelperMock.mockResolvedValueOnce({
      success: true,
      data: { processed_text: 'Worse revised body text' },
    })

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
      workspace: createWorkspace(),
    })

    const result = await orchestrator.run('Declining draft')

    expect(result).toMatchObject({
      revisedContent: 'Declining draft',
      initialScore: 7,
      finalScore: 7,
      iterations: 1,
      completed: true,
      reason: 'no_improvement',
      sessionId: 'cp-1',
    })
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Revision degraded quality from 7 to 6.5. Restoring checkpoint...',
    )
    expect(restoreCheckpointMock).toHaveBeenCalledWith('cp-1', createWorkspace())
  })

  it('returns no_improvement when revision generation fails and leaves the text unchanged', async () => {
    queueEvaluationResponses(
      { score: 70, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
      { score: 70, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
    )
    processWritingHelperMock.mockRejectedValueOnce(new Error('rewrite failed'))

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
      workspace: createWorkspace(),
    })

    const result = await orchestrator.run('Fragile draft')

    expect(result).toMatchObject({
      revisedContent: 'Fragile draft',
      finalScore: 7,
      iterations: 1,
      completed: true,
      reason: 'no_improvement',
      sessionId: 'cp-1',
    })
    expect(workflowRevisionMarkRevisedMock).not.toHaveBeenCalled()
    expect(loggerErrorMock).toHaveBeenCalled()
  })

  it('falls back to workflow session id and synthesized revision-session copy when startSession is unavailable', async () => {
    queueEvaluationResponses(
      { score: 70, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
      { score: 70, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
      { score: 80, suggestions: [] },
    )
    workflowRevisionStartSessionMock.mockResolvedValueOnce({
      success: false,
      error: 'session service unavailable',
    })

    const workspace = createWorkspace()
    workspace.manuscript.chapterId = null
    workspace.workflow.sessionId = 'workflow-42'

    const orchestrator = new RevisionOrchestrator({
      targetScore: 9.0,
      maxIterations: 1,
      workspace,
    })

    const result = await orchestrator.run('Needs one more pass')

    expect(result).toMatchObject({
      sessionId: 'cp-1',
      reason: 'max_iterations',
      revisionSession: {
        id: null,
        chapterId: 'workflow-42',
        state: 'REVISED',
        iteration: 1,
        comparisonSummary: 'Iteration 1: 8.0 score',
      },
    })
    expect(workflowRevisionAnalyzeMock).not.toHaveBeenCalled()
    expect(workflowRevisionCompareMock).not.toHaveBeenCalled()
  })

  it('returns no_improvement when no actionable suggestion can be selected from a non-empty evaluation', async () => {
    queueEvaluationResponses(
      { score: 70, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
      { score: 70, suggestions: [createSuggestion('Improve pacing', 'Adjust rhythm', 'medium')] },
    )

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
      workspace: createWorkspace(),
    })

    vi.spyOn(orchestrator as any, 'selectNextSuggestion').mockReturnValue(null)

    const result = await orchestrator.run('Selection stalled draft')

    expect(result).toMatchObject({
      revisedContent: 'Selection stalled draft',
      finalScore: 7,
      iterations: 1,
      completed: true,
      reason: 'no_improvement',
      sessionId: 'cp-1',
    })
    expect(processWritingHelperMock).not.toHaveBeenCalled()
  })

  it('falls back to loop iteration and synthesized comparison summary when revision workflow omits them', async () => {
    queueEvaluationResponses(
      { score: 70, suggestions: [createSuggestion('Increase conflict', 'Raise tension', 'high')] },
      { score: 70, suggestions: [createSuggestion('Increase conflict', 'Raise tension', 'high')] },
      { score: 82, suggestions: [createSuggestion('Increase conflict', 'Raise tension', 'high')] },
    )
    workflowRevisionGenerateSuggestionsMock.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'SUGGESTED',
      },
    })
    workflowRevisionCompareMock.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'COMPARED',
        comparison: {},
      },
    })

    const orchestrator = new RevisionOrchestrator({
      targetScore: 9,
      maxIterations: 1,
      workspace: createWorkspace(),
    })

    const result = await orchestrator.run('Needs metadata fallback')

    expect(result).toMatchObject({
      reason: 'max_iterations',
      revisionSession: {
        id: 'revision-session-1',
        chapterId: 'chapter-7',
        state: 'COMPARED',
        iteration: 1,
        comparisonSummary: 'Iteration 1: 8.2 score',
      },
    })
  })

  it('prioritizes higher-severity suggestions and then uses focus ordering as a tie-breaker', () => {
    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
    })

    const selected = (orchestrator as any).selectNextSuggestion([
      { title: 'Sharpen conflict', reason: 'Raise tension', severity: 'high', focus: 'conflict' },
      { title: 'Fix logic', reason: 'Address continuity gaps', severity: 'high', focus: 'logic' },
      { title: 'Polish dialogue', reason: 'Clarify voice', severity: 'medium', focus: 'dialogue' },
    ] satisfies Suggestion[])

    expect(selected).toEqual({
      title: 'Fix logic',
      reason: 'Address continuity gaps',
      severity: 'high',
      focus: 'logic',
    })
  })

  it('returns null for missing suggestions and preserves the first item when severity and focus are both unknown', () => {
    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
    })

    expect((orchestrator as any).selectNextSuggestion(undefined)).toBeNull()
    expect((orchestrator as any).selectNextSuggestion([
      { title: 'First', reason: 'No known keyword', severity: 'weird', focus: 'mystery' },
      { title: 'Second', reason: 'No known keyword', severity: 'odd', focus: 'unknown' },
    ])).toEqual({
      title: 'First',
      reason: 'No known keyword',
      severity: 'weird',
      focus: 'mystery',
    })
  })

  it.each([
    ['logic', 'Continuity issue', 'Logic does not hold together'],
    ['conflict', 'Raise conflict', 'More tension is needed'],
    ['character', 'Character motivation', 'Motivation feels weak'],
    ['pacing', 'Adjust pacing', 'The rhythm drags'],
    ['structure', 'Reshape structure', 'The outline loses focus'],
    ['dialogue', 'Dialogue pass', 'Voice needs more contrast'],
    ['style', 'Style polish', 'Tone is too flat'],
    ['detail', 'Add detail', 'Imagery is too sparse'],
    ['generic', 'General note', 'This needs work'],
  ] as const)('detects %s focus from suggestion copy', (focus, title, reason) => {
    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
    })

    expect((orchestrator as any).detectSuggestionFocus(title, reason)).toBe(focus)
  })

  it('maps raw suggestion payloads to structured suggestions with defensive defaults', () => {
    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
    })

    expect((orchestrator as any).mapToStructuredSuggestions([
      {},
      {
        title: 'Dialogue pass',
        reason: 'Voice needs more contrast',
        severity: 'low',
      },
      {
        title: 'Pacing tune-up',
        reason: 'Rhythm drags',
        severity: 'unknown',
      },
    ])).toEqual([
      {
        title: 'Untitled Suggestion',
        reason: 'No reason provided.',
        severity: 'medium',
        focus: 'generic',
      },
      {
        title: 'Dialogue pass',
        reason: 'Voice needs more contrast',
        severity: 'low',
        focus: 'dialogue',
      },
      {
        title: 'Pacing tune-up',
        reason: 'Rhythm drags',
        severity: 'medium',
        focus: 'pacing',
      },
    ])
  })

  it('treats null suggestion payloads as an empty suggestion list during evaluation', async () => {
    callAnalysisAgentMock.mockResolvedValueOnce({
      success: true,
      data: {
        readability_score: 80,
        suggestions: null,
      },
    })

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
    })

    await expect((orchestrator as any).evaluate('Stable draft')).resolves.toEqual({
      score: 8,
      suggestions: [],
    })
  })

  it('returns null when evaluation throws and preserves original content when revision response lacks processed text', async () => {
    callAnalysisAgentMock.mockRejectedValueOnce(new Error('analysis crashed'))
    processWritingHelperMock.mockResolvedValueOnce({
      success: true,
      data: { processed_text: '' },
    })

    const orchestrator = new RevisionOrchestrator({
      targetScore: 8.5,
      maxIterations: 2,
      workspace: createWorkspace(),
    })

    await expect((orchestrator as any).evaluate('Volatile draft')).resolves.toBeNull()
    await expect((orchestrator as any).revise('Original text', {
      title: 'Clarify logic',
      reason: 'Continuity breaks the scene',
      severity: 'high',
      focus: 'logic',
    })).resolves.toBe('Original text')

    expect(loggerErrorMock).toHaveBeenCalledWith('Revision failed:', undefined)
  })
})
