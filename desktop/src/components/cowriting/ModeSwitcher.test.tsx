import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ModeSwitcher } from './ModeSwitcher'

describe('ModeSwitcher', () => {
  it('renders both modes, highlights the active one, and switches modes on click', () => {
    const onModeChange = vi.fn()

    render(<ModeSwitcher currentMode="auto" onModeChange={onModeChange} />)

    const autoButton = screen.getByRole('button', { name: /自动 AI 自动续写/ })
    const guidedButton = screen.getByRole('button', { name: /引导 多方案选择/ })

    expect(autoButton.className).toContain('bg-zinc-600')
    expect(guidedButton.className).toContain('text-zinc-500')

    fireEvent.click(guidedButton)

    expect(onModeChange).toHaveBeenCalledWith('guided')
  })

  it('prevents mode changes when disabled', () => {
    const onModeChange = vi.fn()

    render(<ModeSwitcher currentMode="guided" onModeChange={onModeChange} disabled />)

    const autoButton = screen.getByRole('button', { name: /自动 AI 自动续写/ })
    const guidedButton = screen.getByRole('button', { name: /引导 多方案选择/ })

    expect(guidedButton).toBeDisabled()
    expect(guidedButton.className).toContain('opacity-40')

    fireEvent.click(autoButton)
    expect(onModeChange).not.toHaveBeenCalled()
  })
})
