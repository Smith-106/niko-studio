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

const originalCreateElement = document.createElement.bind(document)
const originalFileReader = globalThis.FileReader
const BACKEND_SECTION_HEAVY_TEST_TIMEOUT_MS = 30_000
const BACKEND_SECTION_SYNC_TEST_TIMEOUT_MS = 60_000

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

function mockFileReaderWithResult(result: string) {
  class MockFileReader {
    public onload: ((event: { target: { result: string } }) => void) | null = null

    readAsText() {
      this.onload?.({ target: { result } })
    }
  }

  vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader)
}

describe('SettingsModal additional coverage', () => {
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

  it('keeps all context types enabled when the last selection is cleared', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSettingsModal({ onClose })

    await user.click(screen.getByRole('button', { name: zh.settingsRetrieval }))
    await user.click(screen.getByLabelText(zh.settingsContextTypeWorld))
    await user.click(screen.getByLabelText(zh.settingsContextTypeCharacter))
    await user.click(screen.getByLabelText(zh.settingsContextTypePlot))
    await user.click(screen.getByRole('button', { name: zh.save }))

    expect(useSettingsStore.getState().settings.contextTypes).toEqual(['world', 'character', 'plot'])
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('marks quality goals as custom when sliders and instructions are edited', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSettingsModal({ onClose })

    fireEvent.change(screen.getByLabelText(zh.qualityGoalNaturalness), {
      target: { value: '91' },
    })
    fireEvent.change(screen.getByLabelText(zh.qualityGoalSentenceEntropy), {
      target: { value: '66' },
    })
    fireEvent.change(screen.getByLabelText(zh.qualityGoalRhythmVariability), {
      target: { value: '72' },
    })
    fireEvent.change(screen.getByLabelText(zh.qualityGoalCustomInstruction), {
      target: { value: '保持更克制的节奏。' },
    })

    await user.click(screen.getByRole('button', { name: zh.save }))

    expect(useSettingsStore.getState().settings.qualityGoals).toEqual(
      expect.objectContaining({
        naturalness: 91,
        sentenceEntropyTarget: 66,
        rhythmVariabilityTarget: 72,
        customHumanizationInstruction: '保持更克制的节奏。',
        humanizationPreset: 'custom',
      }),
    )
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('surfaces runtime sync failures in tauri mode and keeps focus on backend support', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    isTauriRuntimeMock.mockReturnValue(true)
    syncGatewayBaseOverrideMock.mockRejectedValue(new Error('sync exploded'))

    renderSettingsModal({ onClose })
    await user.click(screen.getByRole('button', { name: zh.save }))

    await waitFor(() => {
      expect(syncGatewayBaseOverrideMock).toHaveBeenCalledWith('http://127.0.0.1:8000')
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByText('设置已保存，但这些阶段仍需处理：运行时同步')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: zh.settingsAdvancedSupport })).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByLabelText(zh.backendUrl)).toBeInTheDocument()
    })
  })

  it('exports settings, imports valid and invalid files, and resets local state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T08:00:00.000Z'))

    const appendChildSpy = vi.spyOn(document.body, 'appendChild')
    const removeChildSpy = vi.spyOn(document.body, 'removeChild')
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:settings')
    const revokeObjectURLSpy = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    } as unknown as typeof URL)
    const anchor = originalCreateElement('a')
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return anchor
      }
      return originalCreateElement(tagName)
    }) as typeof document.createElement)

    renderSettingsModal()

    const backendUrlInput = screen.getByLabelText(zh.backendUrl) as HTMLInputElement
    fireEvent.change(backendUrlInput, { target: { value: 'http://localhost:9200' } })
    fireEvent.click(screen.getByTitle(zh.exportSettings))

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(anchor.download).toBe('niko-studio-settings-2026-06-03.json')
    expect(anchor.href).toBe('blob:settings')
    expect(appendChildSpy).toHaveBeenCalledWith(anchor)
    expect(removeChildSpy).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:settings')

    mockFileReaderWithResult(JSON.stringify({
      version: '1.0',
      settings: {
        ...useSettingsStore.getState().settings,
        apiBaseUrl: 'http://imported:7777',
      },
    }))

    const fileInput = screen.getByLabelText(zh.importSettings) as HTMLInputElement
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['valid'], 'valid.json', { type: 'application/json' })],
      },
    })

    expect(screen.getByText(zh.importSuccess)).toBeInTheDocument()
    expect((screen.getByLabelText(zh.backendUrl) as HTMLInputElement).value).toBe('http://imported:7777')
    expect(fileInput.value).toBe('')

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText(zh.importSuccess)).not.toBeInTheDocument()

    mockFileReaderWithResult(JSON.stringify({ version: '1.0' }))
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['invalid'], 'invalid.json', { type: 'application/json' })],
      },
    })

    expect(screen.getByText('导入失败: 无效的配置文件格式')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText('导入失败: 无效的配置文件格式')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(zh.backendUrl), {
      target: { value: 'http://mutated:7000' },
    })
    fireEvent.click(screen.getByText(zh.resetDefault))

    expect((screen.getByLabelText(zh.backendUrl) as HTMLInputElement).value).toBe('http://127.0.0.1:8000')
  })

  it('closes when the backdrop receives the full pointer interaction', () => {
    const onClose = vi.fn()
    renderSettingsModal({ onClose })

    const backdrop = screen.getByRole('dialog').parentElement as HTMLDivElement
    fireEvent.mouseDown(backdrop)
    fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders backend sync success, edits secrets, and saves new secret values', async () => {
    const updateSecrets = vi.fn().mockResolvedValue(undefined)
    seedBackendStore({
      lastSync: '2026-06-03T01:02:03.000Z',
      updateSecrets,
    })

    const user = userEvent.setup()
    renderSettingsModal({ requestedSection: 'backend' })

    expect(await screen.findByText(/同步成功/)).toBeInTheDocument()
    expect(screen.getByText('agent.google_api_key')).toBeInTheDocument()
    expect(screen.getByText(zh.backendConfigConfigured)).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: zh.backendConfigShowSecret })[0])
    const secretInput = screen.getByLabelText('agent.google_api_key') as HTMLInputElement
    expect(secretInput.type).toBe('text')

    fireEvent.change(secretInput, { target: { value: 'fresh-google-secret' } })
    await user.click(screen.getByRole('button', { name: zh.backendConfigSaveSecrets }))

    await waitFor(() => {
      expect(updateSecrets).toHaveBeenCalledWith({
        'agent.google_api_key': {
          configured: true,
          value: 'fresh-google-secret',
        },
      })
      expect((screen.getByLabelText('agent.google_api_key') as HTMLInputElement).value).toBe('')
    })
  }, BACKEND_SECTION_SYNC_TEST_TIMEOUT_MS)

  it('updates model settings, tests connectivity, validates models, refreshes models, and applies custom models', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    checkBackendHealthMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    fetchProviderModelsMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          models: ['gpt-4-turbo'],
          source: 'gateway',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          models: ['gpt-4-turbo', 'gpt-4.1-mini'],
          source: 'gateway',
        },
      })

    renderSettingsModal({ onClose })
    await user.click(screen.getByRole('button', { name: zh.llmConfig }))

    await user.click(screen.getByLabelText('OpenAI (GPT)'))
    expect(screen.getByLabelText(zh.apiKey)).toBeInTheDocument()

    await user.click(screen.getByLabelText(zh.settingsAllowFallback))
    await user.click(screen.getByLabelText(zh.multiModel))
    await user.click(screen.getByLabelText(zh.settingsDetectionGuard))
    await user.click(screen.getByLabelText(zh.writingHelperLegacyPolish))

    fireEvent.change(screen.getByLabelText(zh.apiKey), {
      target: { value: 'sk-openai-test' },
    })

    const getEnabledTestConnectionButton = () =>
      screen
        .getAllByRole('button', { name: zh.testConnection })
        .find((button) => !button.hasAttribute('disabled')) as HTMLButtonElement

    await user.click(getEnabledTestConnectionButton())
    await waitFor(() => {
      expect(document.querySelector('.text-green-500')).not.toBeNull()
    })

    await user.click(getEnabledTestConnectionButton())
    await waitFor(() => {
      expect(document.querySelector('.text-red-500')).not.toBeNull()
    })

    await user.click(screen.getByRole('button', { name: zh.settingsValidateDefaultModel }))
    expect(await screen.findByText(zh.settingsDefaultModelAvailableViaGateway)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.settingsRefreshModels }))
    expect(await screen.findByText(/最近同步：/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(zh.settingsCustomModel), {
      target: { value: 'bad model' },
    })
    await user.click(screen.getByRole('button', { name: zh.settingsUseThisModel }))
    expect(screen.getByText(zh.settingsModelNameWhitespace)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(zh.settingsCustomModel), {
      target: { value: 'gpt-4.1-mini' },
    })
    await user.click(screen.getByRole('button', { name: zh.settingsUseThisModel }))
    expect((screen.getByLabelText(zh.settingsCustomModel) as HTMLInputElement).value).toBe('')

    await user.click(screen.getByLabelText(zh.setPrimary))
    expect(screen.getByText(zh.primary)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.save }))

    expect(useSettingsStore.getState().settings).toEqual(expect.objectContaining({
      allowLlmFallback: false,
      useMultiModel: true,
      detectionEvasionGuardEnabled: false,
      writingHelperUseLegacyPolish: true,
      primaryProvider: 'openai',
    }))
    expect(
      useSettingsStore.getState().settings.llmProviders.find((provider) => provider.id === 'openai'),
    ).toEqual(expect.objectContaining({
      enabled: true,
      apiKey: 'sk-openai-test',
      defaultModel: 'gpt-4.1-mini',
      modelSelectionMode: 'custom',
      customModels: expect.arrayContaining(['gpt-4.1-mini']),
    }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  }, BACKEND_SECTION_HEAVY_TEST_TIMEOUT_MS)

  it('renders style profile empty state and extracted profile values', async () => {
    const user = userEvent.setup()

    const firstRender = renderSettingsModal()
    await user.click(screen.getByRole('button', { name: zh.styleProfileTitle }))
    expect(screen.getByText('打开一个项目后，即可提取和查看该项目的写作风格档案。')).toBeInTheDocument()
    firstRender.unmount()

    useAppStore.setState({ currentProjectId: 'project-1' })
    getStyleProfileMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          avgSentenceLength: 14.2,
          vocabRichness: 0.67,
          dialogueRatio: 0.41,
          tensePreference: 'past',
          dominantPOV: 'third',
        },
      })
      .mockResolvedValueOnce({
        success: false,
        data: null,
      })

    renderSettingsModal()
    await user.click(screen.getByRole('button', { name: zh.styleProfileTitle }))
    await user.click(screen.getByRole('button', { name: zh.styleProfileExtract }))

    expect(await screen.findByText('14.2')).toBeInTheDocument()
    expect(screen.getByText('0.67')).toBeInTheDocument()
    expect(screen.getByText('0.41')).toBeInTheDocument()
    expect(screen.getByText('past')).toBeInTheDocument()
    expect(screen.getByText('third')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.styleProfileExtract }))
    expect(await screen.findByText(zh.styleProfileNotFound)).toBeInTheDocument()
  })

  it('updates UI preferences and saves them to the store', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const syncI18nLanguageSpy = vi.spyOn(i18nModule, 'syncI18nLanguage')

    renderSettingsModal({ onClose })
    await user.click(screen.getByRole('button', { name: zh.uiSettings }))

    await user.click(screen.getByRole('button', { name: zh.themeSepia }))
    await user.selectOptions(screen.getByLabelText(zh.fontSize), 'large')
    await user.selectOptions(screen.getByLabelText(zh.language), 'en')
    await user.selectOptions(screen.getByLabelText(zh.sendShortcutLabel), 'ctrlEnter')
    await user.click(screen.getByRole('button', { name: zh.save }))

    expect(syncI18nLanguageSpy).toHaveBeenCalledTimes(1)
    expect(useSettingsStore.getState().settings).toEqual(expect.objectContaining({
      theme: 'sepia',
      fontSize: 'large',
      language: 'en',
      sendShortcut: 'ctrlEnter',
    }))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('updates workflow and retrieval controls, then forwards the import trigger click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const initialAutoSkillMatch = useSettingsStore.getState().settings.autoSkillMatch

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        contextTypes: ['world'],
        retrieval: {
          ...state.settings.retrieval,
          maxIterations: 3,
          confidenceThreshold: 0.72,
        },
      },
    }))

    renderSettingsModal({ onClose })

    await user.selectOptions(screen.getByLabelText(zh.defaultWorkflow), 'L5')
    fireEvent.change(screen.getByLabelText(zh.targetWords), {
      target: { value: '2500' },
    })
    await user.click(screen.getByLabelText(zh.autoSkillMatch))

    await user.click(screen.getByRole('button', { name: zh.settingsRetrieval }))
    await user.click(screen.getByLabelText(zh.settingsContextTypeCharacter))
    const maxIterationsInput = screen.getByLabelText(zh.settingsRetrievalMaxIterations) as HTMLInputElement
    const confidenceThresholdInput = screen.getByLabelText(zh.settingsRetrievalConfidenceThreshold) as HTMLInputElement

    fireEvent.change(maxIterationsInput, {
      target: { value: 'not-a-number' },
    })
    fireEvent.change(confidenceThresholdInput, {
      target: { value: '' },
    })
    expect(maxIterationsInput.value).toBe('')
    expect(confidenceThresholdInput.value).toBe('')

    const importInput = screen.getByLabelText(zh.importSettings) as HTMLInputElement
    const importClickSpy = vi.spyOn(importInput, 'click')
    await user.click(screen.getByTitle(zh.importSettings))
    expect(importClickSpy).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: zh.save }))

    expect(useSettingsStore.getState().settings).toEqual(expect.objectContaining({
      defaultWorkflowLevel: 'L5',
      targetWordsPerChapter: 2500,
      autoSkillMatch: !initialAutoSkillMatch,
      contextTypes: ['world', 'character'],
    }))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('filters provider cards and updates model connection fields', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    renderSettingsModal({ onClose })
    await user.click(screen.getByRole('button', { name: zh.llmConfig }))

    await user.type(screen.getByLabelText(zh.settingsRetrievalProviderModel), 'OpenAI')
    await user.click(screen.getByLabelText('OpenAI (GPT)'))

    const apiKeyInput = screen.getByLabelText(zh.apiKey) as HTMLInputElement
    expect(apiKeyInput.type).toBe('password')
    fireEvent.change(apiKeyInput, {
      target: { value: 'sk-openai-updated' },
    })

    const toggleApiKeyButton = apiKeyInput.parentElement?.querySelector('button') as HTMLButtonElement
    await user.click(toggleApiKeyButton)
    expect((screen.getByLabelText(zh.apiKey) as HTMLInputElement).type).toBe('text')

    fireEvent.change(screen.getByLabelText(zh.baseUrl), {
      target: { value: 'https://api.openai.example/v2' },
    })

    const defaultModelSelect = screen.getByLabelText(zh.defaultModel) as HTMLSelectElement
    const nextDefaultModel = Array.from(defaultModelSelect.options).find(
      (option) => option.value && option.value !== defaultModelSelect.value,
    )?.value
    expect(nextDefaultModel).toBeTruthy()
    await user.selectOptions(defaultModelSelect, nextDefaultModel as string)

    await user.click(screen.getByRole('button', { name: zh.save }))

    expect(
      useSettingsStore.getState().settings.llmProviders.find((provider) => provider.id === 'openai'),
    ).toEqual(expect.objectContaining({
      enabled: true,
      apiKey: 'sk-openai-updated',
      baseUrl: 'https://api.openai.example/v2',
      defaultModel: nextDefaultModel,
    }))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('renders backend and style fallback states for nullish data', async () => {
    const user = userEvent.setup()

    seedBackendStore({
      syncStatus: 'error',
      error: null,
    })
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        backendConfig: {
          ...state.settings.backendConfig,
          config: {
            ...createBackendConfig(),
            graph: null as never,
            integration: {} as never,
          },
        },
      },
    }))
    useAppStore.setState({
      currentProjectId: 'project-style-fallback',
    })
    getSecretsMock.mockResolvedValue({
      success: false,
      error: '',
    })
    getStyleProfileMock.mockResolvedValue({
      success: true,
      data: {
        avgSentenceLength: null,
        vocabRichness: null,
        dialogueRatio: null,
        tensePreference: '',
        dominantPOV: '',
      },
    })

    renderSettingsModal({ requestedSection: 'backend' })

    await waitFor(() => {
      expect(screen.getAllByText(zh.settingsUnknownError).length).toBeGreaterThan(0)
    })

    await user.click(screen.getByRole('button', { name: zh.styleProfileTitle }))
    await user.click(screen.getByRole('button', { name: zh.styleProfileExtract }))

    await waitFor(() => {
      expect(screen.getByText('0.0')).toBeInTheDocument()
      expect(screen.getAllByText('0.00').length).toBeGreaterThan(0)
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })
  })

  it('refreshes diagnostics and shows loading plus failure messaging', async () => {
    let resolveMetrics: ((value: unknown) => void) | null = null
    getGatewayMetricsMock.mockImplementation(() => new Promise((resolve) => {
      resolveMetrics = resolve
    }))
    listGatewayToolsMock.mockResolvedValue({
      success: false,
      error: 'tools down',
    })

    renderSettingsModal({ requestedSection: 'diagnostics' })

    fireEvent.click(screen.getByRole('button', { name: zh.settingsRefreshDiagnostics }))
    expect(screen.getByRole('button', { name: zh.mcpRefreshing })).toBeDisabled()

    await act(async () => {
      resolveMetrics?.({
        success: true,
        data: {
          metrics: {
            requests_total: 5,
            requests_failed_total: 1,
            requests_success_total: 4,
            latency_ms_avg: 11,
            latency_ms_max: 22,
          },
        },
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText(zh.settingsDiagnosticsFetchFailed)).toBeInTheDocument()
    })
  })
})
