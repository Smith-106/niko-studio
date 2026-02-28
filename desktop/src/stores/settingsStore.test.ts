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
})
