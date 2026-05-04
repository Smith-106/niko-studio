import type { AppSlice } from './appStore'

export interface WordMetrics {
  wordCount: number
  charCount: number
  readingTime: number
}

export interface UiSlice {
  focusMode: boolean
  wordMetrics: WordMetrics
  toggleFocusMode: () => void
  setFocusMode: (value: boolean) => void
  updateWordMetrics: (metrics: Partial<WordMetrics>) => void
}

export const createUiSlice: AppSlice<UiSlice> = (set) => ({
  focusMode: false,
  wordMetrics: { wordCount: 0, charCount: 0, readingTime: 0 },
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setFocusMode: (value) => set({ focusMode: value }),
  updateWordMetrics: (metrics) =>
    set((state) => ({
      wordMetrics: { ...state.wordMetrics, ...metrics },
    })),
})
