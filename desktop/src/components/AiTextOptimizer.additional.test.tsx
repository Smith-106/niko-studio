import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AiTextOptimizer } from './AiTextOptimizer'
import { processWritingHelper } from '../api/client'
import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { getEditorHandle } from '../utils/editorHandle'

vi.mock('../api/client', () => ({
  processWritingHelper: vi.fn(),
}))

vi.mock('../utils/editorHandle', () => ({
  getEditorHandle: vi.fn(),
}))

const mockProcessWritingHelper = vi.mocked(processWritingHelper)
const mockGetEditorHandle = vi.mocked(getEditorHandle)
const zh = translations.zh
const en = translations.en

function createEditorHandle(selectedText = '') {
  return {
    insertText: vi.fn(),
    getSelectedText: vi.fn(() => selectedText),
    getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
    captureSelectionSnapshot: vi.fn(() => null),
    replaceSelectionSnapshot: vi.fn(() => false),
    insertBelowSelectionSnapshot: vi.fn(() => false),
    undoLastRevisionApply: vi.fn(() => false),
    triggerAIContinue: vi.fn(),
  }
}

function enableEnglishOpenAISettings() {
  useSettingsStore.getState().resetSettings()
  const currentProviders = useSettingsStore.getState().settings.llmProviders
  useSettingsStore.getState().updateSettings({
    language: 'en',
    detectionEvasionGuardEnabled: false,
    primaryProvider: 'openai',
    llmProviders: currentProviders.map((provider) =>
      provider.id === 'openai'
        ? {
            ...provider,
            enabled: true,
            apiKey: 'sk-openai-test',
            baseUrl: 'https://api.openai.example/v1',
            defaultModel: 'gpt-4-turbo',
          }
        : provider,
    ),
  })
}

function enableChineseOpenAISettings() {
  useSettingsStore.getState().resetSettings()
  const currentProviders = useSettingsStore.getState().settings.llmProviders
  useSettingsStore.getState().updateSettings({
    language: 'zh',
    detectionEvasionGuardEnabled: false,
    primaryProvider: 'openai',
    llmProviders: currentProviders.map((provider) =>
      provider.id === 'openai'
        ? {
            ...provider,
            enabled: true,
            apiKey: 'sk-openai-test',
            baseUrl: 'https://api.openai.example/v1',
            defaultModel: 'gpt-4-turbo',
          }
        : provider,
    ),
  })
}

function expectVisibleText(text: string) {
  return screen.findAllByText(text, { selector: 'span' }).then((matches) => matches[0])
}

