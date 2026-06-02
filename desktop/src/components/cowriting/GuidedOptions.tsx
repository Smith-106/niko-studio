import { useState, useCallback } from 'react'

// ============================================================
// Types
// ============================================================

export interface GuidedOptionData {
  text: string
  scores: {
    coherence: number
    creativity: number
    styleMatch: number
  }
  overallScore: number
  index: number
}

export interface GuidedOptionsProps {
  options: GuidedOptionData[]
  onSelect: (index: number) => void
  disabled?: boolean
}

// ============================================================
// Helpers
// ============================================================

/** Map a 0-100 score to a color class */
function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

/** Map a 0-100 score to a bar fill color class */
function barColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

/** Overall score badge background */
function overallBadgeColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/20 text-emerald-400'
  if (score >= 60) return 'bg-amber-500/20 text-amber-400'
  return 'bg-red-500/20 text-red-400'
}

const SCORE_LABELS: Record<string, string> = {
  coherence: '连贯',
  creativity: '创意',
  styleMatch: '风格',
}

const SCORE_KEYS = ['coherence', 'creativity', 'styleMatch'] as const

// ============================================================
// Sub-components
// ============================================================

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-zinc-500 w-6 shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-zinc-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono w-6 text-right shrink-0 ${scoreColor(value)}`}>
        {value}
      </span>
    </div>
  )
}

// ============================================================
// Component
// ============================================================

export function GuidedOptions({ options, onSelect, disabled = false }: GuidedOptionsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const handleSelect = useCallback(
    (index: number) => {
      if (disabled) return
      setSelectedIndex(index)
      onSelect(index)
    },
    [disabled, onSelect],
  )

  return (
    <div className="flex flex-col gap-2">
      {options.map(option => {
        const isSelected = selectedIndex === option.index
        return (
          <div
            key={option.index}
            onClick={() => handleSelect(option.index)}
            className={`
              p-2 rounded border transition-colors cursor-pointer space-y-2
              ${
                isSelected
                  ? 'bg-zinc-700/60 border-blue-500/60'
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-500'
              }
              ${disabled ? 'opacity-40 pointer-events-none' : ''}
            `}
          >
            {/* Header: number badge + overall score */}
            <div className="flex items-center justify-between">
              <span
                className={`
                  inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                  ${isSelected ? 'bg-blue-500/30 text-blue-400' : 'bg-zinc-700 text-zinc-400'}
                `}
              >
                {option.index + 1}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${overallBadgeColor(option.overallScore)}`}
              >
                {option.overallScore}
              </span>
            </div>

            {/* Text preview */}
            <p className="text-xs text-zinc-300 leading-relaxed line-clamp-4">
              {option.text}
            </p>

            {/* Score bars */}
            <div className="space-y-1">
              {SCORE_KEYS.map(key => (
                <ScoreBar
                  key={key}
                  label={SCORE_LABELS[key]}
                  value={option.scores[key]}
                />
              ))}
            </div>

            {/* Use This button */}
            <button
              onClick={e => {
                e.stopPropagation()
                handleSelect(option.index)
              }}
              disabled={disabled}
              className={`
                w-full py-1 text-[10px] rounded transition-colors
                ${
                  isSelected
                    ? 'bg-blue-600/80 text-white hover:bg-blue-600'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }
                disabled:cursor-not-allowed
              `}
            >
              采用此方案
            </button>
          </div>
        )
      })}
    </div>
  )
}
