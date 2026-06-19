import { useState, useEffect, useRef } from 'react'

// ============================================================
// Types
// ============================================================

export interface InlineSuggestion {
  id: string
  text: string
  confidence: number
  mode: 'auto' | 'guided'
}

export interface InlineHintsProps {
  suggestions: InlineSuggestion[]
  onAccept: (id: string) => void
  onDismiss: (id: string) => void
  position: { line: number; column: number }
}

// ============================================================
// Helpers
// ============================================================

/** Get confidence color: green>=0.7, yellow>=0.4, red<0.4 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'bg-green-500'
  if (confidence >= 0.4) return 'bg-yellow-500'
  return 'bg-red-500'
}

/** Truncate text to 2 lines (approx 80 chars per line) */
function truncateText(text: string, maxChars = 160): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars).trim() + '...'
}

// ============================================================
// Component
// ============================================================

export function InlineHints({ suggestions, onAccept, onDismiss, position }: InlineHintsProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const cardRef = useRef<HTMLDivElement>(null)

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Handle dismiss with animation
  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id))
    setTimeout(() => {
      onDismiss(id)
    }, 200) // Match fade-out duration
  }

  // Calculate position (relative to cursor)
  // In real implementation, this would use editor coordinates
  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${position.line * 24 + 40}px`, // Approximate line height
    left: `${position.column * 8 + 20}px`, // Approximate char width
    zIndex: 50,
  }

  const activeSuggestions = suggestions

  if (activeSuggestions.length === 0) return null

  return (
    <div style={style} className="pointer-events-auto">
      <div
        ref={cardRef}
        className={`
          w-80 rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur-sm
          shadow-xl shadow-black/40 p-3 space-y-2
          transition-all duration-200 ease-out
          ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 font-medium">AI 建议</span>
          <button
            onClick={() => activeSuggestions.forEach(s => handleDismiss(s.id))}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="关闭所有建议"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Suggestions */}
        <div className="space-y-2">
          {activeSuggestions.map(suggestion => (
            <div
              key={suggestion.id}
              className={`
                p-2 rounded bg-zinc-800/50 border border-zinc-700/50
                transition-all duration-200
                ${dismissed.has(suggestion.id) ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
              `}
            >
              {/* Suggestion text preview */}
              <p className="text-xs text-zinc-300 leading-relaxed mb-2 line-clamp-2">
                {truncateText(suggestion.text)}
              </p>

              {/* Footer: confidence + mode + actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Confidence indicator */}
                  <div className="flex items-center gap-1">
                    <div
                      className={`w-2 h-2 rounded-full ${getConfidenceColor(suggestion.confidence)}`}
                      title={`置信度: ${Math.round(suggestion.confidence * 100)}%`}
                    />
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>

                  {/* Mode badge */}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      suggestion.mode === 'auto'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}
                  >
                    {suggestion.mode === 'auto' ? '自动' : '引导'}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => onAccept(suggestion.id)}
                    className="px-2 py-0.5 text-[10px] rounded bg-blue-600/80 text-white
                      hover:bg-blue-600 transition-colors"
                  >
                    采用
                  </button>
                  <button
                    onClick={() => handleDismiss(suggestion.id)}
                    className="px-2 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-400
                      hover:bg-zinc-600 transition-colors"
                  >
                    忽略
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
