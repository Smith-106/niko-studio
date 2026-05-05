import type { AppSlice } from './appStore'

export interface WordMetrics {
  wordCount: number
  charCount: number
  readingTime: number
}

export interface UiSlice {
  focusMode: boolean
  wordMetrics: WordMetrics
  sidebarExpanded: boolean
  historyPanelOpen: boolean
  toggleFocusMode: () => void
  setFocusMode: (value: boolean) => void
  updateWordMetrics: (metrics: Partial<WordMetrics>) => void
  toggleSidebar: () => void
  setSidebarExpanded: (value: boolean) => void
  toggleHistoryPanel: () => void
  setHistoryPanelOpen: (value: boolean) => void
}

export const createUiSlice: AppSlice<UiSlice> = (set) => ({
  focusMode: false,
  wordMetrics: { wordCount: 0, charCount: 0, readingTime: 0 },
  sidebarExpanded: false,
  historyPanelOpen: false,
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setFocusMode: (value) => set({ focusMode: value }),
  updateWordMetrics: (metrics) =>
    set((state) => ({
      wordMetrics: { ...state.wordMetrics, ...metrics },
    })),
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  setSidebarExpanded: (value) => set({ sidebarExpanded: value }),
  toggleHistoryPanel: () => set((state) => ({ historyPanelOpen: !state.historyPanelOpen })),
  setHistoryPanelOpen: (value) => set({ historyPanelOpen: value }),
})
