/**
 * Bubble Toolbar Component
 *
 * Floating toolbar that appears when text is selected.
 * Contains AI rewrite options and basic formatting.
 */

import { useState, useCallback } from 'react'
import { Bold, Italic, Strikethrough, Wand2, ChevronRight } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { useI18n, type Translations } from '../../i18n'
import {
  getEditorAIRewriteOptions,
  type EditorAIRewriteOption,
} from '../../hooks/editorAIPromptPolicy'

export type RewriteOption = EditorAIRewriteOption

type FormattingAction = 'bold' | 'italic' | 'strike'
type FormattingLabelKey = keyof Pick<
  Translations,
  'editorBubbleBold' | 'editorBubbleItalic' | 'editorBubbleStrikethrough'
>

const FORMATTING_LABEL_KEYS: Record<FormattingAction, FormattingLabelKey> = {
  bold: 'editorBubbleBold',
  italic: 'editorBubbleItalic',
  strike: 'editorBubbleStrikethrough',
}

export function getRewriteOptions(_language?: unknown): RewriteOption[] {
  return getEditorAIRewriteOptions()
}

interface BubbleToolbarProps {
  editor: Editor
  position: { x: number; y: number } | null
  onRewrite: (option: RewriteOption) => void
  onContinue: () => void
  onClose: () => void
}

export function BubbleToolbar({ editor, position, onRewrite, onContinue, onClose }: BubbleToolbarProps) {
  const { t } = useI18n()
  const [showRewriteMenu, setShowRewriteMenu] = useState(false)
  const rewriteOptions = getRewriteOptions()

  const setBold = useCallback(() => editor.chain().focus().toggleBold().run(), [editor])
  const setItalic = useCallback(() => editor.chain().focus().toggleItalic().run(), [editor])
  const setStrike = useCallback(() => editor.chain().focus().toggleStrike().run(), [editor])

  if (!position) return null

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 px-1 py-1 rounded-lg bg-gray-900 dark:bg-dark-surface shadow-2xl border border-gray-700 dark:border-dark-border"
      style={{ left: position.x - 100, top: position.y - 52 }}
    >
      {/* Formatting */}
      <ToolbarButton onClick={setBold} active={editor.isActive('bold')} title={t[FORMATTING_LABEL_KEYS.bold]}>
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={setItalic}
        active={editor.isActive('italic')}
        title={t[FORMATTING_LABEL_KEYS.italic]}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={setStrike}
        active={editor.isActive('strike')}
        title={t[FORMATTING_LABEL_KEYS.strike]}
      >
        <Strikethrough size={14} />
      </ToolbarButton>

      <div className="w-px h-5 bg-gray-600 dark:bg-dark-border mx-0.5" />

      {/* AI Rewrite */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowRewriteMenu(!showRewriteMenu)}
          active={false}
          title={t.editorBubbleRewrite}
        >
          <Wand2 size={14} />
          <span className="text-[11px] ml-0.5">{t.editorBubbleRewrite}</span>
          <ChevronRight size={10} className={`transition-transform ${showRewriteMenu ? 'rotate-90' : ''}`} />
        </ToolbarButton>

        {showRewriteMenu && (
          <div className="absolute left-0 top-full mt-1 w-44 rounded-lg bg-gray-900 dark:bg-dark-surface shadow-2xl border border-gray-700 dark:border-dark-border py-1 z-10">
            {rewriteOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onRewrite(opt)
                  setShowRewriteMenu(false)
                  onClose()
                }}
                className="w-full px-3 py-1.5 text-left text-[12px] text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-dark-surface2 transition-colors"
              >
                {t[opt.labelKey] ?? opt.id}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-600 dark:bg-dark-border mx-0.5" />

      {/* Continue */}
      <ToolbarButton
        onClick={() => {
          onContinue()
          onClose()
        }}
        active={false}
        title={t.editorBubbleContinue}
      >
        <span className="text-[11px]">{t.editorBubbleContinue}</span>
      </ToolbarButton>
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex items-center px-1.5 py-1 rounded text-gray-300 hover:text-white transition-colors ${
        active ? 'bg-primary-600 text-white' : 'hover:bg-gray-700 dark:hover:bg-dark-surface2'
      }`}
    >
      {children}
    </button>
  )
}
