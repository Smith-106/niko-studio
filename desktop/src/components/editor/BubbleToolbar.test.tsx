import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Editor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { translations, type Language } from '../../i18n'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  getEditorAIRewriteOptions,
  type EditorAIRewriteOption,
  type EditorAIRewriteVariant,
} from '../../hooks/editorAIPromptPolicy'
import { BubbleToolbar } from './BubbleToolbar'

const formattingToolbarLabelKeys = [
  'editorBubbleBold',
  'editorBubbleItalic',
  'editorBubbleStrikethrough',
] as const

const rewriteOptions = [
  { id: 'polish', labelKey: 'editorBubblePolish' },
  { id: 'simplify', labelKey: 'editorBubbleSimplify' },
  { id: 'expand', labelKey: 'editorBubbleExpand' },
  { id: 'formal', labelKey: 'editorBubbleFormal' },
  { id: 'casual', labelKey: 'editorBubbleCasual' },
] as const satisfies ReadonlyArray<Pick<EditorAIRewriteOption, 'id' | 'labelKey'>>

function createEditorStub(): Editor {
  const chain = {
    focus: () => chain,
    toggleBold: () => chain,
    toggleItalic: () => chain,
    toggleStrike: () => chain,
    run: () => true,
  }

  return {
    chain: () => chain,
    isActive: () => false,
  } as unknown as Editor
}

function getRewriteOption(variant: EditorAIRewriteVariant): EditorAIRewriteOption {
  const option = getEditorAIRewriteOptions().find((candidate) => candidate.id === variant)
  if (!option) {
    throw new Error(`Missing rewrite option: ${variant}`)
  }

  return option
}

function renderToolbar(language: Language) {
  const onRewrite = vi.fn()
  const onClose = vi.fn()

  useSettingsStore.getState().updateSettings({ language })

  render(
    <BubbleToolbar
      editor={createEditorStub()}
      position={{ x: 160, y: 120 }}
      onRewrite={onRewrite}
      onContinue={vi.fn()}
      onClose={onClose}
    />,
  )

  return { onRewrite, onClose }
}

describe('BubbleToolbar locale coverage', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetSettings()
  })

  it('keeps bubble toolbar translation keys and rewrite option ids aligned across locales', () => {
    expect(getEditorAIRewriteOptions()).toEqual(rewriteOptions)

    ;(['en', 'zh'] as const).forEach((language) => {
      formattingToolbarLabelKeys.forEach((key) => {
        expect(translations[language][key]).toEqual(expect.any(String))
        expect(translations[language][key].trim()).not.toBe('')
      })

      rewriteOptions.forEach(({ id, labelKey }) => {
        expect(translations[language][labelKey]).toEqual(expect.any(String))
        expect(translations[language][labelKey].trim()).not.toBe('')
        expect(id).toEqual(expect.any(String))
      })
    })
  })

  it.each(['en', 'zh'] as const)('renders localized formatting affordances for %s', (language) => {
    renderToolbar(language)

    formattingToolbarLabelKeys.forEach((key) => {
      expect(screen.getByRole('button', { name: translations[language][key] })).toBeVisible()
    })

    expect(screen.getByRole('button', { name: translations[language].editorBubbleRewrite })).toBeVisible()
    expect(screen.getByRole('button', { name: translations[language].editorBubbleContinue })).toBeVisible()
  })

  it.each([
    { language: 'en' as const, variant: 'polish' as const },
    { language: 'zh' as const, variant: 'formal' as const },
  ])('passes the $language rewrite option through the rendered click seam', async ({ language, variant }) => {
    const user = userEvent.setup()
    const expectedOption = getRewriteOption(variant)
    const { onRewrite, onClose } = renderToolbar(language)

    await user.click(screen.getByRole('button', { name: translations[language].editorBubbleRewrite }))

    getEditorAIRewriteOptions().forEach((option) => {
      expect(screen.getByRole('button', { name: translations[language][option.labelKey] })).toBeVisible()
    })

    await user.click(screen.getByRole('button', { name: translations[language][expectedOption.labelKey] }))

    expect(onRewrite).toHaveBeenCalledTimes(1)
    expect(onRewrite).toHaveBeenCalledWith(expectedOption)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('button', { name: translations[language][expectedOption.labelKey] }),
    ).not.toBeInTheDocument()
  })
})
