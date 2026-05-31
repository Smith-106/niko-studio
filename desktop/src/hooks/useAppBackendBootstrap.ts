import { useEffect } from 'react'

import { getRuntimeGatewayBase, isTauriRuntime, startTauriBackend, syncGatewayBaseOverride } from '../api/transport'
import { useSettingsStore } from '../stores/settingsStore'

const STALE_LOCAL_GATEWAY_BASE = 'http://127.0.0.1:8000'

function normalizeConfiguredBase(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function shouldRepairPersistedGatewayBase(configuredBase: string | null, resolvedBase: string): boolean {
  return configuredBase === STALE_LOCAL_GATEWAY_BASE
    && resolvedBase.startsWith('http://127.0.0.1:')
    && resolvedBase !== configuredBase
}

export function useAppBackendBootstrap() {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return
    }

    const { settings, updateSettings } = useSettingsStore.getState()
    const configuredBase = normalizeConfiguredBase(settings.apiBaseUrl)

    void (async () => {
      try {
        await syncGatewayBaseOverride(configuredBase)
        await startTauriBackend()

        const resolvedBase = await getRuntimeGatewayBase(() => configuredBase ?? STALE_LOCAL_GATEWAY_BASE)
        if (shouldRepairPersistedGatewayBase(configuredBase, resolvedBase)) {
          updateSettings({ apiBaseUrl: resolvedBase })
        }
      } catch (e) {
        console.error('[useAppBackendBootstrap] Backend bootstrap failed:', e)
      }
    })()
  }, [])
}
