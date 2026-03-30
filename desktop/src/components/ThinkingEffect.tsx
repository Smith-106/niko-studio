import React, { useMemo } from 'react'
import { useI18n } from '../i18n'

interface ThinkingEffectProps {
  content: string
  maxLines?: number
}

/**
 * Animated thinking indicator showing only the tail of thinking content.
 * Adapted from Cherry Studio's ThinkingEffect pattern.
 * Lightweight -- does not render the full thinking chain.
 */
function ThinkingEffectComponent({ content, maxLines = 5 }: ThinkingEffectProps) {
  const { t } = useI18n()

  const tailLines = useMemo(() => {
    const lines = content.split('\n').filter(Boolean)
    return lines.slice(-maxLines)
  }, [content, maxLines])

  return (
    <div className="relative overflow-hidden max-h-40">
      {/* Gradient fade at top */}
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white dark:from-dark-surface to-transparent z-10 pointer-events-none" />
      <div className="space-y-1 pt-6">
        {tailLines.map((line, i) => (
          <div
            key={i}
            className="text-xs text-gray-400 dark:text-dark-text-muted animate-pulse-subtle leading-relaxed font-mono"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            {line}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400 dark:text-dark-text-muted">
        <div className="w-1.5 h-1.5 rounded-full bg-primary-500/60 animate-pulse" />
        <span>{t.thinking}</span>
      </div>
    </div>
  )
}

export const ThinkingEffect = React.memo(ThinkingEffectComponent)
