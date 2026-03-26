import type { GatewayConnectionState, GatewayRuntimeView } from '../api/client'
import type { Translations } from '../i18n/translations'

type HeaderConnectionLabelKey = 'serviceRunning' | 'serviceDegraded' | 'serviceReconnecting' | 'serviceOffline'

type HeaderConnectionState = GatewayConnectionState

const APP_CONNECTION_LABEL: Record<HeaderConnectionState, HeaderConnectionLabelKey> = {
  connected: 'serviceRunning',
  degraded: 'serviceDegraded',
  reconnecting: 'serviceReconnecting',
  disconnected: 'serviceOffline',
}

const APP_CONNECTION_DOT: Record<HeaderConnectionState, string> = {
  connected: 'bg-green-500',
  degraded: 'bg-amber-500',
  reconnecting: 'bg-blue-500',
  disconnected: 'bg-red-500',
}

interface UseAppHeaderViewModelOptions {
  runtimeView: GatewayRuntimeView | null
  backendStatus: boolean
  t: Pick<Translations, HeaderConnectionLabelKey>
  contextUsage: {
    usedK: number
    totalK: number
    percent: number
  }
}

export function useAppHeaderViewModel({ runtimeView, backendStatus, t, contextUsage }: UseAppHeaderViewModelOptions) {
  const headerConnectionState = runtimeView?.connectionState ?? (backendStatus ? 'connected' : 'disconnected')
  const headerDotClass = APP_CONNECTION_DOT[headerConnectionState] ?? APP_CONNECTION_DOT.disconnected
  const headerConnectionLabelKey = APP_CONNECTION_LABEL[headerConnectionState] ?? (backendStatus ? 'serviceRunning' : 'serviceOffline')
  const headerConnectionText = t[headerConnectionLabelKey]

  const contextUsageText = `${contextUsage.usedK.toFixed(1)}k/${contextUsage.totalK}k`
  const contextUsageBarClass =
    contextUsage.percent > 85
      ? 'bg-danger-500'
      : contextUsage.percent > 65
        ? 'bg-warning-500'
        : 'bg-primary-500'
  const contextUsageWidthPercent = Math.min(100, Math.max(0, contextUsage.percent))

  return {
    headerConnectionState,
    headerDotClass,
    headerConnectionText,
    contextUsageText,
    contextUsageBarClass,
    contextUsageWidthPercent,
  }
}
