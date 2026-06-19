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
  const applySettingsRecipe = (recipe: (next: Settings) => Settings) => {
    settings = recipe(settings)
  }

  return {
    applySettingsRecipe,
    getSettings: () => settings,
  }
}

describe('settings/backendConfig additional branch coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to default messages for load failures with blank or missing errors', async () => {
    const harness = createRecipeHarness()

    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockRejectedValueOnce('')
    await loadBackendConfigRuntime(harness.applySettingsRecipe)
    expect(harness.getSettings().backendConfig.error).toBe('Unknown error loading config')

    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValueOnce({
      success: false,
    } as any)
    await loadBackendConfigRuntime(harness.applySettingsRecipe)
    expect(harness.getSettings().backendConfig.error).toBe('Failed to load backend config')
  })

  it('falls back to refresh and update defaults when config persistence omits optional fields', async () => {
    const harness = createRecipeHarness()

    vi.spyOn(backendConfigRuntimeApi, 'updateConfig').mockResolvedValueOnce({
      success: true,
      data: { status: 'ok' },
    } as any)
    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValueOnce({
      success: false,
    } as any)

    const updated = await updateBackendConfigRuntime(harness.applySettingsRecipe, {
      'agent.default_model': 'gpt-5',
    })

    expect(updated).toEqual([])
    expect(harness.getSettings().backendConfig.error).toBe(
      'Failed to refresh backend config after update',
    )

    vi.spyOn(backendConfigRuntimeApi, 'updateConfig').mockResolvedValueOnce({
      success: false,
    } as any)
    await updateBackendConfigRuntime(harness.applySettingsRecipe, {
      'agent.default_model': 'gpt-4.1',
    })
    expect(harness.getSettings().backendConfig.error).toBe('Failed to update backend config')
  })

  it('uses default messages for secret and reload failures when providers omit error text', async () => {
    const harness = createRecipeHarness({
      ...createSettings(),
      backendConfig: {
        config: createBackendConfig(),
        modifiableFields: [],
        syncStatus: 'idle',
        lastSync: null,
        error: null,
      },
    })
    const secrets = {
      'agent.google_api_key': {
        configured: true,
        value: 'secret-value',
      },
    } satisfies SecretsResponse['secrets']

    vi.spyOn(backendConfigRuntimeApi, 'updateSecrets').mockResolvedValueOnce({
      success: false,
    } as any)
    await updateBackendSecretsRuntime(harness.applySettingsRecipe, secrets)
    expect(harness.getSettings().backendConfig.error).toBe('Failed to update secrets')

    vi.spyOn(backendConfigRuntimeApi, 'reloadConfig').mockResolvedValueOnce({
      success: false,
    } as any)
    await reloadBackendConfigRuntime(harness.applySettingsRecipe, vi.fn())
    expect(harness.getSettings().backendConfig.error).toBe('Failed to reload backend config')
  })
})
