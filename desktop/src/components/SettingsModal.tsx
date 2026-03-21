import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { X, Save, RotateCcw, Eye, EyeOff, Check, AlertCircle, Download, Upload } from 'lucide-react'
import { checkBackendHealth, fetchProviderModels, getGatewayMetrics, listGatewayTools, GatewayMetrics, GatewayTools, getSecrets, BackendConfig, SecretsResponse, SECRET_FIELDS } from '../api/client'
import { useSettingsStore, LLMProvider, QUALITY_GOAL_METRIC_FIELDS, QUALITY_PRESET_TEMPLATES, QualityGoalsSettings, QualityPresetId, ContextType, RetrievalSearchMode, WorkflowBackendMode, SendShortcut } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'
import { useI18n } from '../i18n'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsSectionId = 'backend' | 'workflow' | 'retrieval' | 'templates' | 'models' | 'ui' | 'diagnostics'

type SettingsSection = {
  id: SettingsSectionId
  label: string
}

type BackendSectionKey = keyof Pick<
  BackendConfig,
  'agent' | 'memory' | 'workflow' | 'graph' | 'writing' | 'gateway' | 'backup' | 'token' | 'obsidian' | 'integration'
>

const BACKEND_SECTION_KEYS: BackendSectionKey[] = [
  'agent',
  'memory',
  'workflow',
  'graph',
  'writing',
  'gateway',
  'backup',
  'token',
  'obsidian',
  'integration',
]

const MASKED_SECRET_VALUE = '***MASKED***'

const BACKEND_SECTION_LABEL_KEYS = {
  agent: 'backendConfigSectionAgent',
  memory: 'backendConfigSectionMemory',
  workflow: 'backendConfigSectionWorkflow',
  graph: 'backendConfigSectionGraph',
  writing: 'backendConfigSectionWriting',
  gateway: 'backendConfigSectionGateway',
  backup: 'backendConfigSectionBackup',
  token: 'backendConfigSectionToken',
  obsidian: 'backendConfigSectionObsidian',
  integration: 'backendConfigSectionIntegration',
} as const

function classNames(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ')
}

function formatBackendFieldLabel(field: string) {
  return field.replace(/_/g, ' ')
}

function formatBackendFieldValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

function getBackendFieldValue(config: BackendConfig, path: string): unknown {
  const [section, field] = path.split('.')
  if (!section || !field) {
    return undefined
  }
  const sectionValue = config[section as keyof BackendConfig]
  if (!sectionValue || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) {
    return undefined
  }
  return (sectionValue as Record<string, unknown>)[field]
}

function setBackendFieldValue(config: BackendConfig, path: string, value: unknown): BackendConfig {
  const [section, field] = path.split('.')
  if (!section || !field) {
    return config
  }

  const nextConfig = JSON.parse(JSON.stringify(config)) as BackendConfig
  const sectionValue = nextConfig[section as keyof BackendConfig]
  if (!sectionValue || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) {
    return config
  }

  ;(sectionValue as Record<string, unknown>)[field] = value
  return nextConfig
}

function parseBackendFieldInput(rawValue: string, currentValue: unknown): unknown {
  if (Array.isArray(currentValue)) {
    return rawValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof currentValue === 'number') {
    if (rawValue.trim() === '') {
      return currentValue
    }
    const parsed = Number(rawValue)
    return Number.isFinite(parsed) ? parsed : currentValue
  }
  return rawValue
}

