import { useEffect, useRef, useState } from 'react'
import { X, Save, RotateCcw, Eye, EyeOff, Check, AlertCircle, Download, Upload, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import type { BackendConfig } from '../api/config'
import { isTauriRuntime, syncGatewayBaseOverride } from '../api/transport'
import { getStyleProfile } from '../api/m10-apis'
import { useSettingsStore, QUALITY_GOAL_METRIC_FIELDS, QUALITY_PRESET_TEMPLATES, QualityGoalsSettings, QualityPresetId, ContextType, RetrievalSearchMode, WorkflowBackendMode, SendShortcut } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'
import { useCheckBackend } from '../stores/selectors'
import { useI18n, syncI18nLanguage } from '../i18n'
import { MASKED_SECRET_VALUE, formatBackendFieldValue, useSettingsBackendConfig } from '../hooks/useSettingsBackendConfig'
import { useSettingsProviderModels } from '../hooks/useSettingsProviderModels'
import { useSettingsDiagnostics } from '../hooks/useSettingsDiagnostics'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import type { SettingsSectionId } from '../hooks/useAppPanelOrchestration'
import { TemplateManagerPanel } from './TemplateManagerPanel'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  requestedSection?: SettingsSectionId
  onOpenDetailedDiagnostics?: () => void
}

type SettingsSection = {
  id: SettingsSectionId
  label: string
}

type BackendSectionKey = keyof Pick<
  BackendConfig,
  'agent' | 'memory' | 'workflow' | 'graph' | 'writing' | 'gateway' | 'backup' | 'token' | 'obsidian' | 'integration'
>

type SettingsSaveStageKey = 'persisted' | 'runtime' | 'validation'
type SettingsSaveStageStatus = 'success' | 'failed' | 'skipped'

interface SettingsSaveStageResult {
  status: SettingsSaveStageStatus
  detail?: string
}

interface SettingsSaveResult {
  status: 'success' | 'partial' | 'failed'
  stages: Record<SettingsSaveStageKey, SettingsSaveStageResult>
}

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

function classNames(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ')
}

function formatBackendFieldLabel(field: string) {
  return field.replace(/_/g, ' ')
}

