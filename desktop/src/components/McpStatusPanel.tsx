import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, RefreshCw, Server, Wrench } from 'lucide-react'
import { checkBackendHealth, getGatewayHealth, getGatewayMetrics, listGatewayTools, GatewayMetrics, GatewayTools } from '../api/client'

interface McpStatusPanelProps {
  onClose: () => void
}

const KEY_SERVICES = ['memory', 'graph', 'search', 'workflow', 'critic', 'agent', 'skills']

const SERVICE_STATUS_LABEL: Record<string, string> = {
  ok: '正常',
  error: '异常',
  unknown: '未知',
}

export function McpStatusPanel({ onClose }: McpStatusPanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backendHealthy, setBackendHealthy] = useState(false)
  const [metrics, setMetrics] = useState<GatewayMetrics | null>(null)
  const [tools, setTools] = useState<GatewayTools | null>(null)
  const [services, setServices] = useState<Record<string, string> | null>(null)

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [healthResult, gatewayHealthResult, metricsResult, toolsResult] = await Promise.allSettled([
        checkBackendHealth(),
        getGatewayHealth(),
        getGatewayMetrics(),
        listGatewayTools(),
      ])

      let hasError = false

      if (healthResult.status === 'fulfilled') {
        setBackendHealthy(healthResult.value)
      } else {
        setBackendHealthy(false)
        hasError = true
      }

      if (gatewayHealthResult.status === 'fulfilled' && gatewayHealthResult.value.success && gatewayHealthResult.value.data?.services) {
        setServices(gatewayHealthResult.value.data.services)
      } else {
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

      if (hasError) {
        setError('部分状态拉取失败，以下信息可能不完整。')
      }
    } catch {
      setBackendHealthy(false)
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
      className="fixed right-0 top-12 bottom-0 w-96 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-lg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="MCP 状态面板"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-2">
          <Server size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900 dark:text-dark-text">MCP 状态</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshStatus}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text flex items-center gap-1"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="关闭 MCP 状态面板"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2">网关状态</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-dark-text-secondary">Gateway Health</span>
            <span className={`text-sm font-medium ${backendHealthy ? 'text-green-600' : 'text-red-600'}`}>
              {backendHealthy ? '在线' : '离线'}
            </span>
          </div>
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2">关键服务状态</h3>
          <div className="space-y-2">
            {serviceStatus.map(({ service, online, statusLabel }) => (
              <div key={service} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-dark-text-secondary">{service}</span>
                <span className={online ? 'text-green-600' : 'text-gray-400 dark:text-dark-text-secondary'}>
                  {online ? '在线' : '未就绪'}（{statusLabel}）
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2 flex items-center gap-1">
            <Activity size={14} />
            运行指标
          </h3>
          {metrics ? (
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-dark-text">
              <div>请求总数：{metrics.requests_total}</div>
              <div>失败请求：{metrics.requests_failed_total}</div>
              <div>平均延迟：{metrics.latency_ms_avg} ms</div>
              <div>最大延迟：{metrics.latency_ms_max} ms</div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-dark-text-secondary">暂无指标数据</div>
          )}
        </section>

        <section className="border border-gray-200 dark:border-dark-border rounded-lg p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-2 flex items-center gap-1">
            <Wrench size={14} />
            工具统计
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
                <span className="text-gray-700 dark:text-dark-text">总工具数</span>
                <span className="text-blue-600">{totalTools}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-dark-text-secondary">暂无工具数据</div>
          )}
        </section>
      </div>
    </div>
  )
}
