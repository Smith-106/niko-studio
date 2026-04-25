import type { AppSlice } from '../appStore'

export interface LoadingSlice {
  loadingMap: Record<string, boolean>
  startLoading: (id: string) => void
  finishLoading: (id: string) => void
  isLoading: (id: string) => boolean
}

export const createLoadingSlice: AppSlice<LoadingSlice> = (set, get) => ({
  loadingMap: {},
  startLoading: (id) => {
    set((state) => ({ loadingMap: { ...state.loadingMap, [id]: true } }))
  },
  finishLoading: (id) => {
    set((state) => ({ loadingMap: { ...state.loadingMap, [id]: false } }))
  },
  isLoading: (id) => get().loadingMap[id] ?? false,
})
