import { act, render, screen } from '@testing-library/react'
import { useEditor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tiptap/react', () => ({
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content" data-has-editor={String(Boolean(editor))} />
  ),
  useEditor: vi.fn(() => null),
}))

vi.mock('./editor/SlashCommandMenu', () => ({
  SlashCommandMenu: ({ onSelect }: { onSelect: (item: unknown) => void }) => (
    <button
      data-testid="slash-ai-generate"
      onClick={() =>
        onSelect({
          id: 'ai-generate',
          label: 'Generate',
          description: '',
          icon: 'sparkles',
          type: 'ai',
        })
      }
    >
      slash-generate
    </button>
  ),
}))

vi.mock('./editor/BubbleToolbar', () => ({
  BubbleToolbar: ({
    onRewrite,
    onContinue,
  }: {
    onRewrite: (option: { id: string }) => void
    onContinue: () => void
  }) => (
    <div>
      <button data-testid="bubble-rewrite" onClick={() => onRewrite({ id: 'formal' })}>
        bubble-rewrite
      </button>
      <button data-testid="bubble-continue" onClick={onContinue}>
        bubble-continue
      </button>
    </div>
  ),
}))

vi.mock('../hooks/useEditorAI', () => ({
  useEditorAI: vi.fn(),
}))

import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { useEditorAI } from '../hooks/useEditorAI'
import {
  buildEditorAIPayload,
  buildEditorAIStyleInstruction,
  getEditorActionInstruction,
} from '../hooks/editorAIPromptPolicy'
import {
  DEFAULT_WRITING_STYLE,
  getPersistedStyleRequirements,
  saveStyle,
} from './editor/WritingStyle'
import { NikoEditor } from './NikoEditor'

const mockUseEditor = vi.mocked(useEditor)
const mockUseEditorAI = vi.mocked(useEditorAI)
const zh = translations.zh
const en = translations.en

let latestEditorConfig: any = null
let currentEditorHarness: any = null

function createComponentEditorHarness() {
  const dom = document.createElement('div')
  dom.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 240,
      bottom: 120,
      width: 240,
      height: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect

  const chainApi: any = {
    focus: vi.fn(),
    deleteRange: vi.fn(),
    toggleHeading: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleOrderedList: vi.fn(),
    toggleBlockquote: vi.fn(),
    toggleCodeBlock: vi.fn(),
    setHorizontalRule: vi.fn(),
    run: vi.fn(() => true),
  }

  chainApi.focus.mockImplementation(() => chainApi)
  chainApi.deleteRange.mockImplementation(() => chainApi)
  chainApi.toggleHeading.mockImplementation(() => chainApi)
  chainApi.toggleBulletList.mockImplementation(() => chainApi)
  chainApi.toggleOrderedList.mockImplementation(() => chainApi)
  chainApi.toggleBlockquote.mockImplementation(() => chainApi)
  chainApi.toggleCodeBlock.mockImplementation(() => chainApi)
  chainApi.setHorizontalRule.mockImplementation(() => chainApi)

  const editor: any = {
    state: {
      selection: {
        from: 1,
        to: 1,
        $from: {
          parent: { textContent: '/' },
          parentOffset: 1,
        },
      },
      doc: {
        textBetween: (from: number, to: number) => (from === 0 && to === 1 ? '/' : ''),
      },
    },
    view: {
      state: null,
      coordsAtPos: () => ({ left: 24, right: 40, top: 12 }),
      dom,
    },
    chain: () => chainApi,
    getJSON: () => ({ type: 'doc', content: [] }),
    getText: () => '',
    isActive: () => false,
  }

  editor.view.state = editor.state

  return {
    editor,
    chainApi,
  }
}

function createAiReturn() {
  return {
    isGenerating: false,
    errorMessage: null,
    clearError: vi.fn(),
    runRequest: vi.fn().mockResolvedValue(undefined),
    generateAtCursor: vi.fn(),
    rewriteSelection: vi.fn(),
    continueWriting: vi.fn(),
    cancel: vi.fn(),
  }
}

