import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import {
  evaluateContent,
  evaluateWithModules,
  getImprovementSuggestions,
  novelQualityCheck,
  runConsistencyCheck,
  runStandaloneConsistencyCheck,
} from './evaluation'

describe('evaluateContent', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /critic/evaluate with content and dimensions', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'APPROVED',
        total_score: 85,
        lock_score: 80,
        style_score: 90,
        logic_score: 82,
        actionable_feedback: 'Good pacing.',
        suggestions: [],
      },
    })

    const result = await evaluateContent('Chapter text here', { scene_id: 's1' }, ['logic', 'style'])

    expect(callApiMock).toHaveBeenCalledWith(
      '/critic/evaluate',
      'POST',
      {
        content: 'Chapter text here',
        scene_card: { scene_id: 's1' },
        dimensions: ['logic', 'style'],
        quality_goals: undefined,
      },
    )
    expect(result.success).toBe(true)
    expect(result.data?.decision).toBe('APPROVED')
    expect(result.data?.total_score).toBe(85)
  })

  it('calls /critic/evaluate with quality goals', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 65,
        lock_score: 60,
        style_score: 70,
        logic_score: 55,
        actionable_feedback: 'Weak logic flow.',
        suggestions: [],
      },
    })

    const qualityGoals = { coherence: 80, naturalness: 75 }
    const result = await evaluateContent('content', undefined, ['coherence'], qualityGoals)

    expect(callApiMock).toHaveBeenCalledWith(
      '/critic/evaluate',
      'POST',
      {
        content: 'content',
        scene_card: undefined,
        dimensions: ['coherence'],
        quality_goals: { coherence: 80, naturalness: 75 },
      },
    )
    expect(result.data?.decision).toBe('REVISE')
  })

  it('passes through API errors', async () => {
    callApiMock.mockResolvedValue({
      success: false,
      error: 'evaluation service unavailable',
    })

    const result = await evaluateContent('content')
    expect(result.success).toBe(false)
    expect(result.error).toBe('evaluation service unavailable')
  })

  it('works with minimal arguments', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'HUMAN_REVIEW',
        total_score: 70,
        lock_score: 68,
        style_score: 72,
        logic_score: 60,
        actionable_feedback: 'Needs human review.',
        suggestions: [{ id: 'r1', title: 'Check timeline' }],
      },
    })

    const result = await evaluateContent('bare content')
    expect(callApiMock).toHaveBeenCalledWith(
      '/critic/evaluate',
      'POST',
      {
        content: 'bare content',
        scene_card: undefined,
        dimensions: undefined,
        quality_goals: undefined,
      },
    )
    expect(result.data?.suggestions).toHaveLength(1)
  })
})

describe('evaluateWithModules', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /critic/evaluate with module-score enrichment enabled', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'APPROVED',
        total_score: 91,
        lock_score: 90,
        style_score: 92,
        logic_score: 89,
        actionable_feedback: 'Strong revision pass.',
        suggestions: [],
        module_scores: {
          readability: 94,
        },
      },
    })

    const result = await evaluateWithModules(
      'chapter text',
      { scene_id: 'scene-4' },
      ['logic', 'style'],
      { coherence: 90 },
    )

    expect(callApiMock).toHaveBeenCalledWith(
      '/critic/evaluate',
      'POST',
      {
        content: 'chapter text',
        scene_card: { scene_id: 'scene-4' },
        dimensions: ['logic', 'style'],
        quality_goals: { coherence: 90 },
        include_module_scores: true,
      },
    )
    expect(result.data?.module_scores).toEqual({ readability: 94 })
  })
})

describe('novelQualityCheck', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /writing/quality endpoint', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'APPROVED',
        total_score: 88,
        actionable_feedback: 'Good quality.',
      },
    })

    const result = await novelQualityCheck('novel chapter')

    expect(callApiMock).toHaveBeenCalledWith(
      '/writing/quality',
      'POST',
      {
        content: 'novel chapter',
        scene_card: undefined,
        dimensions: undefined,
        quality_goals: undefined,
      },
    )
    expect(result.success).toBe(true)
  })

  it('passes scene card and quality goals to /writing/quality', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { decision: 'REVISE', total_score: 72, actionable_feedback: 'Improve pacing' },
    })

    await novelQualityCheck(
      'text',
      { scene_id: 's2', chapter: 3 },
      ['logic', 'style'],
      { coherence: 85 },
    )

    expect(callApiMock).toHaveBeenCalledWith(
      '/writing/quality',
      'POST',
      {
        content: 'text',
        scene_card: { scene_id: 's2', chapter: 3 },
        dimensions: ['logic', 'style'],
        quality_goals: { coherence: 85 },
      },
    )
  })

  it('returns API error on failure', async () => {
    callApiMock.mockResolvedValue({
      success: false,
      error: 'content is required',
    })

    const result = await novelQualityCheck('')
    expect(result.success).toBe(false)
    expect(result.error).toBe('content is required')
  })
})

