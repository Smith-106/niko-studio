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

describe('formatBackendFieldValue', () => {
  it('joins arrays with ", "', () => {
    expect(formatBackendFieldValue(['a', 'b', 'c'])).toBe('a, b, c')
  })

  it('returns empty string for empty arrays', () => {
    expect(formatBackendFieldValue([])).toBe('')
  })

  it('returns empty string for null', () => {
    expect(formatBackendFieldValue(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatBackendFieldValue(undefined)).toBe('')
  })

  it('converts numbers to strings', () => {
    expect(formatBackendFieldValue(42)).toBe('42')
  })

  it('converts booleans to strings', () => {
    expect(formatBackendFieldValue(true)).toBe('true')
    expect(formatBackendFieldValue(false)).toBe('false')
  })

  it('passes strings through unchanged', () => {
    expect(formatBackendFieldValue('hello')).toBe('hello')
  })

  it('converts objects via String()', () => {
    expect(formatBackendFieldValue({ key: 'val' })).toBe('[object Object]')
  })
})

describe('MASKED_SECRET_VALUE', () => {
  it('equals "***MASKED***"', () => {
    expect(MASKED_SECRET_VALUE).toBe('***MASKED***')
  })
})

describe('useSettingsBackendConfig', () => {
  beforeEach(() => {
    currentStore = createStore()
    useSettingsStoreMock.mockImplementation(() => currentStore)
    getSecretsMock.mockReset()
    getSecretsMock.mockResolvedValue({
      success: true,
      data: { secrets: createSecrets() },
    })
  })

  it('renders without error when inactive', () => {
    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: false,
        isActive: false,
        settingsUnknownError: 'Unknown error',
      }),
    )

    expect(result.current).toBeDefined()
    expect(result.current.backendConfigDraft).toEqual(createBackendConfig())
    expect(result.current.backendSecrets).toEqual({})
    expect(result.current.backendSecretsDraft).toEqual({})
    expect(result.current.backendConfigSaving).toBe(false)
    expect(result.current.backendSecretsSaving).toBe(false)
    expect(currentStore.loadBackendConfig).not.toHaveBeenCalled()
    expect(getSecretsMock).not.toHaveBeenCalled()
  })

  it('loads backend secrets when active and only loads config when missing', async () => {
    currentStore = createStore({
      settings: {
        backendConfig: {
          config: null,
          syncStatus: 'idle',
          modifiableFields: [],
        },
      },
    })
    useSettingsStoreMock.mockImplementation(() => currentStore)

    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Unknown error',
      }),
    )

    await waitFor(() => {
      expect(currentStore.loadBackendConfig).toHaveBeenCalledTimes(1)
      expect(getSecretsMock).toHaveBeenCalledTimes(1)
      expect(result.current.backendSecrets).toEqual(createSecrets())
      expect(result.current.backendSecretsDraft).toEqual({
        'agent.google_api_key': '',
        'agent.openai_api_key': '',
      })
      expect(result.current.backendSecretsLoading).toBe(false)
    })
  })

  it('tracks config edits, parses arrays and numbers, and saves changed config fields', async () => {
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

    act(() => {
      result.current.handleBackendConfigToggle('gateway.ui_bridge_enabled', true)
      result.current.handleBackendConfigFieldChange(
        'gateway.localhost_only_exempt_paths',
        ' https://a.example , https://b.example ',
        currentStore.settings.backendConfig.config?.gateway.localhost_only_exempt_paths,
      )
      result.current.handleBackendConfigFieldChange(
        'agent.max_cost_per_request',
        '3.5',
        currentStore.settings.backendConfig.config?.agent.max_cost_per_request,
      )
    })

    expect(result.current.backendConfigDraft?.gateway.ui_bridge_enabled).toBe(true)
    expect(result.current.backendConfigDraft?.gateway.localhost_only_exempt_paths).toEqual([
      'https://a.example',
      'https://b.example',
    ])
    expect(result.current.backendConfigDraft?.agent.max_cost_per_request).toBe(3.5)
    expect(result.current.hasBackendConfigChanges).toBe(true)

    await act(async () => {
      await result.current.handleSaveBackendConfig()
    })

    expect(currentStore.updateBackendConfig).toHaveBeenCalledWith({
      'gateway.ui_bridge_enabled': true,
      'gateway.localhost_only_exempt_paths': ['https://a.example', 'https://b.example'],
      'agent.max_cost_per_request': 3.5,
    })
    expect(result.current.backendConfigSaving).toBe(false)
  })

  it('does not save config when there are no effective changes', async () => {
    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: false,
        isActive: false,
        settingsUnknownError: 'Unknown error',
      }),
    )

    await act(async () => {
      await result.current.handleSaveBackendConfig()
    })

    expect(currentStore.updateBackendConfig).not.toHaveBeenCalled()
  })

  it('skips draft updates when backend config is not loaded', async () => {
    currentStore = createStore({
      settings: {
        backendConfig: {
          config: null,
          syncStatus: 'loading',
          modifiableFields: ['gateway.ui_bridge_enabled'],
        },
      },
    })
    useSettingsStoreMock.mockImplementation(() => currentStore)

    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Unknown error',
      }),
    )

    await act(async () => {
      result.current.handleBackendConfigFieldChange('gateway.ui_bridge_enabled', 'true', false)
      result.current.handleBackendConfigToggle('gateway.ui_bridge_enabled', true)
    })

    expect(result.current.backendConfigDraft).toBeNull()
  })

  it('saves secret drafts, masks stored values after success, and toggles secret visibility', async () => {
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

    act(() => {
      result.current.toggleShowBackendSecret('agent.google_api_key')
      result.current.updateBackendSecretDraft('agent.google_api_key', ' fresh-secret ')
      result.current.updateBackendSecretDraft('agent.openai_api_key', MASKED_SECRET_VALUE)
    })

    expect(result.current.showBackendSecrets.agent_google_api_key).toBeUndefined()
    expect(result.current.showBackendSecrets['agent.google_api_key']).toBe(true)
    expect(result.current.hasBackendSecretChanges).toBe(true)

    await act(async () => {
      await result.current.handleSaveBackendSecrets()
    })

    expect(currentStore.updateSecrets).toHaveBeenCalledWith({
      'agent.google_api_key': {
        configured: true,
        value: 'fresh-secret',
      },
    })
    expect(result.current.backendSecretsDraft['agent.google_api_key']).toBe('')
    expect(result.current.backendSecrets['agent.google_api_key']).toEqual({
      configured: true,
      value: MASKED_SECRET_VALUE,
    })
    expect(result.current.backendSecretsSaving).toBe(false)
  })

  it('maps unsuccessful and thrown secret loading/saving flows and clears errors before reload', async () => {
    getSecretsMock.mockResolvedValueOnce({
      success: false,
      error: 'secret list failed',
    })
    const loadFailure = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Unknown error',
      }),
    )

    await waitFor(() => {
      expect(loadFailure.result.current.backendSecretsError).toBe('secret list failed')
    })

    loadFailure.unmount()

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

    currentStore.updateSecrets.mockRejectedValueOnce(new Error('secret save failed'))

    act(() => {
      result.current.updateBackendSecretDraft('agent.google_api_key', 'new-value')
    })

    await act(async () => {
      await result.current.handleSaveBackendSecrets()
    })
    expect(result.current.backendSecretsError).toBe('secret save failed')

    await act(async () => {
      await result.current.handleReloadBackendConfig()
    })
    expect(result.current.backendSecretsError).toBeNull()
    expect(currentStore.reloadBackendConfig).toHaveBeenCalledTimes(1)
  })

  it('handles invalid config paths, blank numbers, and null drafts without saving', async () => {
    currentStore = createStore({
      settings: {
        backendConfig: {
          config: createBackendConfig(),
          syncStatus: 'idle',
          modifiableFields: [
            'badpath',
            'missing.section',
            'gateway.localhost_only_exempt_paths',
            'agent.max_cost_per_request',
          ],
        },
      },
    })
    useSettingsStoreMock.mockImplementation(() => currentStore)

    const { result, rerender } = renderHook((props: { active: boolean }) =>
      useSettingsBackendConfig({
        isOpen: props.active,
        isActive: props.active,
        settingsUnknownError: 'Unknown error',
      }),
      { initialProps: { active: true } },
    )

    await waitFor(() => {
      expect(result.current.backendSecretsLoading).toBe(false)
    })

    act(() => {
      result.current.handleBackendConfigFieldChange('badpath', 'ignored', undefined)
      result.current.handleBackendConfigToggle('missing.section', true)
      result.current.handleBackendConfigFieldChange(
        'agent.max_cost_per_request',
        '',
        currentStore.settings.backendConfig.config?.agent.max_cost_per_request,
      )
      result.current.handleBackendConfigFieldChange(
        'agent.max_cost_per_request',
        'not-a-number',
        currentStore.settings.backendConfig.config?.agent.max_cost_per_request,
      )
      result.current.handleBackendConfigFieldChange(
        'gateway.localhost_only_exempt_paths',
        ' , ',
        currentStore.settings.backendConfig.config?.gateway.localhost_only_exempt_paths,
      )
    })

    expect(result.current.backendConfigDraft?.agent.max_cost_per_request).toBe(1)
    expect(result.current.backendConfigDraft?.gateway.localhost_only_exempt_paths).toEqual([])

    currentStore = createStore({
      settings: {
        backendConfig: {
          config: null,
          syncStatus: 'loaded',
          modifiableFields: ['gateway.ui_bridge_enabled'],
        },
      },
    })
    useSettingsStoreMock.mockImplementation(() => currentStore)
    rerender({ active: false })

    act(() => {
      result.current.handleBackendConfigFieldChange('gateway.ui_bridge_enabled', 'true', false)
      result.current.handleBackendConfigToggle('gateway.ui_bridge_enabled', true)
    })
    await act(async () => {
      await result.current.handleSaveBackendConfig()
    })

    expect(currentStore.updateBackendConfig).not.toHaveBeenCalled()
  })

  it('maps thrown secret loading and skips empty, masked, or unknown secret drafts', async () => {
    getSecretsMock.mockRejectedValueOnce(new Error('secret load threw'))

    const failingLoad = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: true,
        isActive: true,
        settingsUnknownError: 'Unknown error',
      }),
    )

    await waitFor(() => {
      expect(failingLoad.result.current.backendSecretsError).toBe('secret load threw')
    })
    failingLoad.unmount()

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

    act(() => {
      result.current.updateBackendSecretDraft('agent.google_api_key', '   ')
      result.current.updateBackendSecretDraft('agent.openai_api_key', MASKED_SECRET_VALUE)
      result.current.updateBackendSecretDraft('agent.unknown_key', 'fresh')
    })

    await act(async () => {
      await result.current.handleSaveBackendSecrets()
    })

    expect(currentStore.updateSecrets).not.toHaveBeenCalled()
  })
})
