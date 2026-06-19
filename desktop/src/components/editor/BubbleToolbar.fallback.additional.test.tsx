import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingsStore } from '../../stores/settingsStore'

const rewriteOptionsOverride = vi.hoisted(() => ({
  current: null as
    | Array<{
        id: string
        labelKey: string
      }>
    | null,
}))

vi.mock('../../hooks/editorAIPromptPolicy', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/editorAIPromptPolicy')>(
    '../../hooks/editorAIPromptPolicy',
  )

  return {
    ...actual,
    getEditorAIRewriteOptions: () => rewriteOptionsOverride.current ?? actual.getEditorAIRewriteOptions(),
  }
})

import { BubbleToolbar } from './BubbleToolbar'

function createEditorStub() {
  const chain = {
    focus: vi.fn(() => chain),
    toggleBold: vi.fn(() => chain),
    toggleItalic: vi.fn(() => chain),
    toggleStrike: vi.fn(() => chain),
    run: vi.fn(() => true),
  }

  return {
    chain: () => chain,
    isActive: () => false,
  } as never
}

describe('BubbleToolbar fallback coverage', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateSettings({ language: 'en' })
    rewriteOptionsOverride.current = null
  })

  it('falls back to the option id when a translation key is missing', async () => {
    const user = userEvent.setup()
    const onRewrite = vi.fn()
    const onClose = vi.fn()

    rewriteOptionsOverride.current = [
      {
        id: 'fallback-option',
        labelKey: 'editorBubbleMissingTranslation',
      },
    ]

    render(
      <BubbleToolbar
        editor={createEditorStub()}
        position={{ x: 160, y: 120 }}
        onRewrite={onRewrite}
        onContinue={vi.fn()}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'AI Rewrite' }))
    await user.click(screen.getByRole('button', { name: 'fallback-option' }))

    expect(onRewrite).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fallback-option',
        labelKey: 'editorBubbleMissingTranslation',
      }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
