import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WritingHelperPanel } from './WritingHelperPanel'
import { translations } from '../i18n'
import { processWritingHelper, polishContent } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  processWritingHelper: vi.fn(),
  polishContent: vi.fn(),
}))

const mockProcessWritingHelper = vi.mocked(processWritingHelper)
const mockPolishContent = vi.mocked(polishContent)
const zh = translations.zh

describe('WritingHelperPanel clear draft', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    vi.clearAllMocks()
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
})
