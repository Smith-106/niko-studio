import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WritingHelperPanel } from './WritingHelperPanel'
import { processWritingHelper, polishContent } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  processWritingHelper: vi.fn(),
  polishContent: vi.fn(),
}))

const mockProcessWritingHelper = vi.mocked(processWritingHelper)
const mockPolishContent = vi.mocked(polishContent)

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

    const contentInput = screen.getByLabelText('输入文本') as HTMLTextAreaElement
    const modeSelect = screen.getByLabelText('模式') as HTMLSelectElement
    const maxSentencesInput = screen.getByLabelText('最大句数（摘要）') as HTMLInputElement
    const maxItemsInput = screen.getByLabelText('最大条目（提纲）') as HTMLInputElement

    expect(contentInput.value).toBe('已有草稿内容')
    expect(modeSelect.value).toBe('outline')
    expect(maxSentencesInput.value).toBe('9')
    expect(maxItemsInput.value).toBe('11')

    await user.click(screen.getByRole('button', { name: '清空草稿' }))

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

    const modeSelect = screen.getByLabelText('模式') as HTMLSelectElement
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
    const contentInput = screen.getByLabelText('输入文本') as HTMLTextAreaElement
    const legacyToggle = screen.getByLabelText('Writing Helper 润色走 legacy 接口') as HTMLInputElement

    await user.type(contentInput, '原始内容。')
    await user.click(legacyToggle)
    await user.click(screen.getByRole('button', { name: '执行' }))

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
