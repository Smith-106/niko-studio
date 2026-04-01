/**
 * Bubble Toolbar Component
 *
 * Floating toolbar that appears when text is selected.
 * Contains AI rewrite options and basic formatting.
 */

import { useState, useCallback } from 'react'
import { Bold, Italic, Strikethrough, Wand2, ChevronRight } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { useI18n } from '../../i18n'

export interface RewriteOption {
  id: string
  labelKey: string
  instruction: string
}

export const REWRITE_OPTIONS: RewriteOption[] = [
  { id: 'polish', labelKey: 'editorBubblePolish', instruction: '润色选中文本，使其更加流畅自然' },
  { id: 'simplify', labelKey: 'editorBubbleSimplify', instruction: '简化选中文本，使其更简洁明了' },
  { id: 'expand', labelKey: 'editorBubbleExpand', instruction: '扩写选中文本，增加细节和深度' },
  { id: 'formal', labelKey: 'editorBubbleFormal', instruction: '将选中文本改写为正式书面风格' },
  { id: 'casual', labelKey: 'editorBubbleCasual', instruction: '将选中文本改写为口语化风格' },
]

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
      <ToolbarButton onClick={setBold} active={editor.isActive('bold')} title="Bold">
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={setItalic} active={editor.isActive('italic')} title="Italic">
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={setStrike} active={editor.isActive('strike')} title="Strikethrough">
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
            {REWRITE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onRewrite(opt)
                  setShowRewriteMenu(false)
                  onClose()
                }}
                className="w-full px-3 py-1.5 text-left text-[12px] text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-dark-surface2 transition-colors"
              >
                {t[opt.labelKey as keyof typeof t] ?? opt.id}
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
      onClick={onClick}
      title={title}
      className={`flex items-center px-1.5 py-1 rounded text-gray-300 hover:text-white transition-colors ${
        active ? 'bg-primary-600 text-white' : 'hover:bg-gray-700 dark:hover:bg-dark-surface2'
      }`}
    >
      {children}
    </button>
  )
}
