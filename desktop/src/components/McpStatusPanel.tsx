import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, RefreshCw, Server, Wrench } from 'lucide-react'
import {
  checkBackendHealth,
  createGatewayServiceConfig,
  GatewayHealth,
  GatewayMetrics,
  GatewayServiceConfig,
  GatewayTools,
  getGatewayHealth,
  getGatewayMetrics,
  listGatewayServiceConfigs,
  listGatewayTools,
  mergeGatewayHealthState,
  probeGatewayServiceHealth,
  setGatewayServiceEnabled,
  updateGatewayServiceConfig,
} from '../api/client'

import { useI18n } from '../i18n'
import { buildRuntimeDiagnosticSummary } from '../utils/failurePresentation'

interface McpStatusPanelProps {
  onClose: () => void
}

const KEY_SERVICES = ['memory', 'graph', 'search', 'workflow', 'critic', 'agent', 'skills']

const CONNECTION_STATE_COLOR: Record<string, string> = {
  connected: 'text-success-600 dark:text-success-500',
  degraded: 'text-warning-600 dark:text-warning-500',
  disconnected: 'text-danger-600 dark:text-danger-500',
  reconnecting: 'text-primary-600 dark:text-primary-500',
}

export function McpStatusPanel({ onClose }: McpStatusPanelProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backendHealthy, setBackendHealthy] = useState(false)
  const [gatewayHealth, setGatewayHealth] = useState<GatewayHealth | null>(null)
  const [metrics, setMetrics] = useState<GatewayMetrics | null>(null)
  const [tools, setTools] = useState<GatewayTools | null>(null)
  const [services, setServices] = useState<Record<string, string> | null>(null)
  const [serviceConfigs, setServiceConfigs] = useState<GatewayServiceConfig[]>([])
  const [serviceActionError, setServiceActionError] = useState<string | null>(null)
  const [serviceActionLoading, setServiceActionLoading] = useState<string | null>(null)
  const [newServiceId, setNewServiceId] = useState('')
  const [newServiceName, setNewServiceName] = useState('')
  const [newServicePath, setNewServicePath] = useState('')
  const [serviceDraftNames, setServiceDraftNames] = useState<Record<string, string>>({})

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [healthResult, gatewayHealthResult, metricsResult, toolsResult, serviceConfigsResult] = await Promise.allSettled([
        checkBackendHealth(),
        getGatewayHealth(),
        getGatewayMetrics(),
        listGatewayTools(),
        listGatewayServiceConfigs(),
      ])

      let hasError = false

      if (healthResult.status === 'fulfilled') {
        setBackendHealthy(healthResult.value)
      } else {
        setBackendHealthy(false)
        hasError = true
      }

      if (gatewayHealthResult.status === 'fulfilled') {
        if (gatewayHealthResult.value.success && gatewayHealthResult.value.data?.services) {
          setGatewayHealth(gatewayHealthResult.value.data)
          setServices(gatewayHealthResult.value.data.services)
        } else {
          const degradedGatewayHealth: GatewayHealth = {
            status: gatewayHealthResult.value.errorData?.status ?? 'degraded',
            version: 'unavailable',
            services: {},
            diagnostic: gatewayHealthResult.value.errorData?.diagnostic ?? gatewayHealthResult.value.errorData?.mcp_runtime?.diagnostic ?? null,
            mcp_runtime: gatewayHealthResult.value.errorData?.mcp_runtime,
          }
          setGatewayHealth(degradedGatewayHealth)
          setServices(degradedGatewayHealth.services)
          hasError = true
        }
      } else {
        setGatewayHealth(null)
        setServices(null)
        hasError = true
      }

      if (metricsResult.status === 'fulfilled' && metricsResult.value.success && metricsResult.value.data?.metrics) {
        setMetrics(metricsResult.value.data.metrics)
      } else {
        setMetrics(null)
      }

      if (toolsResult.status === 'fulfilled' && toolsResult.value.success && toolsResult.value.data) {
        setTools(toolsResult.value.data)
      } else {
        setTools(null)
      }

      if (serviceConfigsResult.status === 'fulfilled' && serviceConfigsResult.value.success && serviceConfigsResult.value.data?.services) {
        setServiceConfigs(serviceConfigsResult.value.data.services)
      } else {
        setServiceConfigs([])
      }

      if (hasError) {
        setError(t.mcpFetchPartialError)
      }
    } catch {
      setBackendHealthy(false)
      setGatewayHealth(null)
      setMetrics(null)
      setTools(null)
      setServices(null)
      setError(t.mcpFetchFailed)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const serviceToolCounts = useMemo(() => {
    if (!tools) return []
    return Object.entries(tools).map(([service, serviceTools]) => ({
      service,
      count: serviceTools.length,
    }))
  }, [tools])

  const totalTools = useMemo(
    () => serviceToolCounts.reduce((sum, item) => sum + item.count, 0),
    [serviceToolCounts]
  )

  const runtimeView = useMemo(
    () => mergeGatewayHealthState(
      backendHealthy,
      gatewayHealth
        ? { success: true, data: gatewayHealth }
        : { success: false, error: t.mcpFetchFailed },
    ),
    [backendHealthy, gatewayHealth, t.mcpFetchFailed]
  )

  const runtimeDiagnostic = useMemo(
    () => buildRuntimeDiagnosticSummary(
      {
        message: runtimeView.lastError,
        diagnostics: runtimeView.diagnostic,
      },
      t,
    ),
    [runtimeView.diagnostic, runtimeView.lastError, t]
  )

  const serviceStatusLabel: Record<string, string> = {
    ok: t.mcpStatusOk,
    error: t.mcpStatusError,
    disabled: t.mcpStatusDisabled,
    unknown: t.mcpStatusUnknown,
  }

  const connectionStateLabelMap: Record<string, string> = {
    connected: t.mcpConnectionConnected,
    degraded: t.mcpConnectionDegraded,
    disconnected: t.mcpConnectionDisconnected,
    reconnecting: t.mcpConnectionReconnecting,
  }

  const reconnectStateLabelMap: Record<string, string> = {
    idle: t.mcpReconnectIdle,
    probing: t.mcpReconnectProbing,
    backoff: t.mcpReconnectBackoff,
    retrying: t.mcpReconnectRetrying,
    recovered: t.mcpReconnectRecovered,
    failed: t.mcpReconnectFailed,
  }

  const connectionStateLabel = connectionStateLabelMap[runtimeView.connectionState] ?? runtimeView.connectionState
  const reconnectStateLabel = reconnectStateLabelMap[runtimeView.reconnectState] ?? runtimeView.reconnectState
  const connectionStateColor = CONNECTION_STATE_COLOR[runtimeView.connectionState] ?? 'text-gray-600'

  const handleServiceProbe = useCallback(async (serviceId: string) => {
    setServiceActionError(null)
    setServiceActionLoading(`probe:${serviceId}`)

    const result = await probeGatewayServiceHealth(serviceId)
    if (!result.success) {
      setServiceActionError(result.error ?? t.mcpProbeFailed)
      setServiceActionLoading(null)
      return
    }

    await refreshStatus()
    setServiceActionLoading(null)
  }, [refreshStatus])

  const handleServiceToggle = useCallback(async (service: GatewayServiceConfig) => {
    setServiceActionError(null)
    setServiceActionLoading(`toggle:${service.id}`)

    const result = await setGatewayServiceEnabled(service.id, !service.enabled)
    if (!result.success) {
      setServiceActionError(result.error ?? t.mcpUpdateFailed)
      setServiceActionLoading(null)
      return
    }

    await refreshStatus()
    setServiceActionLoading(null)
  }, [refreshStatus])

  const handleServiceRename = useCallback(async (service: GatewayServiceConfig) => {
    const draftName = (serviceDraftNames[service.id] ?? service.name).trim()
    if (!draftName || draftName === service.name) {
      return
    }

    setServiceActionError(null)
    setServiceActionLoading(`rename:${service.id}`)

    const result = await updateGatewayServiceConfig(service.id, { name: draftName, enabled: service.enabled })
    if (!result.success) {
      setServiceActionError(result.error ?? t.mcpUpdateFailed)
      setServiceActionLoading(null)
      return
    }

    await refreshStatus()
    setServiceDraftNames((prev) => ({ ...prev, [service.id]: draftName }))
    setServiceActionLoading(null)
  }, [refreshStatus, serviceDraftNames])

  const handleCreateService = useCallback(async () => {
    const serviceId = newServiceId.trim().toLowerCase()
    const serviceName = newServiceName.trim() || serviceId
    const servicePath = newServicePath.trim() || `/${serviceId}`

    if (!serviceId) {
      setServiceActionError(t.mcpServiceIdRequired)
      return
    }

    setServiceActionError(null)
    setServiceActionLoading('create')

    const result = await createGatewayServiceConfig({
      id: serviceId,
      name: serviceName,
      path: servicePath,
      enabled: true,
    })

    if (!result.success) {
      setServiceActionError(result.error ?? t.mcpCreateFailed)
      setServiceActionLoading(null)
      return
    }

    setNewServiceId('')
    setNewServiceName('')
    setNewServicePath('')
    await refreshStatus()
    setServiceActionLoading(null)
  }, [newServiceId, newServiceName, newServicePath, refreshStatus])

  const serviceConfigRows = useMemo(
    () => serviceConfigs.map((service) => ({
      ...service,
      draftName: serviceDraftNames[service.id] ?? service.name,
      statusLabel: serviceStatusLabel[service.status ?? 'unknown'] ?? service.status ?? 'unknown',
    })),
    [serviceConfigs, serviceDraftNames]
  )

  const serviceStatus = useMemo(
    () =>
      KEY_SERVICES.map((service) => {
        const status = services?.[service] ?? 'unknown'
        const online = backendHealthy && status === 'ok'
        return {
          service,
          online,
          statusLabel: serviceStatusLabel[status] ?? status,
        }
      }),
    [backendHealthy, services]
  )

  return (
    <div
      className="fixed right-0 top-14 bottom-0 w-96 bg-slate-50 dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col z-30 transform transition-transform"
      role="dialog"
      aria-modal="true"
      aria-label={t.mcpPanelAriaLabel}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-primary-600" />
          <span className="font-semibold text-gray-800 dark:text-dark-text tracking-wide text-sm">{t.mcpPanelTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStatus}
            disabled={loading}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg text-xs px-3 py-1.5 font-medium bg-white dark:bg-dark-bg hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border rounded-md disabled:opacity-50 text-gray-700 dark:text-dark-text flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-primary-500' : ''} />
            {loading ? t.mcpRefreshing : t.mcpRefresh}
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-md p-1 hover:bg-gray-200 dark:hover:bg-dark-surface2 transition-colors"
            aria-label={t.mcpCloseAria}
            aria-keyshortcuts="Escape"
            title={`${t.mcpCloseAria} (Esc)`}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar bg-white dark:bg-dark-bg">
        {error && (
          <div role="alert" aria-live="polite" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-warning-50 border border-warning-200 text-warning-700 dark:bg-warning-900/20 dark:border-warning-500/20 dark:text-warning-400 text-xs font-medium shadow-sm animate-fade-in">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {serviceActionError && (
          <div role="alert" aria-live="assertive" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-danger-200 text-danger-600 dark:bg-danger-900/20 dark:border-danger-500/20 dark:text-danger-400 text-xs font-medium shadow-sm animate-fade-in">
            <AlertCircle size={16} className="shrink-0" />
            <span>{serviceActionError}</span>
          </div>
        )}

        <section className="border border-gray-200 dark:border-dark-border rounded-xl p-4 bg-slate-50 dark:bg-dark-surface shadow-sm">
          <h3 className="text-[13px] font-semibold text-gray-700 dark:text-dark-text mb-3 uppercase tracking-wider">{t.mcpGatewayStatus}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-dark-border/60">
              <span className="text-xs font-medium text-gray-500 dark:text-dark-text-secondary">{t.mcpGatewayHealth}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-white dark:bg-dark-bg shadow-sm border border-gray-100 dark:border-dark-border/50 ${connectionStateColor}`}>
                {connectionStateLabel}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-dark-border/60">
              <span className="text-xs font-medium text-gray-500 dark:text-dark-text-secondary">{t.mcpSessionId}</span>
              <span className="text-[11px] font-mono text-gray-600 dark:text-dark-text bg-gray-100 dark:bg-dark-bg px-2 py-0.5 rounded truncate max-w-[200px]" title={runtimeView.sessionId ?? t.mcpNotAvailable}>
                {runtimeView.sessionId ?? t.mcpNotAvailable}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-dark-text-secondary">{t.mcpReconnect}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-dark-text">
                {reconnectStateLabel} <span className="text-gray-400 mx-1">·</span> <span className="text-primary-500">#{runtimeView.reconnectAttempts}</span>
              </span>
            </div>
            {runtimeDiagnostic && (
              <div className={`text-[11px] break-all p-2 rounded-md border mt-2 ${runtimeDiagnostic.tone === 'danger' ? 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/10 border-danger-100 dark:border-danger-500/20' : 'text-warning-700 dark:text-warning-300 bg-warning-50 dark:bg-warning-900/10 border-warning-100 dark:border-warning-500/20'}`}>
                <div className="font-semibold">{runtimeDiagnostic.title}</div>
                {runtimeDiagnostic.detail && (
                  <div className="mt-1">
                    <span className="font-semibold">{t.mcpLastErrorPrefix}</span> {runtimeDiagnostic.detail}
                  </div>
                )}
                {runtimeDiagnostic.action && (
                  <div className="mt-1 opacity-90">{runtimeDiagnostic.action}</div>
                )}
              </div>
            )}
            {!runtimeDiagnostic && runtimeView.lastError && (
              <div className="text-[11px] text-danger-600 dark:text-danger-400 break-all bg-danger-50 dark:bg-danger-900/10 p-2 rounded-md border border-danger-100 dark:border-danger-500/20 mt-2">
                <span className="font-semibold">{t.mcpLastErrorPrefix}</span> {runtimeView.lastError}
              </div>
            )}
          </div>
        </section>

        {runtimeDiagnostic && (
          <section className="border border-gray-200 dark:border-dark-border rounded-xl p-4 bg-slate-50 dark:bg-dark-surface shadow-sm">
            <h3 className="text-[13px] font-semibold text-gray-700 dark:text-dark-text mb-3 uppercase tracking-wider">{t.mcpRuntimeDiagnostics}</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500 dark:text-dark-text-secondary">{t.mcpDiagnosticClass}</span>
                <span className="font-semibold text-gray-700 dark:text-dark-text">{runtimeDiagnostic.title}</span>
              </div>
              {runtimeDiagnostic.detail && (
                <div className="text-gray-700 dark:text-dark-text leading-relaxed">{runtimeDiagnostic.detail}</div>
              )}
              {runtimeDiagnostic.action && (
                <div className="rounded-lg border border-primary-100 dark:border-primary-500/20 bg-primary-50 dark:bg-primary-900/10 px-3 py-2 text-primary-700 dark:text-primary-300 leading-relaxed">
                  {runtimeDiagnostic.action}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="border border-gray-200 dark:border-dark-border rounded-xl p-4 bg-slate-50 dark:bg-dark-surface shadow-sm">
          <h3 className="text-[13px] font-semibold text-gray-700 dark:text-dark-text mb-3 uppercase tracking-wider">{t.mcpKeyServiceStatus}</h3>
          <div className="space-y-2">
            {serviceStatus.map(({ service, online, statusLabel }) => (
              <div key={service} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white dark:bg-dark-bg border border-gray-100 dark:border-dark-border/50 shadow-sm transition-colors hover:border-primary-500/30">
                <span className="font-medium text-gray-700 dark:text-dark-text capitalize tracking-wide">{service}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-success-500 animate-pulse-subtle' : 'bg-gray-400'}`}></span>
                  <span className={online ? 'text-success-600 dark:text-success-500 font-medium' : 'text-gray-500 dark:text-dark-text-muted font-medium'}>
                    {online ? t.mcpServiceOnline : t.mcpServiceNotReady}
                    <span className="text-gray-400 font-normal ml-1">({statusLabel})</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-xl p-4 bg-slate-50 dark:bg-dark-surface shadow-sm">
          <h3 className="text-[13px] font-semibold text-gray-700 dark:text-dark-text mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={14} className="text-primary-500" />
            {t.mcpRuntimeMetrics}
          </h3>
          {metrics ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-dark-bg p-2.5 rounded-lg border border-gray-100 dark:border-dark-border/50 shadow-sm">
                <div className="text-[10px] text-gray-500 dark:text-dark-text-muted uppercase tracking-wider mb-1">{t.mcpMetricTotal}</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-dark-text">{metrics.requests_total}</div>
              </div>
              <div className="bg-white dark:bg-dark-bg p-2.5 rounded-lg border border-gray-100 dark:border-dark-border/50 shadow-sm">
                <div className="text-[10px] text-gray-500 dark:text-dark-text-muted uppercase tracking-wider mb-1">{t.mcpMetricFailed}</div>
                <div className="text-sm font-semibold text-danger-500">{metrics.requests_failed_total}</div>
              </div>
              <div className="bg-white dark:bg-dark-bg p-2.5 rounded-lg border border-gray-100 dark:border-dark-border/50 shadow-sm">
                <div className="text-[10px] text-gray-500 dark:text-dark-text-muted uppercase tracking-wider mb-1">{t.mcpMetricAvgLatency}</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-dark-text">{metrics.latency_ms_avg} ms</div>
              </div>
              <div className="bg-white dark:bg-dark-bg p-2.5 rounded-lg border border-gray-100 dark:border-dark-border/50 shadow-sm">
                <div className="text-[10px] text-gray-500 dark:text-dark-text-muted uppercase tracking-wider mb-1">{t.mcpMetricMaxLatency}</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-dark-text">{metrics.latency_ms_max} ms</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-dark-text-muted italic">{t.mcpNoMetricsData}</div>
          )}
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-xl p-4 bg-slate-50 dark:bg-dark-surface shadow-sm">
          <h3 className="text-[13px] font-semibold text-gray-700 dark:text-dark-text mb-3 uppercase tracking-wider">{t.mcpServiceDynamicConfig}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <input
                value={newServiceId}
                onChange={(event) => setNewServiceId(event.target.value)}
                placeholder={t.mcpServiceIdPlaceholder}
                aria-label={t.mcpServiceIdPlaceholder}
                className="col-span-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-bg text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500 outline-none transition-all shadow-sm"
              />
              <input
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
                placeholder={t.mcpServiceNamePlaceholder}
                aria-label={t.mcpServiceNamePlaceholder}
                className="col-span-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-bg text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500 outline-none transition-all shadow-sm"
              />
              <input
                value={newServicePath}
                onChange={(event) => setNewServicePath(event.target.value)}
                placeholder={t.mcpServicePathPlaceholder}
                aria-label={t.mcpServicePathPlaceholder}
                className="col-span-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-dark-border rounded-md bg-white dark:bg-dark-bg text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500 outline-none transition-all shadow-sm"
              />
            </div>
            <button
              onClick={handleCreateService}
              disabled={serviceActionLoading === 'create'}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg w-full flex items-center justify-center gap-2 text-xs font-medium px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-md disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
            >
              {serviceActionLoading === 'create' && <RefreshCw size={14} className="animate-spin" />}
              {serviceActionLoading === 'create' ? t.mcpCreating : t.mcpCreateService}
            </button>

            <div className="space-y-3 pt-2 border-t border-gray-200/60 dark:border-dark-border/60">
              {serviceConfigRows.length > 0 ? serviceConfigRows.map((service) => (
                <div key={service.id} className="border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg rounded-xl p-3 space-y-2.5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-gray-500 dark:text-dark-text-muted bg-gray-100 dark:bg-dark-surface2 px-1.5 py-0.5 rounded">{service.id}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${service.status === 'ok' ? 'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400' : 'bg-gray-100 text-gray-600 dark:bg-dark-surface2 dark:text-gray-400'}`}>{service.statusLabel}</span>
                  </div>
                  <input
                    value={service.draftName}
                    onChange={(event) => setServiceDraftNames((prev) => ({ ...prev, [service.id]: event.target.value }))}
                    aria-label={t.mcpServiceNamePlaceholder}
                    className="w-full px-2.5 py-1.5 text-xs font-medium border border-gray-200 dark:border-dark-border rounded-md bg-gray-50 dark:bg-dark-surface text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500 outline-none transition-all"
                  />
                  <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 dark:text-dark-text-secondary">
                    <span className="truncate max-w-[160px]" title={service.path}>{service.path}</span>
                    <span className={service.enabled ? 'text-primary-600 dark:text-primary-400' : ''}>{service.enabled ? t.mcpServiceEnabled : t.mcpServiceDisabled}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => void handleServiceRename(service)}
                      disabled={serviceActionLoading === `rename:${service.id}`}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium px-2 py-1.5 bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border rounded-md disabled:opacity-50 text-gray-700 dark:text-dark-text transition-all active:scale-95"
                    >
                      {serviceActionLoading === `rename:${service.id}` && <RefreshCw size={12} className="animate-spin" />}
                      {serviceActionLoading === `rename:${service.id}` ? t.mcpSaving : t.mcpSaveName}
                    </button>
                    <button
                      onClick={() => void handleServiceToggle(service)}
                      disabled={serviceActionLoading === `toggle:${service.id}` || service.builtin}
                      title={service.builtin ? t.mcpBuiltinServiceCannotToggle : undefined}
                      className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium px-2 py-1.5 border rounded-md disabled:opacity-50 transition-all active:scale-95 ${service.enabled ? 'bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border text-warning-600 dark:text-warning-500 hover:bg-warning-50 dark:hover:bg-warning-900/10' : 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100'}`}
                    >
                      {serviceActionLoading === `toggle:${service.id}` && <RefreshCw size={12} className="animate-spin" />}
                      {service.enabled ? t.mcpDisable : t.mcpEnable}
                    </button>
                    <button
                      onClick={() => void handleServiceProbe(service.id)}
                      disabled={serviceActionLoading === `probe:${service.id}`}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium px-2 py-1.5 bg-white dark:bg-dark-surface hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border rounded-md disabled:opacity-50 text-gray-700 dark:text-dark-text transition-all active:scale-95"
                    >
                      {serviceActionLoading === `probe:${service.id}` && <RefreshCw size={12} className="animate-spin" />}
                      {serviceActionLoading === `probe:${service.id}` ? t.mcpProbing : t.mcpHealthCheck}
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-xs text-gray-400 dark:text-dark-text-muted italic">{t.mcpNoServiceConfigData}</div>
              )}
            </div>
          </div>
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-xl p-4 bg-slate-50 dark:bg-dark-surface shadow-sm mb-4">
          <h3 className="text-[13px] font-semibold text-gray-700 dark:text-dark-text mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench size={14} className="text-primary-500" />
            {t.mcpToolStats}
          </h3>
          {serviceToolCounts.length > 0 ? (
            <div className="space-y-2.5">
              {serviceToolCounts.map((item) => (
                <div key={item.service} className="flex items-center justify-between text-xs px-2">
                  <span className="font-medium text-gray-600 dark:text-dark-text-secondary capitalize">{item.service}</span>
                  <span className="text-gray-800 dark:text-dark-text font-bold bg-white dark:bg-dark-bg px-2 py-0.5 rounded border border-gray-100 dark:border-dark-border/50 shadow-sm">{item.count}</span>
                </div>
              ))}
              <div className="pt-3 mt-1 border-t border-gray-200/60 dark:border-dark-border/60 flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider text-[11px]">{t.mcpTotalTools}</span>
                <span className="font-bold text-primary-600 text-base">{totalTools}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 dark:text-dark-text-muted italic">{t.mcpNoToolData}</div>
          )}
        </section>

      </div>
    </div>
  )
}