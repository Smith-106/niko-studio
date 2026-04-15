import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tiptap/react', () => ({
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content" data-has-editor={String(Boolean(editor))} />
  ),
  useEditor: vi.fn(() => null),
}))

vi.mock('./editor/SlashCommandMenu', () => ({
  SlashCommandMenu: () => null,
}))

vi.mock('./editor/BubbleToolbar', () => ({
  BubbleToolbar: () => null,
  REWRITE_OPTIONS: [],
}))

vi.mock('../hooks/useEditorAI', () => ({
  useEditorAI: vi.fn(),
}))

import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { useEditorAI } from '../hooks/useEditorAI'
import { NikoEditor } from './NikoEditor'

const mockUseEditorAI = vi.mocked(useEditorAI)
const zh = translations.zh

describe('NikoEditor inline AI failure feedback', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  it('shows the inline failure chip with translated copy and clears it after the timeout', () => {
    const clearError = vi.fn()
    mockUseEditorAI.mockReturnValue({
      isGenerating: false,
      errorMessage: 'stream failed',
      clearError,
      generateAtCursor: vi.fn(),
      rewriteSelection: vi.fn(),
      continueWriting: vi.fn(),
      cancel: vi.fn(),
    })

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(zh.inlineActionFailed)
    expect(status).toHaveAttribute('title', 'stream failed')

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(clearError).toHaveBeenCalledTimes(1)
  })
})
