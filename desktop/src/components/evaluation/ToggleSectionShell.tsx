import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function ToggleSectionShell({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string
  hint: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-bg/70">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
        aria-label={title}
      >
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
            {title}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
            {hint}
          </p>
        </div>
        {open ? (
          <ChevronDown size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
        ) : (
          <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
        )}
      </button>
      {open && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  )
}
