import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NovelTemplate } from '../services/templates/novelTemplates'

const {
  onCompleteMock,
  createNewProjectMock,
  createNewProjectFromTemplateMock,
  selectProjectMock,
  updateProviderMock,
  updateSettingsMock,
  mockedTemplate,
  enI18nStrings,
  appStoreState,
  settingsStoreState,
} = vi.hoisted(() => {
  const createNewProjectMock = vi.fn(() => 'project-1')
  const createNewProjectFromTemplateMock = vi.fn(() => 'project-template-1')
  const selectProjectMock = vi.fn()
  const updateProviderMock = vi.fn()
  const updateSettingsMock = vi.fn()
  const mockedTemplate: NovelTemplate = {
    id: 'template-mystery',
    name: 'Mystery Detective',
    nameZh: '悬疑推理',
    description: 'A mystery template',
    descriptionZh: '悬疑模板',
    icon: '🔍',
    characters: [{ name: '沈墨', role: '主角', description: '侦探', traits: ['冷静'] }],
    plotSkeleton: [{ name: '案件', description: '调查', type: 'main' }],
    chapterOutlines: [
      { title: '第一章', summary: '开场' },
      { title: '第二章', summary: '调查' },
    ],
    worldviewElements: [{ category: '世界', name: '都市', description: '现代都市' }],
  }

  return {
    onCompleteMock: vi.fn(),
    createNewProjectMock,
    createNewProjectFromTemplateMock,
    selectProjectMock,
    updateProviderMock,
    updateSettingsMock,
    mockedTemplate,
    enI18nStrings: {
      welcomeTitle: 'Welcome to Niko Studio',
      welcomeStepCreateProject: 'Create Project',
      welcomeStepConfigureAI: 'Configure AI',
      welcomeStepStartWriting: 'Start Writing',
      welcomeProjectNameLabel: 'Novel Name',
      welcomeProjectNamePlaceholder: 'Enter your novel name...',
      welcomeCreateProject: 'Create Project',
      welcomeCreateFromTemplate: 'Create from Template',
      welcomeTemplateChars: 'chars',
      welcomeTemplateChapters: 'ch',
      welcomeTemplateSelectedHint:
        'Will create "{name}" project with {chars} characters and {chapters} chapter outlines',
      welcomeAIExplanation:
        'The AI writing assistant requires an LLM provider to work. You can also configure this later in Settings.',
      welcomeProviderLabel: 'Select Provider',
      welcomeApiKeyLabel: 'API Key',
      welcomeApiKeyPlaceholder: 'sk-...',
      welcomeSaveAndContinue: 'Save & Continue',
      welcomeSkipAI: 'Skip, configure later',
      welcomeAllSetTitle: "You're all set!",
      welcomeAllSetDescription: 'Your writing environment is ready. Time to start creating.',
      welcomeTipSlash: 'Type / to trigger AI commands',
      welcomeTipSave: 'Ctrl+S to save current content',
      welcomeTipShortcuts: 'Ctrl+/ to view all shortcuts',
      welcomeStartWriting: 'Start Writing',
    },
    appStoreState: {
      createNewProject: createNewProjectMock,
      createNewProjectFromTemplate: createNewProjectFromTemplateMock,
      selectProject: selectProjectMock,
    },
    settingsStoreState: {
      settings: {
        llmProviders: [
          { id: 'openai', name: 'OpenAI' },
          { id: 'ollama', name: 'Ollama' },
        ],
      },
      updateProvider: updateProviderMock,
      updateSettings: updateSettingsMock,
    },
  }
})

// Mock with English language to cover the non-zh ternary branches
vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: enI18nStrings,
    language: 'en',
  }),
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: <T,>(selector: (state: typeof appStoreState) => T) => selector(appStoreState),
}))

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: <T,>(selector: (state: typeof settingsStoreState) => T) =>
    selector(settingsStoreState),
}))

vi.mock('../services/templates/novelTemplates', () => ({
  NOVEL_TEMPLATES: [mockedTemplate],
}))

import { WelcomeWizard } from './WelcomeWizard'

function renderWizard() {
  return render(<WelcomeWizard onComplete={onCompleteMock} />)
}

describe('WelcomeWizard — uncovered branches', () => {
  beforeEach(() => {
    createNewProjectMock.mockClear()
    createNewProjectFromTemplateMock.mockClear()
    selectProjectMock.mockClear()
    updateProviderMock.mockClear()
    updateSettingsMock.mockClear()
    onCompleteMock.mockClear()
  })

  it('displays English template name and description when language is en (lines 155, 158)', async () => {
    renderWizard()

    // template.name (English) should be rendered since language is 'en'
    expect(screen.getByText('Mystery Detective')).toBeInTheDocument()
    // template.description (English) should be rendered since language is 'en'
    expect(screen.getByText('A mystery template')).toBeInTheDocument()
  })

  it('selects a template and shows English name in hint when language is en (line 170)', async () => {
    const user = userEvent.setup()

    renderWizard()

    // Click template button to select it
    await user.click(screen.getByRole('button', { name: /Mystery Detective/ }))

    // The hint should show English name from template.name (not nameZh)
    expect(
      screen.getByText(
        'Will create "Mystery Detective" project with 1 characters and 2 chapter outlines'
      )
    ).toBeInTheDocument()
  })

  it('clicks create button with empty project name and no template — guard branch on line 44', async () => {
    const user = userEvent.setup()

    renderWizard()

    // The button is disabled when both name is empty and no template selected,
    // but we can still verify the guard by checking the disabled state and
    // ensuring createNewProject is not called
    const createButton = screen.getByRole('button', { name: 'Create Project' })
    expect(createButton).toBeDisabled()

    // Force-click the disabled button to trigger the guard branch
    // userEvent won't click disabled buttons, so we invoke the handler directly
    // by removing the disabled attribute temporarily
    createButton.removeAttribute('disabled')
    await user.click(createButton)

    // The handleCreateProject guard (!projectName.trim()) should prevent project creation
    expect(createNewProjectMock).not.toHaveBeenCalled()
    expect(createNewProjectFromTemplateMock).not.toHaveBeenCalled()
  })

  it('deselects a selected template when clicking it again — optional chaining branch on line 144', async () => {
    const user = userEvent.setup()

    renderWizard()

    const templateButton = screen.getByRole('button', { name: /Mystery Detective/ })

    // First click: select template (selectedTemplate is null → selectedTemplate?.id is undefined,
    // so the ternary else branch runs, setting the template)
    await user.click(templateButton)
    expect(
      screen.getByText(
        'Will create "Mystery Detective" project with 1 characters and 2 chapter outlines'
      )
    ).toBeInTheDocument()

    // Second click: deselect (selectedTemplate?.id === template.id → ternary true branch, sets null)
    await user.click(templateButton)

    // Template should be deselected — hint text should not be present
    expect(
      screen.queryByText(
        'Will create "Mystery Detective" project with 1 characters and 2 chapter outlines'
      )
    ).not.toBeInTheDocument()
  })
})
