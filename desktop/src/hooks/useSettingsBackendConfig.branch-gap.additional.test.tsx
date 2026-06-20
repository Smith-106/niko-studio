import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSecretsMock = vi.hoisted(() => vi.fn())
const useSettingsStoreMock = vi.hoisted(() => vi.fn())

vi.mock('../api/config', async () => {
  const actual = await vi.importActual<typeof import('../api/config')>('../api/config')
  return {
    ...actual,
    getSecrets: getSecretsMock,
  }
})

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: useSettingsStoreMock,
}))

import type { BackendConfig, SecretsResponse } from '../api/config'

import {
  formatBackendFieldValue,
  MASKED_SECRET_VALUE,
  useSettingsBackendConfig,
} from './useSettingsBackendConfig'

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

function createSecrets(): SecretsResponse['secrets'] {
  return {
    'agent.google_api_key': {
      configured: true,
      value: MASKED_SECRET_VALUE,
    },
    'agent.openai_api_key': {
      configured: false,
      value: '',
    },
  }
}

function createStore(overrides?: Partial<ReturnType<typeof createStore>>) {
  const store = {
    settings: {
      backendConfig: {
        config: createBackendConfig(),
        syncStatus: 'idle' as const,
        modifiableFields: [
          'gateway.ui_bridge_enabled',
          'gateway.localhost_only_exempt_paths',
          'agent.max_cost_per_request',
          'agent.google_api_key',
        ],
      },
    },
    loadBackendConfig: vi.fn().mockResolvedValue(undefined),
    updateBackendConfig: vi.fn().mockResolvedValue(['gateway.ui_bridge_enabled']),
    updateSecrets: vi.fn().mockResolvedValue(undefined),
    reloadBackendConfig: vi.fn().mockResolvedValue(undefined),
  }
  return { ...store, ...overrides }
}

let currentStore = createStore()

