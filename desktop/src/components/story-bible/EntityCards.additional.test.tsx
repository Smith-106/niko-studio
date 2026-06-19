import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import type {
  CharacterProfile,
  PlotThread,
  TimelineEvent,
  WorldRule,
} from '../../api/story-bible'
import {
  CharacterCard,
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

describe('EntityCards additional coverage', () => {
  it('cancels unchanged character edits and renders fallback badges', () => {
    const callbacks = createCallbacks()
    const entity: CharacterProfile = {
      id: 'char-empty',
      novelId: 'novel-1',
      name: 'Quiet Witness',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.12,
      source: 'manual',
      metadata: {},
      type: 'character',
      archetype: '',
      traits: [],
      motivations: [],
      backstory: '',
      relationships: [],
      speechPatterns: [],
      arcStage: '',
      povAffinity: 0,
    }

    render(
      <CharacterCard
        entity={entity}
        editingField={{ entityId: 'char-empty', field: 'backstory', value: '' }}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Quiet Witness/ }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(screen.getByText('12%')).toBeInTheDocument()
    expect(callbacks.onCancelEdit).toHaveBeenCalledTimes(1)
    expect(callbacks.onSaveEdit).not.toHaveBeenCalled()
  })

  it('cancels unchanged world-rule edits and tolerates empty optional arrays', () => {
    const callbacks = createCallbacks()
    const entity: WorldRule = {
      id: 'world-empty',
      novelId: 'novel-1',
      name: 'Silent Pact',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.21,
      source: 'manual',
      metadata: {},
      type: 'world-rule',
      category: '',
      description: '',
      constraints: [],
      exceptions: [],
      impactScope: '',
      relatedEntities: [],
    }

    render(
      <WorldRuleCard
        entity={entity}
        editingField={{ entityId: 'world-empty', field: 'description', value: '' }}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Silent Pact/ }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(screen.getByText('21%')).toBeInTheDocument()
    expect(callbacks.onCancelEdit).toHaveBeenCalledTimes(1)
    expect(callbacks.onSaveEdit).not.toHaveBeenCalled()
  })

  it('cancels unchanged plot-thread edits on the default status branch', () => {
    const callbacks = createCallbacks()
    const entity: PlotThread = {
      id: 'plot-empty',
      novelId: 'novel-1',
      name: 'Loose Signal',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.28,
      source: 'manual',
      metadata: {},
      type: 'plot-thread',
      status: 'unknown',
      premise: '',
      goal: '',
      stakes: '',
      involvedCharacters: [],
      keyEvents: [],
      foreshadowingRefs: [],
      resolution: '',
    }

    render(
      <PlotThreadCard
        entity={entity}
        editingField={{ entityId: 'plot-empty', field: 'resolution', value: '' }}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Loose Signal/ }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(screen.getByText('28%')).toBeInTheDocument()
    expect(callbacks.onCancelEdit).toHaveBeenCalledTimes(1)
    expect(callbacks.onSaveEdit).not.toHaveBeenCalled()
  })

  it('cancels unchanged timeline-event edits on the default event-type branch', () => {
    const callbacks = createCallbacks()
    const entity: TimelineEvent = {
      id: 'event-empty',
      novelId: 'novel-1',
      name: 'Ghost Entry',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.09,
      source: 'manual',
      metadata: {},
      type: 'timeline-event',
      eventType: 'memory',
      timestamp: '',
      chapterRef: '',
      description: '',
      participants: [],
      consequences: [],
      plotThreadRefs: [],
      emotionalImpact: '',
    }

    render(
      <TimelineEventCard
        entity={entity}
        editingField={{ entityId: 'event-empty', field: 'emotionalImpact', value: '' }}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Ghost Entry/ }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(screen.getByText('9%')).toBeInTheDocument()
    expect(callbacks.onCancelEdit).toHaveBeenCalledTimes(1)
    expect(callbacks.onSaveEdit).not.toHaveBeenCalled()
  })
})
