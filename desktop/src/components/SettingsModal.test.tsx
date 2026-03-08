import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsModal } from './SettingsModal'
import { useSettingsStore } from '../stores/settingsStore'

const getInputByLabel = (label: string): HTMLInputElement => {
  const labelNode = screen.getByText(label)
  const container = labelNode.parentElement
  if (!container) {
    throw new Error(`cannot find container for label: ${label}`)
  }
  const input = container.querySelector('input')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`cannot find input for label: ${label}`)
  }
  return input
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

    expect(getInputByLabel('自然度').value).toBe('85')
    expect(getInputByLabel('可读性').value).toBe('80')
    expect(getInputByLabel('连贯性').value).toBe('80')
    expect(getInputByLabel('风格一致性').value).toBe('78')
    expect(getInputByLabel('句式熵目标').value).toBe('60')
    expect(getInputByLabel('节奏变化目标').value).toBe('60')

    const presetLabel = screen.getByText('优化预设')
    const presetSelect = presetLabel.parentElement?.querySelector('select')
    expect(presetSelect).toBeInstanceOf(HTMLSelectElement)

    await userEvent.selectOptions(presetSelect as HTMLSelectElement, 'ai_edit_guidance')

    expect(getInputByLabel('自然度').value).toBe('80')
    expect(getInputByLabel('可读性').value).toBe('88')
    expect(getInputByLabel('连贯性').value).toBe('86')
    expect(getInputByLabel('风格一致性').value).toBe('84')
    expect(getInputByLabel('句式熵目标').value).toBe('52')
    expect(getInputByLabel('节奏变化目标').value).toBe('50')
  })

  it('persists workflow backend mode after save', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    const user = userEvent.setup()

    const modeLabel = screen.getByText('工作流后端模式')
    const modeSelect = modeLabel.parentElement?.querySelector('select')
    expect(modeSelect).toBeInstanceOf(HTMLSelectElement)

    await user.selectOptions(modeSelect as HTMLSelectElement, 'uiBridge')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(useSettingsStore.getState().settings.workflowBackendMode).toBe('uiBridge')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders workflow backend mode labels in english', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        language: 'en',
      },
    }))

    render(<SettingsModal isOpen onClose={vi.fn()} />)

    expect(screen.getByText('Workflow Backend Mode')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Standard (/workflow/*)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'UI Bridge (/ui/workflow/*)' })).toBeInTheDocument()
  })
})
