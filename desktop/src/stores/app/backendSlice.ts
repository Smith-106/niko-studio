import { checkBackendHealth } from '@/api/client'

import type { AppSlice } from '../appStore'

export interface BackendSlice {
  backendStatus: boolean
  checkBackend: () => Promise<void>
}

export const createBackendSlice: AppSlice<BackendSlice> = (set) => ({
  backendStatus: false,
  checkBackend: async () => {
    try {
      const healthy = await checkBackendHealth()
      set({ backendStatus: healthy })
    } catch {
      set({ backendStatus: false })
    }
  },
})
