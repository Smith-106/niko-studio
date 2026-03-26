import { useState } from 'react'
import { getGatewayMetrics, listGatewayTools, type GatewayMetrics, type GatewayTools } from '../api/client'

interface UseSettingsDiagnosticsOptions {
  settingsDiagnosticsFetchFailed: string
}

export function useSettingsDiagnostics({ settingsDiagnosticsFetchFailed }: UseSettingsDiagnosticsOptions) {
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)
  const [gatewayMetrics, setGatewayMetrics] = useState<GatewayMetrics | null>(null)
  const [gatewayTools, setGatewayTools] = useState<GatewayTools | null>(null)

  const refreshDiagnostics = async () => {
    setDiagnosticsLoading(true)
    setDiagnosticsError(null)
    try {
      const [metricsRes, toolsRes] = await Promise.all([
        getGatewayMetrics(),
        listGatewayTools(),
      ])

      if (metricsRes.success && metricsRes.data?.metrics) {
        setGatewayMetrics(metricsRes.data.metrics)
      } else {
        setGatewayMetrics(null)
      }

      if (toolsRes.success && toolsRes.data) {
        setGatewayTools(toolsRes.data)
      } else {
        setGatewayTools(null)
      }

      if (!(metricsRes.success && metricsRes.data?.metrics) || !(toolsRes.success && toolsRes.data)) {
        setDiagnosticsError(settingsDiagnosticsFetchFailed)
      }
    } catch {
      setGatewayMetrics(null)
      setGatewayTools(null)
      setDiagnosticsError(settingsDiagnosticsFetchFailed)
    } finally {
      setDiagnosticsLoading(false)
    }
  }

  return {
    diagnosticsLoading,
    diagnosticsError,
    gatewayMetrics,
    gatewayTools,
    refreshDiagnostics,
  }
}
