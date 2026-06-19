import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import type {
  CharacterProfile,
  PlotThread,
  StoryBibleEntity,
  TimelineEvent,
  WorldRule,
} from '../../api/story-bible'
import {
  CharacterCard,
  EntityCardDispatcher,
  completenessColor,
  completenessTextColor,
  joinFromArray,
  splitToArray,
} from './EntityCards'

const characterEntity: CharacterProfile = {
  id: 'char-1',
  novelId: 'novel-1',
  name: 'Atlas',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.86,
  source: 'auto-extract',
  metadata: {},
  type: 'character',
  archetype: '英雄',
  traits: [{ trait: 'stubborn', intensity: 0.8, evidence: 'chapter 1' }],
  motivations: ['save family', 'find truth'],
  backstory: 'Raised in exile',
  relationships: [{ targetId: 'mentor-1', type: 'mentor', description: 'Raised him' }],
  speechPatterns: ['short sentences'],
  arcStage: 'setup',
  povAffinity: 0.75,
}

const worldRuleEntity: WorldRule = {
  id: 'world-1',
  novelId: 'novel-1',
  name: 'Magic Oath',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.62,
  source: 'hybrid',
  metadata: {},
  type: 'world-rule',
  category: 'magic',
  description: 'Intent shapes the oath.',
  constraints: ['must speak true name'],
  exceptions: ['bloodline loophole'],
  impactScope: 'kingdom-wide',
  relatedEntities: [],
}

const plotThreadEntity: PlotThread = {
  id: 'plot-1',
  novelId: 'novel-1',
  name: 'Secret Revolt',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.41,
  source: 'manual',
  metadata: {},
  type: 'plot-thread',
  status: 'planned',
  premise: 'The nobles are restless.',
  goal: 'Keep the crown stable',
  stakes: 'The kingdom collapses',
  involvedCharacters: [],
  keyEvents: [],
  foreshadowingRefs: [],
  resolution: null,
}

const timelineEventEntity: TimelineEvent = {
  id: 'timeline-1',
  novelId: 'novel-1',
  name: 'Coronation',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.53,
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

function createCallbacks() {
  return {
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onDelete: vi.fn(),
  }
}

describe('EntityCards helpers', () => {
  it('converts arrays and color thresholds consistently', () => {
    expect(splitToArray(' one, two ,, three ')).toEqual(['one', 'two', 'three'])
    expect(joinFromArray(['one', 'two'])).toBe('one, two')
    expect(completenessColor(0.85)).toBe('bg-green-500')
    expect(completenessColor(0.45)).toBe('bg-yellow-500')
    expect(completenessColor(0.1)).toBe('bg-red-500')
    expect(completenessTextColor(0.85)).toBe('text-green-400')
    expect(completenessTextColor(0.65)).toBe('text-blue-400')
    expect(completenessTextColor(0.45)).toBe('text-yellow-400')
    expect(completenessTextColor(0.1)).toBe('text-red-400')
  })
})

describe('CharacterCard', () => {
  it('expands, edits, and requires confirmation before deleting', () => {
    const callbacks = createCallbacks()
    const { rerender } = render(
      <CharacterCard
        entity={characterEntity}
        editingField={null}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))

    expect(screen.getByText('1 特质')).toBeInTheDocument()
    expect(screen.getByText('关系 (1)')).toBeInTheDocument()
    expect(screen.getByText('mentor: Raised him')).toBeInTheDocument()
    expect(screen.getByText('自动提取')).toBeInTheDocument()

    fireEvent.click(screen.getByText('save family, find truth'))
    expect(callbacks.onStartEdit).toHaveBeenCalledWith(
      'char-1',
      'motivations',
      'save family, find truth',
    )

    rerender(
      <CharacterCard
        entity={characterEntity}
        editingField={{
          entityId: 'char-1',
          field: 'motivations',
          value: 'save family, find truth',
        }}
        {...callbacks}
      />,
    )

    const input = screen.getByDisplayValue('save family, find truth')
    fireEvent.change(input, { target: { value: 'save family, seek justice' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(callbacks.onSaveEdit).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.getByRole('button', { name: '确认删除' })).toBeInTheDocument()
    expect(callbacks.onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(callbacks.onDelete).toHaveBeenCalledWith('char-1')
  })

  it('cancels inline editing when escape is pressed', () => {
    const callbacks = createCallbacks()
    render(
      <CharacterCard
        entity={characterEntity}
        editingField={{
          entityId: 'char-1',
          field: 'backstory',
          value: 'Raised in exile',
        }}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Atlas/ }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(callbacks.onCancelEdit).toHaveBeenCalledTimes(1)
  })
})

describe('EntityCardDispatcher', () => {
  it('routes world, plot, and timeline entities to the correct specialized cards', () => {
    const callbacks = createCallbacks()
    const { rerender } = render(
      <EntityCardDispatcher entity={worldRuleEntity as StoryBibleEntity} editingField={null} {...callbacks} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Magic Oath/ }))
    expect(screen.getByText('约束 (1)')).toBeInTheDocument()
    expect(screen.getAllByText('must speak true name')).toHaveLength(2)
    expect(screen.getByText('例外 (1)')).toBeInTheDocument()
    expect(screen.getAllByText('bloodline loophole')).toHaveLength(2)
    expect(screen.getByText('混合')).toBeInTheDocument()

    rerender(
      <EntityCardDispatcher entity={plotThreadEntity as StoryBibleEntity} editingField={null} {...callbacks} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Secret Revolt/ }))
    expect(screen.getAllByText('planned')).toHaveLength(2)
    expect(screen.getAllByText('赌注')).toHaveLength(2)
    expect(screen.getAllByText('The kingdom collapses')).toHaveLength(2)
    expect(screen.getByText('手动')).toBeInTheDocument()

    rerender(
      <EntityCardDispatcher entity={timelineEventEntity as StoryBibleEntity} editingField={null} {...callbacks} />,
    )

    expect(screen.getByText('chapter-12')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Coronation/ }))
    expect(screen.getAllByText('情感影响')).toHaveLength(2)
    expect(screen.getAllByText('shock')).toHaveLength(2)
  })
})
