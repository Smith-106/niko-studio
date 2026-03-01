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

interface McpStatusPanelProps {
  onClose: () => void
}

const KEY_SERVICES = ['memory', 'graph', 'search', 'workflow', 'critic', 'agent', 'skills']

const SERVICE_STATUS_LABEL: Record<string, string> = {
  ok: '正常',
  error: '异常',
  disabled: '已禁用',
  unknown: '未知',
}

const CONNECTION_STATE_LABEL: Record<string, string> = {
  connected: '已连接',
  degraded: '降级',
  disconnected: '已断开',
  reconnecting: '重连中',
}

const RECONNECT_STATE_LABEL: Record<string, string> = {
  idle: '空闲',
  probing: '探测中',
  backoff: '退避',
  retrying: '重试中',
  recovered: '已恢复',
  failed: '失败',
}

const CONNECTION_STATE_COLOR: Record<string, string> = {
  connected: 'text-green-600',
  degraded: 'text-amber-600',
  disconnected: 'text-red-600',
  reconnecting: 'text-teal-600',
}

const PANEL_CARD_CLASS = 'border border-slate-200 dark:border-dark-border rounded-lg p-3'

export function McpStatusPanel({ onClose }: McpStatusPanelProps) {
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
        setError('部分状态拉取失败，以下信息可能不完整。')
      }
    } catch {
      setBackendHealthy(false)
      setGatewayHealth(null)
      setMetrics(null)
      setTools(null)
      setServices(null)
      setError('状态拉取失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [])

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

  const connectionStateLabel = CONNECTION_STATE_LABEL[runtimeView.connectionState] ?? runtimeView.connectionState
  const reconnectStateLabel = RECONNECT_STATE_LABEL[runtimeView.reconnectState] ?? runtimeView.reconnectState
  const connectionStateColor = CONNECTION_STATE_COLOR[runtimeView.connectionState] ?? 'text-slate-600'

  const handleServiceProbe = useCallback(async (serviceId: string) => {
    setServiceActionError(null)
    setServiceActionLoading(`probe:${serviceId}`)

    const result = await probeGatewayServiceHealth(serviceId)
    if (!result.success) {
      setServiceActionError(result.error ?? '探测失败')
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
      setServiceActionError(result.error ?? '更新失败')
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
      setServiceActionError(result.error ?? '更新失败')
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
      setServiceActionError('请先填写服务 ID')
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
      setServiceActionError(result.error ?? '创建失败')
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
      statusLabel: SERVICE_STATUS_LABEL[service.status ?? 'unknown'] ?? service.status ?? 'unknown',
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
          statusLabel: SERVICE_STATUS_LABEL[status] ?? status,
        }
      }),
    [backendHealthy, services]
  )

  return (
    <div
      className="fixed right-0 top-12 bottom-0 w-96 bg-white dark:bg-dark-surface border-l border-slate-200 dark:border-dark-border shadow-lg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="MCP 状态面板"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-dark-border">
        <div className="flex items-center gap-2">
          <Server size={20} className="text-teal-600" />
          <span className="font-semibold text-slate-900 dark:text-dark-text">MCP 状态</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStatus}
            disabled={loading}
            className="cursor-pointer text-xs px-3 py-1.5 bg-slate-100 dark:bg-dark-border hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-50 dark:text-dark-text flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button
            onClick={onClose}
            className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-500 rounded"
            aria-label="关闭 MCP 状态面板"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div aria-live="polite" className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {serviceActionError && (
          <div aria-live="polite" className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm">
            <AlertCircle size={16} />
            <span>{serviceActionError}</span>
          </div>
        )}

        <section className={PANEL_CARD_CLASS}>
          <h3 className="text-sm font-medium text-slate-700 dark:text-dark-text mb-2">网关状态</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-dark-text-secondary">Gateway Health</span>
              <span className={`text-sm font-medium ${connectionStateColor}`}>
                {connectionStateLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-dark-text-secondary">Session ID</span>
              <span className="text-xs font-mono text-slate-700 dark:text-dark-text truncate max-w-[220px]" title={runtimeView.sessionId ?? 'N/A'}>
                {runtimeView.sessionId ?? 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-dark-text-secondary">Reconnect</span>
              <span className="text-sm text-slate-700 dark:text-dark-text">
                {reconnectStateLabel} · #{runtimeView.reconnectAttempts}
              </span>
            </div>
            {runtimeView.lastError && (
              <div className="text-xs text-red-600 dark:text-red-300 break-all">
                Last error: {runtimeView.lastError}
              </div>
            )}
          </div>
        </section>

        <section className={PANEL_CARD_CLASS}>
          <h3 className="text-sm font-medium text-slate-700 dark:text-dark-text mb-2">关键服务状态</h3>
          <div className="space-y-2">
            {serviceStatus.map(({ service, online, statusLabel }) => (
              <div key={service} className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-dark-text-secondary">{service}</span>
                <span className={online ? 'text-green-600' : 'text-slate-400 dark:text-dark-text-secondary'}>
                  {online ? '在线' : '未就绪'}（{statusLabel}）
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={PANEL_CARD_CLASS}>
          <h3 className="text-sm font-medium text-slate-700 dark:text-dark-text mb-2 flex items-center gap-1">
            <Activity size={14} />
            运行指标
          </h3>
          {metrics ? (
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-dark-text">
              <div>请求总数：{metrics.requests_total}</div>
              <div>失败请求：{metrics.requests_failed_total}</div>
              <div>平均延迟：{metrics.latency_ms_avg} ms</div>
              <div>最大延迟：{metrics.latency_ms_max} ms</div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 dark:text-dark-text-secondary">暂无指标数据</div>
          )}
        </section>

        <section className={PANEL_CARD_CLASS}>
          <h3 className="text-sm font-medium text-slate-700 dark:text-dark-text mb-2">服务动态配置</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input
                value={newServiceId}
                onChange={(event) => setNewServiceId(event.target.value)}
                placeholder="服务 ID"
                className="col-span-1 px-2 py-1 text-xs border border-slate-200 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-slate-800 dark:text-dark-text"
              />
              <input
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
                placeholder="服务名（可选）"
                className="col-span-1 px-2 py-1 text-xs border border-slate-200 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-slate-800 dark:text-dark-text"
              />
              <input
                value={newServicePath}
                onChange={(event) => setNewServicePath(event.target.value)}
                placeholder="路径（可选）"
                className="col-span-1 px-2 py-1 text-xs border border-slate-200 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-slate-800 dark:text-dark-text"
              />
            </div>
            <button
              onClick={handleCreateService}
              disabled={serviceActionLoading === 'create'}
              className="cursor-pointer text-xs px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {serviceActionLoading === 'create' ? '创建中...' : '新增服务'}
            </button>

            <div className="space-y-2">
              {serviceConfigRows.length > 0 ? serviceConfigRows.map((service) => (
                <div key={service.id} className="border border-slate-200 dark:border-dark-border rounded p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-600 dark:text-dark-text-secondary">{service.id}</span>
                    <span className="text-xs text-slate-500 dark:text-dark-text-secondary">{service.statusLabel}</span>
                  </div>
                  <input
                    value={service.draftName}
                    onChange={(event) => setServiceDraftNames((prev) => ({ ...prev, [service.id]: event.target.value }))}
                    className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-dark-border rounded bg-white dark:bg-dark-surface text-slate-800 dark:text-dark-text"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-dark-text-secondary">
                    <span className="truncate" title={service.path}>{service.path}</span>
                    <span>{service.enabled ? '启用中' : '已禁用'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleServiceRename(service)}
                      disabled={serviceActionLoading === `rename:${service.id}`}
                      className="cursor-pointer text-xs px-2 py-1 bg-slate-100 dark:bg-dark-border hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-50 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {serviceActionLoading === `rename:${service.id}` ? '保存中...' : '保存名称'}
                    </button>
                    <button
                      onClick={() => void handleServiceToggle(service)}
                      disabled={serviceActionLoading === `toggle:${service.id}` || service.builtin}
                      className="cursor-pointer text-xs px-2 py-1 bg-slate-100 dark:bg-dark-border hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-50 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {service.enabled ? '禁用' : '启用'}
                    </button>
                    <button
                      onClick={() => void handleServiceProbe(service.id)}
                      disabled={serviceActionLoading === `probe:${service.id}`}
                      className="cursor-pointer text-xs px-2 py-1 bg-slate-100 dark:bg-dark-border hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-50 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {serviceActionLoading === `probe:${service.id}` ? '探测中...' : '健康检测'}
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-sm text-slate-400 dark:text-dark-text-secondary">暂无服务配置数据</div>
              )}
            </div>
          </div>
        </section>

        <section className={PANEL_CARD_CLASS}>
          <h3 className="text-sm font-medium text-slate-700 dark:text-dark-text mb-2 flex items-center gap-1">
            <Wrench size={14} />
            工具统计
          </h3>
          {serviceToolCounts.length > 0 ? (
            <div className="space-y-2">
              {serviceToolCounts.map((item) => (
                <div key={item.service} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-dark-text-secondary">{item.service}</span>
                  <span className="text-slate-800 dark:text-dark-text font-medium">{item.count}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-200 dark:border-dark-border flex items-center justify-between text-sm font-medium">
                <span className="text-slate-700 dark:text-dark-text">总工具数</span>
                <span className="text-teal-600">{totalTools}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400 dark:text-dark-text-secondary">暂无工具数据</div>
          )}
        </section>

      </div>
    </div>
  )
}
