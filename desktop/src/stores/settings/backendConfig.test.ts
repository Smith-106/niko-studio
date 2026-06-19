import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackendConfig, SecretsResponse } from '@/api/config'

import type { Settings } from './types'
import {
  backendConfigRuntimeApi,
  loadBackendConfigRuntime,
  reloadBackendConfigRuntime,
  updateBackendConfigRuntime,
  updateBackendSecretsRuntime,
} from './backendConfig'

function createBackendConfig(): BackendConfig {
  return {
    agent: {
      default_model: 'gpt-test',
      max_cost_per_request: 1,
      max_cost_per_session: 5,
      max_tokens_per_request: 1000,
      budget_warn_threshold: 0.8,
      google_api_key: '',
      openai_api_key: '',
      log_level: 'INFO',
    },
    gateway: {
      host: '127.0.0.1',
      port: 8000,
      reload: false,
      localhost_only: true,
      localhost_only_exempt_paths: ['http://localhost:5173'],
      cors_dev_origins: ['http://localhost:5173'],
      cors_prod_origins: ['app://niko'],
      metrics_enabled: true,
      ui_bridge_enabled: false,
      detection_evasion_guard: true,
    },
  } as BackendConfig
}

function createSettings(): Settings {
  return {
    backendConfig: {
      config: null,
      modifiableFields: [],
      syncStatus: 'idle',
      lastSync: null,
      error: null,
    },
  } as Settings
}

function createRecipeHarness(initialSettings: Settings = createSettings()) {
  let settings = initialSettings
  const applySettingsRecipe = (recipe: (settings: Settings) => Settings) => {
    settings = recipe(settings)
  }

  return {
    applySettingsRecipe,
    getSettings: () => settings,
  }
}

