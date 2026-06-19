import { afterEach, describe, expect, it, vi } from 'vitest'

async function importStateModule() {
  vi.resetModules()
  vi.doUnmock('./types')
  return import('./state')
}

describe('settings state branch coverage', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('./types')
  })

  it('falls back to built-in quality goal defaults when the human-writing preset is unavailable', async () => {
    vi.resetModules()
    vi.doMock('./types', async () => {
      const actual = await vi.importActual<typeof import('./types')>('./types')
      return {
        ...actual,
        QUALITY_PRESET_TEMPLATES: actual.QUALITY_PRESET_TEMPLATES.filter((preset) => preset.id !== 'human_writing'),
      }
    })

    const { normalizeSettings } = await import('./state')
    const settings = normalizeSettings()

    expect(settings.qualityGoals).toEqual({
      naturalness: 80,
      readability: 80,
      coherence: 80,
      styleConsistency: 80,
      humanizationPreset: 'human_writing',
      customHumanizationInstruction: '',
      sentenceEntropyTarget: 55,
      rhythmVariabilityTarget: 55,
    })
  })

  it('normalizes nullish provider arrays, empty context lists, and missing runtime state', async () => {
    const {
      defaultBackendConfigState,
      normalizePromptTemplateLibrary,
      normalizeSettings,
    } = await importStateModule()

    const settings = normalizeSettings({
      fontSize: 'large',
      retrieval: {
        enabled: true,
        searchMode: 'hybrid',
        profile: null as never,
        maxIterations: null as never,
      } as never,
      contextTypes: [] as never,
      llmProviders: [
        {
          id: 'provider-nullish',
          name: 'Nullish Provider',
          enabled: false,
          apiKey: '',
          baseUrl: 'https://example.com',
          models: null as never,
          fetchedModels: undefined as never,
          customModels: null as never,
          defaultModel: '  loose-default  ',
          modelSelectionMode: 'list',
        },
      ] as never,
    })

    expect(settings.fontSize).toBe('large')
    expect(settings.retrieval.profile).toBe('')
    expect(settings.retrieval.maxIterations).toBe(3)
    expect(settings.contextTypes).toEqual(['world', 'character', 'plot'])
    expect(settings.backendConfig).toEqual(defaultBackendConfigState())
    expect(settings.llmProviders).toEqual([
      expect.objectContaining({
        id: 'provider-nullish',
        models: [],
        fetchedModels: [],
        customModels: [],
        defaultModel: '  loose-default  ',
      }),
    ])

    const library = normalizePromptTemplateLibrary({
      version: 1,
      templates: [
        {
          id: 'tpl-null-vars',
          title: 'Template with null vars',
          category: 'custom',
          content: 'body',
          variables: undefined as never,
          isFavorite: false,
          createdAt: '',
          updatedAt: '',
        },
      ],
      recentTemplateIds: ['tpl-null-vars'],
      variablePresets: {},
    })

    expect(library.templates).toEqual([
      expect.objectContaining({
        id: 'tpl-null-vars',
        variables: [],
      }),
    ])
  })
})
