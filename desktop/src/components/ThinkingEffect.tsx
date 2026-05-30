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
    <div className="relative overflow-hidden max-h-48 border border-slate-100 dark:border-dark-border/40 bg-slate-50/40 dark:bg-dark-surface/10 rounded-2xl p-4 shadow-[var(--shadow-tiny)]">
      {/* Aurora laser scanline */}
      {content ? (
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-transparent via-primary-500 to-indigo-500/60 shadow-[0_1px_8px_rgba(99,102,241,0.35)] rounded-full animate-[pulse_3s_ease-in-out_infinite]" />
      ) : null}

      {/* Gradient fade at top */}
      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white dark:from-dark-bg via-white/40 dark:via-dark-bg/40 to-transparent z-10 pointer-events-none" />
      
      <div className="space-y-1.5 pt-4">
        {tailLines.map((line, i) => (
          <div
            key={i}
            className="text-xs text-gray-400 dark:text-dark-text-muted animate-pulse-subtle leading-relaxed font-mono tracking-wide"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            {line}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4 px-3 py-2 bg-gradient-to-r from-primary-500/5 to-indigo-500/5 border border-primary-500/10 dark:border-primary-500/5 rounded-xl text-[11px] text-gray-500 dark:text-dark-text-muted select-none w-max relative overflow-hidden">
        {/* Glow Shimmering laser scanner bar */}
        <div className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-transparent via-primary-500/10 to-transparent animate-[shimmer_2s_infinite] -skew-x-12" />
        
        <div className="w-1.5 h-1.5 rounded-full bg-primary-500/60 animate-pulse" />
        <span className="font-bold tracking-wide font-sans">{t.thinking}</span>
      </div>
    </div>
  )
}

export const ThinkingEffect = React.memo(ThinkingEffectComponent)
