import React, { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import { useI18n } from '../i18n'

export interface QuickPanelItem {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  keywords?: string[]
  action: () => void
}

interface QuickPanelProps {
  items: QuickPanelItem[]
  visible: boolean
  onClose: () => void
  onSelect: (item: QuickPanelItem) => void
}

const ITEM_HEIGHT = 36
const MAX_VISIBLE = 8

function matchScore(item: QuickPanelItem, query: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const label = item.label.toLowerCase()

  // Exact match
  if (label === q) return 1000
  // Starts with
  if (label.startsWith(q)) return 800
  // Contains
  if (label.includes(q)) return 600 - label.indexOf(q)
  // Keyword match
  if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return 400
  return 0
}

export const QuickPanel = React.memo(function QuickPanel({ items, visible, onClose, onSelect }: QuickPanelProps) {
  const [searchText, setSearchText] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const { t } = useI18n()
  const panelId = useId()
  const titleId = `${panelId}-title`
  const listboxId = `${panelId}-listbox`
  const footerId = `${panelId}-footer`

  const filtered = useMemo(() => {
    if (!searchText) return items
    return items
      .map((item) => ({ item, score: matchScore(item, searchText) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
  }, [items, searchText])

  // Reset on open/close
  useEffect(() => {
    if (!visible) return

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSearchText('')
    setSelectedIndex(0)

    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      restoreFocusRef.current?.focus()
      restoreFocusRef.current = null
    }
  }, [visible])

  // Clamp selection
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, selectedIndex])

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current || selectedIndex < 0) return
    const container = listRef.current
    const top = selectedIndex * ITEM_HEIGHT
    const bottom = top + ITEM_HEIGHT
    if (top < container.scrollTop) {
      container.scrollTop = top
    } else if (bottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = bottom - container.clientHeight
    }
  }, [selectedIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length))
          break
        case 'Home':
          e.preventDefault()
          setSelectedIndex(0)
          break
        case 'End':
          e.preventDefault()
          setSelectedIndex(Math.max(0, filtered.length - 1))
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[selectedIndex]) {
            onSelect(filtered[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          e.preventDefault()
          inputRef.current?.focus()
          break
      }
    },
    [filtered, selectedIndex, onSelect, onClose]
  )

  if (!visible) return null

  const listHeight = Math.min(filtered.length, MAX_VISIBLE) * ITEM_HEIGHT
  const activeOptionId = filtered[selectedIndex] ? `${panelId}-option-${filtered[selectedIndex].id}` : undefined

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 z-50"
      data-quick-panel
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={footerId}
    >
      <div className="mx-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-dark-border dark:bg-dark-surface overflow-hidden">
        <h2 id={titleId} className="sr-only">
          {t.quickPanelTitle}
        </h2>
        <div className="px-3 py-2 border-b border-gray-100 dark:border-dark-border/50">
          <input
            ref={inputRef}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t.quickPanelSearchPlaceholder}
            aria-label={t.quickPanelSearchPlaceholder}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-describedby={footerId}
            className="w-full bg-transparent text-sm text-gray-900 dark:text-dark-text outline-none placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          />
        </div>
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={t.quickPanelResultsLabel}
          style={{ maxHeight: listHeight, overflowY: 'auto' }}
          className="py-1"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-400" role="status" aria-live="polite">
              {t.quickPanelNoMatch}
            </div>
          ) : (
            filtered.map((item, i) => (
              <div
                key={item.id}
                id={`${panelId}-option-${item.id}`}
                role="option"
                aria-selected={i === selectedIndex}
                tabIndex={-1}
                className={`flex items-center gap-3 px-3 cursor-pointer transition-colors ${
                  i === selectedIndex
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-dark-bg'
                }`}
                style={{ height: ITEM_HEIGHT }}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {item.icon && <span className="text-gray-400 flex-shrink-0">{item.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-dark-text truncate">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-gray-400 truncate">{item.description}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div
          id={footerId}
          className="px-3 py-1.5 border-t border-gray-100 dark:border-dark-border/50 flex items-center gap-4 text-[11px] text-gray-400"
        >
          <span>{t.quickPanelSelect}</span>
          <span>{t.quickPanelConfirm}</span>
          <span>{t.quickPanelClose}</span>
        </div>
      </div>
    </div>
  )
})

