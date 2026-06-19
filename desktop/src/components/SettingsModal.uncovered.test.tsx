import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsModal } from './SettingsModal'
import * as i18nModule from '../i18n'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { BackendConfig, SecretsResponse } from '../api/config'
import { MASKED_SECRET_VALUE } from '../hooks/useSettingsBackendConfig'

const getSecretsMock = vi.hoisted(() => vi.fn())
const fetchProviderModelsMock = vi.hoisted(() => vi.fn())
const checkBackendHealthMock = vi.hoisted(() => vi.fn())
const getGatewayMetricsMock = vi.hoisted(() => vi.fn())
const listGatewayToolsMock = vi.hoisted(() => vi.fn())
const isTauriRuntimeMock = vi.hoisted(() => vi.fn())
const syncGatewayBaseOverrideMock = vi.hoisted(() => vi.fn())
const getStyleProfileMock = vi.hoisted(() => vi.fn())

vi.mock('./TemplateManagerPanel', () => ({
  TemplateManagerPanel: () => <div data-testid="template-manager-panel">template panel</div>,
}))

vi.mock('../api/config', async () => {
  const actual = await vi.importActual<typeof import('../api/config')>('../api/config')
  return {
    ...actual,
    getSecrets: getSecretsMock,
  }
})

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return {
    ...actual,
    fetchProviderModels: fetchProviderModelsMock,
    checkBackendHealth: checkBackendHealthMock,
    getGatewayMetrics: getGatewayMetricsMock,
    listGatewayTools: listGatewayToolsMock,
  }
})

vi.mock('../api/transport', async () => {
  const actual = await vi.importActual<typeof import('../api/transport')>('../api/transport')
  return {
    ...actual,
    isTauriRuntime: isTauriRuntimeMock,
    syncGatewayBaseOverride: syncGatewayBaseOverrideMock,
  }
})

vi.mock('../api/m10-apis', async () => {
  const actual = await vi.importActual<typeof import('../api/m10-apis')>('../api/m10-apis')
  return {
    ...actual,
    getStyleProfile: getStyleProfileMock,
  }
})

const zh = i18nModule.translations.zh

const defaultUpdateSettings = useSettingsStore.getState().updateSettings
const defaultUpdateProvider = useSettingsStore.getState().updateProvider
const defaultResetSettings = useSettingsStore.getState().resetSettings
const defaultUpdateSecrets = useSettingsStore.getState().updateSecrets
const defaultUpdateBackendConfig = useSettingsStore.getState().updateBackendConfig
const defaultReloadBackendConfig = useSettingsStore.getState().reloadBackendConfig
const defaultLoadBackendConfig = useSettingsStore.getState().loadBackendConfig

const originalFileReader = globalThis.FileReader

