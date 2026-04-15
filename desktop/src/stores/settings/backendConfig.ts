import {
  getConfig,
  reloadConfig as reloadConfigApi,
  updateConfig,
  updateSecrets as updateSecretsApi,
} from '@/api/config'
import type { ConfigResponse, SecretsResponse } from '@/contracts/backendConfig'

import { nowIso } from './state'
import type { Settings } from './types'

type SettingsRecipe = (settings: Settings) => Settings

export type ApplySettingsRecipe = (recipe: SettingsRecipe) => void

export const backendConfigRuntimeApi = {
  getConfig,
  reloadConfig: reloadConfigApi,
  updateConfig,
  updateSecrets: updateSecretsApi,
}

function withBackendConfig(
  settings: Settings,
  backendConfig: Settings['backendConfig'],
): Settings {
  return {
    ...settings,
    backendConfig,
  }
}

function setBackendConfigStatus(
  settings: Settings,
  syncStatus: Settings['backendConfig']['syncStatus'],
): Settings {
  return withBackendConfig(settings, {
    ...settings.backendConfig,
    syncStatus,
    error: null,
  })
}

function setBackendConfigError(
  settings: Settings,
  fallbackMessage: string,
  error?: unknown,
): Settings {
  const errorMessage = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : fallbackMessage

  return withBackendConfig(settings, {
    ...settings.backendConfig,
    syncStatus: 'error',
    error: errorMessage || fallbackMessage,
  })
}

function applyBackendConfigSnapshot(
  settings: Settings,
  configData: ConfigResponse,
): Settings {
  return withBackendConfig(settings, {
    config: configData.config,
    modifiableFields: configData.modifiable_fields,
    syncStatus: 'idle',
    lastSync: nowIso(),
    error: null,
  })
}

async function refreshBackendConfigSnapshot(
  applySettingsRecipe: ApplySettingsRecipe,
  refreshErrorMessage: string,
): Promise<boolean> {
  const configResponse = await backendConfigRuntimeApi.getConfig()
  if (!configResponse.success || !configResponse.data) {
    applySettingsRecipe((settings) =>
      setBackendConfigError(
        settings,
        configResponse.error ?? refreshErrorMessage,
      ),
    )
    return false
  }

  const configData = configResponse.data
  applySettingsRecipe((settings) => applyBackendConfigSnapshot(settings, configData))
  return true
}

function extractSecretValues(secrets: SecretsResponse['secrets']): Record<string, string> {
  const secretValues: Record<string, string> = {}
  for (const [key, field] of Object.entries(secrets)) {
    if (typeof field.value === 'string') {
      secretValues[key] = field.value
    }
  }
  return secretValues
}

export async function loadBackendConfigRuntime(
  applySettingsRecipe: ApplySettingsRecipe,
): Promise<void> {
  applySettingsRecipe((settings) => setBackendConfigStatus(settings, 'loading'))

  try {
    const response = await backendConfigRuntimeApi.getConfig()
    if (response.success && response.data) {
      const configData = response.data
      applySettingsRecipe((settings) => applyBackendConfigSnapshot(settings, configData))
      return
    }

    applySettingsRecipe((settings) =>
      setBackendConfigError(settings, response.error ?? 'Failed to load backend config'),
    )
  } catch (error) {
    applySettingsRecipe((settings) =>
      setBackendConfigError(settings, 'Unknown error loading config', error),
    )
  }
}

export async function updateBackendConfigRuntime(
  applySettingsRecipe: ApplySettingsRecipe,
  fields: Record<string, unknown>,
): Promise<string[]> {
  applySettingsRecipe((settings) => setBackendConfigStatus(settings, 'syncing'))

  try {
    const response = await backendConfigRuntimeApi.updateConfig(fields)
    if (!response.success || !response.data) {
      applySettingsRecipe((settings) =>
        setBackendConfigError(settings, response.error ?? 'Failed to update backend config'),
      )
      return []
    }

    await refreshBackendConfigSnapshot(
      applySettingsRecipe,
      'Failed to refresh backend config after update',
    )
    return response.data.updated ?? []
  } catch (error) {
    applySettingsRecipe((settings) =>
      setBackendConfigError(settings, 'Unknown error updating config', error),
    )
    return []
  }
}

export async function updateBackendSecretsRuntime(
  applySettingsRecipe: ApplySettingsRecipe,
  secrets: SecretsResponse['secrets'],
): Promise<void> {
  applySettingsRecipe((settings) => setBackendConfigStatus(settings, 'syncing'))

  try {
    const response = await backendConfigRuntimeApi.updateSecrets(extractSecretValues(secrets))
    if (!response.success) {
      applySettingsRecipe((settings) =>
        setBackendConfigError(settings, response.error ?? 'Failed to update secrets'),
      )
      return
    }

    await refreshBackendConfigSnapshot(
      applySettingsRecipe,
      'Failed to refresh backend config after updating secrets',
    )
  } catch (error) {
    applySettingsRecipe((settings) =>
      setBackendConfigError(settings, 'Unknown error updating secrets', error),
    )
  }
}

export async function reloadBackendConfigRuntime(
  applySettingsRecipe: ApplySettingsRecipe,
  reloadBackendConfig: () => Promise<void>,
): Promise<void> {
  applySettingsRecipe((settings) => setBackendConfigStatus(settings, 'syncing'))

  try {
    const reloadResponse = await backendConfigRuntimeApi.reloadConfig()
    if (reloadResponse.success) {
      await reloadBackendConfig()
      return
    }

    applySettingsRecipe((settings) =>
      setBackendConfigError(settings, reloadResponse.error ?? 'Failed to reload backend config'),
    )
  } catch (error) {
    applySettingsRecipe((settings) =>
      setBackendConfigError(settings, 'Unknown error reloading config', error),
    )
  }
}
