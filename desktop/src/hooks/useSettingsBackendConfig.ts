import { useEffect, useState } from 'react'
import { getSecrets, type BackendConfig, type SecretsResponse, SECRET_FIELDS } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'

export const MASKED_SECRET_VALUE = '***MASKED***'

export function formatBackendFieldValue(value: unknown) {
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
  return (sectionValue as unknown as Record<string, unknown>)[field]
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

  ;(sectionValue as unknown as Record<string, unknown>)[field] = value
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

interface UseSettingsBackendConfigOptions {
  isOpen: boolean
  isActive: boolean
  settingsUnknownError: string
}

export function useSettingsBackendConfig({
  isOpen,
  isActive,
  settingsUnknownError,
}: UseSettingsBackendConfigOptions) {
  const {
    settings,
    loadBackendConfig,
    updateBackendConfig,
    updateSecrets,
    reloadBackendConfig,
  } = useSettingsStore()
  const backendConfigState = settings.backendConfig

  const [backendConfigDraft, setBackendConfigDraft] = useState<BackendConfig | null>(backendConfigState.config)
  const [backendSecrets, setBackendSecrets] = useState<SecretsResponse['secrets']>({})
  const [backendSecretsDraft, setBackendSecretsDraft] = useState<Record<string, string>>({})
  const [backendSecretsLoading, setBackendSecretsLoading] = useState(false)
  const [backendSecretsError, setBackendSecretsError] = useState<string | null>(null)
  const [backendConfigSaving, setBackendConfigSaving] = useState(false)
  const [backendSecretsSaving, setBackendSecretsSaving] = useState(false)
  const [showBackendSecrets, setShowBackendSecrets] = useState<Record<string, boolean>>({})

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
    if (backendConfigState.config) {
      setBackendConfigDraft(backendConfigState.config)
    }
  }, [backendConfigState.config])

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
    if (!isOpen || !isActive) {
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
        setBackendSecretsError(response.error ?? settingsUnknownError)
      } catch (err) {
        setBackendSecretsError(err instanceof Error ? err.message : settingsUnknownError)
      } finally {
        setBackendSecretsLoading(false)
      }
    }

    if (!backendConfigState.config && backendConfigState.syncStatus === 'idle') {
      void loadBackendConfig()
    }

    void loadSecrets()
  }, [
    backendConfigState.config,
    backendConfigState.syncStatus,
    isActive,
    isOpen,
    loadBackendConfig,
    settingsUnknownError,
  ])

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
      setBackendSecretsError(err instanceof Error ? err.message : settingsUnknownError)
    } finally {
      setBackendSecretsSaving(false)
    }
  }

  const handleReloadBackendConfig = async () => {
    setBackendSecretsError(null)
    await reloadBackendConfig()
  }

  const updateBackendSecretDraft = (key: string, value: string) => {
    setBackendSecretsDraft((prev) => ({ ...prev, [key]: value }))
  }

  const toggleShowBackendSecret = (key: string) => {
    setShowBackendSecrets((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return {
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
  }
}
