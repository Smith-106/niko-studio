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
  PlotThreadCard,
  TimelineEventCard,
  WorldRuleCard,
} from './EntityCards'

function createCallbacks() {
  return {
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onDelete: vi.fn(),
  }
}

const characterEntity: CharacterProfile = {
  id: 'char-tail',
  novelId: 'novel-1',
  name: 'Atlas Tail',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
  completenessScore: 0.86,
  source: 'auto-extract',
  metadata: {},
  type: 'character',
  archetype: 'hero',
  traits: [{ trait: 'stubborn', intensity: 0.8, evidence: 'chapter 1' }],
  motivations: ['save family', 'find truth'],
  backstory: 'Raised in exile',
  relationships: [{ targetId: 'mentor-1', type: 'mentor', description: 'Raised him' }],
  speechPatterns: ['short sentences'],
  arcStage: 'setup',
  povAffinity: 0.75,
}

const worldRuleEntity: WorldRule = {
  id: 'world-tail',
  novelId: 'novel-1',
  name: 'Magic Oath Tail',
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
  id: 'plot-tail',
  novelId: 'novel-1',
  name: 'Secret Revolt Tail',
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
  id: 'timeline-tail',
  novelId: 'novel-1',
  name: 'Coronation Tail',
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

describe('EntityCards tail coverage', () => {
  it('starts character editing from the keyboard path', () => {
    const callbacks = createCallbacks()
    render(
      <CharacterCard
        entity={characterEntity}
        editingField={null}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Atlas Tail/ }))

    const backstoryField = screen.getByText('Raised in exile').closest('[role="button"]')
    expect(backstoryField).toBeTruthy()

    fireEvent.keyDown(backstoryField as HTMLElement, { key: 'Enter' })

    expect(callbacks.onStartEdit).toHaveBeenCalledWith(
      'char-tail',
      'backstory',
      'Raised in exile',
    )
  })

  it('starts world-rule editing and confirms deletion', () => {
    const callbacks = createCallbacks()
    render(
      <WorldRuleCard
        entity={worldRuleEntity}
        editingField={null}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Magic Oath Tail/ }))
    fireEvent.click(screen.getByText('kingdom-wide'))

    expect(callbacks.onStartEdit).toHaveBeenCalledWith(
      'world-tail',
      'impactScope',
      'kingdom-wide',
    )

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    expect(callbacks.onDelete).toHaveBeenCalledWith('world-tail')
  })

  it('starts plot-thread editing and confirms deletion', () => {
    const callbacks = createCallbacks()
    render(
      <PlotThreadCard
        entity={plotThreadEntity}
        editingField={null}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Secret Revolt Tail/ }))
    fireEvent.click(screen.getByText('Keep the crown stable'))

    expect(callbacks.onStartEdit).toHaveBeenCalledWith(
      'plot-tail',
      'goal',
      'Keep the crown stable',
    )

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    expect(callbacks.onDelete).toHaveBeenCalledWith('plot-tail')
  })

  it('starts timeline-event editing and confirms deletion', () => {
    const callbacks = createCallbacks()
    render(
      <TimelineEventCard
        entity={timelineEventEntity}
        editingField={null}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Coronation Tail/ }))
    fireEvent.click(screen.getByText('The heir claims the crown.'))

    expect(callbacks.onStartEdit).toHaveBeenCalledWith(
      'timeline-tail',
      'description',
      'The heir claims the crown.',
    )

    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    expect(callbacks.onDelete).toHaveBeenCalledWith('timeline-tail')
  })

  it('routes character entities through the dispatcher branch', () => {
    const callbacks = createCallbacks()
    render(
      <EntityCardDispatcher
        entity={characterEntity as StoryBibleEntity}
        editingField={null}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Atlas Tail/ }))

    expect(screen.getByText('mentor: Raised him')).toBeInTheDocument()
  })

  it('renders sparse optional fields and extra status or event branches', () => {
    const sparseCharacter = {
      ...characterEntity,
      id: 'char-sparse',
      name: 'Sparse Atlas',
      motivations: undefined,
      speechPatterns: undefined,
      traits: undefined,
      relationships: undefined,
    } as unknown as CharacterProfile

    const sparseWorld = {
      ...worldRuleEntity,
      id: 'world-sparse',
      name: 'Sparse Oath',
      category: '',
      constraints: undefined,
      exceptions: undefined,
    } as unknown as WorldRule

    const resolvedPlot = {
      ...plotThreadEntity,
      id: 'plot-resolved',
      name: 'Resolved Plot',
      status: 'resolved',
    } as PlotThread

    const abandonedPlot = {
      ...plotThreadEntity,
      id: 'plot-abandoned',
      name: 'Abandoned Plot',
      status: 'abandoned',
    } as PlotThread

    const emptyStatusPlot = {
      ...plotThreadEntity,
      id: 'plot-empty-status',
      name: 'Empty Status Plot',
      status: '',
    } as PlotThread

    const conflictEvent = {
      ...timelineEventEntity,
      id: 'event-conflict',
      name: 'Conflict Event',
      eventType: 'conflict',
    } as TimelineEvent

    const revelationEvent = {
      ...timelineEventEntity,
      id: 'event-revelation',
      name: 'Revelation Event',
      eventType: 'revelation',
    } as TimelineEvent

    const climaxEvent = {
      ...timelineEventEntity,
      id: 'event-climax',
      name: 'Climax Event',
      eventType: 'climax',
    } as TimelineEvent

    const emptyEventType = {
      ...timelineEventEntity,
      id: 'event-empty-type',
      name: 'Empty Type Event',
      eventType: '',
      timestamp: '',
    } as TimelineEvent

    const callbacks = createCallbacks()
    const { rerender } = render(
      <CharacterCard
        entity={sparseCharacter}
        editingField={null}
        {...callbacks}
      />,
    )

    expect(screen.getByText('Sparse Atlas')).toBeInTheDocument()

    rerender(
      <WorldRuleCard
        entity={sparseWorld}
        editingField={null}
        {...callbacks}
      />,
    )
    expect(screen.getByText('Sparse Oath')).toBeInTheDocument()

    rerender(
      <PlotThreadCard
        entity={resolvedPlot}
        editingField={null}
        {...callbacks}
      />,
    )
    expect(screen.getAllByText('resolved').length).toBeGreaterThan(0)

    rerender(
      <PlotThreadCard
        entity={abandonedPlot}
        editingField={null}
        {...callbacks}
      />,
    )
    expect(screen.getAllByText('abandoned').length).toBeGreaterThan(0)

    rerender(
      <PlotThreadCard
        entity={emptyStatusPlot}
        editingField={null}
        {...callbacks}
      />,
    )
    expect(screen.getByRole('button', { name: /Empty Status Plot/ })).toBeInTheDocument()

    rerender(
      <TimelineEventCard
        entity={conflictEvent}
        editingField={null}
        {...callbacks}
      />,
    )
    expect(screen.getAllByText('conflict').length).toBeGreaterThan(0)

    rerender(
      <TimelineEventCard
        entity={revelationEvent}
        editingField={null}
        {...callbacks}
      />,
    )
    expect(screen.getAllByText('revelation').length).toBeGreaterThan(0)

    rerender(
      <TimelineEventCard
        entity={climaxEvent}
        editingField={null}
        {...callbacks}
      />,
    )
    expect(screen.getAllByText('climax').length).toBeGreaterThan(0)

    rerender(
      <TimelineEventCard
        entity={emptyEventType}
        editingField={null}
        {...callbacks}
      />,
    )
    expect(screen.getByRole('button', { name: /Empty Type Event/ })).toBeInTheDocument()
  })
})
