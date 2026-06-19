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
  confidence: 0.9,
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
  traits: [],
  motivations: ['save family'],
  backstory: 'Raised in exile',
  relationships: [],
  speechPatterns: ['short sentences'],
  arcStage: 'setup',
  povAffinity: 0.7,
}

const emptyPlotThreadEntity: StoryBibleEntity = {
  id: 'plot-empty',
  novelId: 'novel-1',
  name: 'Loose Signal',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.41,
  source: 'auto-extract',
  metadata: {},
  type: 'plot-thread',
  status: '',
  premise: '',
  goal: '',
  stakes: '',
  involvedCharacters: [],
  keyEvents: [],
  foreshadowingRefs: [],
  resolution: '',
}

const emptyTimelineEntity: StoryBibleEntity = {
  id: 'timeline-empty',
  novelId: 'novel-1',
  name: 'Ghost Entry',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.27,
  source: 'manual',
  metadata: {},
  type: 'timeline-event',
  eventType: '',
  timestamp: '',
  chapterRef: '',
  description: '',
  participants: [],
  consequences: [],
  plotThreadRefs: [],
  emotionalImpact: '',
}

function createCompletenessReport(): CompletenessReport {
  return {
    novelId: 'novel-1',
    overallScore: 0.77,
    byType: {
      character: { count: 1, avgScore: 0.84 },
      'world-rule': { count: 0, avgScore: 0 },
      'plot-thread': { count: 1, avgScore: 0.41 },
      'timeline-event': { count: 1, avgScore: 0.27 },
    },
    missing: [{ type: 'character', suggestion: '补充主角弱点' }],
    timestamp: '2026-06-03T00:00:00.000Z',
  }
}

describe('StoryBiblePanel additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sbCreateEntityMock.mockResolvedValue({ success: true, data: null })
    sbUpdateEntityMock.mockResolvedValue({ success: true, data: null })
    sbDeleteEntityMock.mockResolvedValue({ success: true, data: null })
    sbGetCompletenessMock.mockResolvedValue({
      success: true,
      data: createCompletenessReport(),
    })
    sbGetEntitiesMock.mockImplementation(async (_novelId: string, type: SbEntityType = 'character') => {
      if (type === 'plot-thread') {
        return {
          success: true,
          data: {
            entities: [emptyPlotThreadEntity],
            count: 1,
            novelId: 'novel-1',
            type,
          },
        }
      }
      if (type === 'timeline-event') {
        return {
          success: true,
          data: {
            entities: [emptyTimelineEntity],
            count: 1,
            novelId: 'novel-1',
            type,
          },
        }
      }
      return {
        success: true,
        data: {
          entities: [characterEntity],
          count: 1,
          novelId: 'novel-1',
          type,
        },
      }
    })
  })

  it('renders plot and timeline fallback labels when completeness loading fails', async () => {
    sbGetCompletenessMock.mockRejectedValueOnce(new Error('supplementary failed'))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()
    expect(screen.queryByText('建议补充')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Plots/ }))
    expect(await screen.findByText('Loose Signal')).toBeInTheDocument()
    expect(screen.getByText('未知状态')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Timeline/ }))
    expect(await screen.findByText('Ghost Entry')).toBeInTheDocument()
    expect(screen.getByText('未分类')).toBeInTheDocument()
  })

  it('shows empty state when entity loading returns an unsuccessful payload', async () => {
    sbGetEntitiesMock.mockResolvedValueOnce({
      success: false,
      data: null,
    })

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('暂无角色实体')).toBeInTheDocument()
    expect(screen.getByText('点击 Auto-Extract 或 + Add 创建')).toBeInTheDocument()
  })

  it('shows empty state when entity loading throws for the active tab', async () => {
    sbGetEntitiesMock.mockImplementation(async (_novelId: string, type: SbEntityType = 'character') => {
      if (type === 'plot-thread') {
        throw new Error('tab load failed')
      }
      return {
        success: true,
        data: {
          entities: [characterEntity],
          count: 1,
          novelId: 'novel-1',
          type,
        },
      }
    })

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Plots/ }))

    expect(await screen.findByText('暂无情节实体')).toBeInTheDocument()
  })

  it('saves scalar edits, keeps editing open on failure, and dismisses unchanged edits', async () => {
    sbUpdateEntityMock.mockRejectedValueOnce(new Error('update failed'))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Plots/ }))
    expect(await screen.findByText('Loose Signal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Loose Signal/ }))
    fireEvent.click(
      screen.getByText('结局').parentElement?.querySelector('[role="button"]') as HTMLElement,
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Restored ending' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(sbUpdateEntityMock).toHaveBeenCalledWith('plot-empty', {
        resolution: 'Restored ending',
      })
    })
    expect(screen.getByDisplayValue('Restored ending')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Timeline/ }))
    expect(await screen.findByText('Ghost Entry')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ghost Entry/ }))
    fireEvent.click(
      screen.getByText('情感影响').parentElement?.querySelector('[role="button"]') as HTMLElement,
    )
    const unchangedInput = screen.getByRole('textbox')
    fireEvent.keyDown(unchangedInput, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  it('keeps the list stable when deleting an entity fails', async () => {
    sbDeleteEntityMock.mockRejectedValueOnce(new Error('delete failed'))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(sbDeleteEntityMock).toHaveBeenCalledWith('char-1')
    })
    expect(screen.getByText('Atlas')).toBeInTheDocument()
  })
})
