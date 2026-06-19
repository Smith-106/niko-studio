import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { useWritingContextStore } from '@/stores/writingContextStore'

import { AiContextSelector } from './AiContextSelector'

function resetWritingContextStore() {
  useWritingContextStore.setState({
    contextNotes: [],
    aiSelectedNoteIds: [],
    recommendationsLoading: false,
    searchQuery: '',
  })
}

describe('AiContextSelector', () => {
  beforeEach(() => {
    localStorage.clear()
    resetWritingContextStore()
    vi.restoreAllMocks()
  })

  it('shows the selected note summary, dispatches context events, and clears selection', () => {
    useWritingContextStore.setState({
      contextNotes: [
        {
          id: 'note-1',
          title: 'Hero',
          source: 'obsidian',
          preview: 'hero profile',
          tags: ['hero'],
          relevanceScore: 0.9,
          tokenCount: 1200,
        },
      ],
      aiSelectedNoteIds: ['note-1'],
    })

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const { container } = render(<AiContextSelector />)

    expect(screen.getByText('已选 1 篇笔记 (1200 tokens)')).toBeInTheDocument()

    const progress = container.querySelector('.bg-blue-500') as HTMLDivElement | null
    expect(progress?.style.width).toBe('30%')

    fireEvent.click(screen.getByRole('button', { name: '应用到 AI 对话' }))

    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent
    expect(event.type).toBe('ai-context-apply')
    expect(event.detail).toEqual({
      noteIds: ['note-1'],
      tokenCount: 1200,
    })

    const clearButton = container.querySelectorAll('button')[0] as HTMLButtonElement
    fireEvent.click(clearButton)

    expect(useWritingContextStore.getState().aiSelectedNoteIds).toEqual([])
    expect(screen.getByRole('button', { name: '应用到 AI 对话' })).toBeDisabled()
  })

  it('uses the warning color when the selected tokens are near the budget', () => {
    useWritingContextStore.setState({
      contextNotes: [
        {
          id: 'note-1',
          title: 'Plot',
          source: 'niko-studio',
          preview: 'plot notes',
          tags: ['plot'],
          relevanceScore: 0.8,
          tokenCount: 3600,
        },
      ],
      aiSelectedNoteIds: ['note-1'],
    })

    const { container } = render(<AiContextSelector />)

    const progress = container.querySelector('.bg-yellow-500') as HTMLDivElement | null
    expect(progress?.style.width).toBe('90%')
    expect(screen.getByRole('button', { name: '应用到 AI 对话' })).toBeEnabled()
  })

  it('shows an over-budget warning and disables apply when the budget is exceeded', () => {
    useWritingContextStore.setState({
      contextNotes: [
        {
          id: 'note-1',
          title: 'Archive',
          source: 'ai-recommendation',
          preview: 'archive notes',
          tags: ['archive'],
          relevanceScore: 0.7,
          tokenCount: 4500,
        },
      ],
      aiSelectedNoteIds: ['note-1'],
    })

    const { container } = render(<AiContextSelector />)

    const progress = container.querySelector('.bg-red-500') as HTMLDivElement | null
    expect(progress?.style.width).toBe('100%')
    expect(screen.getByText('超出 token 预算，请减少选择')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '应用到 AI 对话' })).toBeDisabled()
  })
})
