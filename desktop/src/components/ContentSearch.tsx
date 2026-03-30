import { useState, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Search, X } from 'lucide-react'
import { useI18n } from '../i18n'

interface ContentSearchProps {
  containerRef: React.RefObject<HTMLDivElement>
  visible: boolean
  onClose: () => void
}

interface SearchState {
  query: string
  matchCount: number
  currentIndex: number
  caseSensitive: boolean
}

/**
 * In-page message search using CSS Custom Highlight API.
 * Adapted from Cherry Studio's ContentSearch pattern.
 * Zero-DOM-modification text highlighting.
 */
export const ContentSearch = forwardRef<{ focus: () => void }, ContentSearchProps>(
  function ContentSearchInner({ containerRef, visible, onClose }, ref) {
    const { t } = useI18n()
    const [state, setState] = useState<SearchState>({
      query: '',
      matchCount: 0,
      currentIndex: 0,
      caseSensitive: false,
    })
    const inputRef = useRef<HTMLInputElement>(null)
    const rangesRef = useRef<Range[]>([])

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }))

    // Auto-focus on open
    useEffect(() => {
      if (visible) {
        requestAnimationFrame(() => inputRef.current?.focus())
      } else {
        clearHighlights()
      }
    }, [visible])

    const performSearch = useCallback(() => {
      if (!containerRef.current || !state.query) {
        clearHighlights()
        return
      }

      const container = containerRef.current
      const matches: Range[] = []

      // Walk text nodes using TreeWalker
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
      const textNodes: Text[] = []
      let node: Text | null
      while ((node = walker.nextNode() as Text | null)) {
        textNodes.push(node)
      }

      const query = state.caseSensitive ? state.query : state.query.toLowerCase()

      for (const textNode of textNodes) {
        const text = state.caseSensitive ? textNode.textContent! : textNode.textContent!.toLowerCase()
        let startIdx = 0
        while (true) {
          const idx = text.indexOf(query, startIdx)
          if (idx === -1) break
          const range = document.createRange()
          range.setStart(textNode, idx)
          range.setEnd(textNode, idx + query.length)
          matches.push(range)
          startIdx = idx + 1
        }
      }

      rangesRef.current = matches

      // Apply CSS Custom Highlight API
      if ('Highlights' in CSS && typeof CSS.highlights !== 'undefined') {
        try {
          const highlight = new Highlight(...matches)
          CSS.highlights.set('content-search', highlight)
        } catch {
          // Fallback: no highlighting support
        }
      }

      setState((prev) => ({
        ...prev,
        matchCount: matches.length,
        currentIndex: matches.length > 0 ? Math.min(prev.currentIndex, matches.length - 1) : 0,
      }))
    }, [containerRef, state.query, state.caseSensitive])

    const clearHighlights = useCallback(() => {
      if ('Highlights' in CSS && typeof CSS.highlights !== 'undefined') {
        try {
          CSS.highlights.delete('content-search')
        } catch {
          // ignore
        }
      }
      rangesRef.current = []
    }, [])

    // Cleanup on unmount
    useEffect(() => {
      return () => clearHighlights()
    }, [clearHighlights])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          navigateNext(e.shiftKey ? -1 : 1)
        }
      },
      [onClose],
    )

    const navigateNext = useCallback(
      (direction: number) => {
        if (rangesRef.current.length === 0) return
        let nextIndex = 0
        setState((prev) => {
          const next = (prev.currentIndex + direction + prev.matchCount) % prev.matchCount
          nextIndex = next
          return { ...prev, currentIndex: next }
        })
        // Use requestAnimationFrame to ensure DOM state is updated before scrolling
        requestAnimationFrame(() => {
          const range = rangesRef.current[nextIndex]
          if (range) {
            range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        })
      },
      [],
    )

    if (!visible) return null

    return (
      <div className="absolute top-0 right-0 z-50 m-2 animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={state.query}
            onChange={(e) => {
              const query = e.target.value
              setState((prev) => ({ ...prev, query, currentIndex: 0 }))
              // Debounced search
              setTimeout(() => performSearch(), 150)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t.contentSearchPlaceholder}
            className="w-40 bg-transparent text-sm text-gray-900 dark:text-dark-text outline-none placeholder:text-gray-400"
          />
          {state.matchCount > 0 && (
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {state.currentIndex + 1}/{state.matchCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => setState((prev) => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
            className={`px-1.5 py-0.5 text-xs rounded font-medium transition-colors ${
              state.caseSensitive
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Case sensitive"
          >
            Aa
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  },
)
