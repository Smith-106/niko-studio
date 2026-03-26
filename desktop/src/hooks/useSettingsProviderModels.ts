import { useMemo, useState } from 'react'
import { checkBackendHealth, fetchProviderModels } from '../api/client'
import type { LLMProvider } from '../stores/settingsStore'

interface UseSettingsProviderModelsOptions {
  llmProviders: LLMProvider[]
  onProviderChange: (providerId: string, updates: Partial<LLMProvider>) => void
  texts: {
    settingsModelNameRequired: string
    settingsModelNameTooLong: string
    settingsModelNameWhitespace: string
    settingsInvalidCustomModel: string
    settingsFetchModelsFailedWithReason: string
    settingsFetchModelsFailed: string
    settingsPresetModels: string
    settingsFetchedModels: string
    settingsCustomModels: string
    settingsDefaultModelValidateFetchFailed: string
    settingsDefaultModelAvailableViaGateway: string
    settingsDefaultModelAvailableViaDirect: string
    settingsDefaultModelUnavailable: string
    settingsDefaultModelValidateFailed: string
  }
}

function validateCustomModelInput(value: string, texts: UseSettingsProviderModelsOptions['texts']): { ok: boolean; reason?: string } {
  if (!value) {
    return { ok: false, reason: texts.settingsModelNameRequired }
  }
  if (value.length > 120) {
    return { ok: false, reason: texts.settingsModelNameTooLong }
  }
  if (/\s/.test(value)) {
    return { ok: false, reason: texts.settingsModelNameWhitespace }
  }
  return { ok: true }
}

function deduplicateModels(models: string[]): string[] {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)))
}

function getEffectiveModels(provider: LLMProvider): string[] {
  return deduplicateModels([
    ...provider.models,
    ...(provider.fetchedModels ?? []),
    ...(provider.customModels ?? []),
  ])
}

function ensureValidDefaultModel(provider: LLMProvider, updates: Partial<LLMProvider>): Partial<LLMProvider> {
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

export function useSettingsProviderModels({
  llmProviders,
  onProviderChange,
  texts,
}: UseSettingsProviderModelsOptions) {
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({})
  const [modelSyncLoading, setModelSyncLoading] = useState<Record<string, boolean>>({})
  const [modelSyncError, setModelSyncError] = useState<Record<string, string | null>>({})
  const [customModelInputs, setCustomModelInputs] = useState<Record<string, string>>({})
  const [providerSearch, setProviderSearch] = useState('')
  const [modelValidateLoading, setModelValidateLoading] = useState<Record<string, boolean>>({})
  const [modelValidateMessage, setModelValidateMessage] = useState<Record<string, { type: 'success' | 'error'; text: string } | null>>({})

  const updateLocalProvider = (providerId: string, updates: Partial<LLMProvider>) => {
    const provider = llmProviders.find((item) => item.id === providerId)
    if (!provider) {
      return
    }
    onProviderChange(providerId, ensureValidDefaultModel(provider, updates))
  }

  const filteredProviders = useMemo(() => {
    const keyword = providerSearch.trim().toLowerCase()
    if (!keyword) {
      return llmProviders
    }

    return llmProviders.filter((provider) => {
      if (provider.name.toLowerCase().includes(keyword)) {
        return true
      }

      const effectiveModels = getEffectiveModels(provider)
      return effectiveModels.some((model) => model.toLowerCase().includes(keyword))
    })
  }, [llmProviders, providerSearch])

  const toggleShowApiKey = (providerId: string) => {
    setShowApiKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }))
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
          ? texts.settingsFetchModelsFailedWithReason.replace('{error}', res.error)
          : texts.settingsFetchModelsFailed
        setModelSyncError((prev) => ({ ...prev, [provider.id]: reason }))
      }
    } catch {
      setModelSyncError((prev) => ({ ...prev, [provider.id]: texts.settingsFetchModelsFailed }))
    } finally {
      setModelSyncLoading((prev) => ({ ...prev, [provider.id]: false }))
    }
  }

  const applyCustomModel = (provider: LLMProvider) => {
    const value = (customModelInputs[provider.id] ?? '').trim()
    const validation = validateCustomModelInput(value, texts)
    if (!validation.ok) {
      setModelSyncError((prev) => ({ ...prev, [provider.id]: validation.reason ?? texts.settingsInvalidCustomModel }))
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
      groups.push({ label: texts.settingsPresetModels, models: staticModels })
    }
    if (fetchedModels.length > 0) {
      groups.push({ label: texts.settingsFetchedModels, models: fetchedModels })
    }
    if (customModels.length > 0) {
      groups.push({ label: texts.settingsCustomModels, models: customModels })
    }

    return groups
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
          [provider.id]: { type: 'error', text: texts.settingsDefaultModelValidateFetchFailed },
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
            text: data.source === 'gateway'
              ? texts.settingsDefaultModelAvailableViaGateway
              : texts.settingsDefaultModelAvailableViaDirect,
          },
        }))
      } else {
        setModelValidateMessage((prev) => ({
          ...prev,
          [provider.id]: { type: 'error', text: texts.settingsDefaultModelUnavailable },
        }))
      }
    } catch {
      setModelValidateMessage((prev) => ({
        ...prev,
        [provider.id]: { type: 'error', text: texts.settingsDefaultModelValidateFailed },
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

  return {
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
  }
}
