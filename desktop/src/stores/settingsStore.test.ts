import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendConfig, SecretsResponse } from '@/api/config'
import { readRuntimePreferences } from '@/runtime/preferences'
import { backendConfigRuntimeApi } from './settings/backendConfig'
import { useSettingsStore, type PromptTemplate } from './settingsStore'

const templateFixture = (id: string): PromptTemplate => ({
  id,
  title: `模板-${id}`,
  category: 'custom',
  content: 'hello {name}',
  variables: [{ id: 'name', label: '姓名', required: true }],
  isFavorite: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const backendConfigFixture = (): BackendConfig => ({
  app_name: 'Niko Studio',
  version: '9.0.3',
  debug: false,
  env: 'test',
  data_dir: '/tmp/data',
  log_dir: '/tmp/logs',
  agent: {
    max_cost_per_request: 1,
    max_cost_per_session: 10,
    max_tokens_per_request: 100000,
    budget_warn_threshold: 0.8,
    default_model: 'claude-sonnet-4-6',
    google_api_key: '',
    openai_api_key: '',
    log_level: 'INFO',
  },
  memory: {
    vector_db_path: '/tmp/vector',
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
  gateway: {
    host: '127.0.0.1',
    port: 8000,
    reload: false,
    localhost_only: true,
    localhost_only_exempt_paths: [],
    cors_dev_origins: ['http://localhost:5173'],
    cors_prod_origins: [],
    metrics_enabled: true,
    ui_bridge_enabled: false,
    detection_evasion_guard: true,
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
})

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  useSettingsStore.getState().resetSettings()
})

describe('settingsStore runtime preference projection', () => {
  it('projects apiBaseUrl and workflowBackendMode into the runtime adapter', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        apiBaseUrl: 'http://settings.example.com/',
        workflowBackendMode: 'uiBridge',
      },
    }))

    expect(readRuntimePreferences()).toEqual({
      apiBaseUrl: 'http://settings.example.com/',
      workflowBackendMode: 'uiBridge',
    })
  })

  it('restores runtime adapter defaults when settings reset', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        apiBaseUrl: 'http://settings.example.com/',
        workflowBackendMode: 'uiBridge',
      },
    }))

    useSettingsStore.getState().resetSettings()

    expect(readRuntimePreferences()).toMatchObject({
      apiBaseUrl: 'http://127.0.0.1:8000',
      workflowBackendMode: 'standard',
    })
  })
})

