import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingsStore } from './settingsStore'

describe('settingsStore additional persistence coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    useSettingsStore.getState().resetSettings()
  })

  it('clears pending debounced persistence writes when storage is explicitly cleared', () => {
    vi.useFakeTimers()

    try {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')

      useSettingsStore.getState().updateSettings({ language: 'en' })
      useSettingsStore.persist.clearStorage()

      expect(removeItemSpy).toHaveBeenCalledWith('niko-settings')

      vi.runAllTimers()

      expect(localStorage.getItem('niko-settings')).toBeNull()
      expect(setItemSpy).not.toHaveBeenCalledWith('niko-settings', expect.any(String))
    } finally {
      vi.useRealTimers()
    }
  })
})