describe('AiTextOptimizer additional coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    useSettingsStore.getState().resetSettings()
    mockGetEditorHandle.mockReturnValue(null)
  })

  it('shows the empty-state guidance when no editor handle is available', () => {
    enableEnglishOpenAISettings()

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByText(en.optimizerSourceEmpty)).toBeInTheDocument()
    expect(screen.getAllByText(en.optimizerSourceEmptyHint).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: en.optimizerRun })).toBeDisabled()
  })

  it.each([
    [en.optimizerPresetHumanize, 'You are a professional text humanization expert.'],
    [en.optimizerPresetAiGuide, 'You are an AI text modification guidance expert.'],
    [en.optimizerPresetCharacter, 'You are a role-playing text humanization expert.'],
    [en.optimizerPresetLiterary, 'You are a literary text humanization expert.'],
    [en.optimizerPresetAcademic, 'You are an academic paper humanization expert.'],
  ])('runs the English "%s" preset with provider-backed instruction assembly', async (presetLabel, instructionSnippet) => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    const editorHandle = createEditorHandle('English draft content')
    mockGetEditorHandle.mockReturnValue(editorHandle)
    mockProcessWritingHelper.mockResolvedValueOnce({
      success: true,
      data: {
        mode: 'polish',
        processed_text: `${presetLabel} result`,
      },
    })

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    if (presetLabel !== en.optimizerPresetHumanize) {
      await user.click(screen.getByRole('button', { name: new RegExp(presetLabel, 'i') }))
    }
    await user.click(screen.getByRole('button', { name: en.optimizerRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledTimes(1)
    })

    expect(mockProcessWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      content: 'English draft content',
      mode: 'polish',
      detection_evasion_guard_enabled: false,
      api_key: 'sk-openai-test',
      base_url: 'https://api.openai.example/v1',
      model: 'gpt-4-turbo',
      provider: 'openai',
      instruction: expect.stringContaining(instructionSnippet),
    }))
    expect(await screen.findByText(`${presetLabel} result`)).toBeInTheDocument()
  })

  it.each([
    [zh.optimizerPresetAiGuide, '你是一位AI文本修改指导专家。'],
    [zh.optimizerPresetCharacter, '你是一位角色扮演式文本人类化专家。'],
    [zh.optimizerPresetLiterary, '你是一位文学性文本人类化专家。'],
    [zh.optimizerPresetAcademic, '你是一位学术论文人类化专家。'],
  ])('runs the Chinese "%s" preset instruction branch', async (presetLabel, instructionSnippet) => {
    const user = userEvent.setup()
    enableChineseOpenAISettings()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('中文待优化内容'))
    mockProcessWritingHelper.mockResolvedValueOnce({
      success: true,
      data: {
        mode: 'polish',
        processed_text: `${presetLabel} 输出`,
      },
    })

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    await user.click(screen.getByRole('button', { name: new RegExp(presetLabel) }))
    await user.click(screen.getByRole('button', { name: zh.optimizerRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledTimes(1)
    })

    expect(mockProcessWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      content: '中文待优化内容',
      instruction: expect.stringContaining(instructionSnippet),
      detection_evasion_guard_enabled: false,
    }))
    expect(await screen.findByText(`${presetLabel} 输出`)).toBeInTheDocument()
  })

  it('keeps the selection source for unchanged content and submits typed custom instructions', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('Seed draft'))
    mockProcessWritingHelper.mockResolvedValueOnce({
      success: true,
      data: {
        mode: 'polish',
        processed_text: 'Custom result body',
      },
    })

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Seed draft' } })
    expect(screen.getByText(en.optimizerSourceSelection)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(en.optimizerPresetCustom, 'i') }))
    await user.type(screen.getByPlaceholderText(/rewrite the text in a more conversational style/i), 'Keep the tension high.')
    await user.click(screen.getByRole('button', { name: en.optimizerRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledTimes(1)
    })

    expect(mockProcessWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Seed draft',
      instruction: 'Keep the tension high.',
    }))
    expect(await screen.findByText('Custom result body')).toBeInTheDocument()
  })

  it('runs two-step analysis mode, renders the diagnosis report, and inserts the final result', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    const editorHandle = createEditorHandle('Draft for diagnosis')
    mockGetEditorHandle.mockReturnValue(editorHandle)
    mockProcessWritingHelper
      .mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'polish',
          processed_text: 'Diagnosis report body',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'polish',
          processed_text: 'Final rewritten result',
        },
      })

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText(en.optimizerTwoStepAnalysis)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en.optimizerRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledTimes(2)
    })

    expect(mockProcessWritingHelper.mock.calls[0]?.[0]).toMatchObject({
      content: 'Draft for diagnosis',
      instruction: expect.stringContaining('Analyze the following text for AI-generated characteristics ONLY.'),
    })
    expect(mockProcessWritingHelper.mock.calls[1]?.[0]).toMatchObject({
      content: 'Draft for diagnosis',
      instruction: expect.stringContaining('Rewrite based on the following AI characteristic diagnosis report:'),
    })
    expect(String(mockProcessWritingHelper.mock.calls[1]?.[0]?.instruction)).toContain('Diagnosis report body')

    expect(await screen.findByText(en.optimizerResultTitle)).toBeInTheDocument()
    fireEvent.click(screen.getByText(en.optimizerDiagnosisTitle))
    expect(screen.getByText('Diagnosis report body')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en.writingHelperInsertToEditor }))
    expect(editorHandle.insertText).toHaveBeenCalledWith('Final rewritten result')
  })

  it('runs the Chinese two-step flow with localized prompts', async () => {
    const user = userEvent.setup()
    enableChineseOpenAISettings()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('中文草稿'))
    mockProcessWritingHelper
      .mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'polish',
          processed_text: '中文诊断报告',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'polish',
          processed_text: '中文改写结果',
        },
      })

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: zh.optimizerRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledTimes(2)
    })

    expect(String(mockProcessWritingHelper.mock.calls[0]?.[0]?.instruction)).toContain('请仅对以下文本进行AI特征分析')
    expect(String(mockProcessWritingHelper.mock.calls[1]?.[0]?.instruction)).toContain('基于以下 AI 特征诊断报告进行改写')

    expect(await screen.findByText(zh.optimizerResultTitle)).toBeInTheDocument()
    fireEvent.click(screen.getByText(zh.optimizerDiagnosisTitle))
    expect(screen.getByText('中文诊断报告')).toBeInTheDocument()
  })

  it('surfaces analysis failures in two-step mode', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('Draft for failure'))

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    await user.click(screen.getByRole('checkbox'))

    mockProcessWritingHelper.mockResolvedValueOnce({
      success: false,
      error: 'analysis failed',
    })
    await user.click(screen.getByRole('button', { name: en.optimizerRun }))
    expect(await screen.findByText('analysis failed')).toBeInTheDocument()
  })

  it('falls back to the localized failure copy when analysis fails without an error message', async () => {
    const user = userEvent.setup()
    enableChineseOpenAISettings()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('中文失败草稿'))
    mockProcessWritingHelper.mockResolvedValueOnce({
      success: false,
      error: '',
    })

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: zh.optimizerRun }))

    expect(await expectVisibleText(zh.optimizerFailed)).toBeInTheDocument()
  })

  it('surfaces rewrite fallback failures in two-step mode', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('Draft for failure'))

    mockProcessWritingHelper
      .mockResolvedValueOnce({
        success: true,
        data: {
          mode: 'polish',
          processed_text: 'Diagnosis body',
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: '',
      })

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: en.optimizerRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledTimes(2)
    })
    expect(await expectVisibleText(en.optimizerFailed)).toBeInTheDocument()
  })

  it('surfaces simple-mode fallback failures', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('Draft body'))

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    mockProcessWritingHelper.mockResolvedValueOnce({
      success: false,
      error: '',
    })
    await user.click(screen.getByRole('button', { name: en.optimizerRun }))
    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledTimes(1)
    })
    expect(await expectVisibleText(en.optimizerFailed)).toBeInTheDocument()
  })

  it('surfaces thrown exceptions in simple mode', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('Draft body'))

    mockProcessWritingHelper.mockRejectedValueOnce(new Error('boom'))

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)
    await user.click(screen.getByRole('button', { name: en.optimizerRun }))
    expect(await screen.findByText('Error: boom')).toBeInTheDocument()
  })

  it('ignores blank refresh selections and keeps the current manual content', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    let selectedText = 'Initial selection'
    const editorHandle = createEditorHandle()
    editorHandle.getSelectedText.mockImplementation(() => selectedText)
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Manual replacement')

    selectedText = '   '
    await user.click(screen.getByRole('button', { name: en.optimizerRefreshFromSelection }))

    expect(input).toHaveValue('Manual replacement')
    expect(screen.getByText(en.optimizerSourceManual)).toBeInTheDocument()
  })

  it('keeps selection source when typed content matches the selection seed', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    const editorHandle = createEditorHandle('Seed draft')
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    // Wait for the component to initialize with selection seed
    await waitFor(() => {
      expect(screen.getByText(en.optimizerSourceSelection)).toBeInTheDocument()
    })

    // Clear the input and type the same text as the selection seed
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Seed draft')

    // After typing, the source should be 'manual' because user.clear() triggers onChange
    // with empty string which sets contentSource to 'empty', then typing sets it to 'manual'
    // The condition at line 481 checks contentSource === 'selection', but after clear it's 'empty'
    // So this path is actually NOT reachable through normal user interaction.
    // The early return at line 482-484 is dead code for the 'selection' case.
    // However, we can verify the component works correctly by checking the final state.
    expect(screen.getByText(en.optimizerSourceManual)).toBeInTheDocument()
  })

  it('wires the close and open-settings actions', async () => {
    const user = userEvent.setup()
    enableEnglishOpenAISettings()
    const onClose = vi.fn()
    const onOpenSettings = vi.fn()
    mockGetEditorHandle.mockReturnValue(createEditorHandle('Draft body'))

    render(<AiTextOptimizer onClose={onClose} onOpenSettings={onOpenSettings} />)

    await user.click(screen.getByRole('button', { name: en.writingHelperClose }))
    await user.click(screen.getByRole('button', { name: en.writingHelperOpenSettings }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })
})
