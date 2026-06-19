import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { useWritingContextStore } from '@/stores/writingContextStore'

import { WritingContextPanel } from './WritingContextPanel'

function resetWritingContextStore() {
  useWritingContextStore.setState({
    contextNotes: [],
    aiSelectedNoteIds: [],
    recommendationsLoading: false,
    searchQuery: '',
  })
}

describe('WritingContextPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    resetWritingContextStore()
  })

  it('renders loading and empty states', () => {
    useWritingContextStore.setState({ recommendationsLoading: true })
    const { rerender } = render(<WritingContextPanel />)

    expect(screen.getByText('加载推荐笔记...')).toBeInTheDocument()

    act(() => {
      useWritingContextStore.setState({ recommendationsLoading: false, contextNotes: [] })
    })
    rerender(<WritingContextPanel />)

    expect(screen.getByText('暂无相关笔记')).toBeInTheDocument()
    expect(screen.getByText('连接 Obsidian Vault 后将自动推荐')).toBeInTheDocument()
  })

  it('filters notes, updates the query, toggles selections, and shows the AI selector', () => {
    useWritingContextStore.setState({
      contextNotes: [
        {
          id: 'note-1',
          title: 'Hero Codex',
          source: 'obsidian',
          preview: 'hero profile',
          tags: ['character', 'hero'],
          relevanceScore: 0.9,
          tokenCount: 120,
        },
        {
          id: 'note-2',
          title: 'Conflict Ladder',
          source: 'ai-recommendation',
          preview: 'conflict plan',
          tags: ['plot'],
          relevanceScore: 0.7,
          tokenCount: 340,
        },
        {
          id: 'note-3',
          title: 'Scene Blueprint',
          source: 'niko-studio',
          preview: 'scene draft',
          tags: ['structure'],
          relevanceScore: 0.6,
          tokenCount: 220,
        },
      ],
    })

    render(<WritingContextPanel />)

    expect(screen.getByText('Hero Codex')).toBeInTheDocument()
    expect(screen.getByText('Conflict Ladder')).toBeInTheDocument()
    expect(screen.getByText('Scene Blueprint')).toBeInTheDocument()
    expect(screen.getByText('Obsidian')).toBeInTheDocument()
    expect(screen.getByText('AI 推荐')).toBeInTheDocument()
    expect(screen.getByText('Niko')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('搜索相关笔记...') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'plot' } })

    expect(useWritingContextStore.getState().searchQuery).toBe('plot')
    expect(screen.queryByText('Hero Codex')).not.toBeInTheDocument()
    expect(screen.getByText('Conflict Ladder')).toBeInTheDocument()
    expect(screen.queryByText('Scene Blueprint')).not.toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'hero' } })
    fireEvent.click(screen.getByText('Hero Codex'))

    expect(useWritingContextStore.getState().aiSelectedNoteIds).toEqual(['note-1'])
    expect(screen.getByRole('button', { name: '应用到 AI 对话' })).toBeInTheDocument()
  })
})
