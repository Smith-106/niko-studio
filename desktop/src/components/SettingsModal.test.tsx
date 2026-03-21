import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsModal } from './SettingsModal'
import { useSettingsStore } from '../stores/settingsStore'
import { translations } from '../i18n'
import type { BackendConfig, SecretsResponse } from '../api/client'
import * as apiClient from '../api/client'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return {
    ...actual,
    getSecrets: vi.fn(),
  }
})

const zh = translations.zh
const en = translations.en
const mockedGetSecrets = vi.mocked(apiClient.getSecrets)

const createBackendConfig = (): BackendConfig => ({
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
    cors_dev_origins: ['http://localhost:5173'],
    cors_prod_origins: [],
    metrics_enabled: true,
    ui_bridge_enabled: false,
  },
  integration: {
    postgres_enabled: false,
    redis_cache_enabled: false,
    elasticsearch_enabled: false,
    neo4j_enabled: false,
    langflow_enabled: false,
  },
})

const createSecretsResponse = (): SecretsResponse['secrets'] => ({
  'agent.google_api_key': {
    configured: true,
    value: '***MASKED***',
  },
  'agent.openai_api_key': {
    configured: false,
    value: '',
  },
})

const getInputByLabel = (label: string): HTMLInputElement => {
  const labelNode = screen.getByText(label)
  const container = labelNode.parentElement
  if (!container) {
    throw new Error(`cannot find container for label: ${label}`)
  }
  const input = container.querySelector('input')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`cannot find input for label: ${label}`)
  }
  return input
}

