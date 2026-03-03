import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WritingHelperPanel } from './WritingHelperPanel'
import { processWritingHelper } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  processWritingHelper: vi.fn(),
}))

const mockProcessWritingHelper = vi.mocked(processWritingHelper)

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

  it('sends selected mode in request payload', async () => {
    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '重写结果。',
      },
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    const user = userEvent.setup()
    const modeSelect = screen.getByLabelText('模式') as HTMLSelectElement
    const contentInput = screen.getByLabelText('输入文本') as HTMLTextAreaElement

    await user.selectOptions(modeSelect, 'rewrite')
    await user.type(contentInput, '第一句。第一句。')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(mockProcessWritingHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '第一句。第一句。',
        mode: 'rewrite',
      })
    )
  })
})
