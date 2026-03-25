import { describe, expect, it } from 'vitest'
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

  it('does not persist sensitive api keys to localStorage', () => {
    localStorage.clear()
    const store = useSettingsStore.getState()

    store.updateSettings({ apiKey: 'top-secret-key' })
    store.updateProvider('anthropic', { apiKey: 'provider-secret-key' })

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
    expect(persistedRaw).not.toContain('top-secret-key')
    expect(persistedRaw).not.toContain('provider-secret-key')
  })
})
