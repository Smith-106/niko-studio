import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface ContextNote {
  id: string
  title: string
  source: 'obsidian' | 'niko-studio' | 'ai-recommendation'
  preview: string
  tags: string[]
  relevanceScore: number
  tokenCount: number
}

interface WritingContextStore {
  contextNotes: ContextNote[]
  aiSelectedNoteIds: string[]
  recommendationsLoading: boolean
  searchQuery: string

  setContextNotes: (notes: ContextNote[]) => void
  toggleNoteForAi: (noteId: string) => void
  setSearchQuery: (query: string) => void
  setRecommendationsLoading: (loading: boolean) => void
  getSelectedTokenCount: () => number
  clearAiSelection: () => void
}

export const useWritingContextStore = create<WritingContextStore>()(
  persist(
    (set, get) => ({
      contextNotes: [],
      aiSelectedNoteIds: [],
      recommendationsLoading: false,
      searchQuery: '',

      setContextNotes: (notes) => set({ contextNotes: notes }),
      toggleNoteForAi: (noteId) =>
        set((state) => ({
          aiSelectedNoteIds: state.aiSelectedNoteIds.includes(noteId)
            ? state.aiSelectedNoteIds.filter((id) => id !== noteId)
            : [...state.aiSelectedNoteIds, noteId],
        })),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setRecommendationsLoading: (loading) => set({ recommendationsLoading: loading }),
      getSelectedTokenCount: () => {
        const { contextNotes, aiSelectedNoteIds } = get()
        return contextNotes
          .filter((n) => aiSelectedNoteIds.includes(n.id))
          .reduce((sum, n) => sum + n.tokenCount, 0)
      },
      clearAiSelection: () => set({ aiSelectedNoteIds: [] }),
    }),
    {
      name: 'niko-writing-context',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        aiSelectedNoteIds: state.aiSelectedNoteIds,
      }),
    },
  ),
)