describe('SettingsModal quality presets', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.setState((state) => ({
      ...state,
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
    mockedGetSecrets.mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        secrets: createSecretsResponse(),
      },
    })
  })

  it('updates quality goal sliders when preset changes', async () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    expect(getInputByLabel(zh.qualityGoalNaturalness).value).toBe('85')
    expect(getInputByLabel(zh.qualityGoalReadability).value).toBe('80')
    expect(getInputByLabel(zh.qualityGoalCoherence).value).toBe('80')
    expect(getInputByLabel(zh.qualityGoalStyleConsistency).value).toBe('78')
    expect(getInputByLabel(zh.qualityGoalSentenceEntropy).value).toBe('60')
    expect(getInputByLabel(zh.qualityGoalRhythmVariability).value).toBe('60')

    const presetLabel = screen.getByText(zh.qualityGoalPreset)
    const presetSelect = presetLabel.parentElement?.querySelector('select')
    expect(presetSelect).toBeInstanceOf(HTMLSelectElement)

    await userEvent.selectOptions(presetSelect as HTMLSelectElement, 'ai_edit_guidance')

    expect(getInputByLabel(zh.qualityGoalNaturalness).value).toBe('80')
    expect(getInputByLabel(zh.qualityGoalReadability).value).toBe('88')
    expect(getInputByLabel(zh.qualityGoalCoherence).value).toBe('86')
    expect(getInputByLabel(zh.qualityGoalStyleConsistency).value).toBe('84')
    expect(getInputByLabel(zh.qualityGoalSentenceEntropy).value).toBe('52')
    expect(getInputByLabel(zh.qualityGoalRhythmVariability).value).toBe('50')
  })

  it('persists retrieval and context type settings after save', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    const user = userEvent.setup()

    await user.click(screen.getByLabelText(zh.settingsEnableKnowledgeRetrieval))
    await user.selectOptions(screen.getByDisplayValue(zh.settingsSearchModeHybrid), 'iterative')

    const profileInput = screen.getByPlaceholderText(zh.settingsRetrievalProfilePlaceholder)
    await user.clear(profileInput)
    await user.type(profileInput, 'strict')


    const minScoreInput = getInputByLabel(zh.settingsRetrievalMinScore)
    const budgetTokensInput = getInputByLabel(zh.settingsRetrievalBudgetTokens)
    const maxIterationsInput = getInputByLabel(zh.settingsRetrievalMaxIterations)
    const confidenceThresholdInput = getInputByLabel(zh.settingsRetrievalConfidenceThreshold)

    await user.clear(minScoreInput)
    await user.type(minScoreInput, '0.35')
    await user.clear(budgetTokensInput)
    await user.type(budgetTokensInput, '2048')
    await user.clear(maxIterationsInput)
    await user.type(maxIterationsInput, '6')
    await user.clear(confidenceThresholdInput)
    await user.type(confidenceThresholdInput, '0.9')

    await user.click(screen.getByLabelText(zh.settingsEnableRerank))
    await user.click(screen.getByLabelText(zh.settingsContextTypeCharacter))

    await user.click(screen.getByRole('button', { name: zh.save }))

    const { retrieval, contextTypes } = useSettingsStore.getState().settings
    expect(retrieval.enabled).toBe(false)
    expect(retrieval.searchMode).toBe('iterative')
    expect(retrieval.profile).toBe('strict')
    expect(retrieval.minScore).toBe(0.35)
    expect(retrieval.budgetTokens).toBe(2048)
    expect(retrieval.maxIterations).toBe(6)
    expect(retrieval.confidenceThreshold).toBe(0.9)
    expect(retrieval.rerank).toBe(true)
    expect(contextTypes).toEqual(['world', 'plot'])
    expect(onClose).toHaveBeenCalled()
  })

  it('persists workflow backend mode after save', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    const user = userEvent.setup()

    const modeLabel = screen.getByText(zh.workflowBackendMode)
    const modeSelect = modeLabel.parentElement?.querySelector('select')
    expect(modeSelect).toBeInstanceOf(HTMLSelectElement)

    await user.selectOptions(modeSelect as HTMLSelectElement, 'uiBridge')
    await user.click(screen.getByRole('button', { name: zh.save }))

    expect(useSettingsStore.getState().settings.workflowBackendMode).toBe('uiBridge')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders workflow backend mode labels in english', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        language: 'en',
      },
    }))

    render(<SettingsModal isOpen onClose={vi.fn()} />)

    expect(screen.getByText(en.workflowBackendMode)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: en.workflowBackendModeStandard })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: en.workflowBackendModeUiBridge })).toBeInTheDocument()
  })

  it('loads backend config when opening backend section without cached config', async () => {
    const loadBackendConfig = vi.fn().mockResolvedValue(undefined)
    useSettingsStore.setState((state) => ({
      ...state,
      loadBackendConfig,
    }))

    const user = userEvent.setup()
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: zh.backendService }))

    await waitFor(() => {
      expect(loadBackendConfig).toHaveBeenCalledTimes(1)
      expect(mockedGetSecrets).toHaveBeenCalledTimes(1)
    })
  })

  it('renders backend config fields and only enables save for editable changes', async () => {
    const updateBackendConfig = vi.fn().mockResolvedValue(['agent.default_model'])
    const config = createBackendConfig()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        backendConfig: {
          config,
          modifiableFields: ['agent.default_model'],
          syncStatus: 'idle',
          lastSync: null,
          error: null,
        },
      },
      updateBackendConfig,
    }))

    const user = userEvent.setup()
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: zh.backendService }))

    // Wait for backend config panel to render all sections
    await waitFor(() => {
      expect(screen.getByText(zh.backendConfigSectionAgent)).toBeInTheDocument()
    })

    // Find the agent.default_model input by its specific ID
    const defaultModelInput = await screen.findByTestId('backend-config-agent-default_model')
    const saveButton = screen.getByRole('button', { name: zh.backendConfigSave })

    expect(defaultModelInput).toBeEnabled()
    expect(saveButton).toBeDisabled()
    expect(screen.getAllByText(zh.backendConfigReadOnlyHint).length).toBeGreaterThan(0)

    await user.clear(defaultModelInput)
    await user.type(defaultModelInput, 'gpt-4o-mini')

    expect(saveButton).toBeEnabled()

    await user.click(saveButton)

    expect(updateBackendConfig).toHaveBeenCalledWith({
      'agent.default_model': 'gpt-4o-mini',
    })
  })

  it('renders backend config labels in english', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        language: 'en',
        backendConfig: {
          config: createBackendConfig(),
          modifiableFields: ['agent.default_model'],
          syncStatus: 'idle',
          lastSync: null,
          error: null,
        },
      },
    }))

    const user = userEvent.setup()
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: en.backendService }))

    expect(await screen.findByText(en.backendConfigTitle)).toBeInTheDocument()
    expect(screen.getByText(en.backendConfigDescription)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.backendConfigSave })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.backendConfigSaveSecrets })).toBeInTheDocument()
    expect(screen.getByText(en.backendConfigSectionAgent)).toBeInTheDocument()
  })

  it('reloads backend config from the backend section', async () => {
    const reloadBackendConfig = vi.fn().mockResolvedValue(undefined)
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        backendConfig: {
          config: createBackendConfig(),
          modifiableFields: ['agent.default_model'],
          syncStatus: 'idle',
          lastSync: null,
          error: null,
        },
      },
      reloadBackendConfig,
    }))

    const user = userEvent.setup()
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: zh.backendService }))
    await user.click(await screen.findByRole('button', { name: zh.backendConfigReload }))

    await waitFor(() => {
      expect(reloadBackendConfig).toHaveBeenCalledTimes(1)
    })
  })

  it('renders backend sync status and disables actions while syncing', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        backendConfig: {
          config: createBackendConfig(),
          modifiableFields: ['agent.default_model'],
          syncStatus: 'syncing',
          lastSync: null,
          error: null,
        },
      },
    }))

    const user = userEvent.setup()
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: zh.backendService }))

    expect(await screen.findByText(zh.backendConfigSyncing)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.backendConfigReload })).toBeDisabled()
    expect(screen.getByRole('button', { name: zh.backendConfigSave })).toBeDisabled()
  })

  it('renders backend error and empty states', async () => {
    mockedGetSecrets.mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
        secrets: {},
      },
    })

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        backendConfig: {
          config: null,
          modifiableFields: [],
          syncStatus: 'error',
          lastSync: null,
          error: 'sync failed',
        },
      },
    }))

    const user = userEvent.setup()
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: zh.backendService }))

    expect(await screen.findByText('sync failed')).toBeInTheDocument()
    expect(screen.getByText(zh.backendConfigNoConfig)).toBeInTheDocument()
    expect(screen.getByText(zh.backendConfigNoSecrets)).toBeInTheDocument()
  })
})