function buildBackendConfigUpdates(
  currentConfig: BackendConfig,
  draftConfig: BackendConfig,
  modifiableFields: string[]
): Record<string, unknown> {
  const updates: Record<string, unknown> = {}

  for (const fieldPath of modifiableFields) {
    if (SECRET_FIELDS.includes(fieldPath)) {
      continue
    }

    const currentValue = getBackendFieldValue(currentConfig, fieldPath)
    const draftValue = getBackendFieldValue(draftConfig, fieldPath)
    if (JSON.stringify(currentValue) !== JSON.stringify(draftValue)) {
      updates[fieldPath] = draftValue
    }
  }

  return updates
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    settings,
    updateSettings,
    updateProvider,
    resetSettings,
    loadBackendConfig,
    updateBackendConfig,
    updateSecrets,
    reloadBackendConfig,
  } = useSettingsStore()
  const { setAllowLlmFallback, setQualityGoals, checkBackend } = useAppStore()
  const [localSettings, setLocalSettings] = useState(settings)
  const [backendConfigDraft, setBackendConfigDraft] = useState<BackendConfig | null>(settings.backendConfig.config)
  const [backendSecrets, setBackendSecrets] = useState<SecretsResponse['secrets']>({})
  const [backendSecretsDraft, setBackendSecretsDraft] = useState<Record<string, string>>({})
  const [backendSecretsLoading, setBackendSecretsLoading] = useState(false)
  const [backendSecretsError, setBackendSecretsError] = useState<string | null>(null)
  const [backendConfigSaving, setBackendConfigSaving] = useState(false)
  const [backendSecretsSaving, setBackendSecretsSaving] = useState(false)
  const [showBackendSecrets, setShowBackendSecrets] = useState<Record<string, boolean>>({})
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

  const sections: SettingsSection[] = [
    { id: 'backend', label: t.backendService },
    { id: 'workflow', label: t.writingSettings },
    { id: 'retrieval', label: t.settingsRetrieval },
    { id: 'templates', label: t.templateLibraryTitle },
    { id: 'models', label: t.llmConfig },
    { id: 'ui', label: t.uiSettings },
    { id: 'diagnostics', label: t.settingsDiagnostics },
  ]

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('workflow')
  const backendConfigState = settings.backendConfig
  const modifiableFieldSet = new Set(backendConfigState.modifiableFields)
  const backendSectionLabels = {
    agent: t.backendConfigSectionAgent,
    memory: t.backendConfigSectionMemory,
    workflow: t.backendConfigSectionWorkflow,
    graph: t.backendConfigSectionGraph,
    writing: t.backendConfigSectionWriting,
    gateway: t.backendConfigSectionGateway,
    backup: t.backendConfigSectionBackup,
    token: t.backendConfigSectionToken,
    obsidian: t.backendConfigSectionObsidian,
    integration: t.backendConfigSectionIntegration,
  } as const

  const backendSyncMessage =
    backendConfigState.syncStatus === 'loading'
      ? t.backendConfigLoading
      : backendConfigState.syncStatus === 'syncing'
        ? t.backendConfigSyncing
        : backendConfigState.syncStatus === 'error'
          ? backendConfigState.error ?? t.settingsUnknownError
          : backendConfigState.lastSync
            ? `${t.backendConfigSyncSuccess} · ${new Date(backendConfigState.lastSync).toLocaleString()}`
            : null

  const hasBackendConfigChanges =
    Boolean(backendConfigState.config) &&
    Boolean(backendConfigDraft) &&
    Object.keys(
      buildBackendConfigUpdates(
        backendConfigState.config as BackendConfig,
        backendConfigDraft as BackendConfig,
        backendConfigState.modifiableFields
      )
    ).length > 0

  const hasBackendSecretChanges = Object.values(backendSecretsDraft).some((value) => {
    const trimmed = value.trim()
    return trimmed.length > 0 && trimmed !== MASKED_SECRET_VALUE
  })

  useEffect(() => {
    if (settings.backendConfig.config) {
      setBackendConfigDraft(settings.backendConfig.config)
    }
  }, [settings.backendConfig.config])

  useEffect(() => {
    setBackendSecretsDraft((prev) => {
      const nextDraft: Record<string, string> = {}
      for (const key of Object.keys(backendSecrets)) {
        nextDraft[key] = prev[key] ?? ''
      }
      return nextDraft
    })
  }, [backendSecrets])

  useEffect(() => {
    if (!isOpen || activeSection !== 'backend') {
      return
    }

    const loadSecrets = async () => {
      setBackendSecretsLoading(true)
      setBackendSecretsError(null)
      try {
        const response = await getSecrets()
        if (response.success && response.data) {
          setBackendSecrets(response.data.secrets)
          return
        }
        setBackendSecretsError(response.error ?? t.settingsUnknownError)
      } catch (err) {
        setBackendSecretsError(err instanceof Error ? err.message : t.settingsUnknownError)
      } finally {
        setBackendSecretsLoading(false)
      }
    }

    if (!backendConfigState.config && backendConfigState.syncStatus === 'idle') {
      void loadBackendConfig()
    }

    void loadSecrets()
  }, [activeSection, backendConfigState.config, backendConfigState.syncStatus, isOpen, loadBackendConfig, t.settingsUnknownError])

  if (!isOpen) return null

  const retrievalModes: Array<{ value: RetrievalSearchMode; label: string }> = [
    { value: 'hybrid', label: t.settingsSearchModeHybrid },
    { value: 'iterative', label: t.settingsSearchModeIterative },
    { value: 'context', label: t.settingsSearchModeContext },
  ]

  const contextTypeOptions: Array<{ value: ContextType; label: string }> = [
    { value: 'world', label: t.settingsContextTypeWorld },
    { value: 'character', label: t.settingsContextTypeCharacter },
    { value: 'plot', label: t.settingsContextTypePlot },
  ]

  const updateNumericRetrievalField = (field: 'minScore' | 'budgetTokens' | 'maxIterations' | 'confidenceThreshold', raw: string) => {
    setLocalSettings((prev) => {
      const trimmed = raw.trim()
      const nextValue = trimmed === '' ? undefined : Number(trimmed)
      return {
        ...prev,
        retrieval: {
          ...prev.retrieval,
          [field]: Number.isFinite(nextValue as number) ? nextValue : undefined,
        },
      }
    })
  }

  const toggleContextType = (type: ContextType, checked: boolean) => {
    setLocalSettings((prev) => {
      const next = checked
        ? Array.from(new Set([...prev.contextTypes, type]))
        : prev.contextTypes.filter((item) => item !== type)
      return {
        ...prev,
        contextTypes: next.length > 0 ? next : ['world', 'character', 'plot'],
      }
    })
  }

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

    if ('__TAURI__' in window) {
      try {
        await invoke('set_gateway_base_override', {
          base:
            localSettings.apiBaseUrl && localSettings.apiBaseUrl.trim()
              ? localSettings.apiBaseUrl.trim()
              : null,
        })
      } catch {
        // ignore override sync failures
      }
    }

    await checkBackend()
    onClose()
  }

  const handleBackendConfigFieldChange = (path: string, rawValue: string, currentValue: unknown) => {
    setBackendConfigDraft((prev) => {
      if (!prev) {
        return prev
      }
      return setBackendFieldValue(prev, path, parseBackendFieldInput(rawValue, currentValue))
    })
  }

  const handleBackendConfigToggle = (path: string, checked: boolean) => {
    setBackendConfigDraft((prev) => {
      if (!prev) {
        return prev
      }
      return setBackendFieldValue(prev, path, checked)
    })
  }

  const handleSaveBackendConfig = async () => {
    if (!backendConfigState.config || !backendConfigDraft) {
      return
    }

    const updates = buildBackendConfigUpdates(
      backendConfigState.config,
      backendConfigDraft,
      backendConfigState.modifiableFields
    )

    if (Object.keys(updates).length === 0) {
      return
    }

    setBackendConfigSaving(true)
    try {
      await updateBackendConfig(updates)
    } finally {
      setBackendConfigSaving(false)
    }
  }

  const handleSaveBackendSecrets = async () => {
    const nextSecrets = Object.entries(backendSecretsDraft).reduce<SecretsResponse['secrets']>((acc, [key, value]) => {
      const trimmed = value.trim()
      if (!trimmed || trimmed === MASKED_SECRET_VALUE) {
        return acc
      }

      const field = backendSecrets[key]
      if (!field) {
        return acc
      }

      acc[key] = {
        ...field,
        configured: true,
        value: trimmed,
      }
      return acc
    }, {})

    if (Object.keys(nextSecrets).length === 0) {
      return
    }

    setBackendSecretsSaving(true)
    setBackendSecretsError(null)
    try {
      await updateSecrets(nextSecrets)
      setBackendSecretsDraft((prev) => {
        const cleared = { ...prev }
        for (const key of Object.keys(nextSecrets)) {
          cleared[key] = ''
        }
        return cleared
      })
      setBackendSecrets((prev) => {
        const updated = { ...prev }
        for (const key of Object.keys(nextSecrets)) {
          const current = updated[key]
          if (current) {
            updated[key] = {
              ...current,
              configured: true,
              value: MASKED_SECRET_VALUE,
            }
          }
        }
        return updated
      })
    } catch (err) {
      setBackendSecretsError(err instanceof Error ? err.message : t.settingsUnknownError)
    } finally {
      setBackendSecretsSaving(false)
    }
  }

  const handleReloadBackendConfig = async () => {
    setBackendSecretsError(null)
    await reloadBackendConfig()
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
      return { ok: false, reason: t.settingsModelNameRequired }
    }
    if (value.length > 120) {
      return { ok: false, reason: t.settingsModelNameTooLong }
    }
    if (/\s/.test(value)) {
      return { ok: false, reason: t.settingsModelNameWhitespace }
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
          ? t.settingsFetchModelsFailedWithReason.replace('{error}', res.error)
          : t.settingsFetchModelsFailed
        setModelSyncError((prev) => ({ ...prev, [provider.id]: reason }))
      }
    } catch {
      setModelSyncError((prev) => ({ ...prev, [provider.id]: t.settingsFetchModelsFailed }))
    } finally {
      setModelSyncLoading((prev) => ({ ...prev, [provider.id]: false }))
    }
  }

  const applyCustomModel = (provider: LLMProvider) => {
    const value = (customModelInputs[provider.id] ?? '').trim()
    const validation = validateCustomModelInput(value)
    if (!validation.ok) {
      setModelSyncError((prev) => ({ ...prev, [provider.id]: validation.reason ?? t.settingsInvalidCustomModel }))
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
      groups.push({ label: t.settingsPresetModels, models: staticModels })
    }
    if (fetchedModels.length > 0) {
      groups.push({ label: t.settingsFetchedModels, models: fetchedModels })
    }
    if (customModels.length > 0) {
      groups.push({ label: t.settingsCustomModels, models: customModels })
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
          [provider.id]: { type: 'error', text: t.settingsDefaultModelValidateFetchFailed },
        }))
        return
      }

      const fetchedModels = data.models
      const defaultModel = provider.defaultModel.trim().toLowerCase()
      const isValid = fetchedModels.some((model) => model.toLowerCase() === defaultModel)

      if (isValid) {
        setModelValidateMessage((prev) => ({
          ...prev,
          [provider.id]: {
            type: 'success',
            text: data.source === 'gateway' ? t.settingsDefaultModelAvailableViaGateway : t.settingsDefaultModelAvailableViaDirect,
          },
        }))
      } else {
        setModelValidateMessage((prev) => ({
          ...prev,
          [provider.id]: { type: 'error', text: t.settingsDefaultModelUnavailable },
        }))
      }
    } catch {
      setModelValidateMessage((prev) => ({
        ...prev,
        [provider.id]: { type: 'error', text: t.settingsDefaultModelValidateFailed },
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
        setDiagnosticsError(t.settingsDiagnosticsFetchFailed)
      }
    } catch {
      setGatewayMetrics(null)
      setGatewayTools(null)
      setDiagnosticsError(t.settingsDiagnosticsFetchFailed)
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
          throw new Error(t.settingsInvalidConfigFile)
        }

        // 合并导入的设置
        setLocalSettings(importData.settings)
        setImportMessage({ type: 'success', text: t.importSuccess })

        // 3秒后清除消息
        setTimeout(() => setImportMessage(null), 3000)
      } catch (err) {
        setImportMessage({ type: 'error', text: `${t.settingsImportFailedPrefix}${err instanceof Error ? err.message : t.settingsUnknownError}` })
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
      <div className="bg-white dark:bg-dark-surface rounded-2xl w-[900px] max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-dark-border">
          <h2 className="text-lg font-semibold dark:text-dark-text">{t.settingsTitle}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors dark:text-dark-text"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex">
          {/* Secondary navigation */}
          <nav className="w-[220px] border-r dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
            <div className="p-3 space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={classNames(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    activeSection === section.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'hover:bg-gray-100 dark:hover:bg-dark-border text-gray-700 dark:text-dark-text'
                  )}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[65vh] space-y-6">
            <div className={activeSection === 'backend' ? 'block' : 'hidden'}>
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.backendService}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.backendUrl}</label>
                      <input
                        type="text"
                        value={localSettings.apiBaseUrl}
                        onChange={(e) => setLocalSettings({ ...localSettings, apiBaseUrl: e.target.value })}
                        className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </section>

                <section className="border dark:border-dark-border rounded-lg p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">{t.backendConfigTitle}</h3>
                      <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{t.backendConfigDescription}</p>
                      {backendSyncMessage && (
                        <div
                          className={classNames(
                            'inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs',
                            backendConfigState.syncStatus === 'error'
                              ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-dark-border dark:text-dark-text-secondary'
                          )}
                        >
                          {backendConfigState.syncStatus === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
                          <span>{backendSyncMessage}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleReloadBackendConfig}
                        disabled={backendConfigState.syncStatus === 'loading' || backendConfigState.syncStatus === 'syncing'}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw size={16} />
                        {t.backendConfigReload}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveBackendConfig()}
                        disabled={!hasBackendConfigChanges || backendConfigSaving || backendConfigState.syncStatus === 'loading' || backendConfigState.syncStatus === 'syncing'}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save size={16} />
                        {t.backendConfigSave}
                      </button>
                    </div>
                  </div>

                  {backendConfigDraft ? (
                    <div className="space-y-4">
                      {BACKEND_SECTION_KEYS.map((sectionKey) => {
                        const sectionValue = backendConfigDraft[sectionKey]
                        if (!sectionValue || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) {
                          return null
                        }

                        const entries = Object.entries(sectionValue as Record<string, unknown>)
                        if (entries.length === 0) {
                          return null
                        }

                        return (
                          <div key={sectionKey} className="border dark:border-dark-border rounded-lg p-4 space-y-3">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-dark-text">
                              {backendSectionLabels[sectionKey]}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {entries.map(([field, value]) => {
                                const fieldPath = `${sectionKey}.${field}`
                                const editable = modifiableFieldSet.has(fieldPath)
                                const inputId = `backend-config-${sectionKey}-${field}`
                                const formattedValue = formatBackendFieldValue(value)

                                if (typeof value === 'boolean') {
                                  return (
                                    <div key={fieldPath} className="border dark:border-dark-border rounded-lg p-3 space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <label htmlFor={inputId} className="text-xs font-medium text-gray-700 dark:text-dark-text">
                                          {formatBackendFieldLabel(field)}
                                        </label>
                                        {!editable && (
                                          <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-dark-border dark:text-dark-text-secondary">
                                            {t.backendConfigReadOnly}
                                          </span>
                                        )}
                                      </div>
                                      <label htmlFor={inputId} className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-secondary">
                                        <input
                                          id={inputId}
                                          type="checkbox"
                                          checked={value}
                                          disabled={!editable}
                                          onChange={(e) => handleBackendConfigToggle(fieldPath, e.target.checked)}
                                          className="rounded"
                                        />
                                        <span>{formatBackendFieldValue(value)}</span>
                                      </label>
                                      {!editable && (
                                        <p className="text-[11px] text-gray-400 dark:text-dark-text-secondary">
                                          {t.backendConfigReadOnlyHint}
                                        </p>
                                      )}
                                    </div>
                                  )
                                }

                                return (
                                  <div key={fieldPath} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <label htmlFor={inputId} className="block text-xs text-gray-500 dark:text-dark-text-secondary">
                                        {formatBackendFieldLabel(field)}
                                      </label>
                                      {!editable && (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-dark-border dark:text-dark-text-secondary">
                                          {t.backendConfigReadOnly}
                                        </span>
                                      )}
                                    </div>
                                    <input
                                      id={inputId}
                                      type={typeof value === 'number' ? 'number' : 'text'}
                                      value={formattedValue}
                                      disabled={!editable}
                                      onChange={(e) => handleBackendConfigFieldChange(fieldPath, e.target.value, value)}
                                      className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                    {!editable && (
                                      <p className="text-[11px] text-gray-400 dark:text-dark-text-secondary">
                                        {t.backendConfigReadOnlyHint}
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.backendConfigNoConfig}</div>
                  )}
                </section>

                <section className="border dark:border-dark-border rounded-lg p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">{t.backendConfigSecretsTitle}</h3>
                      <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{t.backendConfigSecretsDescription}</p>
                      {backendSecretsError && (
                        <div className="inline-flex items-center gap-2 rounded-md bg-red-50 px-2.5 py-1 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                          <AlertCircle size={14} />
                          <span>{backendSecretsError}</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveBackendSecrets()}
                      disabled={!hasBackendSecretChanges || backendSecretsLoading || backendSecretsSaving}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save size={16} />
                      {t.backendConfigSaveSecrets}
                    </button>
                  </div>

                  {backendSecretsLoading ? (
                    <div className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.backendConfigLoading}</div>
                  ) : Object.keys(backendSecrets).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(backendSecrets).map(([key, field]) => {
                        const inputId = `backend-secret-${key.replace(/\./g, '-')}`
                        const visible = Boolean(showBackendSecrets[key])
                        return (
                          <div key={key} className="border dark:border-dark-border rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label htmlFor={inputId} className="text-xs font-medium text-gray-700 dark:text-dark-text">
                                {key}
                              </label>
                              <span className={classNames(
                                'text-[10px] px-2 py-0.5 rounded',
                                field.configured
                                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-500 dark:bg-dark-border dark:text-dark-text-secondary'
                              )}>
                                {field.configured ? t.backendConfigConfigured : t.backendConfigNotConfigured}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                id={inputId}
                                type={visible ? 'text' : 'password'}
                                value={backendSecretsDraft[key] ?? ''}
                                onChange={(e) => setBackendSecretsDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                                placeholder={field.configured ? MASKED_SECRET_VALUE : ''}
                                className="flex-1 px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <button
                                type="button"
                                onClick={() => setShowBackendSecrets((prev) => ({ ...prev, [key]: !prev[key] }))}
                                className="p-2 text-gray-500 hover:bg-gray-100 dark:text-dark-text-secondary dark:hover:bg-dark-border rounded-lg transition-colors"
                                aria-label={visible ? t.backendConfigHideSecret : t.backendConfigShowSecret}
                              >
                                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.backendConfigNoSecrets}</div>
                  )}
                </section>
              </div>
            </div>

            <div className={activeSection === 'workflow' ? 'block' : 'hidden'}>
              <>
                <section>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.writingSettings}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.defaultWorkflow}</label>
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
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.workflowBackendMode}</label>
                      <select
                        value={localSettings.workflowBackendMode}
                        onChange={(e) => setLocalSettings({ ...localSettings, workflowBackendMode: e.target.value as WorkflowBackendMode })}
                        className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="standard">{t.workflowBackendModeStandard}</option>
                        <option value="uiBridge">{t.workflowBackendModeUiBridge}</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.targetWords}</label>
                        <input
                          type="number"
                          value={localSettings.targetWordsPerChapter}
                          onChange={(e) => setLocalSettings({ ...localSettings, targetWordsPerChapter: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
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

                    <div className="border dark:border-dark-border rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-700 dark:text-dark-text mb-2">{t.qualityGoalsTitle}</div>
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
                  </div>
                </section>
              </>
            </div>

            <div className={activeSection === 'retrieval' ? 'block' : 'hidden'}>
              <section>
                <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.settingsRetrieval}</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="retrievalEnabled"
                      checked={localSettings.retrieval.enabled}
                      onChange={(e) => setLocalSettings((prev) => ({
                        ...prev,
                        retrieval: {
                          ...prev.retrieval,
                          enabled: e.target.checked,
                        },
                      }))}
                      className="rounded"
                    />
                    <label htmlFor="retrievalEnabled" className="text-sm text-gray-600 dark:text-dark-text-secondary">
                      {t.settingsEnableKnowledgeRetrieval}
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsSearchMode}</label>
                      <select
                        value={localSettings.retrieval.searchMode}
                        onChange={(e) => setLocalSettings((prev) => ({
                          ...prev,
                          retrieval: {
                            ...prev.retrieval,
                            searchMode: e.target.value as RetrievalSearchMode,
                          },
                        }))}
                        className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {retrievalModes.map((mode) => (
                          <option key={mode.value} value={mode.value}>{mode.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalProfile}</label>
                      <input
                        type="text"
                        value={localSettings.retrieval.profile}
                        onChange={(e) => setLocalSettings((prev) => ({
                          ...prev,
                          retrieval: {
                            ...prev.retrieval,
                            profile: e.target.value,
                          },
                        }))}
                        placeholder={t.settingsRetrievalProfilePlaceholder}
                        className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalMinScore}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={localSettings.retrieval.minScore ?? ''}
                        onChange={(e) => updateNumericRetrievalField('minScore', e.target.value)}
                        className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalBudgetTokens}</label>
                      <input
                        type="number"
                        value={localSettings.retrieval.budgetTokens ?? ''}
                        onChange={(e) => updateNumericRetrievalField('budgetTokens', e.target.value)}
                        className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalMaxIterations}</label>
                      <input
                        type="number"
                        min="1"
                        value={localSettings.retrieval.maxIterations ?? ''}
                        onChange={(e) => updateNumericRetrievalField('maxIterations', e.target.value)}
                        className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalConfidenceThreshold}</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={localSettings.retrieval.confidenceThreshold ?? ''}
                        onChange={(e) => updateNumericRetrievalField('confidenceThreshold', e.target.value)}
                        className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="retrievalRerank"
                      checked={localSettings.retrieval.rerank}
                      onChange={(e) => setLocalSettings((prev) => ({
                        ...prev,
                        retrieval: {
                          ...prev.retrieval,
                          rerank: e.target.checked,
                        },
                      }))}
                      className="rounded"
                    />
                    <label htmlFor="retrievalRerank" className="text-sm text-gray-600 dark:text-dark-text-secondary">
                      {t.settingsEnableRerank}
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-2">{t.settingsAgentContextTypes}</label>
                    <div className="flex flex-wrap gap-4">
                      {contextTypeOptions.map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-secondary">
                          <input
                            type="checkbox"
                            checked={localSettings.contextTypes.includes(option.value)}
                            onChange={(e) => toggleContextType(option.value, e.target.checked)}
                            className="rounded"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className={activeSection === 'templates' ? 'block' : 'hidden'}>
              <section>
                <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.templateLibraryTitle}</h3>
                <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{t.templateLibraryTitle}</p>
              </section>
            </div>

            <div className={activeSection === 'models' ? 'block' : 'hidden'}>
              <>
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">{t.llmConfig}</h3>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={localSettings.allowLlmFallback}
                          onChange={(e) => setLocalSettings({ ...localSettings, allowLlmFallback: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-600 dark:text-dark-text-secondary">{t.settingsAllowFallback}</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={localSettings.useMultiModel}
                          onChange={(e) => setLocalSettings({ ...localSettings, useMultiModel: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-600 dark:text-dark-text-secondary">{t.multiModel}</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={localSettings.detectionEvasionGuardEnabled}
                          onChange={(e) => setLocalSettings({ ...localSettings, detectionEvasionGuardEnabled: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-600 dark:text-dark-text-secondary">{t.settingsDetectionGuard}</span>
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
                      <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalProviderModel}</label>
                      <input
                        type="text"
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        placeholder={t.settingsRetrievalSearchPlaceholder}
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
                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">{t.primary}</span>
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
                                {testingProvider === provider.id ? t.testing : t.testConnection}
                              </button>
                            </div>
                          </div>

                          {provider.enabled && (
                            <div className="space-y-3 ml-6">
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.apiKey}</label>
                                <div className="relative">
                                  <input
                                    type={showApiKeys[provider.id] ? 'text' : 'password'}
                                    value={provider.apiKey}
                                    onChange={(e) => updateLocalProvider(provider.id, { apiKey: e.target.value })}
                                    className="w-full px-3 py-2 pr-10 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={t.settingsApiKeyPlaceholder}
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
                                  <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.baseUrl}</label>
                                  <input
                                    type="text"
                                    value={provider.baseUrl}
                                    onChange={(e) => updateLocalProvider(provider.id, { baseUrl: e.target.value })}
                                    className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.defaultModel}</label>
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
                                  <label className="block text-xs text-gray-500 dark:text-dark-text-secondary">{t.settingsModelSource}</label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => validateProviderDefaultModel(provider)}
                                      disabled={modelValidateLoading[provider.id]}
                                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                                    >
                                      {modelValidateLoading[provider.id] ? t.settingsValidatingModel : t.settingsValidateDefaultModel}
                                    </button>
                                    <button
                                      onClick={() => refreshProviderModels(provider)}
                                      disabled={modelSyncLoading[provider.id]}
                                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                                    >
                                      {modelSyncLoading[provider.id] ? t.settingsRefreshingModels : t.settingsRefreshModels}
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
                                    {t.settingsLastSync.replace('{value}', new Date(provider.lastModelSyncAt).toLocaleString())}
                                  </p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <label className="block text-xs text-gray-500 dark:text-dark-text-secondary">{t.settingsCustomModel}</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={customModelInputs[provider.id] ?? ''}
                                    onChange={(e) => setCustomModelInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                                    placeholder={t.settingsCustomModelPlaceholder}
                                    className="flex-1 px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => applyCustomModel(provider)}
                                    className="text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    {t.settingsUseThisModel}
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
                                  <label className="text-xs text-gray-600 dark:text-dark-text-secondary">{t.setPrimary}</label>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              </>
            </div>

            <div className={activeSection === 'ui' ? 'block' : 'hidden'}>
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
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.sendShortcutLabel}</label>
                    <select
                      value={localSettings.sendShortcut}
                      onChange={(e) => setLocalSettings({ ...localSettings, sendShortcut: e.target.value as SendShortcut })}
                      className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="enter">{t.sendShortcutEnter}</option>
                      <option value="ctrlEnter">{t.sendShortcutCtrlEnter}</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>

            <div className={activeSection === 'diagnostics' ? 'block' : 'hidden'}>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">{t.settingsDiagnostics}</h3>
                  <button
                    onClick={refreshDiagnostics}
                    disabled={diagnosticsLoading}
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-50 dark:text-dark-text"
                  >
                    {diagnosticsLoading ? t.mcpRefreshing : t.settingsRefreshDiagnostics}
                  </button>
                </div>

                {diagnosticsError && (
                  <p className="text-xs text-red-500 mb-2">{diagnosticsError}</p>
                )}

                <div className="space-y-3">
                  <div className="border dark:border-dark-border rounded-lg p-3">
                    <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">{t.settingsGatewayMetrics}</div>
                    {gatewayMetrics ? (
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-dark-text">
                        <div>{t.mcpRequestsTotal.replace('{value}', String(gatewayMetrics.requests_total))}</div>
                        <div>{t.mcpRequestsFailed.replace('{value}', String(gatewayMetrics.requests_failed_total))}</div>
                        <div>{t.mcpLatencyAvg.replace('{value}', String(gatewayMetrics.latency_ms_avg))}</div>
                        <div>{t.mcpLatencyMax.replace('{value}', String(gatewayMetrics.latency_ms_max))}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 dark:text-dark-text-secondary">{t.settingsNoMetricsData}</div>
                    )}
                  </div>

                  <div className="border dark:border-dark-border rounded-lg p-3">
                    <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">{t.settingsToolList}</div>
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
                      <div className="text-xs text-gray-400 dark:text-dark-text-secondary">{t.settingsNoToolsData}</div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
            >
              <RotateCcw size={16} />
              {t.resetDefault}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
              title={t.exportSettings}
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
              title={t.importSettings}
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
              {t.cancel}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              {t.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
