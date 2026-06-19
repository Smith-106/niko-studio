import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import type {
  CompletenessReport,
  ExtractionResult,
  SbEntityType,
  StoryBibleEntity,
} from '../../api/story-bible'

const sbGetEntitiesMock = vi.hoisted(() => vi.fn())
const sbCreateEntityMock = vi.hoisted(() => vi.fn())
const sbUpdateEntityMock = vi.hoisted(() => vi.fn())
const sbDeleteEntityMock = vi.hoisted(() => vi.fn())
const sbGetCompletenessMock = vi.hoisted(() => vi.fn())

const mockExtractionResult = vi.hoisted<ExtractionResult>(() => ({
  novelId: 'novel-1',
  extracted: [],
  conflicts: [],
  confidence: 0.92,
  warnings: [],
  timestamp: '2026-06-03T00:00:00.000Z',
}))

vi.mock('../../api/story-bible', () => ({
  sbGetEntities: sbGetEntitiesMock,
  sbCreateEntity: sbCreateEntityMock,
  sbUpdateEntity: sbUpdateEntityMock,
  sbDeleteEntity: sbDeleteEntityMock,
  sbGetCompleteness: sbGetCompletenessMock,
}))

vi.mock('./AutoExtractButton', () => ({
  AutoExtractButton: ({
    onExtractionComplete,
  }: {
    novelId: string
    onExtractionComplete: (result: ExtractionResult) => void | Promise<void>
  }) => (
    <button
      type="button"
      onClick={() => {
        void onExtractionComplete(mockExtractionResult)
      }}
    >
      Mock Auto-Extract
    </button>
  ),
}))

import { StoryBiblePanel } from './StoryBiblePanel'

const characterEntity: StoryBibleEntity = {
  id: 'char-1',
  novelId: 'novel-1',
  name: 'Atlas',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.84,
  source: 'manual',
  metadata: {},
  type: 'character',
  archetype: '英雄',
  traits: [{ trait: 'stubborn', intensity: 0.8, evidence: 'chapter 1' }],
  motivations: ['save family', 'find truth'],
  backstory: 'Raised in exile',
  relationships: [],
  speechPatterns: ['short sentences'],
  arcStage: 'setup',
  povAffinity: 0.7,
}

const worldRuleEntity: StoryBibleEntity = {
  id: 'world-1',
  novelId: 'novel-1',
  name: 'Magic Oath',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.72,
  source: 'hybrid',
  metadata: {},
  type: 'world-rule',
  category: 'magic',
  description: 'Oaths bind power to intent.',
  constraints: ['must speak true name'],
  exceptions: ['bloodline loophole'],
  impactScope: 'kingdom-wide',
  relatedEntities: [],
}

const plotThreadEntity: StoryBibleEntity = {
  id: 'plot-1',
  novelId: 'novel-1',
  name: 'Secret Revolt',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.65,
  source: 'auto-extract',
  metadata: {},
  type: 'plot-thread',
  status: 'active',
  premise: 'The court is fracturing.',
  goal: 'Expose the traitor',
  stakes: 'The capital will fall',
  involvedCharacters: [],
  keyEvents: [],
  foreshadowingRefs: [],
  resolution: null,
}

const timelineEntity: StoryBibleEntity = {
  id: 'timeline-1',
  novelId: 'novel-1',
  name: 'Coronation',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.58,
  source: 'manual',
  metadata: {},
  type: 'timeline-event',
  eventType: 'turning-point',
  timestamp: 'chapter-12',
  chapterRef: '12',
  description: 'The heir claims the crown.',
  participants: [],
  consequences: [],
  plotThreadRefs: [],
  emotionalImpact: 'shock',
}

const entitiesByType: Record<SbEntityType, StoryBibleEntity[]> = {
  character: [characterEntity],
  'world-rule': [worldRuleEntity],
  'plot-thread': [plotThreadEntity],
  'timeline-event': [timelineEntity],
}

