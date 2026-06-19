import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Editor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { translations, type Language } from '../../i18n'
import { useSettingsStore } from '../../stores/settingsStore'
import { BubbleToolbar } from './BubbleToolbar'

function createEditorStub(activeMarks: string[] = []) {
  const chain = {
    focus: vi.fn(() => chain),
    toggleBold: vi.fn(() => chain),
    toggleItalic: vi.fn(() => chain),
    toggleStrike: vi.fn(() => chain),
    run: vi.fn(() => true),
  }

  const editor = {
    chain: () => chain,
    isActive: (mark: string) => activeMarks.includes(mark),
  } as unknown as Editor

  return { editor, chain }
}

function renderToolbar(language: Language, editor: Editor) {
  const onRewrite = vi.fn()
  const onContinue = vi.fn()
  const onClose = vi.fn()

  useSettingsStore.getState().updateSettings({ language })

  render(
    <BubbleToolbar
      editor={editor}
      position={{ x: 160, y: 120 }}
      onRewrite={onRewrite}
      onContinue={onContinue}
      onClose={onClose}
    />,
  )

  return { onRewrite, onContinue, onClose }
}

describe('BubbleToolbar additional coverage', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings()
  })

  it('returns null when no selection position is available', () => {
    const { editor } = createEditorStub()

    const { container } = render(
      <BubbleToolbar
        editor={editor}
        position={null}
        onRewrite={vi.fn()}
        onContinue={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('applies active formatting state and dispatches formatting commands', async () => {
    const user = userEvent.setup()
    const { editor, chain } = createEditorStub(['bold'])

    renderToolbar('en', editor)

    const boldButton = screen.getByRole('button', { name: translations.en.editorBubbleBold })
    const italicButton = screen.getByRole('button', { name: translations.en.editorBubbleItalic })
    const strikeButton = screen.getByRole('button', { name: translations.en.editorBubbleStrikethrough })

    expect(boldButton.className).toContain('bg-primary-600')
    expect(italicButton.className).not.toContain('bg-primary-600')

    await user.click(boldButton)
    await user.click(italicButton)
    await user.click(strikeButton)

    expect(chain.focus).toHaveBeenCalledTimes(3)
    expect(chain.toggleBold).toHaveBeenCalledTimes(1)
    expect(chain.toggleItalic).toHaveBeenCalledTimes(1)
    expect(chain.toggleStrike).toHaveBeenCalledTimes(1)
    expect(chain.run).toHaveBeenCalledTimes(3)
  })

  it('toggles the rewrite menu and closes after continuing', async () => {
    const user = userEvent.setup()
    const { editor } = createEditorStub()
    const { onContinue, onClose } = renderToolbar('en', editor)

    const rewriteButton = screen.getByRole('button', { name: translations.en.editorBubbleRewrite })

    expect(screen.queryByRole('button', { name: translations.en.editorBubblePolish })).not.toBeInTheDocument()

    await user.click(rewriteButton)
    expect(screen.getByRole('button', { name: translations.en.editorBubblePolish })).toBeVisible()

    await user.click(rewriteButton)
    expect(screen.queryByRole('button', { name: translations.en.editorBubblePolish })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: translations.en.editorBubbleContinue }))

    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
