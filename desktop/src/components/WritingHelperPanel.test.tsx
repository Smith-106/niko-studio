import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WritingHelperPanel } from './WritingHelperPanel'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  processWritingHelper: vi.fn(),
}))

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
