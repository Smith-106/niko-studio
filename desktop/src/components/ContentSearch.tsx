import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
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
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }))

    const clearHighlights = useCallback(() => {
      if ('Highlights' in CSS && typeof CSS.highlights !== 'undefined') {
        try {
          CSS.highlights.delete('content-search')
        } catch {
          // Ignore browsers without highlight support.
        }
      }
      rangesRef.current = []
    }, [])

    const performSearch = useCallback(() => {
      if (!containerRef.current || !state.query) {
        clearHighlights()
        setState((prev) => ({
          ...prev,
          matchCount: 0,
          currentIndex: 0,
        }))
        return
      }

      const matches: Range[] = []
      const walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT, null)
      const textNodes: Text[] = []
      let node: Text | null

      while ((node = walker.nextNode() as Text | null)) {
        textNodes.push(node)
      }

      const query = state.caseSensitive ? state.query : state.query.toLowerCase()

      for (const textNode of textNodes) {
        const rawText = textNode.data
        const searchableText = state.caseSensitive ? rawText : rawText.toLowerCase()
        let startIndex = 0

        while (true) {
          const matchIndex = searchableText.indexOf(query, startIndex)
          if (matchIndex === -1) {
            break
          }

          const range = document.createRange()
          range.setStart(textNode, matchIndex)
          range.setEnd(textNode, matchIndex + query.length)
          matches.push(range)
          startIndex = matchIndex + 1
        }
      }

      rangesRef.current = matches

      if ('Highlights' in CSS && typeof CSS.highlights !== 'undefined') {
        try {
          const highlight = new Highlight(...matches)
          CSS.highlights.set('content-search', highlight)
        } catch {
          // Ignore browsers without highlight support.
        }
      }

      setState((prev) => ({
        ...prev,
        matchCount: matches.length,
        currentIndex: matches.length > 0 ? Math.min(prev.currentIndex, matches.length - 1) : 0,
      }))
    }, [clearHighlights, containerRef, state.caseSensitive, state.query])

    useEffect(() => {
      if (visible) {
        requestAnimationFrame(() => inputRef.current?.focus())
      } else {
        clearHighlights()
      }
    }, [clearHighlights, visible])

    useEffect(() => {
      if (!visible) {
        return
      }

      searchTimerRef.current = setTimeout(() => {
        performSearch()
      }, 150)

      return () => {
        if (searchTimerRef.current) {
          clearTimeout(searchTimerRef.current)
          searchTimerRef.current = null
        }
      }
    }, [performSearch, visible])

    useEffect(() => {
      return () => {
        clearHighlights()
      }
    }, [clearHighlights])

    const navigateNext = useCallback((direction: number) => {
      if (rangesRef.current.length === 0) {
        return
      }

      let nextIndex = 0
      setState((prev) => {
        const next = (prev.currentIndex + direction + prev.matchCount) % prev.matchCount
        nextIndex = next
        return { ...prev, currentIndex: next }
      })

      requestAnimationFrame(() => {
        const range = rangesRef.current[nextIndex]
        range?.startContainer.parentElement?.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        })
      })
    }, [])

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose()
          return
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          navigateNext(event.shiftKey ? -1 : 1)
        }
      },
      [navigateNext, onClose],
    )

    if (!visible) {
      return null
    }

    return (
      <div className="absolute top-0 right-0 z-50 m-2 animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-lg">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={state.query}
            onChange={(event) => {
              const query = event.target.value
              setState((prev) => ({ ...prev, query, currentIndex: 0 }))
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
