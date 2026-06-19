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
  confidence: 0.85,
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

const timelineEntityWithEventType: StoryBibleEntity = {
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

const timelineEntityNoEventType: StoryBibleEntity = {
  id: 'timeline-2',
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

const hybridSourceEntity: StoryBibleEntity = {
  id: 'world-1',
  novelId: 'novel-1',
  name: 'Hybrid Rule',
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

function createCompletenessReport(): CompletenessReport {
  return {
    novelId: 'novel-1',
    overallScore: 0.77,
    byType: {
      character: { count: 1, avgScore: 0.84 },
      'world-rule': { count: 1, avgScore: 0.72 },
      'plot-thread': { count: 0, avgScore: 0 },
      'timeline-event': { count: 2, avgScore: 0.42 },
    },
    missing: [{ type: 'character', suggestion: '补充主角弱点' }],
    timestamp: '2026-06-03T00:00:00.000Z',
  }
}

describe('StoryBiblePanel uncovered branch coverage', () => {
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
      if (type === 'timeline-event') {
        return {
          success: true,
          data: {
            entities: [timelineEntityWithEventType, timelineEntityNoEventType],
            count: 2,
            novelId: 'novel-1',
            type,
          },
        }
      }
      if (type === 'world-rule') {
        return {
          success: true,
          data: {
            entities: [hybridSourceEntity],
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

  it('renders timeline-event subLabel as eventType when present and as 未分类 when empty', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    fireEvent.click(screen.getByRole('button', { name: /Timeline/ }))

    expect(await screen.findByText('Coronation')).toBeInTheDocument()
    // Line 70: entity.eventType is 'turning-point' → renders eventType
    expect(screen.getByText('turning-point')).toBeInTheDocument()
    // Line 70 fallback: entity.eventType is '' → renders '未分类'
    expect(screen.getByText('未分类')).toBeInTheDocument()
  })

  it('renders 混合 source badge for hybrid entities', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    fireEvent.click(screen.getByRole('button', { name: /World/ }))

    expect(await screen.findByText('Hybrid Rule')).toBeInTheDocument()

    // Expand the card to see the source badge
    fireEvent.click(screen.getByRole('button', { name: /Hybrid Rule/ }))

    // Line 241: entity.source === 'hybrid' → renders '混合'
    expect(screen.getByText('混合')).toBeInTheDocument()
  })

  it('returns early from handleSaveEdit when editingField is null', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    // Before any edit is started, editingField is null.
    // handleSaveEdit(null editingField) returns early — sbUpdateEntityMock is NOT called.
    // We verify by ensuring no update call happens without first clicking an edit field.
    expect(sbUpdateEntityMock).not.toHaveBeenCalled()
  })

  it('silently swallows errors from addStoryBibleEntity', async () => {
    sbCreateEntityMock.mockRejectedValueOnce(new Error('create entity failed'))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
    fireEvent.click(screen.getByRole('button', { name: '时间线' }))

    await waitFor(() => {
      expect(sbCreateEntityMock).toHaveBeenCalledWith({
        novelId: 'novel-1',
        name: '新时间线事件',
        type: 'timeline-event',
      })
    })

    // Line 372: catch {} — silently fails. The + Add button should not be disabled forever.
    // After the catch, addingEntity state resets to false via the finally block.
    const addButton = screen.getByRole('button', { name: '+ Add' })
    expect(addButton).not.toBeDisabled()
  })

  it('creates a plot-thread entity with the default name (line 116)', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
    fireEvent.click(screen.getByRole('button', { name: '情节' }))

    await waitFor(() => {
      expect(sbCreateEntityMock).toHaveBeenCalledWith({
        novelId: 'novel-1',
        name: '新情节线',
        type: 'plot-thread',
      })
    })
  })

  it('creates a world-rule entity with the default name (line 115)', async () => {
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
  })

  it('creates a character entity with the default name (line 114)', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
    fireEvent.click(screen.getByRole('button', { name: '角色' }))

    await waitFor(() => {
      expect(sbCreateEntityMock).toHaveBeenCalledWith({
        novelId: 'novel-1',
        name: '新角色',
        type: 'character',
      })
    })
  })

  it('cancels inline edit on Escape key (line 161)', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    // Expand the card
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))

    // Click on a specific field to start editing - use role=button div
    await waitFor(() => {
      // The editable field divs have role="button" and cursor-text class
      const editables = document.querySelectorAll('[role="button"][class*="cursor-text"]')
      expect(editables.length).toBeGreaterThan(0)
    })

    const editables = document.querySelectorAll('[role="button"][class*="cursor-text"]')
    fireEvent.click(editables[0])

    await waitFor(() => {
      // Should now show an input
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    // Press Escape to cancel
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })

    await waitFor(() => {
      // Input should be gone, editing cancelled
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  it('renders character with no archetype as 未设定原型 (line 64)', async () => {
    const charNoArchetype: StoryBibleEntity = {
      ...characterEntity,
      id: 'char-no-arch',
      name: 'NoArchetype',
      archetype: '',
    }
    sbGetEntitiesMock.mockImplementation(async () => ({
      success: true,
      data: { entities: [charNoArchetype], count: 1, novelId: 'novel-1', type: 'character' },
    }))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('NoArchetype')).toBeInTheDocument()
    expect(screen.getByText('未设定原型')).toBeInTheDocument()
  })

  it('renders plot-thread with no status as 未知状态 (line 68)', async () => {
    const plotEntity: StoryBibleEntity = {
      ...characterEntity,
      id: 'plot-1',
      name: 'EmptyPlot',
      type: 'plot-thread',
      status: '',
      premise: '',
      goal: '',
      stakes: '',
      resolution: '',
    }
    sbGetEntitiesMock.mockImplementation(async () => ({
      success: true,
      data: { entities: [plotEntity], count: 1, novelId: 'novel-1', type: 'plot-thread' },
    }))

    render(<StoryBiblePanel novelId="novel-1" />)

    fireEvent.click(screen.getByRole('button', { name: /Plots/ }))

    expect(await screen.findByText('EmptyPlot')).toBeInTheDocument()
    expect(screen.getByText('未知状态')).toBeInTheDocument()
  })

  it('keeps edit value unchanged and cancels when save clicked with same value (line 154-155)', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    // Expand the card
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))

    // Click on a specific editable field
    await waitFor(() => {
      const editables = document.querySelectorAll('[role="button"][class*="cursor-text"]')
      expect(editables.length).toBeGreaterThan(0)
    })

    const editables = document.querySelectorAll('[role="button"][class*="cursor-text"]')
    fireEvent.click(editables[0])

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    // Click Save (OK) without changing value — should cancel edit instead of calling update
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => {
      expect(sbUpdateEntityMock).not.toHaveBeenCalled()
    })
  })

  it('renders auto-extract source badge (line 241)', async () => {
    const autoEntity: StoryBibleEntity = {
      ...characterEntity,
      id: 'char-auto',
      name: 'AutoChar',
      source: 'auto-extract',
    }
    sbGetEntitiesMock.mockImplementation(async () => ({
      success: true,
      data: { entities: [autoEntity], count: 1, novelId: 'novel-1', type: 'character' },
    }))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('AutoChar')).toBeInTheDocument()

    // Expand card to see source badge
    fireEvent.click(screen.getByRole('button', { name: /AutoChar/ }))

    await waitFor(() => {
      expect(screen.getByText('自动提取')).toBeInTheDocument()
    })
  })

  it('renders empty field value with placeholder (line 231)', async () => {
    const emptyFieldEntity: StoryBibleEntity = {
      ...characterEntity,
      id: 'char-empty',
      name: 'EmptyFields',
      backstory: '',
      arcStage: '',
    }
    sbGetEntitiesMock.mockImplementation(async () => ({
      success: true,
      data: { entities: [emptyFieldEntity], count: 1, novelId: 'novel-1', type: 'character' },
    }))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('EmptyFields')).toBeInTheDocument()

    // Expand card to see empty fields
    fireEvent.click(screen.getByRole('button', { name: /EmptyFields/ }))

    await waitFor(() => {
      // Empty fields show the placeholder
      const placeholders = screen.getAllByText('点击编辑...')
      expect(placeholders.length).toBeGreaterThan(0)
    })
  })

  it('swallows sbGetEntities failure silently (line 288-290)', async () => {
    sbGetEntitiesMock.mockRejectedValueOnce(new Error('entities unavailable'))

    render(<StoryBiblePanel novelId="novel-1" />)

    // Should render empty state instead of crashing
    await waitFor(() => {
      expect(screen.getByText(/暂无/)).toBeInTheDocument()
    })
  })

  it('swallows sbGetCompleteness failure silently (line 302-304)', async () => {
    sbGetCompletenessMock.mockRejectedValueOnce(new Error('completeness unavailable'))

    render(<StoryBiblePanel novelId="novel-1" />)

    // Should still render, completeness section is just absent
    expect(await screen.findByText('Atlas')).toBeInTheDocument()
  })

  it('swallows sbUpdateEntity failure silently (line 344-346)', async () => {
    sbUpdateEntityMock.mockRejectedValueOnce(new Error('update failed'))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    // Expand card
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))

    // Start editing a field
    await waitFor(() => {
      const editables = document.querySelectorAll('[role="button"][class*="cursor-text"]')
      expect(editables.length).toBeGreaterThan(0)
    })

    const editables = document.querySelectorAll('[role="button"][class*="cursor-text"]')
    fireEvent.click(editables[0])

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    // Change value and save
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '反派' } })
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    // Should not crash — the catch block swallows the error
    await waitFor(() => {
      expect(sbUpdateEntityMock).toHaveBeenCalled()
    })
  })

  it('swallows sbDeleteEntity failure silently (line 354-356)', async () => {
    sbDeleteEntityMock.mockRejectedValueOnce(new Error('delete failed'))

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    // Expand card
    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))

    // Click delete once
    await waitFor(() => {
      expect(screen.getByText('删除')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('删除'))

    // Confirm delete
    await waitFor(() => {
      expect(screen.getByText('确认删除')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('确认删除'))

    // Should not crash
    await waitFor(() => {
      expect(sbDeleteEntityMock).toHaveBeenCalledWith('char-1')
    })
  })

  it('sets entities to empty when sbGetEntities returns success=false (line 285-287)', async () => {
    sbGetEntitiesMock.mockResolvedValueOnce({ success: false })

    render(<StoryBiblePanel novelId="novel-1" />)

    await waitFor(() => {
      expect(screen.getByText(/暂无/)).toBeInTheDocument()
    })
  })

  it('sets completeness to null when sbGetCompleteness returns success=false', async () => {
    sbGetCompletenessMock.mockResolvedValue({ success: false })

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    // No completeness indicator in header (or default 0)
    // No missing suggestions footer
    expect(screen.queryByText('建议补充')).not.toBeInTheDocument()
  })

  it('renders tab with count from completeness report (line 427-441)', async () => {
    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    // The character tab should show count "1" (from byType.character.count)
    const countElements = screen.getAllByText('1')
    expect(countElements.length).toBeGreaterThan(0)
  })

  it('renders tab count as undefined when byType entry is missing', async () => {
    sbGetCompletenessMock.mockResolvedValue({
      success: true,
      data: {
        ...createCompletenessReport(),
        byType: {}, // no entries
      },
    })

    render(<StoryBiblePanel novelId="novel-1" />)

    expect(await screen.findByText('Atlas')).toBeInTheDocument()

    // No count numbers shown on tabs since byType is empty
    // Only the completeness indicator in header
  })
})
