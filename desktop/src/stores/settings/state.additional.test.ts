import { describe, expect, it } from 'vitest'
import type { LLMProvider, PromptTemplate, Settings } from './types'

import {
  defaultBackendConfigState,
  defaultSettings,
  normalizePromptTemplateLibrary,
  normalizeProvider,
  normalizeSettings,
  sanitizeSettingsForPersist,
} from './state'

function buildProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
  return {
    id: 'provider-1',
    name: 'Provider 1',
    enabled: true,
    apiKey: 'secret-key',
    baseUrl: 'https://example.com',
    models: ['alpha'],
    defaultModel: 'alpha',
    fetchedModels: [],
    customModels: [],
    modelSelectionMode: 'list',
    ...overrides,
  }
}

function buildTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    id: 'template-1',
    title: 'Template 1',
    category: 'custom',
    content: 'hello {name}',
    variables: [{ id: 'name', label: 'Name', required: true }],
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('settings state additional coverage', () => {
  it('normalizes and deduplicates provider models while preserving valid defaults', () => {
    const normalized = normalizeProvider(
      buildProvider({
        models: [' Alpha ', 'alpha', ''],
        fetchedModels: ['beta', 'BETA'],
        customModels: [' gamma ', 'Gamma'],
        defaultModel: ' missing ',
        modelSelectionMode: undefined,
      }),
    )

    expect(normalized.models).toEqual(['Alpha'])
    expect(normalized.fetchedModels).toEqual(['beta'])
    expect(normalized.customModels).toEqual(['gamma'])
    expect(normalized.defaultModel).toBe('Alpha')
    expect(normalized.modelSelectionMode).toBe('list')

    const preservesDefault = normalizeProvider(
      buildProvider({
        models: ['gpt-4o'],
        fetchedModels: ['gpt-4o-mini'],
        defaultModel: ' GPT-4O-mini ',
        modelSelectionMode: 'custom',
      }),
    )

    expect(preservesDefault.defaultModel).toBe('GPT-4O-mini')
    expect(preservesDefault.modelSelectionMode).toBe('custom')
  })

  it('normalizes template libraries by filtering duplicates, invalid recent ids, and malformed presets', () => {
    const library = normalizePromptTemplateLibrary({
      version: 5,
      templates: [
        buildTemplate({ id: 'keep', title: 'First keep' }),
        buildTemplate({ id: 'keep', title: 'Updated keep', isFavorite: true }),
        buildTemplate({
          id: 'two',
          title: '  ',
          variables: [{ id: ' tone ', label: '   ', required: 1 as never }],
        }),
        buildTemplate({ id: '   ' }),
      ],
      recentTemplateIds: ['two', 'missing', 'two', 'keep'],
      variablePresets: {
        keep: { hero: 'Niko', '': 'ignored', broken: 42 as never },
        missing: { ghost: 'value' },
        two: null as never,
      },
    })

    expect(library.version).toBe(5)
    expect(library.templates).toHaveLength(2)
    expect(library.templates[0]).toMatchObject({
      id: 'keep',
      title: 'Updated keep',
      isFavorite: true,
    })
    expect(library.templates[1]).toMatchObject({
      id: 'two',
      title: 'two',
    })
    expect(library.templates[1].variables).toEqual([
      { id: 'tone', label: 'tone', required: true, defaultValue: undefined, description: undefined },
    ])
    expect(library.recentTemplateIds).toEqual(['two', 'keep'])
    expect(library.variablePresets).toEqual({
      keep: { hero: 'Niko' },
    })
  })

  it('normalizes retrieval, theme, language, and runtime state boundaries', () => {
    const settings = normalizeSettings(
      {
        theme: 'light' as never,
        fontSize: 'gigantic' as never,
        language: 'jp' as never,
        sendShortcut: 'shiftEnter' as never,
        qualityGoals: { naturalness: 91 },
        retrieval: {
          enabled: 0 as never,
          searchMode: 'unsupported' as never,
          profile: '  focused  ',
          minScore: '0.6' as never,
          budgetTokens: 'NaN' as never,
          rerank: 'yes' as never,
          maxIterations: '0' as never,
          confidenceThreshold: 1.23456 as never,
        },
        contextTypes: ['world', 'plot', 'world', 'invalid'] as never,
        llmProviders: [
          buildProvider({
            models: ['Alpha', 'alpha'],
            fetchedModels: ['beta'],
            customModels: [''],
            defaultModel: 'beta',
          }),
        ],
        backendConfig: {
          config: { stale: true } as never,
          modifiableFields: ['agent.default_model', 42 as never],
          syncStatus: 'syncing',
          lastSync: '2026-06-07T00:00:00.000Z',
          error: 'stale',
        },
      },
      { includeRuntimeState: false },
    )

    expect(settings.theme).toBe('sorbet')
    expect(settings.fontSize).toBe('medium')
    expect(settings.language).toBe('zh')
    expect(settings.sendShortcut).toBe('enter')
    expect(settings.qualityGoals.naturalness).toBe(91)
    expect(settings.retrieval).toEqual({
      enabled: false,
      searchMode: 'hybrid',
      profile: 'focused',
      minScore: 0.6,
      budgetTokens: undefined,
      rerank: true,
      maxIterations: 1,
      confidenceThreshold: 1,
    })
    expect(settings.contextTypes).toEqual(['world', 'plot'])
    expect(settings.backendConfig).toEqual(defaultBackendConfigState())
    expect(settings.llmProviders[0]).toMatchObject({
      models: ['Alpha'],
      fetchedModels: ['beta'],
      customModels: [],
      defaultModel: 'beta',
    })
  })

  it('normalizes backend runtime state when runtime fields are included', () => {
    const settings = normalizeSettings({
      theme: 'dark' as never,
      language: 'en',
      sendShortcut: 'ctrlEnter',
      backendConfig: {
        config: { ok: true } as never,
        modifiableFields: ['workflow.quality_level', false as never],
        syncStatus: 'mystery' as never,
        lastSync: 123 as never,
        error: false as never,
      },
    })

    expect(settings.theme).toBe('slate')
    expect(settings.language).toBe('en')
    expect(settings.sendShortcut).toBe('ctrlEnter')
    expect(settings.backendConfig).toEqual({
      config: { ok: true },
      modifiableFields: ['workflow.quality_level'],
      syncStatus: 'idle',
      lastSync: null,
      error: null,
    })
  })

  it('falls back to retrieval and backend defaults when optional values are omitted', () => {
    const settings = normalizeSettings({
      retrieval: {
        enabled: true,
        searchMode: 'iterative',
        profile: 'balanced',
        minScore: undefined,
        budgetTokens: undefined,
        rerank: false,
        maxIterations: 4,
        confidenceThreshold: null as never,
      } as never,
      backendConfig: {
        config: null,
        modifiableFields: undefined,
        syncStatus: 'loading',
        lastSync: '2026-06-07T01:00:00.000Z',
        error: 'syncing',
      },
    })

    expect(settings.retrieval.confidenceThreshold).toBe(0.8)
    expect(settings.backendConfig).toEqual({
      config: null,
      modifiableFields: [],
      syncStatus: 'loading',
      lastSync: '2026-06-07T01:00:00.000Z',
      error: 'syncing',
    })
  })

  it('sanitizes persisted settings by blanking API keys and dropping runtime-only state', () => {
    const settings: Settings = {
      ...defaultSettings,
      apiKey: 'top-secret',
      llmProviders: [
        buildProvider({
          id: 'openai',
          apiKey: 'provider-secret',
          fetchedModels: ['gpt-4o-mini'],
        }),
      ],
      backendConfig: {
        config: { runtimeOnly: true } as never,
        modifiableFields: ['agent.default_model'],
        syncStatus: 'error',
        lastSync: '2026-06-07T00:00:00.000Z',
        error: 'boom',
      },
    }

    const persisted = sanitizeSettingsForPersist(settings) as Record<string, unknown>

    expect(persisted.apiKey).toBe('')
    expect(persisted.llmProviders).toEqual([
      expect.objectContaining({
        id: 'openai',
        apiKey: '',
      }),
    ])
    expect(persisted).not.toHaveProperty('backendConfig')
  })
})
