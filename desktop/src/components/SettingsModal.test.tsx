import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsModal } from './SettingsModal'
import { useSettingsStore } from '../stores/settingsStore'

const getRangeByLabel = (label: string): HTMLInputElement => {
  const labelNode = screen.getByText(label)
  const container = labelNode.parentElement
  if (!container) {
    throw new Error(`cannot find container for label: ${label}`)
  }
  const range = container.querySelector('input[type="range"]')
  if (!(range instanceof HTMLInputElement)) {
    throw new Error(`cannot find range input for label: ${label}`)
  }
  return range
}

describe('SettingsModal quality presets', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        language: 'zh',
      },
    }))
  })

  it('updates quality goal sliders when preset changes', async () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    expect(getRangeByLabel('自然度').value).toBe('85')
    expect(getRangeByLabel('可读性').value).toBe('80')
    expect(getRangeByLabel('连贯性').value).toBe('80')
    expect(getRangeByLabel('风格一致性').value).toBe('78')
    expect(getRangeByLabel('句式熵目标').value).toBe('60')
    expect(getRangeByLabel('节奏变化目标').value).toBe('60')

    const presetLabel = screen.getByText('优化预设')
    const presetSelect = presetLabel.parentElement?.querySelector('select')
    expect(presetSelect).toBeInstanceOf(HTMLSelectElement)

    await userEvent.selectOptions(presetSelect as HTMLSelectElement, 'ai_edit_guidance')

    expect(getRangeByLabel('自然度').value).toBe('80')
    expect(getRangeByLabel('可读性').value).toBe('88')
    expect(getRangeByLabel('连贯性').value).toBe('86')
    expect(getRangeByLabel('风格一致性').value).toBe('84')
    expect(getRangeByLabel('句式熵目标').value).toBe('52')
    expect(getRangeByLabel('节奏变化目标').value).toBe('50')
  })

  it('persists writing helper legacy polish toggle after save', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    const user = userEvent.setup()
    const toggle = screen.getByLabelText('Writing Helper 润色走 legacy 接口') as HTMLInputElement

    expect(toggle.checked).toBe(false)
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(useSettingsStore.getState().settings.writingHelperUseLegacyPolish).toBe(true)
    expect(onClose).toHaveBeenCalled()
  })
})