function createBackendConfig(): BackendConfig {
  return {
    app_name: 'Niko Studio',
    version: '8.1.1',
    debug: false,
    env: 'test',
    data_dir: '/tmp/data',
    log_dir: '/tmp/logs',
    agent: {
      max_cost_per_request: 1.0,
      max_cost_per_session: 10.0,
      max_tokens_per_request: 100000,
      budget_warn_threshold: 0.8,
      default_model: 'claude-sonnet-4-6',
      google_api_key: '',
      openai_api_key: '',
      log_level: 'INFO',
    },
    memory: {
      vector_db_path: '/tmp/vectors',
      embedding_model: 'text-embedding-3-small',
      embedding_dimension: 1536,
      cache_enabled: true,
      cache_ttl: 3600,
      cache_max_size: 1000,
      chunk_size: 512,
      chunk_overlap: 64,
    },
    workflow: {
      session_timeout: 3600,
      max_concurrent_sessions: 5,
      checkpoint_enabled: true,
      checkpoint_interval: 300,
      resume_strategy: 'latest',
      quality_mode: 'standard',
      quality_level: 'high',
      degrade_on_timeout: true,
      degrade_on_error: true,
      critical_gate_always_on: true,
      quality_phase_timeout_seconds: 120,
    },
    graph: {
      db_path: '/tmp/graph.db',
      max_connections: 10,
      max_entities_per_query: 100,
      relation_depth: 3,
    },
    writing: {
      character_depth_dimensions: 5,
      max_character_traits: 8,
      scene_coherence_threshold: 0.8,
      contradiction_sensitivity: 'medium',
      foreshadowing_max_distance: 10,
      foreshadowing_reminder_threshold: 0.5,
      style_vector_dimensions: 128,
      style_sample_min_words: 500,
    },
    backup: {
      backup_dir: '/tmp/backups',
      compress: true,
      max_backups: 10,
      webdav_enabled: false,
      webdav_url: '',
      webdav_username: '',
      webdav_password: '',
      webdav_remote_path: '',
      s3_enabled: false,
      s3_bucket: '',
      s3_prefix: '',
      s3_region: '',
      s3_endpoint_url: '',
      s3_access_key_id: '',
      s3_secret_access_key: '',
      s3_force_path_style: false,
    },
    token: {
      db_path: '/tmp/tokens.db',
      default_model: 'claude-sonnet-4-6',
      default_budget: 10000,
      budget_warn_threshold: 0.8,
    },
    obsidian: {
      enabled: false,
      auto_discover: true,
      sync_on_startup: false,
      default_vault: '',
      file_patterns: ['*.md'],
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
    integration: {
      postgres_enabled: false,
      redis_cache_enabled: false,
      elasticsearch_enabled: false,
      neo4j_enabled: false,
      langflow_enabled: false,
      dbhub_governance_enabled: false,
      search_route_mode: 'legacy',
      search_elastic_timeout_ms: 300,
      redis_rate_limit: 120,
      redis_rate_limit_window_seconds: 60,
      langflow_flow_name: 'niko-search-pilot',
      redis_cache_ttl_seconds: 120,
    },
  }
}

function createSecretsResponse(): SecretsResponse['secrets'] {
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

function renderSettingsModal(
  props: Partial<React.ComponentProps<typeof SettingsModal>> = {},
) {
  return render(
    <SettingsModal
      isOpen
      onClose={vi.fn()}
      {...props}
    />,
  )
}

function seedBackendStore(overrides: {
  syncStatus?: 'idle' | 'loading' | 'syncing' | 'error'
  lastSync?: string | null
  error?: string | null
  updateSecrets?: typeof defaultUpdateSecrets
  updateBackendConfig?: typeof defaultUpdateBackendConfig
  reloadBackendConfig?: typeof defaultReloadBackendConfig
} = {}) {
  useSettingsStore.setState((state) => ({
    ...state,
    updateSecrets: overrides.updateSecrets ?? defaultUpdateSecrets,
    updateBackendConfig: overrides.updateBackendConfig ?? defaultUpdateBackendConfig,
    reloadBackendConfig: overrides.reloadBackendConfig ?? defaultReloadBackendConfig,
    loadBackendConfig: defaultLoadBackendConfig,
    settings: {
      ...state.settings,
      backendConfig: {
        config: createBackendConfig(),
        modifiableFields: [
          'agent.default_model',
          'gateway.ui_bridge_enabled',
          'gateway.localhost_only_exempt_paths',
          'agent.google_api_key',
        ],
        syncStatus: overrides.syncStatus ?? 'idle',
        lastSync: overrides.lastSync ?? null,
        error: overrides.error ?? null,
      },
    },
  }))
}

describe('SettingsModal uncovered lines coverage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    useSettingsStore.getState().resetSettings()

    useSettingsStore.setState((state) => ({
      ...state,
      updateSettings: defaultUpdateSettings,
      updateProvider: defaultUpdateProvider,
      resetSettings: defaultResetSettings,
      updateSecrets: defaultUpdateSecrets,
      updateBackendConfig: defaultUpdateBackendConfig,
      reloadBackendConfig: defaultReloadBackendConfig,
      loadBackendConfig: defaultLoadBackendConfig,
      settings: {
        ...state.settings,
        language: 'zh',
        backendConfig: {
          config: null,
          modifiableFields: [],
          syncStatus: 'idle',
          lastSync: null,
          error: null,
        },
      },
    }))

    useAppStore.setState({
      backendStatus: true,
      checkBackend: vi.fn().mockImplementation(async () => {
        useAppStore.setState({ backendStatus: true })
      }),
      currentProjectId: null,
    })

    getSecretsMock.mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        secrets: createSecretsResponse(),
      },
    })
    fetchProviderModelsMock.mockResolvedValue({
      success: true,
      data: {
        models: ['gpt-4-turbo', 'gpt-4.1-mini'],
        source: 'gateway',
      },
    })
    checkBackendHealthMock.mockResolvedValue(true)
    getGatewayMetricsMock.mockResolvedValue({
      success: true,
      data: {
        metrics: {
          requests_total: 10,
          requests_failed_total: 1,
          requests_success_total: 9,
          latency_ms_avg: 30,
          latency_ms_max: 90,
        },
      },
    })
    listGatewayToolsMock.mockResolvedValue({
      success: true,
      data: {
        tools: ['writer', 'critic'],
        skills_count: 2,
      },
    })
    isTauriRuntimeMock.mockReturnValue(false)
    syncGatewayBaseOverrideMock.mockResolvedValue(undefined)
    getStyleProfileMock.mockResolvedValue({
      success: true,
      data: {
        avgSentenceLength: 14.2,
        vocabRichness: 0.67,
        dialogueRatio: 0.41,
        tensePreference: 'past',
        dominantPOV: 'third',
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    globalThis.FileReader = originalFileReader
  })

describe('SettingsModal uncovered lines coverage', () => {
  // Lines 377, 379: tauri mode with empty apiBaseUrl → syncGatewayBaseOverride(null)
  it('syncs gateway with null when apiBaseUrl is empty in tauri mode', async () => {
    const user = userEvent.setup()
    isTauriRuntimeMock.mockReturnValue(true)
    syncGatewayBaseOverrideMock.mockResolvedValue(undefined)

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        apiBaseUrl: '',
      },
    }))

    renderSettingsModal()
    await user.click(screen.getByRole('button', { name: zh.save }))

    await waitFor(() => {
      expect(syncGatewayBaseOverrideMock).toHaveBeenCalledWith(null)
    })
  })

  // Lines 1644-1646: warning branch when save result is partial
  it('renders partial-save warning when runtime stage fails in tauri mode', async () => {
    const user = userEvent.setup()
    isTauriRuntimeMock.mockReturnValue(true)
    syncGatewayBaseOverrideMock.mockRejectedValue(new Error('gateway sync failed'))

    renderSettingsModal()
    await user.click(screen.getByRole('button', { name: zh.save }))

    await waitFor(() => {
      expect(screen.getByText(zh.settingsSavePartialFailure.replace('{stages}', zh.settingsSaveStageRuntime))).toBeInTheDocument()
    })
  })

  // Lines 753-756: backendSecretsError rendering
  it('renders backend secrets error when fetching secrets fails', async () => {
    const user = userEvent.setup()

    getSecretsMock.mockResolvedValue({
      success: false,
      error: 'secrets fetch failed',
    })

    seedBackendStore()
    renderSettingsModal({ requestedSection: 'backend' })

    await waitFor(() => {
      expect(screen.getByText('secrets fetch failed')).toBeInTheDocument()
    })
  })
})
})