describe('runConsistencyCheck', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /critic/consistency with normalized workspace payload', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { runId: 'consistency-run-1' } })

    await runConsistencyCheck(
      ['chapter text'],
      [{ chapterNumber: 9, title: 'Chapter 9' }],
      undefined,
      {
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
          chapterId: 'chapter-9',
          chapterTitle: 'Chapter 9',
          chapterNumber: 9,
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
          sessionId: null,
          planId: null,
          level: 'L3',
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
    )

    expect(callApiMock).toHaveBeenCalledWith(
      '/critic/consistency',
      'POST',
      expect.objectContaining({
        chapters: ['chapter text'],
        chapterMeta: [{ chapterNumber: 9, title: 'Chapter 9' }],
        workspace: expect.objectContaining({
          identity: expect.objectContaining({
            workspaceId: 'atlas-workspace',
            projectId: 'atlas-project',
          }),
        }),
      }),
    )
  })
})

describe('runStandaloneConsistencyCheck', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /consistency/check with optional check types and workspace', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        valid: false,
        issues: ['timeline drift'],
        score: 72,
      },
    })

    const workspace = {
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
        chapterId: 'chapter-2',
        chapterTitle: null,
        chapterNumber: 2,
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
        sessionId: null,
        planId: null,
        level: 'L3',
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
    } as const

    const result = await runStandaloneConsistencyCheck('chapter body', {
      checkTypes: ['timeline', 'worldview'],
      workspace,
    })

    expect(callApiMock).toHaveBeenCalledWith(
      '/consistency/check',
      'POST',
      {
        content: 'chapter body',
        check_types: ['timeline', 'worldview'],
        workspace,
      },
    )
    expect(result.data).toEqual({
      valid: false,
      issues: ['timeline drift'],
      score: 72,
    })
  })

  it('omits optional fields when no standalone-check options are provided', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        valid: true,
        issues: [],
        score: 100,
      },
    })

    await runStandaloneConsistencyCheck('clean chapter')

    expect(callApiMock).toHaveBeenCalledWith(
      '/consistency/check',
      'POST',
      {
        content: 'clean chapter',
        check_types: undefined,
        workspace: undefined,
      },
    )
  })
})

describe('getImprovementSuggestions', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /critic/suggestions with content and issues', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: [
        { issue: 'Weak opening', suggestion: 'Start with action', priority: 'high' },
        { issue: 'Flat dialogue', suggestion: 'Add subtext', priority: 'medium' },
      ],
    })

    const result = await getImprovementSuggestions('chapter text', ['Weak opening', 'Flat dialogue'])

    expect(callApiMock).toHaveBeenCalledWith(
      '/critic/suggestions',
      'POST',
      {
        content: 'chapter text',
        issues: ['Weak opening', 'Flat dialogue'],
        max_suggestions: undefined,
      },
    )
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
  })

  it('passes max_suggestions parameter', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: [{ issue: 'i', suggestion: 's', priority: 'low' }],
    })

    await getImprovementSuggestions('text', undefined, 3)

    expect(callApiMock).toHaveBeenCalledWith(
      '/critic/suggestions',
      'POST',
      {
        content: 'text',
        issues: undefined,
        max_suggestions: 3,
      },
    )
  })

  it('handles empty results', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: [],
    })

    const result = await getImprovementSuggestions('text')
    expect(result.data).toEqual([])
  })

  it('propagates API errors', async () => {
    callApiMock.mockResolvedValue({
      success: false,
      error: 'service unavailable',
    })

    const result = await getImprovementSuggestions('text')
    expect(result.success).toBe(false)
    expect(result.error).toBe('service unavailable')
  })
})
