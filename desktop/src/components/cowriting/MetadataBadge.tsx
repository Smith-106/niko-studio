// ============================================================
// Types
// ============================================================

export interface MetadataBadgeProps {
  mode: 'auto' | 'guided'
  model: string
  confidence: number // 0-1
  tokenCount?: number
  violations?: number
  size?: 'sm' | 'md'
}

// ============================================================
// Helpers
// ============================================================

function confidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-green-400'
  if (confidence >= 0.4) return 'text-yellow-400'
  return 'text-red-400'
}

/** Shorten model name: "claude-sonnet-4-6" -> "sonnet-4-6" */
function shortenModel(model: string): string {
  // Strip common provider prefixes
  return model
    .replace(/^claude-/, '')
    .replace(/^gpt-/, 'gpt-')
    .replace(/^gemini-/, 'gemini-')
}

// ============================================================
// Component
// ============================================================

export function MetadataBadge({
  mode,
  model,
  confidence,
  tokenCount,
  violations,
  size = 'sm',
}: MetadataBadgeProps) {
  const modePill = mode === 'auto'
    ? 'bg-blue-500/20 text-blue-400'
    : 'bg-purple-500/20 text-purple-400'

  const modeLabel = mode === 'auto' ? '自动' : '引导'
  const confPct = Math.round(confidence * 100)
  const confColor = confidenceColor(confidence)
  const shortModel = shortenModel(model)

  if (size === 'md') {
    return (
      <div className="flex flex-col gap-1 text-[10px] leading-none">
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded font-medium ${modePill}`}>
            {modeLabel}
          </span>
          <span className="font-mono text-zinc-400">{shortModel}</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <span className={`font-mono ${confColor}`}>{confPct}%</span>
          {tokenCount != null && (
            <span className="font-mono text-zinc-400">{tokenCount} tokens</span>
          )}
          {violations != null && violations > 0 && (
            <span className="font-mono text-red-400">{violations} violations</span>
          )}
        </div>
      </div>
    )
  }

  // sm: single line
  return (
    <div className="flex items-center gap-2 text-[10px] leading-none">
      <span className={`px-1.5 py-0.5 rounded font-medium ${modePill}`}>
        {modeLabel}
      </span>
      <span className="font-mono text-zinc-400">{shortModel}</span>
      <span className={`font-mono ${confColor}`}>{confPct}%</span>
      {tokenCount != null && (
        <span className="font-mono text-zinc-500">{tokenCount}t</span>
      )}
      {violations != null && violations > 0 && (
        <span className="font-mono text-red-400">{violations}v</span>
      )}
    </div>
  )
}