describe('NikoEditor inline AI failure feedback', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    vi.useFakeTimers()
    vi.clearAllMocks()
    latestEditorConfig = null
    currentEditorHarness = null
    mockUseEditor.mockImplementation((config) => {
      latestEditorConfig = config
      currentEditorHarness ??= createComponentEditorHarness()
      return currentEditorHarness.editor
    })
  })

  it('shows the inline failure chip with translated copy and clears it after the timeout', () => {
    const clearError = vi.fn()
    mockUseEditorAI.mockReturnValue({
      isGenerating: false,
      errorMessage: 'stream failed',
      clearError,
      runRequest: vi.fn(),
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

  it.each([
    { language: 'en' as const, localizedSnippet: 'Tone: serious' },
    { language: 'zh' as const, localizedSnippet: '情感基调：严肃' },
  ])(
    'passes the active locale and reconstructed persisted style requirements to useEditorAI for $language',
    ({ language, localizedSnippet }) => {
      expect(getPersistedStyleRequirements(language)).toBe('')

      const persistedStyle = {
        ...DEFAULT_WRITING_STYLE,
        tone: 'serious' as const,
        formality: 4,
        structure: {
          ...DEFAULT_WRITING_STYLE.structure,
          paragraphLength: 'short' as const,
        },
        thinking: {
          ...DEFAULT_WRITING_STYLE.thinking,
          depth: 5,
        },
        language: {
          ...DEFAULT_WRITING_STYLE.language,
          sentencePatterns: ['short, clipped lines'],
          rhetoric: ['metaphor'],
          vocabulary: {
            ...DEFAULT_WRITING_STYLE.language.vocabulary,
            preferred: ['granite'],
            avoid: ['purple prose'],
          },
        },
      }
      saveStyle(persistedStyle)
      useSettingsStore.getState().updateSettings({ language })
      mockUseEditorAI.mockReturnValue(createAiReturn())

      render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

      expect(mockUseEditorAI).toHaveBeenCalledTimes(1)
      const options = mockUseEditorAI.mock.calls[0]?.[0]
      const expectedStyleRequirements = getPersistedStyleRequirements(language)

      expect(options.language).toBe(language)
      expect(expectedStyleRequirements).toContain(localizedSnippet)
      expect(options.getStyleRequirements?.()).toBe(expectedStyleRequirements)
      expect(options.getStyleRequirements?.()).not.toContain('"tone"')
    },
  )

  it('routes slash AI commands through a slash-owned restart guard before deleting the command range', () => {
    const aiReturn = createAiReturn()
    mockUseEditorAI.mockReturnValue(aiReturn)

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    act(() => {
      latestEditorConfig.editorProps.handleKeyDown(
        currentEditorHarness.editor.view,
        { key: '/' } as KeyboardEvent,
      )
      vi.runAllTimers()
    })

    act(() => {
      screen.getByTestId('slash-ai-generate').click()
    })

    expect(aiReturn.runRequest).toHaveBeenCalledWith(
      { action: 'generate' },
      expect.objectContaining({
        owner: 'slash',
        allowRestart: true,
        beforeRequestStart: expect.any(Function),
      }),
    )
    expect(currentEditorHarness.chainApi.deleteRange).not.toHaveBeenCalled()

    const requestOptions = aiReturn.runRequest.mock.calls[0]?.[1]
    act(() => {
      requestOptions.beforeRequestStart()
    })

    expect(currentEditorHarness.chainApi.deleteRange).toHaveBeenCalledWith({ from: 0, to: 1 })
    expect(screen.queryByTestId('slash-ai-generate')).not.toBeInTheDocument()
  })

  it('tags bubble rewrite and continue actions with the bubble owner restart semantics', () => {
    const aiReturn = createAiReturn()
    mockUseEditorAI.mockReturnValue(aiReturn)

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    currentEditorHarness.editor.state.selection = {
      ...currentEditorHarness.editor.state.selection,
      from: 1,
      to: 4,
    }

    act(() => {
      latestEditorConfig.onSelectionUpdate({
        editor: currentEditorHarness.editor,
      })
    })

    act(() => {
      screen.getByTestId('bubble-rewrite').click()
      screen.getByTestId('bubble-continue').click()
    })

    expect(aiReturn.runRequest).toHaveBeenNthCalledWith(
      1,
      { action: 'rewrite', variant: 'formal' },
      expect.objectContaining({
        owner: 'bubble',
        allowRestart: true,
      }),
    )
    expect(aiReturn.runRequest).toHaveBeenNthCalledWith(
      2,
      { action: 'continue' },
      expect.objectContaining({
        owner: 'bubble',
        allowRestart: true,
      }),
    )
  })

  it('builds localized prompt payloads through the shared editor AI policy', () => {
    expect(buildEditorAIStyleInstruction('en', 'Keep it spare')).toBe('Style requirements: Keep it spare')
    expect(buildEditorAIStyleInstruction('zh', '保留克制语气')).toBe('风格要求：保留克制语气')
    expect(buildEditorAIStyleInstruction('en', '   ')).toBe('')
    expect(getEditorActionInstruction('en', 'generate')).toContain('Generate a fitting passage')
    expect(getEditorActionInstruction('zh', 'full-article')).toContain('完整的文章')

    const zhPayload = buildEditorAIPayload({
      request: { action: 'generate' },
      language: 'zh',
      contextBefore: '前文',
      rawStyleRequirements: '保留克制语气',
    })
    const enPayload = buildEditorAIPayload({
      request: { action: 'rewrite', variant: 'formal' },
      language: 'en',
      selectedText: 'target',
      rawStyleRequirements: 'Keep it spare',
    })

    expect(zhPayload.prompt).toContain('上下文数据：')
    expect(zhPayload.styleInstruction).toBe('风格要求：保留克制语气')
    expect(enPayload.prompt).toContain('Original text:')
    expect(enPayload.prompt).toContain('Rewrite requirement:')
    expect(enPayload.styleInstruction).toBe('Style requirements: Keep it spare')
    expect(en.inlineActionFailed).toBeTruthy()
  })
})
