import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../stores/settingsStore'

export function useAppBackendBootstrap() {
  useEffect(() => {
    if (!('__TAURI__' in window)) {
      return
    }

    const settings = useSettingsStore.getState().settings

    void invoke('set_gateway_base_override', {
      base: settings.apiBaseUrl && settings.apiBaseUrl.trim() ? settings.apiBaseUrl.trim() : null,
    })

    void invoke('start_backend')
  }, [])
}
