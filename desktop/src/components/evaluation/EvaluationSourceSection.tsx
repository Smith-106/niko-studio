import type { EvaluationSourceDescriptor } from '../../stores/selectors'

export function EvaluationSourceSection({
  title,
  hint,
  sources,
  activeKind,
  onSelect,
}: {
  title: string
  hint: string
  sources: EvaluationSourceDescriptor[]
  activeKind: EvaluationSourceDescriptor['kind'] | null
  onSelect: (kind: EvaluationSourceDescriptor['kind']) => void
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
        {title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-blue-700/90 dark:text-blue-200/80">
        {hint}
      </p>
      {sources.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sources.map((source) => {
            const isActive = source.kind === activeKind
            return (
              <button
                key={source.kind}
                type="button"
                onClick={() => onSelect(source.kind)}
                aria-pressed={isActive}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-blue-200 bg-white/80 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-dark-surface dark:text-blue-200 dark:hover:bg-blue-900/30'
                }`}
              >
                {source.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
