import { beforeEach, describe, expect, it } from 'vitest'

import { useWritingContextStore } from './writingContextStore'

function resetWritingContextStore() {
  useWritingContextStore.setState({
    contextNotes: [],
    aiSelectedNoteIds: [],
    recommendationsLoading: false,
    searchQuery: '',
  })
}

describe('writingContextStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetWritingContextStore()
  })

  it('tracks selected notes and aggregates token count', () => {
    const notes = [
      {
        id: 'note-1',
        title: 'Hero Notes',
        source: 'obsidian' as const,
        preview: 'Hero profile',
        tags: ['hero'],
        relevanceScore: 0.9,
        tokenCount: 120,
      },
      {
        id: 'note-2',
        title: 'Scene Plan',
        source: 'niko-studio' as const,
        preview: 'Chapter beat map',
        tags: ['plot'],
        relevanceScore: 0.7,
        tokenCount: 80,
      },
    ]

    const store = useWritingContextStore.getState()
    store.setContextNotes(notes)
    store.toggleNoteForAi('note-1')
    store.toggleNoteForAi('note-2')

    expect(useWritingContextStore.getState().aiSelectedNoteIds).toEqual(['note-1', 'note-2'])
    expect(useWritingContextStore.getState().getSelectedTokenCount()).toBe(200)

    useWritingContextStore.getState().toggleNoteForAi('note-1')
    expect(useWritingContextStore.getState().aiSelectedNoteIds).toEqual(['note-2'])
    expect(useWritingContextStore.getState().getSelectedTokenCount()).toBe(80)

    useWritingContextStore.getState().clearAiSelection()
    expect(useWritingContextStore.getState().aiSelectedNoteIds).toEqual([])
  })

  it('stores search and loading state independently from notes', () => {
    useWritingContextStore.getState().setSearchQuery('memory')
    useWritingContextStore.getState().setRecommendationsLoading(true)

    expect(useWritingContextStore.getState()).toMatchObject({
      searchQuery: 'memory',
      recommendationsLoading: true,
    })
  })

  it('persists only aiSelectedNoteIds and rehydrates them', async () => {
    useWritingContextStore.getState().setContextNotes([
      {
        id: 'note-1',
        title: 'Hero Notes',
        source: 'obsidian',
        preview: 'Hero profile',
        tags: ['hero'],
        relevanceScore: 0.9,
        tokenCount: 120,
      },
    ])
    useWritingContextStore.getState().toggleNoteForAi('note-1')
    useWritingContextStore.getState().setSearchQuery('draft-only')
    useWritingContextStore.getState().setRecommendationsLoading(true)

    const persistedRaw = localStorage.getItem('niko-writing-context')
    expect(persistedRaw).toBeTruthy()

    const persisted = JSON.parse(persistedRaw!) as {
      state: Record<string, unknown>
    }
    expect(persisted.state).toEqual({
      aiSelectedNoteIds: ['note-1'],
    })

    resetWritingContextStore()
    localStorage.setItem(
      'niko-writing-context',
      JSON.stringify({
        state: {
          aiSelectedNoteIds: ['note-2'],
        },
        version: 0,
      }),
    )
    await useWritingContextStore.persist.rehydrate()

    expect(useWritingContextStore.getState()).toMatchObject({
      contextNotes: [],
      aiSelectedNoteIds: ['note-2'],
      recommendationsLoading: false,
      searchQuery: '',
    })
  })
})
