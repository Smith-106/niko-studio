import { render, screen } from '@testing-library/react'
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
  i18nStrings,
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
    i18nStrings: {
      welcomeTitle: '欢迎使用 Niko Studio',
      welcomeStepCreateProject: '创建项目',
      welcomeStepConfigureAI: '配置 AI',
      welcomeStepStartWriting: '开始写作',
      welcomeProjectNameLabel: '小说名称',
      welcomeProjectNamePlaceholder: '输入你的小说名称...',
      welcomeCreateProject: '创建项目',
      welcomeCreateFromTemplate: '从模板创建 / Create from Template',
      welcomeTemplateChars: '角色',
      welcomeTemplateChapters: '章',
      welcomeTemplateSelectedHint:
        '将创建「{name}」项目，包含 {chars} 个角色和 {chapters} 个章节大纲',
      welcomeAIExplanation:
        'AI 写作助手需要配置 LLM 提供商才能使用。你也可以稍后在设置中配置。',
      welcomeProviderLabel: '选择提供商',
      welcomeApiKeyLabel: 'API Key',
      welcomeApiKeyPlaceholder: 'sk-...',
      welcomeSaveAndContinue: '保存并继续',
      welcomeSkipAI: '跳过，稍后配置',
      welcomeAllSetTitle: '一切就绪！',
      welcomeAllSetDescription: '你的写作环境已准备完毕，现在可以开始创作了。',
      welcomeTipSlash: '输入 / 触发 AI 命令',
      welcomeTipSave: 'Ctrl+S 保存当前内容',
      welcomeTipShortcuts: 'Ctrl+/ 查看所有快捷键',
      welcomeStartWriting: '开始写作',
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

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: i18nStrings,
    language: 'zh',
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

async function advanceToStep2(user: ReturnType<typeof userEvent.setup>) {
  renderWizard()
  await user.type(screen.getByLabelText('小说名称'), '  夜色追凶  ')
  await user.click(screen.getByRole('button', { name: '创建项目' }))
}

describe('WelcomeWizard', () => {
  beforeEach(() => {
    createNewProjectMock.mockClear()
    createNewProjectFromTemplateMock.mockClear()
    selectProjectMock.mockClear()
    updateProviderMock.mockClear()
    updateSettingsMock.mockClear()
    onCompleteMock.mockClear()
  })

  it('creates a project from the typed name and advances to AI setup', async () => {
    const user = userEvent.setup()

    renderWizard()

    const createButton = screen.getByRole('button', { name: '创建项目' })
    expect(createButton).toBeDisabled()

    await user.type(screen.getByLabelText('小说名称'), '  夜色追凶  ')
    expect(createButton).toBeEnabled()

    await user.click(createButton)

    expect(createNewProjectMock).toHaveBeenCalledWith('夜色追凶')
    expect(selectProjectMock).toHaveBeenCalledWith('project-1')
    expect(screen.getByRole('heading', { name: '配置 AI' })).toBeInTheDocument()
  })

  it('selects a template, clears the manual name, and creates from the template', async () => {
    const user = userEvent.setup()

    renderWizard()

    const nameInput = screen.getByLabelText('小说名称') as HTMLInputElement
    await user.type(nameInput, '手动名称')
    await user.click(screen.getByRole('button', { name: /悬疑推理/ }))

    expect(nameInput.value).toBe('')
    expect(screen.getByText('将创建「悬疑推理」项目，包含 1 个角色和 2 个章节大纲')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '创建项目' }))

    expect(createNewProjectFromTemplateMock).toHaveBeenCalledWith(mockedTemplate)
    expect(createNewProjectMock).not.toHaveBeenCalled()
    expect(selectProjectMock).toHaveBeenCalledWith('project-template-1')
    expect(screen.getByRole('heading', { name: '配置 AI' })).toBeInTheDocument()
  })

  it('saves the provider API key and supports toggling API key visibility', async () => {
    const user = userEvent.setup()

    await advanceToStep2(user)

    await user.selectOptions(screen.getByLabelText('选择提供商'), 'openai')

    const apiKeyInput = screen.getByLabelText('API Key') as HTMLInputElement
    expect(apiKeyInput.type).toBe('password')

    const toggleButton = apiKeyInput.parentElement?.querySelector('button')
    expect(toggleButton).toBeInstanceOf(HTMLButtonElement)
    await user.click(toggleButton as HTMLButtonElement)
    expect(apiKeyInput.type).toBe('text')

    await user.type(apiKeyInput, '  sk-live-test  ')
    await user.click(screen.getByRole('button', { name: '保存并继续' }))

    expect(updateProviderMock).toHaveBeenCalledWith('openai', {
      enabled: true,
      apiKey: 'sk-live-test',
    })
    expect(updateSettingsMock).toHaveBeenCalledWith({ primaryProvider: 'openai' })
    expect(screen.getByText('一切就绪！')).toBeInTheDocument()
  })

  it('allows skipping AI setup and finishing the wizard', async () => {
    const user = userEvent.setup()

    await advanceToStep2(user)
    await user.click(screen.getByRole('button', { name: '跳过，稍后配置' }))

    expect(updateProviderMock).not.toHaveBeenCalled()
    expect(screen.getByText('一切就绪！')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '开始写作' }))
    expect(onCompleteMock).toHaveBeenCalledTimes(1)
  })
})
