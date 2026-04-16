import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WritingHelperPanel } from './WritingHelperPanel'
import { translations } from '../i18n'
import { processWritingHelper, polishContent } from '../api/client'
import { getEditorHandle } from '../utils/editorHandle'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  processWritingHelper: vi.fn(),
  polishContent: vi.fn(),
}))

vi.mock('../utils/editorHandle', () => ({
  getEditorHandle: vi.fn(),
}))

const mockProcessWritingHelper = vi.mocked(processWritingHelper)
const mockPolishContent = vi.mocked(polishContent)
const mockGetEditorHandle = vi.mocked(getEditorHandle)
const zh = translations.zh

describe('WritingHelperPanel clear draft', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    vi.clearAllMocks()
    mockGetEditorHandle.mockReturnValue(null)
  })

  it('resets draft fields and calls onClearDraft', async () => {
    const onClearDraft = vi.fn()

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: '已有草稿内容',
          mode: 'outline',
          maxSentences: 9,
          maxItems: 11,
        }}
        onClearDraft={onClearDraft}
      />
    )

    const user = userEvent.setup()

    const contentInput = screen.getByLabelText(zh.writingHelperInputText) as HTMLTextAreaElement
    const modeSelect = screen.getByLabelText(zh.writingHelperMode) as HTMLSelectElement
    const maxSentencesInput = screen.getByLabelText(zh.writingHelperMaxSentences) as HTMLInputElement
    const maxItemsInput = screen.getByLabelText(zh.writingHelperMaxItems) as HTMLInputElement

    expect(contentInput.value).toBe('已有草稿内容')
    expect(modeSelect.value).toBe('outline')
    expect(maxSentencesInput.value).toBe('9')
    expect(maxItemsInput.value).toBe('11')

    await user.click(screen.getByRole('button', { name: zh.writingHelperClearDraft }))

    expect(onClearDraft).toHaveBeenCalledOnce()
    expect(contentInput.value).toBe('')
    expect(modeSelect.value).toBe('polish')
    expect(maxSentencesInput.value).toBe('3')
    expect(maxItemsInput.value).toBe('6')
  })
})

describe('WritingHelperPanel mode options and payload', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    vi.clearAllMocks()
    mockGetEditorHandle.mockReturnValue(null)
  })

  it('renders rewrite and expand mode options', () => {
    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    const modeSelect = screen.getByLabelText(zh.writingHelperMode) as HTMLSelectElement
    const optionValues = Array.from(modeSelect.options).map((option) => option.value)

    expect(optionValues).toContain('rewrite')
    expect(optionValues).toContain('expand')
  })

  it('uses legacy polish alias when toggle is enabled in polish mode', async () => {
    mockPolishContent.mockResolvedValue({
      originalText: '原始内容。',
      polishedText: '兼容润色结果。',
      diffMarkup: '',
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    const user = userEvent.setup()
    const contentInput = screen.getByLabelText(zh.writingHelperInputText) as HTMLTextAreaElement
    const legacyToggle = screen.getByLabelText(zh.writingHelperLegacyPolish) as HTMLInputElement

    await user.type(contentInput, '原始内容。')
    await user.click(legacyToggle)
    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))

    expect(mockPolishContent).toHaveBeenCalledWith(
      expect.objectContaining({
        originalText: '原始内容。',
        polishType: 'standard',
      })
    )
    expect(mockProcessWritingHelper).not.toHaveBeenCalled()
    expect(screen.getByText('兼容润色结果。')).toBeInTheDocument()
  })

  it('uses revision-safe replace/alternative/undo actions when the current input matches an editor selection snapshot', async () => {
    const user = userEvent.setup()
    const editorHandle = {
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => '原始内容。'),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      captureSelectionSnapshot: vi.fn(() => ({ from: 3, to: 8, text: '原始内容。' })),
      replaceSelectionSnapshot: vi.fn(() => true),
      insertBelowSelectionSnapshot: vi.fn(() => true),
      undoLastRevisionApply: vi.fn(() => true),
    }

    mockGetEditorHandle.mockReturnValue(editorHandle)
    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '改写结果。',
      },
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByLabelText(zh.writingHelperInputText)).toHaveValue('原始内容。')

    await user.selectOptions(screen.getByLabelText(zh.writingHelperMode), 'rewrite')
    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))

    expect(await screen.findByText('修改预览')).toBeInTheDocument()
    expect(screen.getByText('原文')).toBeInTheDocument()
    expect(screen.getByText('建议版本')).toBeInTheDocument()
    expect(screen.getAllByText('改写结果。').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '替换选区' }))
    expect(editorHandle.replaceSelectionSnapshot).toHaveBeenCalledWith(
      { from: 3, to: 8, text: '原始内容。' },
      '改写结果。',
    )
    expect(screen.getByText('已替换当前选区。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '作为备选插入' }))
    expect(editorHandle.insertBelowSelectionSnapshot).toHaveBeenCalledWith(
      { from: 3, to: 8, text: '原始内容。' },
      '改写结果。',
    )
    expect(screen.getByText('已作为备选插入到原文后。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '撤销上次应用' }))
    expect(editorHandle.undoLastRevisionApply).toHaveBeenCalledTimes(1)
    expect(screen.getByText('已撤销上次应用。')).toBeInTheDocument()
  })

  it('falls back to plain insert when no matching editor selection snapshot exists', async () => {
    const user = userEvent.setup()
    const editorHandle = {
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => ''),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      captureSelectionSnapshot: vi.fn(() => null),
      replaceSelectionSnapshot: vi.fn(() => false),
      insertBelowSelectionSnapshot: vi.fn(() => false),
      undoLastRevisionApply: vi.fn(() => false),
    }

    mockGetEditorHandle.mockReturnValue(editorHandle)
    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'polish',
        processed_text: '插入结果。',
      },
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await user.type(screen.getByLabelText(zh.writingHelperInputText), '手动输入内容')
    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))
    await screen.findByText('插入结果。')

    expect(screen.getByRole('button', { name: zh.writingHelperInsertToEditor })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '替换选区' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.writingHelperInsertToEditor }))
    expect(editorHandle.insertText).toHaveBeenCalledWith('插入结果。')
  })
})