export function SettingsModal({
  isOpen,
  onClose,
  requestedSection = 'workflow',
  onOpenDetailedDiagnostics,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const backdropPointerDownRef = useRef(false)
  const {
    settings,
    updateSettings,
    updateProvider,
    resetSettings,
  } = useSettingsStore()
  const checkBackend = useCheckBackend()
  const [localSettings, setLocalSettings] = useState(settings)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const { t, translate } = useI18n()

  const sections: SettingsSection[] = [
    { id: 'workflow', label: t.writingSettings },
    { id: 'retrieval', label: t.settingsRetrieval },
    { id: 'templates', label: t.templateLibraryTitle },
    { id: 'models', label: t.llmConfig },
    { id: 'style', label: t.styleProfileTitle },
    { id: 'ui', label: t.uiSettings },
    { id: 'backend', label: t.backendService },
    { id: 'diagnostics', label: t.settingsDiagnostics },
  ]
  const primarySections = sections.filter((section) => section.id !== 'backend' && section.id !== 'diagnostics')
  const supportSections = sections.filter((section) => section.id === 'backend' || section.id === 'diagnostics')
  const isAdvancedSection = (sectionId: SettingsSectionId) => sectionId === 'backend' || sectionId === 'diagnostics'

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('workflow')
  const [styleProfileData, setStyleProfileData] = useState<Record<string, unknown> | null>(null)
  const [styleProfileLoading, setStyleProfileLoading] = useState(false)
  const [styleProfileError, setStyleProfileError] = useState<string | null>(null)
  const [showAdvancedSupport, setShowAdvancedSupport] = useState(false)
  const {
    backendConfigState,
    backendConfigDraft,
    backendSecrets,
    backendSecretsDraft,
    backendSecretsLoading,
    backendSecretsError,
    backendConfigSaving,
    backendSecretsSaving,
    showBackendSecrets,
    hasBackendConfigChanges,
    hasBackendSecretChanges,
    handleBackendConfigFieldChange,
    handleBackendConfigToggle,
    handleSaveBackendConfig,
    handleSaveBackendSecrets,
    handleReloadBackendConfig,
    updateBackendSecretDraft,
    toggleShowBackendSecret,
  } = useSettingsBackendConfig({
    isOpen,
    isActive: activeSection === 'backend',
    settingsUnknownError: t.settingsUnknownError,
  })
  const modifiableFieldSet = new Set(backendConfigState.modifiableFields)
  const {
    showApiKeys,
    testingProvider,
    testResults,
    modelSyncLoading,
    modelSyncError,
    customModelInputs,
    providerSearch,
    modelValidateLoading,
    modelValidateMessage,
    filteredProviders,
    updateLocalProvider,
    toggleShowApiKey,
    refreshProviderModels,
    applyCustomModel,
    getModelGroups,
    validateProviderDefaultModel,
    testConnection,
    setCustomModelInputs,
    setProviderSearch,
  } = useSettingsProviderModels({
    llmProviders: localSettings.llmProviders,
    onProviderChange: (providerId, updates) => {
      setLocalSettings((prev) => ({
        ...prev,
        llmProviders: prev.llmProviders.map((provider) => (
          provider.id === providerId ? { ...provider, ...updates } : provider
        )),
      }))
    },
    texts: {
      settingsModelNameRequired: t.settingsModelNameRequired,
      settingsModelNameTooLong: t.settingsModelNameTooLong,
      settingsModelNameWhitespace: t.settingsModelNameWhitespace,
      settingsInvalidCustomModel: t.settingsInvalidCustomModel,
      settingsFetchModelsFailedWithReason: t.settingsFetchModelsFailedWithReason,
      settingsFetchModelsFailed: t.settingsFetchModelsFailed,
      settingsPresetModels: t.settingsPresetModels,
      settingsFetchedModels: t.settingsFetchedModels,
      settingsCustomModels: t.settingsCustomModels,
      settingsDefaultModelValidateFetchFailed: t.settingsDefaultModelValidateFetchFailed,
      settingsDefaultModelAvailableViaGateway: t.settingsDefaultModelAvailableViaGateway,
      settingsDefaultModelAvailableViaDirect: t.settingsDefaultModelAvailableViaDirect,
      settingsDefaultModelUnavailable: t.settingsDefaultModelUnavailable,
      settingsDefaultModelValidateFailed: t.settingsDefaultModelValidateFailed,
    },
  })
  const {
    diagnosticsLoading,
    diagnosticsError,
    refreshDiagnostics,
  } = useSettingsDiagnostics({
    settingsDiagnosticsFetchFailed: t.settingsDiagnosticsFetchFailed,
  })
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

  const getSaveStageLabel = (stage: SettingsSaveStageKey) => {
    if (stage === 'persisted') return t.settingsSaveStagePersisted
    if (stage === 'runtime') return t.settingsSaveStageRuntime
    return t.settingsSaveStageValidation
  }

  const getSaveStageSummary = (result: SettingsSaveResult) => (
    (Object.entries(result.stages) as Array<[SettingsSaveStageKey, SettingsSaveStageResult]>)
      .filter(([, stage]) => stage.status === 'failed')
      .map(([stage]) => getSaveStageLabel(stage))
      .join(' / ')
  )

  const buildSaveMessage = (result: SettingsSaveResult) => {
    const stages = getSaveStageSummary(result)
    if (result.status === 'success') {
      return {
        type: 'success' as const,
        text: t.settingsSaveSuccess,
      }
    }
    if (result.status === 'partial') {
      return {
        type: 'warning' as const,
        text: translate('settingsSavePartialFailure', { stages }),
      }
    }
    return {
      type: 'error' as const,
      text: translate('settingsSaveFailed', { stages }),
    }
  }

  const focusFailedSaveStage = (result: SettingsSaveResult) => {
    if (result.stages.validation.status === 'failed') {
      setShowAdvancedSupport(true)
      setActiveSection('diagnostics')
      return
    }
    if (result.stages.runtime.status === 'failed') {
      setShowAdvancedSupport(true)
      setActiveSection('backend')
    }
  }

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setLocalSettings(settings)
      setSaveMessage(null)
    }
    wasOpenRef.current = isOpen
  }, [isOpen, settings])

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
    isActive: isOpen,
    initialFocusRef: headingRef,
  })

  useEffect(() => {
    if (!isOpen) return
    setActiveSection(requestedSection)
    setShowAdvancedSupport(isAdvancedSection(requestedSection))
  }, [isOpen, requestedSection])

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
    setSavingSettings(true)
    setSaveMessage(null)

    const result: SettingsSaveResult = {
      status: 'success',
      stages: {
        persisted: { status: 'success' },
        runtime: { status: 'skipped' },
        validation: { status: 'skipped' },
      },
    }

    try {
      try {
        updateSettings(localSettings)
        localSettings.llmProviders.forEach((provider) => {
          updateProvider(provider.id, provider)
        })
      } catch (error) {
        result.stages.persisted = {
          status: 'failed',
          detail: error instanceof Error ? error.message : t.settingsUnknownError,
        }
        result.status = 'failed'
        setSaveMessage(buildSaveMessage(result))
        return
      }

      if (isTauriRuntime()) {
        try {
          await syncGatewayBaseOverride(
            localSettings.apiBaseUrl && localSettings.apiBaseUrl.trim()
              ? localSettings.apiBaseUrl.trim()
              : null,
          )
          result.stages.runtime = { status: 'success' }
        } catch (error) {
          result.stages.runtime = {
            status: 'failed',
            detail: error instanceof Error ? error.message : t.settingsUnknownError,
          }
        }
      }

      await checkBackend()
      result.stages.validation = useAppStore.getState().backendStatus
        ? { status: 'success' }
        : { status: 'failed', detail: t.settingsSaveValidationFailed }

      const hasFailedStage = Object.values(result.stages).some((stage) => stage.status === 'failed')
      if (hasFailedStage) {
        result.status = result.stages.persisted.status === 'failed' ? 'failed' : 'partial'
        setSaveMessage(buildSaveMessage(result))
        focusFailedSaveStage(result)
        return
      }

      onClose()
    } finally {
      setSavingSettings(false)
    }
  }

  const handleReset = () => {
    resetSettings()
    const nextSettings = useSettingsStore.getState().settings
    setLocalSettings(nextSettings)
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

        // 合并导入的设�?
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

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    backdropPointerDownRef.current = event.target === event.currentTarget
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!backdropPointerDownRef.current || event.target !== event.currentTarget) {
      backdropPointerDownRef.current = false
      return
    }

    backdropPointerDownRef.current = false
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="bg-white dark:bg-dark-bg rounded-2xl w-full max-w-5xl h-[85vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-dark-border flex flex-col transform transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border bg-slate-50 dark:bg-dark-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shadow-sm">
              <Settings className="text-white" size={18} />
            </div>
            <h2
              ref={headingRef}
              id="settings-modal-title"
              tabIndex={-1}
              className="text-lg font-bold text-gray-800 dark:text-dark-text tracking-wide"
            >
              {t.settingsTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.settingsClose}
            title={t.settingsClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-surface2 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Secondary navigation */}
          <nav className="w-60 border-r border-gray-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg overflow-y-auto custom-scrollbar shrink-0">
            <div className="p-4 space-y-1">
              {primarySections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={classNames(
                    'w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]',
                    activeSection === section.id
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'hover:bg-gray-100 dark:hover:bg-dark-surface2 text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text'
                  )}
                >
                  {section.label}
                </button>
              ))}

              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-dark-border">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSupport((prev) => !prev)}
                  className={classNames(
                    'w-full rounded-xl border px-4 py-3 text-left transition-all',
                    showAdvancedSupport || isAdvancedSection(activeSection)
                      ? 'border-gray-300 bg-white text-gray-800 dark:border-dark-border2 dark:bg-dark-surface dark:text-dark-text'
                      : 'border-transparent text-gray-600 hover:bg-gray-100 dark:text-dark-text-secondary dark:hover:bg-dark-surface2',
                  )}
                  aria-expanded={showAdvancedSupport}
                  aria-label={t.settingsAdvancedSupport}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{t.settingsAdvancedSupport}</div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                        {t.settingsAdvancedSupportHint}
                      </p>
                    </div>
                    {showAdvancedSupport ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                {showAdvancedSupport && (
                  <div className="mt-2 space-y-1 pl-2">
                    {supportSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={classNames(
                          'w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]',
                          activeSection === section.id
                            ? 'bg-primary-600 text-white shadow-md'
                            : 'hover:bg-gray-100 dark:hover:bg-dark-surface2 text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text',
                        )}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-8 bg-white dark:bg-dark-bg">
            <div className={activeSection === 'backend' ? 'block' : 'hidden'}>
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text mb-4 uppercase tracking-wider">{t.backendService}</h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="settings-backend-url" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.backendUrl}</label>
                      <input
                        id="settings-backend-url"
                        name="settings-backend-url"
                        type="text"
                        value={localSettings.apiBaseUrl}
                        onChange={(e) => setLocalSettings({ ...localSettings, apiBaseUrl: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
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
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-500 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

                        const entries = Object.entries(sectionValue as unknown as Record<string, unknown>)
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
            data-testid={inputId}
                                      id={inputId}
                                      type={typeof value === 'number' ? 'number' : 'text'}
                                      value={formattedValue}
                                      disabled={!editable}
                                      onChange={(e) => handleBackendConfigFieldChange(fieldPath, e.target.value, value)}
                                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-xl hover:bg-primary-500 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                                onChange={(e) => updateBackendSecretDraft(key, e.target.value)}
                                placeholder={field.configured ? MASKED_SECRET_VALUE : ''}
                                className="flex-1 px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                              />
                              <button
                                type="button"
                                onClick={() => toggleShowBackendSecret(key)}
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
                  <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text mb-4 uppercase tracking-wider">{t.writingSettings}</h3>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="settings-default-workflow" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.defaultWorkflow}</label>
                      <select
                        id="settings-default-workflow"
                        name="settings-default-workflow"
                        value={localSettings.defaultWorkflowLevel}
                        onChange={(e) => setLocalSettings({ ...localSettings, defaultWorkflowLevel: e.target.value as 'L1' | 'L2' | 'L3' | 'L4' | 'L5' })}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                      >
                        <option value="L1">{t.workflowL1}</option>
                        <option value="L2">{t.workflowL2}</option>
                        <option value="L3">{t.workflowL3}</option>
                        <option value="L4">{t.workflowL4}</option>
                        <option value="L5">{t.workflowL5}</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="settings-workflow-backend-mode" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.workflowBackendMode}</label>
                      <select
                        id="settings-workflow-backend-mode"
                        name="settings-workflow-backend-mode"
                        value={localSettings.workflowBackendMode}
                        onChange={(e) => setLocalSettings({ ...localSettings, workflowBackendMode: e.target.value as WorkflowBackendMode })}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                      >
                        <option value="standard">{t.workflowBackendModeStandard}</option>
                        <option value="uiBridge">{t.workflowBackendModeUiBridge}</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="settings-target-words-per-chapter" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.targetWords}</label>
                        <input
                          id="settings-target-words-per-chapter"
                          name="settings-target-words-per-chapter"
                          type="number"
                          value={localSettings.targetWordsPerChapter}
                          onChange={(e) => setLocalSettings({ ...localSettings, targetWordsPerChapter: parseInt(e.target.value) })}
                          className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
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
                          <label htmlFor="settings-quality-goal-preset" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.qualityGoalPreset}</label>
                          <select
                            id="settings-quality-goal-preset"
                            name="settings-quality-goal-preset"
                            value={localSettings.qualityGoals.humanizationPreset}
                            onChange={(e) => applyQualityPreset(e.target.value as QualityPresetId)}
                            className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                          >
                            {QUALITY_PRESET_TEMPLATES.map((preset) => (
                              <option key={preset.id} value={preset.id}>{t[preset.labelKey]}</option>
                            ))}
                            <option value="custom">{t.qualityPresetCustom}</option>
                          </select>
                        </div>
                        {QUALITY_GOAL_METRIC_FIELDS.map((field) => {
                          const inputId = `settings-quality-${field.key}`

                          return (
                            <div key={field.key}>
                              <label htmlFor={inputId} className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t[field.labelKey]}</label>
                              <input
                                id={inputId}
                                name={inputId}
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
                          )
                        })}
                        <div>
                          <label htmlFor="settings-quality-sentence-entropy-target" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.qualityGoalSentenceEntropy}</label>
                          <input
                            id="settings-quality-sentence-entropy-target"
                            name="settings-quality-sentence-entropy-target"
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
                          <label htmlFor="settings-quality-rhythm-variability-target" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.qualityGoalRhythmVariability}</label>
                          <input
                            id="settings-quality-rhythm-variability-target"
                            name="settings-quality-rhythm-variability-target"
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
                          <label htmlFor="settings-quality-custom-humanization-instruction" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.qualityGoalCustomInstruction}</label>
                          <textarea
                            id="settings-quality-custom-humanization-instruction"
                            name="settings-quality-custom-humanization-instruction"
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
                            className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
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
                <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text mb-4 uppercase tracking-wider">{t.settingsRetrieval}</h3>
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
                      <label htmlFor="settings-retrieval-search-mode" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsSearchMode}</label>
                      <select
                        id="settings-retrieval-search-mode"
                        name="settings-retrieval-search-mode"
                        value={localSettings.retrieval.searchMode}
                        onChange={(e) => setLocalSettings((prev) => ({
                          ...prev,
                          retrieval: {
                            ...prev.retrieval,
                            searchMode: e.target.value as RetrievalSearchMode,
                          },
                        }))}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                      >
                        {retrievalModes.map((mode) => (
                          <option key={mode.value} value={mode.value}>{mode.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="settings-retrieval-profile" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalProfile}</label>
                      <input
                        id="settings-retrieval-profile"
                        name="settings-retrieval-profile"
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
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-retrieval-min-score" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalMinScore}</label>
                      <input
                        id="settings-retrieval-min-score"
                        name="settings-retrieval-min-score"
                        type="number"
                        step="0.01"
                        value={localSettings.retrieval.minScore ?? ''}
                        onChange={(e) => updateNumericRetrievalField('minScore', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-retrieval-budget-tokens" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalBudgetTokens}</label>
                      <input
                        id="settings-retrieval-budget-tokens"
                        name="settings-retrieval-budget-tokens"
                        type="number"
                        value={localSettings.retrieval.budgetTokens ?? ''}
                        onChange={(e) => updateNumericRetrievalField('budgetTokens', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-retrieval-max-iterations" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalMaxIterations}</label>
                      <input
                        id="settings-retrieval-max-iterations"
                        name="settings-retrieval-max-iterations"
                        type="number"
                        min="1"
                        value={localSettings.retrieval.maxIterations ?? ''}
                        onChange={(e) => updateNumericRetrievalField('maxIterations', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="settings-retrieval-confidence-threshold" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalConfidenceThreshold}</label>
                      <input
                        id="settings-retrieval-confidence-threshold"
                        name="settings-retrieval-confidence-threshold"
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={localSettings.retrieval.confidenceThreshold ?? ''}
                        onChange={(e) => updateNumericRetrievalField('confidenceThreshold', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
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
                      {contextTypeOptions.map((option) => {
                        const inputId = `settings-context-type-${option.value}`

                        return (
                          <label key={option.value} htmlFor={inputId} className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-secondary">
                            <input
                              id={inputId}
                              name={inputId}
                              type="checkbox"
                              checked={localSettings.contextTypes.includes(option.value)}
                              onChange={(e) => toggleContextType(option.value, e.target.checked)}
                              className="rounded"
                            />
                            <span>{option.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className={activeSection === 'templates' ? 'block' : 'hidden'}>
              <section>
                <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text mb-4 uppercase tracking-wider">{t.templateLibraryTitle}</h3>
                <TemplateManagerPanel />
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
                          id="settings-allow-llm-fallback"
                          name="settings-allow-llm-fallback"
                          type="checkbox"
                          checked={localSettings.allowLlmFallback}
                          onChange={(e) => setLocalSettings({ ...localSettings, allowLlmFallback: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-600 dark:text-dark-text-secondary">{t.settingsAllowFallback}</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          id="settings-use-multi-model"
                          name="settings-use-multi-model"
                          type="checkbox"
                          checked={localSettings.useMultiModel}
                          onChange={(e) => setLocalSettings({ ...localSettings, useMultiModel: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-600 dark:text-dark-text-secondary">{t.multiModel}</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          id="settings-detection-evasion-guard"
                          name="settings-detection-evasion-guard"
                          type="checkbox"
                          checked={localSettings.detectionEvasionGuardEnabled}
                          onChange={(e) => setLocalSettings({ ...localSettings, detectionEvasionGuardEnabled: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-600 dark:text-dark-text-secondary">{t.settingsDetectionGuard}</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          id="settings-writing-helper-legacy-polish"
                          name="settings-writing-helper-legacy-polish"
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
                      <label htmlFor="settings-provider-search" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.settingsRetrievalProviderModel}</label>
                      <input
                        id="settings-provider-search"
                        name="settings-provider-search"
                        type="text"
                        value={providerSearch}
                        onChange={(e) => setProviderSearch(e.target.value)}
                        placeholder={t.settingsRetrievalSearchPlaceholder}
                        className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm text-sm"
                      />
                    </div>

                    {filteredProviders.map((provider) => {
                      const providerEnabledId = `settings-provider-${provider.id}-enabled`
                      const providerApiKeyId = `settings-provider-${provider.id}-api-key`
                      const providerBaseUrlId = `settings-provider-${provider.id}-base-url`
                      const providerDefaultModelId = `settings-provider-${provider.id}-default-model`
                      const providerCustomModelId = `settings-provider-${provider.id}-custom-model`
                      const providerPrimaryId = `settings-provider-${provider.id}-primary`

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
                                id={providerEnabledId}
                                name={providerEnabledId}
                                type="checkbox"
                                checked={provider.enabled}
                                onChange={(e) => updateLocalProvider(provider.id, { enabled: e.target.checked })}
                                className="rounded"
                              />
                              <label htmlFor={providerEnabledId} className="font-medium text-gray-800 dark:text-dark-text">{provider.name}</label>
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
                                className="text-xs px-2 py-1 text-xs px-3 py-1.5 font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-all shadow-sm active:scale-95"
                              >
                                {testingProvider === provider.id ? t.testing : t.testConnection}
                              </button>
                            </div>
                          </div>

                          {provider.enabled && (
                            <div className="space-y-3 ml-6">
                              <div>
                                <label htmlFor={providerApiKeyId} className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.apiKey}</label>
                                <div className="relative">
                                  <input
                                    id={providerApiKeyId}
                                    name={providerApiKeyId}
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
                                  <label htmlFor={providerBaseUrlId} className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.baseUrl}</label>
                                  <input
                                    id={providerBaseUrlId}
                                    name={providerBaseUrlId}
                                    type="text"
                                    value={provider.baseUrl}
                                    onChange={(e) => updateLocalProvider(provider.id, { baseUrl: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm text-sm"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={providerDefaultModelId} className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.defaultModel}</label>
                                  <select
                                    id={providerDefaultModelId}
                                    name={providerDefaultModelId}
                                    value={provider.defaultModel}
                                    onChange={(e) => updateLocalProvider(provider.id, { defaultModel: e.target.value, modelSelectionMode: 'list' })}
                                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm text-sm"
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
                                      className="text-xs px-2 py-1 text-xs px-3 py-1.5 font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-all shadow-sm active:scale-95"
                                    >
                                      {modelValidateLoading[provider.id] ? t.settingsValidatingModel : t.settingsValidateDefaultModel}
                                    </button>
                                    <button
                                      onClick={() => refreshProviderModels(provider)}
                                      disabled={modelSyncLoading[provider.id]}
                                      className="text-xs px-2 py-1 text-xs px-3 py-1.5 font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-all shadow-sm active:scale-95"
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
                                <label htmlFor={providerCustomModelId} className="block text-xs text-gray-500 dark:text-dark-text-secondary">{t.settingsCustomModel}</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    id={providerCustomModelId}
                                    name={providerCustomModelId}
                                    type="text"
                                    value={customModelInputs[provider.id] ?? ''}
                                    onChange={(e) => setCustomModelInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                                    placeholder={t.settingsCustomModelPlaceholder}
                                    className="flex-1 px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm text-sm"
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
                                    id={providerPrimaryId}
                                    type="radio"
                                    name="primaryProvider"
                                    value={provider.id}
                                    checked={localSettings.primaryProvider === provider.id}
                                    onChange={() => setLocalSettings({ ...localSettings, primaryProvider: provider.id })}
                                    className="text-blue-600"
                                  />
                                  <label htmlFor={providerPrimaryId} className="text-xs text-gray-600 dark:text-dark-text-secondary">{t.setPrimary}</label>
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

            <div className={activeSection === 'style' ? 'block' : 'hidden'}>
              <section>
                <h3 className="text-sm font-semibold mb-4">{t.styleProfileTitle}</h3>
                <div className="space-y-3">
                  {!useAppStore.getState().currentProjectId ? (
                    <p className="text-xs text-gray-500 dark:text-dark-text-muted">打开一个项目后，即可提取和查看该项目的写作风格档案。</p>
                  ) : (
                  <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const projectId = useAppStore.getState().currentProjectId || ''
                        if (!projectId) return
                        setStyleProfileLoading(true)
                        setStyleProfileError(null)
                        void getStyleProfile(projectId)
                          .then((res) => {
                            if (res.success && res.data) {
                              setStyleProfileData(res.data)
                            } else {
                              setStyleProfileError(t.styleProfileNotFound)
                            }
                          })
                          .catch(() => setStyleProfileError(t.styleProfileNotFound))
                          .finally(() => setStyleProfileLoading(false))
                      }}
                      disabled={styleProfileLoading}
                      className="px-3 py-1.5 text-xs bg-primary-cta text-white rounded hover:opacity-90 disabled:opacity-50"
                    >
                      {styleProfileLoading ? t.styleProfileExtracting : t.styleProfileExtract}
                    </button>
                  </div>
                  {styleProfileError && (
                    <p className="text-xs text-danger-500">{styleProfileError}</p>
                  )}
                  {styleProfileData && (
                    <div className="space-y-2 bg-dark-card rounded p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-xs">
                          <span className="text-dark-text-muted">{t.styleProfileAvgSentenceLen}:</span>
                          <span className="ml-1 text-dark-text">{Number(styleProfileData.avgSentenceLength || 0).toFixed(1)}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-dark-text-muted">{t.styleProfileVocabRichness}:</span>
                          <span className="ml-1 text-dark-text">{Number(styleProfileData.vocabRichness || 0).toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-dark-text-muted">{t.styleProfileDialogueRatio}:</span>
                          <span className="ml-1 text-dark-text">{Number(styleProfileData.dialogueRatio || 0).toFixed(2)}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-dark-text-muted">{t.styleProfileTense}:</span>
                          <span className="ml-1 text-dark-text">{String(styleProfileData.tensePreference || '—')}</span>
                        </div>
                        <div className="text-xs col-span-2">
                          <span className="text-dark-text-muted">{t.styleProfilePOV}:</span>
                          <span className="ml-1 text-dark-text">{String(styleProfileData.dominantPOV || '—')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
              </section>
            </div>

            <div className={activeSection === 'ui' ? 'block' : 'hidden'}>
              <section>
                <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text mb-4 uppercase tracking-wider">{t.uiSettings}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-2">{t.theme}</label>
                    <div className="grid grid-cols-5 gap-2">
                      {([
                        { value: 'system', label: t.themeSystem, dot: '#64748b' },
                        { value: 'sorbet', label: t.themeSorbet, dot: '#4808d1' },
                        { value: 'slate', label: t.themeSlate, dot: '#6366f1' },
                        { value: 'amber', label: t.themeAmber, dot: '#f59e0b' },
                        { value: 'forest', label: t.themeForest, dot: '#22c55e' },
                        { value: 'charcoal', label: t.themeCharcoal, dot: '#e2e8f0' },
                        { value: 'cauldron', label: t.themeCauldron, dot: '#a855f7' },
                        { value: 'aurora', label: t.themeAurora, dot: '#06b6d4' },
                        { value: 'moonbeam', label: t.themeMoonbeam, dot: '#818cf8' },
                        { value: 'sepia', label: t.themeSepia, dot: '#d97706' },
                      ] as const).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLocalSettings({ ...localSettings, theme: option.value })}
                          className={`flex flex-col items-center gap-1.5 px-2 py-2.5 text-[11px] font-medium rounded-lg border transition-all ${
                            localSettings.theme === option.value
                              ? 'border-primary-600 bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 shadow-sm ring-1 ring-primary-500/20'
                              : 'border-gray-300 dark:border-dark-border2 bg-gray-50 dark:bg-dark-surface text-gray-700 dark:text-dark-text-secondary hover:border-gray-400 dark:hover:border-primary-500/40'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full inline-block shrink-0 ring-1 ring-black/10" style={{ backgroundColor: option.dot }} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="settings-font-size" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.fontSize}</label>
                    <select
                      id="settings-font-size"
                      name="settings-font-size"
                      value={localSettings.fontSize}
                      onChange={(e) => setLocalSettings({ ...localSettings, fontSize: e.target.value as 'small' | 'medium' | 'large' })}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                    >
                      <option value="small">{t.fontSmall}</option>
                      <option value="medium">{t.fontMedium}</option>
                      <option value="large">{t.fontLarge}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="settings-language" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.language}</label>
                    <select
                      id="settings-language"
                      name="settings-language"
                      value={localSettings.language}
                      onChange={(e) => {
                        const next = e.target.value as 'zh' | 'en'
                        setLocalSettings({ ...localSettings, language: next })
                        syncI18nLanguage()
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                    >
                      <option value="zh">{t.langChinese}</option>
                      <option value="en">{t.langEnglish}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="settings-send-shortcut" className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">{t.sendShortcutLabel}</label>
                    <select
                      id="settings-send-shortcut"
                      name="settings-send-shortcut"
                      value={localSettings.sendShortcut}
                      onChange={(e) => setLocalSettings({ ...localSettings, sendShortcut: e.target.value as SendShortcut })}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
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
                    className="text-xs px-3 py-1.5 text-xs px-3 py-1.5 font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-all shadow-sm active:scale-95"
                  >
                    {diagnosticsLoading ? t.mcpRefreshing : t.settingsRefreshDiagnostics}
                  </button>
                </div>

                {diagnosticsError && (
                  <p className="text-xs text-red-500 mb-2">{diagnosticsError}</p>
                )}

                <div className="space-y-3">
                  {onOpenDetailedDiagnostics && (
                    <div className="border dark:border-dark-border rounded-lg p-3 bg-gray-50 dark:bg-dark-bg/60">
                      <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">{t.mcpPanelTitle}</div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-600 dark:text-dark-text-secondary">
                          {t.settingsDetailedDiagnosticsHint}
                        </p>
                        <button
                          type="button"
                          onClick={onOpenDetailedDiagnostics}
                          className="shrink-0 text-xs px-3 py-1.5 font-medium bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-all shadow-sm active:scale-95"
                        >
                          {t.settingsOpenDetailedDiagnostics}
                        </button>
                      </div>
                    </div>
                  )}
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
              id="settings-import-file"
              name="settings-import-file"
              type="file"
              accept=".json"
              aria-label={t.importSettings}
              onChange={handleImport}
              className="hidden"
            />
            {importMessage && (
              <span className={`text-xs ${importMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {importMessage.text}
              </span>
            )}
            {saveMessage && (
              <span
                className={`text-xs ${
                  saveMessage.type === 'success'
                    ? 'text-green-600'
                    : saveMessage.type === 'warning'
                      ? 'text-amber-600'
                      : 'text-red-600'
                }`}
              >
                {saveMessage.text}
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
              disabled={savingSettings}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-500 shadow-md active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60"
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


