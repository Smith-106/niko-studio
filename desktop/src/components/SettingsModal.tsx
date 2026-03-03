import { useState, useRef } from 'react'
import { X, Save, RotateCcw, Eye, EyeOff, Check, AlertCircle, Download, Upload } from 'lucide-react'
import { checkBackendHealth, fetchProviderModels, getGatewayMetrics, listGatewayTools, GatewayMetrics, GatewayTools } from '../api/client'
import { useSettingsStore, LLMProvider, QUALITY_GOAL_METRIC_FIELDS, QUALITY_PRESET_TEMPLATES, QualityGoalsSettings, QualityPresetId } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'
import { useI18n } from '../i18n'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, updateProvider, resetSettings } = useSettingsStore()
  const { setAllowLlmFallback, setQualityGoals, checkBackend } = useAppStore()
  const [localSettings, setLocalSettings] = useState(settings)
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({})
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)
  const [gatewayMetrics, setGatewayMetrics] = useState<GatewayMetrics | null>(null)
  const [gatewayTools, setGatewayTools] = useState<GatewayTools | null>(null)
  const [modelSyncLoading, setModelSyncLoading] = useState<Record<string, boolean>>({})
  const [modelSyncError, setModelSyncError] = useState<Record<string, string | null>>({})
  const [customModelInputs, setCustomModelInputs] = useState<Record<string, string>>({})
  const [providerSearch, setProviderSearch] = useState('')
  const [modelValidateLoading, setModelValidateLoading] = useState<Record<string, boolean>>({})
  const [modelValidateMessage, setModelValidateMessage] = useState<Record<string, { type: 'success' | 'error'; text: string } | null>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()

  if (!isOpen) return null

  const applyQualityPreset = (presetId: QualityPresetId) => {
    const presetTemplate = QUALITY_PRESET_TEMPLATES.find((preset) => preset.id === presetId)
    setLocalSettings((prev) => {
      const nextQualityGoals: QualityGoalsSettings = {
        ...prev.qualityGoals,
        humanizationPreset: presetId,
      }

      if (presetTemplate) {
        nextQualityGoals.naturalness = presetTemplate.goals.naturalness
        nextQualityGoals.readability = presetTemplate.goals.readability
        nextQualityGoals.coherence = presetTemplate.goals.coherence
        nextQualityGoals.styleConsistency = presetTemplate.goals.styleConsistency
        nextQualityGoals.sentenceEntropyTarget = presetTemplate.sentenceEntropyTarget
        nextQualityGoals.rhythmVariabilityTarget = presetTemplate.rhythmVariabilityTarget
      }

      return {
        ...prev,
        qualityGoals: nextQualityGoals,
      }
    })
  }

  const handleSave = async () => {
    updateSettings(localSettings)
    setAllowLlmFallback(localSettings.allowLlmFallback)
    setQualityGoals(localSettings.qualityGoals)
    // 同步更新各个 provider
    localSettings.llmProviders.forEach((provider) => {
      updateProvider(provider.id, provider)
    })
    await checkBackend()
    onClose()
  }

  const handleReset = () => {
    resetSettings()
    const nextSettings = useSettingsStore.getState().settings
    setLocalSettings(nextSettings)
    setAllowLlmFallback(nextSettings.allowLlmFallback)
    setQualityGoals(nextSettings.qualityGoals)
  }

  const toggleShowApiKey = (providerId: string) => {
    setShowApiKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }))
  }

  const validateCustomModelInput = (value: string): { ok: boolean; reason?: string } => {
    if (!value) {
      return { ok: false, reason: '模型名称不能为空。' }
    }
    if (value.length > 120) {
      return { ok: false, reason: '模型名称过长（最多 120 个字符）。' }
    }
    if (/\s/.test(value)) {
      return { ok: false, reason: '模型名称不能包含空白字符。' }
    }
    return { ok: true }
  }

  const ensureValidDefaultModel = (provider: LLMProvider, updates: Partial<LLMProvider>): Partial<LLMProvider> => {
    const nextProvider: LLMProvider = { ...provider, ...updates }
    const effectiveModels = getEffectiveModels(nextProvider)
    if (effectiveModels.length === 0) {
      return updates
    }

    const requestedDefault = (nextProvider.defaultModel ?? '').trim()
    const hasRequestedDefault = effectiveModels.some((model) => model.toLowerCase() === requestedDefault.toLowerCase())
    const safeDefaultModel = hasRequestedDefault ? requestedDefault : effectiveModels[0]

    return {
      ...updates,
      defaultModel: safeDefaultModel,
      modelSelectionMode: updates.modelSelectionMode ?? (hasRequestedDefault ? nextProvider.modelSelectionMode : 'list'),
    }
  }

  const updateLocalProvider = (providerId: string, updates: Partial<LLMProvider>) => {
    setLocalSettings((prev) => ({
      ...prev,
      llmProviders: prev.llmProviders.map((p) => {
        if (p.id !== providerId) {
          return p
        }
        return { ...p, ...ensureValidDefaultModel(p, updates) }
      }),
    }))
  }

  const deduplicateModels = (models: string[]): string[] => {
    return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)))
  }

  const getEffectiveModels = (provider: LLMProvider): string[] => {
    return deduplicateModels([
      ...provider.models,
      ...(provider.fetchedModels ?? []),
      ...(provider.customModels ?? []),
    ])
  }

  const refreshProviderModels = async (provider: LLMProvider) => {
    setModelSyncLoading((prev) => ({ ...prev, [provider.id]: true }))
    setModelSyncError((prev) => ({ ...prev, [provider.id]: null }))

    try {
      const res = await fetchProviderModels(provider.id, provider.baseUrl, provider.apiKey)
      if (res.success && res.data?.models) {
        updateLocalProvider(provider.id, {
          fetchedModels: res.data.models,
          lastModelSyncAt: new Date().toISOString(),
        })
      } else {
        const reason = res.error?.includes('gateway=')
          ? `模型拉取失败（网关/直连均失败）：${res.error}`
          : '模型拉取失败，请继续使用预置或自定义模型。'
        setModelSyncError((prev) => ({ ...prev, [provider.id]: reason }))
      }
    } catch {
      setModelSyncError((prev) => ({ ...prev, [provider.id]: '模型拉取失败，请继续使用预置或自定义模型。' }))
    } finally {
      setModelSyncLoading((prev) => ({ ...prev, [provider.id]: false }))
    }
  }

  const applyCustomModel = (provider: LLMProvider) => {
    const value = (customModelInputs[provider.id] ?? '').trim()
    const validation = validateCustomModelInput(value)
    if (!validation.ok) {
      setModelSyncError((prev) => ({ ...prev, [provider.id]: validation.reason ?? '自定义模型不合法。' }))
      return
    }

    const nextCustomModels = deduplicateModels([...(provider.customModels ?? []), value])
    updateLocalProvider(provider.id, {
      customModels: nextCustomModels,
      defaultModel: value,
      modelSelectionMode: 'custom',
    })
    setCustomModelInputs((prev) => ({ ...prev, [provider.id]: '' }))
    setModelSyncError((prev) => ({ ...prev, [provider.id]: null }))
  }

  const getModelGroups = (provider: LLMProvider): Array<{ label: string; models: string[] }> => {
    const staticModels = deduplicateModels(provider.models ?? [])
    const fetchedModels = deduplicateModels(provider.fetchedModels ?? [])
    const customModels = deduplicateModels(provider.customModels ?? [])

    const groups: Array<{ label: string; models: string[] }> = []

    if (staticModels.length > 0) {
      groups.push({ label: '预置模型', models: staticModels })
    }
    if (fetchedModels.length > 0) {
      groups.push({ label: '自动拉取', models: fetchedModels })
    }
    if (customModels.length > 0) {
      groups.push({ label: '自定义模型', models: customModels })
    }

    return groups
  }

  const getFilteredProviders = (): LLMProvider[] => {
    const keyword = providerSearch.trim().toLowerCase()
    if (!keyword) {
      return localSettings.llmProviders
    }

    return localSettings.llmProviders.filter((provider) => {
      if (provider.name.toLowerCase().includes(keyword)) {
        return true
      }

      const effectiveModels = getEffectiveModels(provider)
      return effectiveModels.some((model) => model.toLowerCase().includes(keyword))
    })
  }

  const validateProviderDefaultModel = async (provider: LLMProvider) => {
    setModelValidateLoading((prev) => ({ ...prev, [provider.id]: true }))
    setModelValidateMessage((prev) => ({ ...prev, [provider.id]: null }))

    try {
      const res = await fetchProviderModels(provider.id, provider.baseUrl, provider.apiKey)
      const data = res.data
      if (!res.success || !data?.models?.length) {
        setModelValidateMessage((prev) => ({
          ...prev,
          [provider.id]: { type: 'error', text: '默认模型校验失败：无法拉取模型列表。' },
        }))
        return
      }

      const fetchedModels = data.models
      const defaultModel = provider.defaultModel.trim().toLowerCase()
      const isValid = fetchedModels.some((model) => model.toLowerCase() === defaultModel)

      if (isValid) {
        setModelValidateMessage((prev) => ({
          ...prev,
          [provider.id]: { type: 'success', text: `默认模型可用（来源：${data.source === 'gateway' ? '网关' : '直连'}）。` },
        }))
      } else {
        setModelValidateMessage((prev) => ({
          ...prev,
          [provider.id]: { type: 'error', text: '默认模型不在当前可用模型列表中。' },
        }))
      }
    } catch {
      setModelValidateMessage((prev) => ({
        ...prev,
        [provider.id]: { type: 'error', text: '默认模型校验失败，请稍后重试。' },
      }))
    } finally {
      setModelValidateLoading((prev) => ({ ...prev, [provider.id]: false }))
    }
  }

  const testConnection = async (provider: LLMProvider) => {
    setTestingProvider(provider.id)
    setTestResults((prev) => ({ ...prev, [provider.id]: null }))

    try {
      const healthy = await checkBackendHealth()
      setTestResults((prev) => ({ ...prev, [provider.id]: healthy ? 'success' : 'error' }))
    } catch {
      setTestResults((prev) => ({ ...prev, [provider.id]: 'error' }))
    } finally {
      setTestingProvider(null)
    }
  }

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
        setDiagnosticsError('诊断拉取失败，请稍后重试。')
      }
    } catch {
      setGatewayMetrics(null)
      setGatewayTools(null)
      setDiagnosticsError('诊断拉取失败，请稍后重试。')
    } finally {
      setDiagnosticsLoading(false)
    }
  }

  // 导出设置
  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: localSettings
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `niko-studio-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 导入设置
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importData = JSON.parse(content)

        // 验证导入数据
        if (!importData.settings || !importData.version) {
          throw new Error('无效的配置文件格式')
        }

        // 合并导入的设置
        setLocalSettings(importData.settings)
        setImportMessage({ type: 'success', text: '设置导入成功！' })

        // 3秒后清除消息
        setTimeout(() => setImportMessage(null), 3000)
      } catch (err) {
        setImportMessage({ type: 'error', text: `导入失败: ${err instanceof Error ? err.message : '未知错误'}` })
        setTimeout(() => setImportMessage(null), 3000)
      }
    }
    reader.readAsText(file)

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-surface rounded-2xl w-[700px] max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-dark-border">
          <h2 className="text-lg font-semibold dark:text-dark-text">设置</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors dark:text-dark-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6">
          {/* 后端设置 */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">后端服务</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">Niko-Studio 后端地址</label>
                <input
                  type="text"
                  value={localSettings.apiBaseUrl}
                  onChange={(e) => setLocalSettings({ ...localSettings, apiBaseUrl: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* 系统诊断 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">系统诊断</h3>
              <button
                onClick={refreshDiagnostics}
                disabled={diagnosticsLoading}
                className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
              >
                {diagnosticsLoading ? '刷新中...' : '刷新诊断'}
              </button>
            </div>

            {diagnosticsError && (
              <p className="text-xs text-red-500 mb-2">{diagnosticsError}</p>
            )}

            <div className="space-y-3">
              <div className="border dark:border-dark-border rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">网关指标</div>
                {gatewayMetrics ? (
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-dark-text">
                    <div>请求总数：{gatewayMetrics.requests_total}</div>
                    <div>失败请求：{gatewayMetrics.requests_failed_total}</div>
                    <div>平均延迟：{gatewayMetrics.latency_ms_avg} ms</div>
                    <div>最大延迟：{gatewayMetrics.latency_ms_max} ms</div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 dark:text-dark-text-secondary">暂无指标数据</div>
                )}
              </div>

              <div className="border dark:border-dark-border rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">工具清单</div>
                {gatewayTools && Object.keys(gatewayTools).length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {Object.entries(gatewayTools).map(([service, tools]) => (
                      <div key={service}>
                        <div className="text-xs font-medium text-gray-700 dark:text-dark-text">{service}</div>
                        <div className="text-xs text-gray-500 dark:text-dark-text-secondary break-all">
                          {tools.join('，')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 dark:text-dark-text-secondary">暂无工具数据</div>
                )}
              </div>
            </div>
          </section>

          {/* LLM 提供商配置 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">LLM 模型配置</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.allowLlmFallback}
                    onChange={(e) => setLocalSettings({ ...localSettings, allowLlmFallback: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-gray-600 dark:text-dark-text-secondary">允许降级</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.useMultiModel}
                    onChange={(e) => setLocalSettings({ ...localSettings, useMultiModel: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-gray-600 dark:text-dark-text-secondary">多模型并行</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.detectionEvasionGuardEnabled}
                    onChange={(e) => setLocalSettings({ ...localSettings, detectionEvasionGuardEnabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-gray-600 dark:text-dark-text-secondary">检测规避拦截</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.writingHelperUseLegacyPolish}
                    onChange={(e) => setLocalSettings({ ...localSettings, writingHelperUseLegacyPolish: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-gray-600 dark:text-dark-text-secondary">{t.writingHelperLegacyPolish}</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">检索 Provider / 模型</label>
                <input
                  type="text"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  placeholder="输入 provider 名称或模型关键字"
                  className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {getFilteredProviders().map((provider) => {
                return (
                <div
                  key={provider.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    provider.enabled ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-dark-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={provider.enabled}
                        onChange={(e) => updateLocalProvider(provider.id, { enabled: e.target.checked })}
                        className="rounded"
                      />
                      <span className="font-medium text-gray-800 dark:text-dark-text">{provider.name}</span>
                      {provider.id === localSettings.primaryProvider && provider.enabled && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">主要</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {testResults[provider.id] === 'success' && (
                        <Check size={16} className="text-green-500" />
                      )}
                      {testResults[provider.id] === 'error' && (
                        <AlertCircle size={16} className="text-red-500" />
                      )}
                      <button
                        onClick={() => testConnection(provider)}
                        disabled={!provider.apiKey || testingProvider === provider.id}
                        className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                      >
                        {testingProvider === provider.id ? '测试中...' : '测试连接'}
                      </button>
                    </div>
                  </div>

                  {provider.enabled && (
                    <div className="space-y-3 ml-6">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">API Key</label>
                        <div className="relative">
                          <input
                            type={showApiKeys[provider.id] ? 'text' : 'password'}
                            value={provider.apiKey}
                            onChange={(e) => updateLocalProvider(provider.id, { apiKey: e.target.value })}
                            className="w-full px-3 py-2 pr-10 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="sk-..."
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowApiKey(provider.id)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text"
                          >
                            {showApiKeys[provider.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">Base URL</label>
                          <input
                            type="text"
                            value={provider.baseUrl}
                            onChange={(e) => updateLocalProvider(provider.id, { baseUrl: e.target.value })}
                            className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">默认模型</label>
                          <select
                            value={provider.defaultModel}
                            onChange={(e) => updateLocalProvider(provider.id, { defaultModel: e.target.value, modelSelectionMode: 'list' })}
                            className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          >
                            {getModelGroups(provider).map((group) => (
                              <optgroup key={group.label} label={group.label}>
                                {group.models.map((model) => (
                                  <option key={`${group.label}-${model}`} value={model}>{model}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs text-gray-500 dark:text-dark-text-secondary">模型来源</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => validateProviderDefaultModel(provider)}
                              disabled={modelValidateLoading[provider.id]}
                              className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                            >
                              {modelValidateLoading[provider.id] ? '校验中...' : '校验默认模型'}
                            </button>
                            <button
                              onClick={() => refreshProviderModels(provider)}
                              disabled={modelSyncLoading[provider.id]}
                              className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                            >
                              {modelSyncLoading[provider.id] ? '刷新中...' : '刷新模型'}
                            </button>
                          </div>
                        </div>
                        {modelValidateMessage[provider.id] && (
                          <p className={`text-xs ${modelValidateMessage[provider.id]?.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                            {modelValidateMessage[provider.id]?.text}
                          </p>
                        )}
                        {modelSyncError[provider.id] && (
                          <p className="text-xs text-red-500">{modelSyncError[provider.id]}</p>
                        )}
                        {provider.lastModelSyncAt && !modelSyncError[provider.id] && (
                          <p className="text-xs text-gray-400 dark:text-dark-text-secondary">
                            最近同步：{new Date(provider.lastModelSyncAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs text-gray-500 dark:text-dark-text-secondary">自定义模型</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={customModelInputs[provider.id] ?? ''}
                            onChange={(e) => setCustomModelInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                            placeholder="例如：gpt-4.1-mini"
                            className="flex-1 px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => applyCustomModel(provider)}
                            className="text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            使用该模型
                          </button>
                        </div>
                      </div>

                      {provider.enabled && (
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="primaryProvider"
                            checked={localSettings.primaryProvider === provider.id}
                            onChange={() => setLocalSettings({ ...localSettings, primaryProvider: provider.id })}
                            className="text-blue-600"
                          />
                          <label className="text-xs text-gray-600 dark:text-dark-text-secondary">设为主要提供商</label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )})}
            </div>
          </section>

          {/* 模型参数 */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.modelParams}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.temperature}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localSettings.temperature}
                    onChange={(e) => setLocalSettings({ ...localSettings, temperature: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 dark:text-dark-text w-10">{localSettings.temperature}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-dark-text-secondary mt-1">
                  较低值 (0-0.3): 更确定性，适合事实性写作 | 较高值 (0.7-1): 更创造性，适合创意写作
                </p>
              </div>
            </div>
          </section>

          {/* 写作设置 */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">写作设置</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">默认工作流</label>
                <select
                  value={localSettings.defaultWorkflowLevel}
                  onChange={(e) => setLocalSettings({ ...localSettings, defaultWorkflowLevel: e.target.value as 'L1' | 'L2' | 'L3' | 'L4' | 'L5' })}
                  className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="L1">{t.workflowL1}</option>
                  <option value="L2">{t.workflowL2}</option>
                  <option value="L3">{t.workflowL3}</option>
                  <option value="L4">{t.workflowL4}</option>
                  <option value="L5">{t.workflowL5}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.targetWords}</label>
                <input
                  type="number"
                  value={localSettings.targetWordsPerChapter}
                  onChange={(e) => setLocalSettings({ ...localSettings, targetWordsPerChapter: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-2">{t.qualityGoalsTitle}</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.qualityGoalPreset}</label>
                    <select
                      value={localSettings.qualityGoals.humanizationPreset}
                      onChange={(e) => applyQualityPreset(e.target.value as QualityPresetId)}
                      className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {QUALITY_PRESET_TEMPLATES.map((preset) => (
                        <option key={preset.id} value={preset.id}>{t[preset.labelKey]}</option>
                      ))}
                      <option value="custom">{t.qualityPresetCustom}</option>
                    </select>
                  </div>
                  {QUALITY_GOAL_METRIC_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t[field.labelKey]}</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={localSettings.qualityGoals[field.key]}
                        onChange={(e) => {
                          const nextValue = parseInt(e.target.value)
                          setLocalSettings((prev) => ({
                            ...prev,
                            qualityGoals: {
                              ...prev.qualityGoals,
                              [field.key]: nextValue,
                              humanizationPreset: 'custom',
                            },
                          }))
                        }}
                        className="w-full"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.qualityGoalSentenceEntropy}</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={localSettings.qualityGoals.sentenceEntropyTarget}
                      onChange={(e) => setLocalSettings((prev) => ({
                        ...prev,
                        qualityGoals: {
                          ...prev.qualityGoals,
                          sentenceEntropyTarget: parseInt(e.target.value),
                          humanizationPreset: 'custom',
                        },
                      }))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.qualityGoalRhythmVariability}</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={localSettings.qualityGoals.rhythmVariabilityTarget}
                      onChange={(e) => setLocalSettings((prev) => ({
                        ...prev,
                        qualityGoals: {
                          ...prev.qualityGoals,
                          rhythmVariabilityTarget: parseInt(e.target.value),
                          humanizationPreset: 'custom',
                        },
                      }))}
                      className="w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.qualityGoalCustomInstruction}</label>
                    <textarea
                      rows={2}
                      value={localSettings.qualityGoals.customHumanizationInstruction}
                      onChange={(e) => setLocalSettings((prev) => ({
                        ...prev,
                        qualityGoals: {
                          ...prev.qualityGoals,
                          customHumanizationInstruction: e.target.value,
                          humanizationPreset: 'custom',
                        },
                      }))}
                      placeholder={t.qualityGoalCustomInstructionPlaceholder}
                      className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSkillMatch"
                  checked={localSettings.autoSkillMatch}
                  onChange={(e) => setLocalSettings({ ...localSettings, autoSkillMatch: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="autoSkillMatch" className="text-sm text-gray-600 dark:text-dark-text-secondary">
                  {t.autoSkillMatch}
                </label>
              </div>
            </div>
          </section>

          {/* 界面设置 */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.uiSettings}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.theme}</label>
                <select
                  value={localSettings.theme}
                  onChange={(e) => setLocalSettings({ ...localSettings, theme: e.target.value as 'light' | 'dark' | 'system' })}
                  className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="light">{t.themeLight}</option>
                  <option value="dark">{t.themeDark}</option>
                  <option value="system">{t.themeSystem}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.fontSize}</label>
                <select
                  value={localSettings.fontSize}
                  onChange={(e) => setLocalSettings({ ...localSettings, fontSize: e.target.value as 'small' | 'medium' | 'large' })}
                  className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="small">{t.fontSmall}</option>
                  <option value="medium">{t.fontMedium}</option>
                  <option value="large">{t.fontLarge}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.language}</label>
                <select
                  value={localSettings.language}
                  onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value as 'zh' | 'en' })}
                  className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="zh">{t.langChinese}</option>
                  <option value="en">{t.langEnglish}</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
            >
              <RotateCcw size={16} />
              重置默认
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
              title="导出设置"
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
              title="导入设置"
            >
              <Upload size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            {importMessage && (
              <span className={`text-xs ${importMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {importMessage.text}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
