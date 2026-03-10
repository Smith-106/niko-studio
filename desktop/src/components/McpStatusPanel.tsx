import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, RefreshCw, Server, Wrench } from 'lucide-react'
import {
  checkBackendHealth,
  createGatewayServiceConfig,
  deriveGatewayRuntimeState,
  GatewayHealth,
  GatewayMetrics,
  GatewayServiceConfig,
  GatewayTools,
  getGatewayHealth,
  getGatewayMetrics,
  listGatewayServiceConfigs,
  listGatewayTools,
  probeGatewayServiceHealth,
  setGatewayServiceEnabled,
  updateGatewayServiceConfig,
} from '../api/client'

import { useI18n } from '../i18n'

interface McpStatusPanelProps {
  onClose: () => void
}

const KEY_SERVICES = ['memory', 'graph', 'search', 'workflow', 'critic', 'agent', 'skills']

const CONNECTION_STATE_COLOR: Record<string, string> = {
  connected: 'text-green-600',
  degraded: 'text-amber-600',
  disconnected: 'text-red-600',
  reconnecting: 'text-blue-600',
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

      if (gatewayHealthResult.status === 'fulfilled' && gatewayHealthResult.value.success && gatewayHealthResult.value.data?.services) {
        setGatewayHealth(gatewayHealthResult.value.data)
        setServices(gatewayHealthResult.value.data.services)
      } else {
        setGatewayHealth(null)
        setServices(null)
        hasError = true
      }

      if (metricsResult.status === 'fulfilled' && metricsResult.value.success && metricsResult.value.data?.metrics) {
        setMetrics(metricsResult.value.data.metrics)
      } else {
        setMetrics(null)
        hasError = true
      }

      if (toolsResult.status === 'fulfilled' && toolsResult.value.success && toolsResult.value.data) {
        setTools(toolsResult.value.data)
      } else {
        setTools(null)
        hasError = true
      }

      if (serviceConfigsResult.status === 'fulfilled' && serviceConfigsResult.value.success && serviceConfigsResult.value.data?.services) {
        setServiceConfigs(serviceConfigsResult.value.data.services)
      } else {
        setServiceConfigs([])
        hasError = true
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
    () => deriveGatewayRuntimeState(gatewayHealth, backendHealthy),
    [gatewayHealth, backendHealthy]
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
      className="fixed right-0 top-12 bottom-0 w-96 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-lg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={t.mcpPanelAriaLabel}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-2">
          <Server size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900 dark:text-dark-text">{t.mcpPanelTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStatus}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text flex items-center gap-1"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? t.mcpRefreshing : t.mcpRefresh}
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label={t.mcpCloseAria}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {serviceActionError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm">
            <AlertCircle size={16} />
            <span>{serviceActionError}</span>
          </div>
        )}

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2">{t.mcpGatewayStatus}</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.mcpGatewayHealth}</span>
              <span className={`text-sm font-medium ${connectionStateColor}`}>
                {connectionStateLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.mcpSessionId}</span>
              <span className="text-xs font-mono text-gray-700 dark:text-dark-text truncate max-w-[220px]" title={runtimeView.sessionId ?? t.mcpNotAvailable}>
                {runtimeView.sessionId ?? t.mcpNotAvailable}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.mcpReconnect}</span>
              <span className="text-sm text-gray-700 dark:text-dark-text">
                {reconnectStateLabel} · #{runtimeView.reconnectAttempts}
              </span>
            </div>
            {runtimeView.lastError && (
              <div className="text-xs text-red-600 dark:text-red-300 break-all">
                {t.mcpLastErrorPrefix}{runtimeView.lastError}
              </div>
            )}
          </div>
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2">{t.mcpKeyServiceStatus}</h3>
          <div className="space-y-2">
            {serviceStatus.map(({ service, online, statusLabel }) => (
              <div key={service} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-dark-text-secondary">{service}</span>
                <span className={online ? 'text-green-600' : 'text-gray-400 dark:text-dark-text-secondary'}>
                  {online ? t.mcpServiceOnline : t.mcpServiceNotReady}（{statusLabel}）
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2 flex items-center gap-1">
            <Activity size={14} />
            {t.mcpRuntimeMetrics}
          </h3>
          {metrics ? (
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-dark-text">
              <div>{t.mcpRequestsTotal.replace('{value}', String(metrics.requests_total))}</div>
              <div>{t.mcpRequestsFailed.replace('{value}', String(metrics.requests_failed_total))}</div>
              <div>{t.mcpLatencyAvg.replace('{value}', String(metrics.latency_ms_avg))}</div>
              <div>{t.mcpLatencyMax.replace('{value}', String(metrics.latency_ms_max))}</div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-dark-text-secondary">{t.mcpNoMetricsData}</div>
          )}
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2">{t.mcpServiceDynamicConfig}</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input
                value={newServiceId}
                onChange={(event) => setNewServiceId(event.target.value)}
                placeholder={t.mcpServiceIdPlaceholder}
                className="col-span-1 px-2 py-1 text-xs border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-gray-800 dark:text-dark-text"
              />
              <input
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
                placeholder={t.mcpServiceNamePlaceholder}
                className="col-span-1 px-2 py-1 text-xs border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-gray-800 dark:text-dark-text"
              />
              <input
                value={newServicePath}
                onChange={(event) => setNewServicePath(event.target.value)}
                placeholder={t.mcpServicePathPlaceholder}
                className="col-span-1 px-2 py-1 text-xs border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-gray-800 dark:text-dark-text"
              />
            </div>
            <button
              onClick={handleCreateService}
              disabled={serviceActionLoading === 'create'}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
              {serviceActionLoading === 'create' ? t.mcpCreating : t.mcpCreateService}
            </button>

            <div className="space-y-2">
              {serviceConfigRows.length > 0 ? serviceConfigRows.map((service) => (
                <div key={service.id} className="border border-gray-200 dark:border-dark-border rounded p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-gray-600 dark:text-dark-text-secondary">{service.id}</span>
                    <span className="text-xs text-gray-500 dark:text-dark-text-secondary">{service.statusLabel}</span>
                  </div>
                  <input
                    value={service.draftName}
                    onChange={(event) => setServiceDraftNames((prev) => ({ ...prev, [service.id]: event.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-gray-800 dark:text-dark-text"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-text-secondary">
                    <span className="truncate" title={service.path}>{service.path}</span>
                    <span>{service.enabled ? t.mcpServiceEnabled : t.mcpServiceDisabled}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleServiceRename(service)}
                      disabled={serviceActionLoading === `rename:${service.id}`}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                    >
                      {serviceActionLoading === `rename:${service.id}` ? t.mcpSaving : t.mcpSaveName}
                    </button>
                    <button
                      onClick={() => void handleServiceToggle(service)}
                      disabled={serviceActionLoading === `toggle:${service.id}` || service.builtin}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                    >
                      {service.enabled ? t.mcpDisable : t.mcpEnable}
                    </button>
                    <button
                      onClick={() => void handleServiceProbe(service.id)}
                      disabled={serviceActionLoading === `probe:${service.id}`}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                    >
                      {serviceActionLoading === `probe:${service.id}` ? t.mcpProbing : t.mcpHealthCheck}
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-gray-400 dark:text-dark-text-secondary">{t.mcpNoServiceConfigData}</div>
              )}
            </div>
          </div>
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2 flex items-center gap-1">
            <Wrench size={14} />
            {t.mcpToolStats}
          </h3>
          {serviceToolCounts.length > 0 ? (
            <div className="space-y-2">
              {serviceToolCounts.map((item) => (
                <div key={item.service} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-dark-text-secondary">{item.service}</span>
                  <span className="text-gray-800 dark:text-dark-text font-medium">{item.count}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200 dark:border-dark-border flex items-center justify-between text-sm font-medium">
                <span className="text-gray-700 dark:text-dark-text">{t.mcpTotalTools}</span>
                <span className="text-blue-600">{totalTools}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-dark-text-secondary">{t.mcpNoToolData}</div>
          )}
        </section>

      </div>
    </div>
  )
}
