import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import OnboardingPage from './OnboardingPage'

describe('OnboardingPage', () => {
  it('walks through every onboarding step and finishes', () => {
    const onComplete = vi.fn()

    render(<OnboardingPage onComplete={onComplete} />)

    expect(screen.getByText('欢迎使用 niko-studio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上一步' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText('配置 AI 模型')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '上一步' }))
    expect(screen.getByText('欢迎使用 niko-studio')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText('知识层')).toBeInTheDocument()
    expect(screen.getByText('启用 Nowledge Mem 集成')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText('准备就绪')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '进入工作台' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
