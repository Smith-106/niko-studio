/**
 * NikoEditor — TipTap Rich Text Editor
 *
 * Replaces the plain textarea with a full-featured rich text editor.
 * Includes slash commands, bubble toolbar, and AI integration.
 */

import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
import { SlashCommandMenu, type SlashMenuItem } from './editor/SlashCommandMenu'
import { BubbleToolbar, REWRITE_OPTIONS } from './editor/BubbleToolbar'
import { useEditorAI } from '../hooks/useEditorAI'
import { useI18n } from '../i18n'
import { setEditorHandle, type EditorHandle } from '../utils/editorHandle'

export interface NikoEditorHandle {
  insertText: (text: string) => void
  getSelectedText: () => string
  getJSON: () => JSONContent
}

export interface NikoEditorProps {
  initialContent?: string | JSONContent
  onUpdate?: (json: JSONContent, text: string) => void
  onOpenWritingHelper: () => void
}

interface SlashState {
  active: boolean
  query: string
  position: { x: number; y: number } | null
  range: { from: number; to: number } | null
}

interface BubbleState {
  active: boolean
  position: { x: number; y: number } | null
}

const EMPTY_SLASH: SlashState = { active: false, query: '', position: null, range: null }
const EMPTY_BUBBLE: BubbleState = { active: false, position: null }

