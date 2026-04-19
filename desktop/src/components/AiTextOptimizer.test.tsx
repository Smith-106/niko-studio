import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
const enCustomPlaceholder = 'Example: Rewrite the text in a more conversational style, adding personal opinions and emotional nuance...'
const enCustomInstructionError = 'Please enter custom instructions'

function createEditorHandle(selectedText = '') {
  return {
    insertText: vi.fn(),
    getSelectedText: vi.fn(() => selectedText),
    getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
    captureSelectionSnapshot: vi.fn(() => null),
    replaceSelectionSnapshot: vi.fn(() => false),
    insertBelowSelectionSnapshot: vi.fn(() => false),
    undoLastRevisionApply: vi.fn(() => false),
  }
}

describe('AiTextOptimizer', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
    mockGetEditorHandle.mockReturnValue(null)
  })

  it('shows selection source state when opened from the editor selection', () => {
    const editorHandle = createEditorHandle('选中的段落')
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByRole('textbox')).toHaveValue('选中的段落')
    expect(screen.getByText(zh.optimizerSourceSelection)).toBeInTheDocument()
    expect(screen.getByText('已从当前编辑器选区载入，共 5 个字符')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.optimizerRefreshFromSelection })).toBeInTheDocument()
  })

  it('shows explicit empty-state guidance when no text is available', () => {
    const editorHandle = createEditorHandle('')
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByText(zh.optimizerSourceEmpty)).toBeInTheDocument()
    expect(screen.getAllByText(zh.optimizerSourceEmptyHint).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: zh.optimizerRun })).toBeDisabled()
  })

  it('switches the source label to manual input after editing prefilled text', async () => {
    const user = userEvent.setup()
    const editorHandle = createEditorHandle('选中的段落')
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '这是手动输入的内容')

    expect(screen.getByText(zh.optimizerSourceManual)).toBeInTheDocument()
    expect(screen.getByText(zh.optimizerSourceManualHint)).toBeInTheDocument()
  })

  it('refreshes the input from the latest editor selection', async () => {
    const user = userEvent.setup()
    let selectedText = '初始选中内容'
    const editorHandle = createEditorHandle()
    editorHandle.getSelectedText.mockImplementation(() => selectedText)
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '改成手动内容')

    selectedText = '刷新后的选中内容'
    await user.click(screen.getByRole('button', { name: zh.optimizerRefreshFromSelection }))

    expect(input).toHaveValue('刷新后的选中内容')
    expect(screen.getByText(zh.optimizerSourceSelection)).toBeInTheDocument()
    expect(screen.getByText('已从当前编辑器选区载入，共 8 个字符')).toBeInTheDocument()
  })

  it('renders English source framing and custom placeholder copy', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })
    const editorHandle = createEditorHandle('Draft')
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByRole('textbox')).toHaveValue('Draft')
    expect(screen.getByText(en.optimizerSourceSelection)).toBeInTheDocument()
    expect(screen.getByText('Loaded from the current editor selection, 5 characters')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(en.optimizerPresetCustom) }))

    expect(screen.getByPlaceholderText(enCustomPlaceholder)).toBeInTheDocument()
  })

  it('keeps English source labels and hints correct across manual edits and refresh', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })
    let selectedText = 'Draft'
    const editorHandle = createEditorHandle()
    editorHandle.getSelectedText.mockImplementation(() => selectedText)
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Manual rewrite')

    expect(screen.getByText(en.optimizerSourceManual)).toBeInTheDocument()
    expect(screen.getByText(en.optimizerSourceManualHint)).toBeInTheDocument()

    selectedText = 'Fresh selection'
    await user.click(screen.getByRole('button', { name: en.optimizerRefreshFromSelection }))

    expect(input).toHaveValue('Fresh selection')
    expect(screen.getByText(en.optimizerSourceSelection)).toBeInTheDocument()
    expect(screen.getByText('Loaded from the current editor selection, 15 characters')).toBeInTheDocument()
  })

  it('shows an English custom-instruction validation error', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })
    const editorHandle = createEditorHandle('Draft')
    mockGetEditorHandle.mockReturnValue(editorHandle)

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    await user.click(screen.getByRole('button', { name: new RegExp(en.optimizerPresetCustom) }))
    await user.click(screen.getByRole('button', { name: en.optimizerRun }))

    expect(screen.getByText(enCustomInstructionError)).toBeInTheDocument()
  })

  it('inserts the optimized result back into the editor', async () => {
    const user = userEvent.setup()
    const editorHandle = createEditorHandle('需要优化的内容')
    mockGetEditorHandle.mockReturnValue(editorHandle)
    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'polish',
        processed_text: '优化后的结果',
      },
    })

    render(<AiTextOptimizer onClose={() => {}} onOpenSettings={() => {}} />)

    await user.click(screen.getByRole('button', { name: zh.optimizerRun }))

    expect(await screen.findByText('优化后的结果')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.writingHelperInsertToEditor }))

    expect(editorHandle.insertText).toHaveBeenCalledWith('优化后的结果')
  })
})
