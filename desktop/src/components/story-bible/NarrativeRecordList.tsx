import type { GraphItem } from './CardList'
import { readText } from './storyBibleTextUtils'

export function NarrativeRecordList({
  items,
  emptyText,
  activeRecordId,
  activeLabel,
  activateLabel,
  onSelect,
  onActivate,
}: {
  items: GraphItem[]
  emptyText: string
  activeRecordId: string | null
  activeLabel: string
  activateLabel: string
  onSelect: (item: GraphItem) => void
  onActivate: (item: GraphItem) => void
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] italic">{emptyText}</p>
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
      {items.map((item, index) => {
        const recordId = readText(item.id)
        const title = readText(item.name) || readText(item.title) || recordId || `Item ${index + 1}`
        const summary = readText(item.summary) || readText(item.description) || readText(item.content)
        const isActive = Boolean(recordId) && recordId === activeRecordId

        return (
          <div
            key={recordId || `${title}-${index}`}
            className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="text-sm font-medium text-[var(--text-primary)]">{title}</div>
                {summary && (
                  <div className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{summary}</div>
                )}
                {recordId && <div className="mt-2 text-[11px] text-[var(--text-muted)]">{recordId}</div>}
              </button>
              <button
                type="button"
                onClick={() => onActivate(item)}
                disabled={isActive}
                className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-default)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--primary-cta)]/40 hover:text-[var(--primary-cta)] disabled:cursor-default disabled:border-[var(--primary-cta)]/30 disabled:bg-[var(--primary-cta)]/10 disabled:text-[var(--primary-cta)] transition-colors"
              >
                {isActive ? activeLabel : activateLabel}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