describe('useSettingsBackendConfig branch-gap additional coverage', () => {
  beforeEach(() => {
    currentStore = createStore()
    useSettingsStoreMock.mockImplementation(() => currentStore)
    getSecretsMock.mockReset()
    getSecretsMock.mockResolvedValue({
      success: true,
      data: { secrets: createSecrets() },
    })
  })

  it('covers getBackendFieldValue with empty section string (line 19)', () => {
    // path '' splits to ['', undefined], so !section is true
    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: false,
        isActive: false,
        settingsUnknownError: 'Unknown error',
      }),
    )

    // Test via handleBackendConfigFieldChange which calls setBackendFieldValue
    // A path like '.field' has empty section
    act(() => {
      result.current.handleBackendConfigFieldChange('.field', 'test', 'val')
    })

    // Draft should not be modified because getBackendFieldValue returns undefined for empty section
    // setBackendFieldValue returns config unchanged for empty section
    expect(result.current.backendConfigDraft).toEqual(createBackendConfig())
  })

  it('covers getBackendFieldValue when section value is a primitive (line 23)', () => {
    // Create a config where a "section" is a string instead of object
    const customConfig = {
      ...createBackendConfig(),
      agent: 'not-an-object',
    } as unknown as BackendConfig

    currentStore = createStore({
      settings: {
        backendConfig: {
          config: customConfig,
          syncStatus: 'idle' as const,
          modifiableFields: ['agent.default_model'],
        },
      },
    })
    useSettingsStoreMock.mockImplementation(() => currentStore)

    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: false,
        isActive: false,
        settingsUnknownError: 'Unknown error',
      }),
    )

    act(() => {
      result.current.handleBackendConfigFieldChange('agent.default_model', 'test', 'val')
    })

    // Draft should not be modified because section value is not an object
    expect(result.current.backendConfigDraft).toEqual(customConfig)
  })

  it('covers getBackendFieldValue when section value is an array (line 23)', () => {
    const customConfig = {
      ...createBackendConfig(),
      agent: ['array-value'],
    } as unknown as BackendConfig

    currentStore = createStore({
      settings: {
        backendConfig: {
          config: customConfig,
          syncStatus: 'idle' as const,
          modifiableFields: ['agent.default_model'],
        },
      },
    })
    useSettingsStoreMock.mockImplementation(() => currentStore)

    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: false,
        isActive: false,
        settingsUnknownError: 'Unknown error',
      }),
    )

    act(() => {
      result.current.handleBackendConfigFieldChange('agent.default_model', 'test', 'val')
    })

    // Draft should not be modified because section value is an array
    expect(result.current.backendConfigDraft).toEqual(customConfig)
  })

  it('covers SECRET_FIELDS.includes in buildBackendConfigUpdates (line 70)', async () => {
    // The modifiableFields includes 'agent.google_api_key' which is in SECRET_FIELDS
    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Unknown error',
      }),
    )

    await waitFor(() => {
      expect(result.current.backendSecretsLoading).toBe(false)
    })

    // Make a change to a non-secret field to confirm secret field is skipped
    act(() => {
      result.current.handleBackendConfigToggle(
        'gateway.ui_bridge_enabled',
        true,
      )
    })

    expect(result.current.hasBackendConfigChanges).toBe(true)

    await act(async () => {
      await result.current.handleSaveBackendConfig()
    })

    // Should only save the non-secret field change, not the secret field
    expect(currentStore.updateBackendConfig).toHaveBeenCalledWith({
      'gateway.ui_bridge_enabled': true,
    })
  })

  it('covers loadSecrets catch with non-Error thrown (line 161)', async () => {
    getSecretsMock.mockRejectedValueOnce('string-error')

    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Fallback error',
      }),
    )

    await waitFor(() => {
      expect(result.current.backendSecretsLoading).toBe(false)
    })

    expect(result.current.backendSecretsError).toBe('Fallback error')
  })

  it('covers loadSecrets response.error undefined (line 159)', async () => {
    getSecretsMock.mockResolvedValueOnce({
      success: false,
      error: undefined,
    })

    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Fallback error',
      }),
    )

    await waitFor(() => {
      expect(result.current.backendSecretsLoading).toBe(false)
    })

    expect(result.current.backendSecretsError).toBe('Fallback error')
  })

  it('covers handleSaveBackendSecrets catch with non-Error thrown (line 271-272)', async () => {
    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Unknown error',
      }),
    )

    await waitFor(() => {
      expect(result.current.backendSecretsLoading).toBe(false)
    })

    currentStore.updateSecrets.mockRejectedValueOnce('non-error-string')

    act(() => {
      result.current.updateBackendSecretDraft('agent.google_api_key', 'new-secret')
    })

    await act(async () => {
      await result.current.handleSaveBackendSecrets()
    })

    expect(result.current.backendSecretsError).toBe('Unknown error')
  })

  it('covers secret save updater when key not in current secrets (line 261)', async () => {
    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Unknown error',
      }),
    )

    await waitFor(() => {
      expect(result.current.backendSecretsLoading).toBe(false)
    })

    // Set a draft for a key not present in current secrets
    act(() => {
      result.current.updateBackendSecretDraft('agent.nonexistent_key', 'fresh-value')
    })

    await act(async () => {
      await result.current.handleSaveBackendSecrets()
    })

    // Should not save because the key is not in backendSecrets
    expect(currentStore.updateSecrets).not.toHaveBeenCalled()
  })

  it('covers draft not updated when backendConfigState.config is null (line 130 false branch)', async () => {
    currentStore = createStore({
      settings: {
        backendConfig: {
          config: null,
          syncStatus: 'loaded' as const,
          modifiableFields: [],
        },
      },
    })
    useSettingsStoreMock.mockImplementation(() => currentStore)

    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: false,
        isActive: false,
        settingsUnknownError: 'Unknown error',
      }),
    )

    // Draft should be null since config is null and the effect should not update draft
    expect(result.current.backendConfigDraft).toBeNull()
  })
})
