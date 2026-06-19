import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const i18nState = vi.hoisted(() => ({
  language: 'zh' as 'zh' | 'en',
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    language: i18nState.language,
  }),
}))

import { ApiKeyGuideModal } from './ApiKeyGuideModal'

describe('ApiKeyGuideModal', () => {
  beforeEach(() => {
    i18nState.language = 'zh'
  })

  it('renders the Chinese copy and distinguishes backdrop clicks from panel clicks', () => {
    const onClose = vi.fn()
    const onOpenSettings = vi.fn()
    const { container } = render(
      <ApiKeyGuideModal onClose={onClose} onOpenSettings={onOpenSettings} />,
    )

    expect(screen.getByRole('heading', { name: '配置 AI 写作助手' })).toBeInTheDocument()
    expect(
      screen.getByText('AI 写作功能需要配置 LLM 服务提供商和 API Key。请在设置中完成配置。'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '稍后配置' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '前往设置' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('heading', { name: '配置 AI 写作助手' }))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(container.firstElementChild as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenSettings).not.toHaveBeenCalled()
  })

  it('renders the English copy and routes the settings action through close + open', () => {
    i18nState.language = 'en'
    const onClose = vi.fn()
    const onOpenSettings = vi.fn()

    render(<ApiKeyGuideModal onClose={onClose} onOpenSettings={onOpenSettings} />)

    expect(
      screen.getByRole('heading', { name: 'Configure AI Writing Assistant' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'AI writing features require an LLM provider and API key. Please configure in Settings.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go to Settings' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })
})
