import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import type {
  PlotThread,
  TimelineEvent,
  WorldRule,
} from '../../api/story-bible'
import {
  CompletenessBadge,
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

describe('EntityCards interaction additional coverage', () => {
  it('renders the completeness badge meter and percentage text', () => {
    const { container } = render(<CompletenessBadge score={0.73} />)

    expect(screen.getByText('73%')).toBeInTheDocument()
    expect(container.querySelector('[style="width: 73%;"]')).toBeTruthy()
  })

  it('saves changed world-rule edits and records the edit source field', async () => {
    const callbacks = createCallbacks()
    const entity: WorldRule = {
      id: 'world-edit',
      novelId: 'novel-1',
      name: 'Silent Pact',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.61,
      source: 'hybrid',
      metadata: {},
      type: 'world-rule',
      category: '',
      description: '',
      constraints: ['speak true name'],
      exceptions: ['bloodline loophole'],
      impactScope: '',
      relatedEntities: [],
    }

    render(
      <WorldRuleCard
        entity={entity}
        editingField={{ entityId: 'world-edit', field: 'description', value: '' }}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Silent Pact/ }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Rules bind intent.' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(callbacks.onSaveEdit).toHaveBeenCalledTimes(1)
    })
  })

  it('saves changed plot-thread edits on the non-empty branch', async () => {
    const callbacks = createCallbacks()
    const entity: PlotThread = {
      id: 'plot-edit',
      novelId: 'novel-1',
      name: 'Loose Signal',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.78,
      source: 'manual',
      metadata: {},
      type: 'plot-thread',
      status: 'active',
      premise: '',
      goal: '',
      stakes: 'The capital will fall',
      involvedCharacters: [],
      keyEvents: [],
      foreshadowingRefs: [],
      resolution: '',
    }

    render(
      <PlotThreadCard
        entity={entity}
        editingField={{ entityId: 'plot-edit', field: 'resolution', value: '' }}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Loose Signal/ }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Justice is restored' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(callbacks.onSaveEdit).toHaveBeenCalledTimes(1)
    })
    expect(screen.getAllByText('The capital will fall').length).toBeGreaterThan(0)
  })

  it('saves changed timeline-event edits and shows timestamp metadata', async () => {
    const callbacks = createCallbacks()
    const entity: TimelineEvent = {
      id: 'event-edit',
      novelId: 'novel-1',
      name: 'Ghost Entry',
      createdAt: '2026-06-03T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z',
      completenessScore: 0.88,
      source: 'auto-extract',
      metadata: {},
      type: 'timeline-event',
      eventType: 'resolution',
      timestamp: 'chapter-12',
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
        editingField={{ entityId: 'event-edit', field: 'emotionalImpact', value: '' }}
        {...callbacks}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Ghost Entry/ }))
    expect(screen.getAllByText('chapter-12').length).toBeGreaterThan(0)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'relief' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(callbacks.onSaveEdit).toHaveBeenCalledTimes(1)
    })
  })
})
