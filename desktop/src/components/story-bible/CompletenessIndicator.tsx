// ============================================================
// Types
// ============================================================

export type CompletenessLevel = 'critical' | 'incomplete' | 'adequate' | 'comprehensive'

export interface CompletenessIndicatorProps {
  /** Completeness score from 0 to 1 */
  score: number
  /** Explicit level override; auto-derived from score if omitted */
  level?: CompletenessLevel
  /** Show percentage label next to the indicator */
  showLabel?: boolean
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Optional tooltip text (e.g. missing fields summary) */
  tooltip?: string
}

// ============================================================
// Helpers
// ============================================================

const LEVEL_THRESHOLDS: Array<{ min: number; level: CompletenessLevel }> = [
  { min: 0.8, level: 'comprehensive' },
  { min: 0.6, level: 'adequate' },
  { min: 0.3, level: 'incomplete' },
  { min: 0, level: 'critical' },
]

function deriveLevel(score: number): CompletenessLevel {
  const clamped = Math.max(0, Math.min(1, score))
  for (const { min, level } of LEVEL_THRESHOLDS) {
    if (clamped >= min) return level
  }
  return 'critical'
}

const LEVEL_COLORS: Record<CompletenessLevel, { bar: string; text: string; dot: string }> = {
  critical: { bar: 'bg-red-500', text: 'text-red-400', dot: 'bg-red-500' },
  incomplete: { bar: 'bg-yellow-500', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  adequate: { bar: 'bg-blue-500', text: 'text-blue-400', dot: 'bg-blue-500' },
  comprehensive: { bar: 'bg-green-500', text: 'text-green-400', dot: 'bg-green-500' },
}

const LEVEL_LABELS: Record<CompletenessLevel, string> = {
  critical: 'Critical',
  incomplete: 'Incomplete',
  adequate: 'Adequate',
  comprehensive: 'Comprehensive',
}

// ============================================================
// Component
// ============================================================

export function CompletenessIndicator({
  score,
  level: levelProp,
  showLabel = false,
  size = 'md',
  tooltip,
}: CompletenessIndicatorProps) {
  const level = levelProp ?? deriveLevel(score)
  const colors = LEVEL_COLORS[level]
  const percent = Math.round(Math.max(0, Math.min(1, score)) * 100)

  const tooltipProps = tooltip
    ? { title: tooltip }
    : undefined

  // --- sm: inline badge (dot + percentage) ---
  if (size === 'sm') {
    return (
      <div
        className="inline-flex items-center gap-1"
        {...tooltipProps}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
        {showLabel && (
          <span className={`text-[10px] font-mono ${colors.text}`}>
            {percent}%
          </span>
        )}
      </div>
    )
  }

  // --- md: compact bar + percentage ---
  if (size === 'md') {
    return (
      <div
        className="flex items-center gap-1.5"
        {...tooltipProps}
      >
        <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${colors.bar}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {showLabel && (
          <span className={`text-[10px] font-mono ${colors.text}`}>
            {percent}%
          </span>
        )}
      </div>
    )
  }

  // --- lg: full bar with label ---
  return (
    <div
      className="flex flex-col gap-1"
      {...tooltipProps}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium ${colors.text}`}>
          {LEVEL_LABELS[level]}
        </span>
        {showLabel && (
          <span className={`text-[10px] font-mono ${colors.text}`}>
            {percent}%
          </span>
        )}
      </div>
      <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

// Re-export helper for backward compat with StoryBiblePanel
export function completenessColor(score: number): string {
  return LEVEL_COLORS[deriveLevel(score)].bar
}

export function completenessTextColor(score: number): string {
  return LEVEL_COLORS[deriveLevel(score)].text
}