function createCompletenessReport(): CompletenessReport {
  return {
    novelId: 'novel-1',
    overallScore: 0.77,
    byType: {
      character: { count: entitiesByType.character.length, avgScore: 0.84 },
      'world-rule': { count: entitiesByType['world-rule'].length, avgScore: 0.72 },
      'plot-thread': { count: entitiesByType['plot-thread'].length, avgScore: 0.65 },
      'timeline-event': { count: entitiesByType['timeline-event'].length, avgScore: 0.58 },
    },
    missing: [
      { type: 'character', suggestion: '补充主角弱点' },
      { type: 'world-rule', suggestion: '定义规则代价' },
      { type: 'plot-thread', suggestion: '补充伏笔回收' },
      { type: 'timeline-event', suggestion: '明确时间锚点' },
    ],
    timestamp: '2026-06-03T00:00:00.000Z',
  }
}

describe('StoryBiblePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    sbGetEntitiesMock.mockImplementation(async (_novelId: string, type: SbEntityType = 'character') => ({
      success: true,
      data: {
        entities: entitiesByType[type],
        count: entitiesByType[type].length,
        novelId: 'novel-1',
        type,
      },
    }))
    sbCreateEntityMock.mockResolvedValue({
      success: true,
      data: { entity: worldRuleEntity },
    })
    sbUpdateEntityMock.mockResolvedValue({
      success: true,
      data: { entity: characterEntity },
    })
    sbDeleteEntityMock.mockResolvedValue({
      success: true,
      data: { status: 'deleted', entityId: 'char-1' },
    })
    sbGetCompletenessMock.mockResolvedValue({
      success: true,
      data: createCompletenessReport(),
    })
  })

  it('loads entities, switches tabs, and refreshes after auto extract completes', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()
    expect(screen.getByText('建议补充')).toBeInTheDocument()
    expect(screen.getByText('[角色] 补充主角弱点')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /World/ }))

    expect(await screen.findByText('Magic Oath')).toBeInTheDocument()
    expect(sbGetEntitiesMock).toHaveBeenCalledWith('novel-1', 'world-rule')

    const entityCallsBeforeRefresh = sbGetEntitiesMock.mock.calls.length
    const completenessCallsBeforeRefresh = sbGetCompletenessMock.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'Mock Auto-Extract' }))

    await waitFor(() => {
      expect(sbGetEntitiesMock.mock.calls.length).toBeGreaterThan(entityCallsBeforeRefresh)
      expect(sbGetCompletenessMock.mock.calls.length).toBeGreaterThan(completenessCallsBeforeRefresh)
    })

    expect(sbGetEntitiesMock).toHaveBeenLastCalledWith('novel-1', 'world-rule')
  })

  it('creates a new entity from the add menu and switches to the matching tab', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
    fireEvent.click(screen.getByRole('button', { name: '世界观' }))

    await waitFor(() => {
      expect(sbCreateEntityMock).toHaveBeenCalledWith({
        novelId: 'novel-1',
        name: '新世界规则',
        type: 'world-rule',
      })
    })

    expect(await screen.findByText('Magic Oath')).toBeInTheDocument()
    expect(sbGetEntitiesMock).toHaveBeenCalledWith('novel-1', 'world-rule')
  })

  it('saves edited array fields using the latest input value', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))
    fireEvent.click(screen.getByText('save family, find truth'))

    const input = screen.getByDisplayValue('save family, find truth')
    fireEvent.change(input, {
      target: { value: 'save family, seek justice,  ' },
    })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(sbUpdateEntityMock).toHaveBeenCalledWith('char-1', {
        motivations: ['save family', 'seek justice'],
      })
    })
  })

  it('requires a second click before deleting an entity', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    expect(screen.getByRole('button', { name: '确认删除' })).toBeInTheDocument()
    expect(sbDeleteEntityMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(sbDeleteEntityMock).toHaveBeenCalledWith('char-1')
    })
  })
})