export const NikoEditor = forwardRef<NikoEditorHandle, NikoEditorProps>(function NikoEditor({ initialContent, onUpdate, onOpenWritingHelper: _onOpenWritingHelper }, ref) {
  const { t } = useI18n()
  const [slashState, setSlashState] = useState<SlashState>(EMPTY_SLASH)
  const [bubbleState, setBubbleState] = useState<BubbleState>(EMPTY_BUBBLE)

  // Refs to avoid stale closures in useEditor callbacks
  const slashRef = useRef<SlashState>(EMPTY_SLASH)
  const bubbleRef = useRef<BubbleState>(EMPTY_BUBBLE)
  const editorRef = useRef<HTMLDivElement>(null)

  // Keep refs in sync
  useEffect(() => { slashRef.current = slashState }, [slashState])
  useEffect(() => { bubbleRef.current = bubbleState }, [bubbleState])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'code-block' } },
        blockquote: { HTMLAttributes: { class: 'blockquote' } },
      }),
      Placeholder.configure({
        placeholder: t.editorPlaceholder,
      }),
      TextStyle,
      Typography,
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: {
        class:
          'niko-editor-content outline-none min-h-[60vh] text-lg md:text-[21px] leading-[1.8] text-gray-800 dark:text-gray-300 font-serif',
      },
      handleKeyDown: (view, event) => {
        const currentSlash = slashRef.current

        // Handle slash command activation
        if (event.key === '/' && !currentSlash.active) {
          setTimeout(() => {
            const { from } = view.state.selection
            const $pos = view.state.selection.$from
            const textBefore = $pos.parent.textContent.slice(0, $pos.parentOffset)

            if (textBefore.endsWith('/')) {
              const coords = view.coordsAtPos(from)
              const editorDom = view.dom as HTMLElement
              const rect = editorDom.getBoundingClientRect()

              setSlashState({
                active: true,
                query: '',
                position: { x: coords.left - rect.left, y: coords.top - rect.top },
                range: { from: from - 1, to: from },
              })
            }
          }, 0)
        }

        // Close slash menu on Escape
        if (event.key === 'Escape' && currentSlash.active) {
          setSlashState(EMPTY_SLASH)
          return true
        }

        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON()
      const text = ed.getText()
      onUpdate?.(json, text)

      // Update slash command query (read from ref to get latest)
      const currentSlash = slashRef.current
      if (currentSlash.active && currentSlash.range) {
        const { from } = ed.state.selection
        const slashFrom = currentSlash.range.from
        if (from > slashFrom) {
          const query = ed.state.doc.textBetween(slashFrom, from, '\n')
          if (query.includes(' ') || query.includes('\n')) {
            setSlashState(EMPTY_SLASH)
          } else {
            setSlashState((prev) => ({ ...prev, query: query.replace(/^\//, '') }))
          }
        } else {
          setSlashState(EMPTY_SLASH)
        }
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection
      if (from !== to) {
        const coords = ed.view.coordsAtPos(from)
        const editorDom = ed.view.dom as HTMLElement
        const rect = editorDom.getBoundingClientRect()

        setBubbleState({
          active: true,
          position: {
            x: coords.left - rect.left + (coords.right - coords.left) / 2,
            y: coords.top,
          },
        })
        // Close slash menu if open
        if (slashRef.current.active) {
          setSlashState(EMPTY_SLASH)
        }
      } else {
        setBubbleState(EMPTY_BUBBLE)
      }
    },
  })

  // Mutable handle object — isGenerating updated via effect
  const handleRef = useRef<EditorHandle & { isGenerating?: boolean }>({
    insertText: () => {},
    getSelectedText: () => '',
    getJSON: () => ({ type: 'doc', content: [] }),
    isGenerating: false,
  })

  useImperativeHandle(ref, () => handleRef.current, [])

  // Update handle methods when editor changes
  useEffect(() => {
    if (!editor) return
    handleRef.current.insertText = (text: string) => {
      editor.chain().focus().insertContent(text).run()
    }
    handleRef.current.getSelectedText = () => {
      const { from, to } = editor.state.selection
      return editor.state.doc.textBetween(from, to, '\n')
    }
    handleRef.current.getJSON = () => editor.getJSON()
    setEditorHandle(handleRef.current)
    return () => { setEditorHandle(null) }
  }, [editor])

  const ai = useEditorAI({
    editor,
    getStyleInstruction: () => {
      try {
        const raw = localStorage.getItem('niko.writing-helper-style-v1')
        return raw ? `风格要求：${raw}` : ''
      } catch {
        return ''
      }
    },
  })

  const handleSlashSelect = useCallback(
    (item: SlashMenuItem) => {
      if (!editor || !slashState.range) return

      editor.chain().focus().deleteRange(slashState.range).run()
      setSlashState(EMPTY_SLASH)

      switch (item.id) {
        case 'ai-generate':
          ai.generateAtCursor('请根据上下文生成一段合适的文本')
          break
        case 'ai-continue':
          ai.continueWriting()
          break
        case 'ai-full-article':
          ai.generateAtCursor('请生成一篇完整的文章')
          break
        case 'heading-1':
          editor.chain().focus().toggleHeading({ level: 1 }).run()
          break
        case 'heading-2':
          editor.chain().focus().toggleHeading({ level: 2 }).run()
          break
        case 'heading-3':
          editor.chain().focus().toggleHeading({ level: 3 }).run()
          break
        case 'bullet-list':
          editor.chain().focus().toggleBulletList().run()
          break
        case 'ordered-list':
          editor.chain().focus().toggleOrderedList().run()
          break
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run()
          break
        case 'code-block':
          editor.chain().focus().toggleCodeBlock().run()
          break
        case 'horizontal-rule':
          editor.chain().focus().setHorizontalRule().run()
          break
      }
    },
    [editor, slashState.range, ai],
  )

  const handleRewrite = useCallback(
    (option: typeof REWRITE_OPTIONS[number]) => {
      ai.rewriteSelection(option.instruction)
    },
    [ai],
  )

  const handleContinue = useCallback(() => {
    ai.continueWriting()
  }, [ai])

  // Click outside to close bubble toolbar
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bubbleState.active && editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setBubbleState(EMPTY_BUBBLE)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [bubbleState.active])

  // Sync isGenerating to the shared handle
  useEffect(() => {
    handleRef.current.isGenerating = ai.isGenerating
  }, [ai.isGenerating])

  useEffect(() => {
    if (!ai.errorMessage) return
    const timeoutId = window.setTimeout(() => {
      ai.clearError()
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [ai.clearError, ai.errorMessage])

  return (
    <div ref={editorRef} className="relative">
      <EditorContent editor={editor} />

      {/* Slash Command Menu */}
      {slashState.active && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="pointer-events-auto">
            <SlashCommandMenu
              query={slashState.query}
              position={slashState.position}
              onSelect={handleSlashSelect}
              onClose={() => setSlashState(EMPTY_SLASH)}
            />
          </div>
        </div>
      )}

      {/* Bubble Toolbar */}
      {bubbleState.active && editor && (
        <BubbleToolbar
          editor={editor}
          position={bubbleState.position}
          onRewrite={handleRewrite}
          onContinue={handleContinue}
          onClose={() => setBubbleState(EMPTY_BUBBLE)}
        />
      )}

      {/* AI Generating Indicator */}
      {ai.isGenerating && (
        <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-500/20">
          <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          <span className="text-[11px] font-medium text-primary-600 dark:text-primary-400">{t.editorAiGenerating}</span>
          <button
            onClick={ai.cancel}
            className="text-[10px] text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 underline"
          >
            {t.editorAiCancel}
          </button>
        </div>
      )}

      {!ai.isGenerating && ai.errorMessage && (
        <div
          role="status"
          aria-live="polite"
          title={ai.errorMessage}
          className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 shadow-sm"
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[11px] font-medium text-red-600 dark:text-red-300">{t.inlineActionFailed}</span>
        </div>
      )}
    </div>
  )
})