describe('settings/backendConfig runtime helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads the backend config snapshot into runtime-only state', async () => {
    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        config: createBackendConfig(),
        modifiable_fields: ['agent.default_model'],
      },
    })
    const harness = createRecipeHarness()

    await loadBackendConfigRuntime(harness.applySettingsRecipe)

    expect(harness.getSettings().backendConfig).toEqual({
      config: createBackendConfig(),
      modifiableFields: ['agent.default_model'],
      syncStatus: 'idle',
      lastSync: '2026-06-03T12:00:00.000Z',
      error: null,
    })
  })

  it('captures unsuccessful and thrown backend-config load errors', async () => {
    const harness = createRecipeHarness()
    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValueOnce({
      success: false,
      error: 'load failed',
    })

    await loadBackendConfigRuntime(harness.applySettingsRecipe)
    expect(harness.getSettings().backendConfig.syncStatus).toBe('error')
    expect(harness.getSettings().backendConfig.error).toBe('load failed')

    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockRejectedValueOnce(new Error('network down'))
    await loadBackendConfigRuntime(harness.applySettingsRecipe)
    expect(harness.getSettings().backendConfig.syncStatus).toBe('error')
    expect(harness.getSettings().backendConfig.error).toBe('network down')
  })

  it('updates config, refreshes the snapshot, and returns the updated field list', async () => {
    const updateConfigSpy = vi.spyOn(backendConfigRuntimeApi, 'updateConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        updated: ['gateway.ui_bridge_enabled'],
      },
    })
    const getConfigSpy = vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        config: {
          ...createBackendConfig(),
          gateway: {
            ...createBackendConfig().gateway,
            ui_bridge_enabled: true,
          },
        },
        modifiable_fields: ['gateway.ui_bridge_enabled'],
      },
    })
    const harness = createRecipeHarness()

    const updated = await updateBackendConfigRuntime(harness.applySettingsRecipe, {
      'gateway.ui_bridge_enabled': true,
    })

    expect(updated).toEqual(['gateway.ui_bridge_enabled'])
    expect(updateConfigSpy).toHaveBeenCalledWith({ 'gateway.ui_bridge_enabled': true })
    expect(getConfigSpy).toHaveBeenCalledTimes(1)
    expect(harness.getSettings().backendConfig.syncStatus).toBe('idle')
    expect(
      harness.getSettings().backendConfig.config?.gateway.ui_bridge_enabled,
    ).toBe(true)
  })

  it('surfaces config update failures, refresh failures, and thrown exceptions', async () => {
    const harness = createRecipeHarness()

    vi.spyOn(backendConfigRuntimeApi, 'updateConfig').mockResolvedValueOnce({
      success: false,
      error: 'update failed',
    })
    expect(
      await updateBackendConfigRuntime(harness.applySettingsRecipe, { 'agent.default_model': 'gpt-4o' }),
    ).toEqual([])
    expect(harness.getSettings().backendConfig.error).toBe('update failed')

    vi.spyOn(backendConfigRuntimeApi, 'updateConfig').mockResolvedValueOnce({
      success: true,
      data: {
        status: 'ok',
        updated: ['agent.default_model'],
      },
    })
    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValueOnce({
      success: false,
      error: 'refresh failed',
    })
    expect(
      await updateBackendConfigRuntime(harness.applySettingsRecipe, { 'agent.default_model': 'gpt-4.1' }),
    ).toEqual(['agent.default_model'])
    expect(harness.getSettings().backendConfig.error).toBe('refresh failed')

    vi.spyOn(backendConfigRuntimeApi, 'updateConfig').mockRejectedValueOnce(new Error('write denied'))
    expect(
      await updateBackendConfigRuntime(harness.applySettingsRecipe, { 'agent.default_model': 'gpt-5' }),
    ).toEqual([])
    expect(harness.getSettings().backendConfig.error).toBe('write denied')
  })

  it('updates secrets, filters non-string values, and refreshes the config snapshot', async () => {
    const updateSecretsSpy = vi.spyOn(backendConfigRuntimeApi, 'updateSecrets').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        updated: ['agent.google_api_key'],
      },
    })
    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        config: createBackendConfig(),
        modifiable_fields: ['agent.default_model'],
      },
    })
    const harness = createRecipeHarness()

    const secrets = {
      'agent.google_api_key': {
        configured: true,
        value: 'secret-value',
      },
      'agent.openai_api_key': {
        configured: true,
        value: 123,
      },
    } as unknown as SecretsResponse['secrets']

    await updateBackendSecretsRuntime(harness.applySettingsRecipe, secrets)

    expect(updateSecretsSpy).toHaveBeenCalledWith({
      'agent.google_api_key': 'secret-value',
    })
    expect(harness.getSettings().backendConfig.syncStatus).toBe('idle')
  })

  it('captures secret update failures and thrown exceptions', async () => {
    const harness = createRecipeHarness()
    const secrets = {
      'agent.google_api_key': {
        configured: true,
        value: 'secret-value',
      },
    } satisfies SecretsResponse['secrets']

    vi.spyOn(backendConfigRuntimeApi, 'updateSecrets').mockResolvedValueOnce({
      success: false,
      error: 'secret save failed',
    })
    await updateBackendSecretsRuntime(harness.applySettingsRecipe, secrets)
    expect(harness.getSettings().backendConfig.error).toBe('secret save failed')

    vi.spyOn(backendConfigRuntimeApi, 'updateSecrets').mockRejectedValueOnce(new Error('secret exploded'))
    await updateBackendSecretsRuntime(harness.applySettingsRecipe, secrets)
    expect(harness.getSettings().backendConfig.error).toBe('secret exploded')
  })

  it('reloads backend config and maps unsuccessful or thrown reloads', async () => {
    const harness = createRecipeHarness()
    const reloadBackendConfig = vi.fn().mockResolvedValue(undefined)

    vi.spyOn(backendConfigRuntimeApi, 'reloadConfig').mockResolvedValueOnce({
      success: true,
      data: {
        status: 'ok',
        message: 'reloaded',
      },
    })
    await reloadBackendConfigRuntime(harness.applySettingsRecipe, reloadBackendConfig)
    expect(reloadBackendConfig).toHaveBeenCalledTimes(1)

    vi.spyOn(backendConfigRuntimeApi, 'reloadConfig').mockResolvedValueOnce({
      success: false,
      error: 'reload failed',
    })
    await reloadBackendConfigRuntime(harness.applySettingsRecipe, reloadBackendConfig)
    expect(harness.getSettings().backendConfig.error).toBe('reload failed')

    vi.spyOn(backendConfigRuntimeApi, 'reloadConfig').mockRejectedValueOnce(new Error('reload exploded'))
    await reloadBackendConfigRuntime(harness.applySettingsRecipe, reloadBackendConfig)
    expect(harness.getSettings().backendConfig.error).toBe('reload exploded')
  })
})
