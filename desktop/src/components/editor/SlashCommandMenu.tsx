/**
 * Slash Command Menu Component
 *
 * Floating menu that appears when user types "/" in the editor.
 * Shows AI commands and formatting options.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useI18n } from '../../i18n'

export interface SlashMenuItem {
  id: string
  label: string
  description: string
  icon: string
  type: 'ai' | 'format'
}

interface SlashCommandMenuProps {
  query: string
  position: { x: number; y: number } | null
  onSelect: (item: SlashMenuItem) => void
  onClose: () => void
}

export function SlashCommandMenu({ query, position, onSelect, onClose }: SlashCommandMenuProps) {
  const { t } = useI18n()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const items: SlashMenuItem[] = useMemo(() => [
    // AI commands
    { id: 'ai-generate', label: t.editorCmdGenerate, description: t.editorCmdGenerateDesc, icon: '✨', type: 'ai' as const },
    { id: 'ai-continue', label: t.editorCmdContinue, description: t.editorCmdContinueDesc, icon: '➡️', type: 'ai' as const },
    { id: 'ai-full-article', label: t.editorCmdFullArticle, description: t.editorCmdFullArticleDesc, icon: '📄', type: 'ai' as const },
    // Format commands
    { id: 'heading-1', label: t.editorCmdHeading1, description: t.editorCmdHeading1Desc, icon: 'H1', type: 'format' as const },
    { id: 'heading-2', label: t.editorCmdHeading2, description: t.editorCmdHeading2Desc, icon: 'H2', type: 'format' as const },
    { id: 'heading-3', label: t.editorCmdHeading3, description: t.editorCmdHeading3Desc, icon: 'H3', type: 'format' as const },
    { id: 'bullet-list', label: t.editorCmdBulletList, description: t.editorCmdBulletListDesc, icon: '•', type: 'format' as const },
    { id: 'ordered-list', label: t.editorCmdOrderedList, description: t.editorCmdOrderedListDesc, icon: '1.', type: 'format' as const },
    { id: 'blockquote', label: t.editorCmdBlockquote, description: t.editorCmdBlockquoteDesc, icon: '"', type: 'format' as const },
    { id: 'code-block', label: t.editorCmdCodeBlock, description: t.editorCmdCodeBlockDesc, icon: '</>', type: 'format' as const },
    { id: 'horizontal-rule', label: t.editorCmdHorizontalRule, description: t.editorCmdHorizontalRuleDesc, icon: '—', type: 'format' as const },
    // New format commands from TASK-001
    { id: 'table', label: '表格', description: '插入一个表格', icon: '▦', type: 'format' as const },
    { id: 'math', label: '行内公式', description: '插入一个行内 LaTeX 公式', icon: '∑', type: 'format' as const },
    { id: 'math-block', label: '块级公式', description: '插入一个块级 LaTeX 公式', icon: '∬', type: 'format' as const },
    { id: 'callout', label: '提示块', description: '插入一个提示块 (info, tip, etc.)', icon: '📣', type: 'format' as const },
  ], [t])

  const filtered = useMemo(() => {
    if (!query) return items
    const q = query.toLowerCase()
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.id.includes(q),
    )
  }, [items, query])

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [filtered, selectedIndex, onSelect, onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (filtered.length === 0 || !position) return null

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-2xl custom-scrollbar"
      style={{ left: position.x, top: (position.y || 0) + 8 }}
    >
      <div className="py-1">
        {filtered.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setSelectedIndex(idx)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              idx === selectedIndex
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2'
            }`}
          >
            <span className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 dark:bg-dark-bg text-xs font-mono font-bold shrink-0">
              {item.icon}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-medium truncate">{item.label}</div>
              <div className="text-[10px] text-gray-400 dark:text-dark-text-muted truncate">{item.description}</div>
            </div>
            {item.type === 'ai' && (
              <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 uppercase">
                AI
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
