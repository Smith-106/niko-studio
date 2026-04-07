import { useEffect } from 'react'

import { isTauriRuntime, startTauriBackend, syncGatewayBaseOverride } from '../api/transport'
import { useSettingsStore } from '../stores/settingsStore'

export function useAppBackendBootstrap() {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return
    }

    const settings = useSettingsStore.getState().settings

    void syncGatewayBaseOverride(
      settings.apiBaseUrl && settings.apiBaseUrl.trim() ? settings.apiBaseUrl.trim() : null,
    )

    void startTauriBackend()
  }, [])
}