describe('settingsStore prompt template library', () => {
  it('normalizes old settings without promptTemplateLibrary', () => {
    localStorage.clear()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        promptTemplateLibrary: undefined,
      },
    }))

    useSettingsStore.getState().updateSettings({ language: 'en' })

    const library = useSettingsStore.getState().settings.promptTemplateLibrary
    expect(library).toBeDefined()
    expect(library?.templates.length).toBeGreaterThan(0)
    expect(library?.recentTemplateIds).toEqual([])
  })

  it('supports favorite toggle, usage record and variable presets', () => {
    localStorage.clear()
    const store = useSettingsStore.getState()

    store.addTemplate(templateFixture('tpl-test-1'))
    store.toggleTemplateFavorite('tpl-test-1')
    store.recordTemplateUsage('tpl-test-1')
    store.setTemplateVariablePreset('tpl-test-1', 'name', 'Niko')

    const library = useSettingsStore.getState().settings.promptTemplateLibrary!
    const template = library.templates.find((item) => item.id === 'tpl-test-1')

    expect(template?.isFavorite).toBe(true)
    expect(library.recentTemplateIds[0]).toBe('tpl-test-1')
    expect(library.variablePresets['tpl-test-1']).toEqual({ name: 'Niko' })
  })

  it('supports writing helper legacy polish toggle setting', () => {
    localStorage.clear()
    const store = useSettingsStore.getState()

    expect(store.settings.writingHelperUseLegacyPolish).toBe(false)

    store.updateSettings({ writingHelperUseLegacyPolish: true })

    expect(useSettingsStore.getState().settings.writingHelperUseLegacyPolish).toBe(true)
  })

  it('defaults workflow backend mode to standard', () => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()

    expect(useSettingsStore.getState().settings.workflowBackendMode).toBe('standard')
  })

  it('does not persist sensitive api keys to localStorage', async () => {
    localStorage.clear()
    const store = useSettingsStore.getState()

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        backendConfig: {
          config: null,
          modifiableFields: ['agent.default_model'],
          syncStatus: 'error',
          lastSync: '2026-04-08T00:00:00.000Z',
          error: 'stale config error',
        },
      },
    }))

    store.updateSettings({ apiKey: 'top-secret-key' })
    store.updateProvider('anthropic', { apiKey: 'provider-secret-key' })

    // Wait for debounced localStorage write (300ms) to flush
    await new Promise((r) => setTimeout(r, 400))

    const persistedRaw = localStorage.getItem('niko-settings')
    expect(persistedRaw).toBeTruthy()

    const persisted = JSON.parse(persistedRaw!) as {
      state?: {
        settings?: {
          apiKey?: string
          llmProviders?: Array<{ id: string; apiKey?: string }>
        }
      }
    }

    expect(persisted.state?.settings?.apiKey).toBe('')
    const anthropic = persisted.state?.settings?.llmProviders?.find((provider) => provider.id === 'anthropic')
    expect(anthropic?.apiKey).toBe('')
    expect(persisted.state?.settings).not.toHaveProperty('backendConfig')
    expect(persisted.state?.settings).not.toHaveProperty('sidebarCollapsed')
    expect(persistedRaw).not.toContain('top-secret-key')
    expect(persistedRaw).not.toContain('provider-secret-key')
  })

  it('drops legacy workflow ui and backend runtime state during rehydrate', async () => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()

    localStorage.setItem('niko-settings', JSON.stringify({
      state: {
        settings: {
          language: 'en',
          theme: 'aurora',
          sidebarCollapsed: true,
          backendConfig: {
            config: { agent: { default_model: 'stale-model' } },
            modifiableFields: ['agent.default_model'],
            syncStatus: 'error',
            lastSync: '2026-04-08T00:00:00.000Z',
            error: 'stale config error',
          },
        },
      },
      version: 0,
    }))

    await useSettingsStore.persist.rehydrate()

    const { settings } = useSettingsStore.getState()
    expect(settings.language).toBe('en')
    expect(settings.theme).toBe('aurora')
    expect(settings.backendConfig).toEqual({
      config: null,
      modifiableFields: [],
      syncStatus: 'idle',
      lastSync: null,
      error: null,
    })
    expect('sidebarCollapsed' in settings).toBe(false)
  })

  it('loads backend config into runtime-only state', async () => {
    const getConfigSpy = vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        config: backendConfigFixture(),
        modifiable_fields: ['agent.default_model'],
      },
    })

    await useSettingsStore.getState().loadBackendConfig()

    expect(getConfigSpy).toHaveBeenCalledTimes(1)
    expect(useSettingsStore.getState().settings.backendConfig).toMatchObject({
      config: backendConfigFixture(),
      modifiableFields: ['agent.default_model'],
      syncStatus: 'idle',
      error: null,
    })
  })

  it('updates backend config and refreshes runtime-only snapshot', async () => {
    const updateConfigSpy = vi.spyOn(backendConfigRuntimeApi, 'updateConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        updated: ['agent.default_model'],
      },
    })
    vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        config: backendConfigFixture(),
        modifiable_fields: ['agent.default_model'],
      },
    })

    const updated = await useSettingsStore.getState().updateBackendConfig({
      'agent.default_model': 'gpt-4o',
    })

    expect(updated).toEqual(['agent.default_model'])
    expect(updateConfigSpy).toHaveBeenCalledWith({
      'agent.default_model': 'gpt-4o',
    })
    expect(useSettingsStore.getState().settings.backendConfig.syncStatus).toBe('idle')
  })

  it('updates backend secrets through the runtime-only sync helper', async () => {
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
        config: backendConfigFixture(),
        modifiable_fields: ['agent.default_model'],
      },
    })

    const secrets: SecretsResponse['secrets'] = {
      'agent.google_api_key': {
        configured: true,
        value: 'secret-value',
      },
    }

    await useSettingsStore.getState().updateSecrets(secrets)

    expect(updateSecretsSpy).toHaveBeenCalledWith({
      'agent.google_api_key': 'secret-value',
    })
    expect(useSettingsStore.getState().settings.backendConfig.syncStatus).toBe('idle')
  })

  it('reloads backend config and refreshes the runtime-only snapshot', async () => {
    const reloadConfigSpy = vi.spyOn(backendConfigRuntimeApi, 'reloadConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        message: 'reloaded',
      },
    })
    const getConfigSpy = vi.spyOn(backendConfigRuntimeApi, 'getConfig').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        config: backendConfigFixture(),
        modifiable_fields: ['agent.default_model'],
      },
    })

    await useSettingsStore.getState().reloadBackendConfig()

    expect(reloadConfigSpy).toHaveBeenCalledTimes(1)
    expect(getConfigSpy).toHaveBeenCalledTimes(1)
    expect(useSettingsStore.getState().settings.backendConfig.syncStatus).toBe('idle')
  })
})
