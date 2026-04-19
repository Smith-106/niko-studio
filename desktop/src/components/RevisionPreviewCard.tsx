interface RevisionPreviewCardProps {
  previewTitle: string
  originalLabel: string
  candidateLabel: string
  sourceText: string
  candidateText: string
  primaryActionLabel: string
  secondaryActionLabel?: string
  undoActionLabel: string
  onPrimaryAction: () => void
  onSecondaryAction?: () => void
  onUndoAction: () => void
  className?: string
  sourceTextClassName?: string
  candidateTextClassName?: string
  actionsClassName?: string
}

export function RevisionPreviewCard({
  previewTitle,
  originalLabel,
  candidateLabel,
  sourceText,
  candidateText,
  primaryActionLabel,
  secondaryActionLabel,
  undoActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  onUndoAction,
  className,
  sourceTextClassName,
  candidateTextClassName,
  actionsClassName,
}: RevisionPreviewCardProps) {
  return (
    <div className={className ?? 'mt-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-surface'}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
        {previewTitle}
      </div>
      <div className="mt-3 space-y-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-dark-border dark:bg-dark-bg">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
            {originalLabel}
          </div>
          <p className={sourceTextClassName ?? 'mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-dark-text'}>
            {sourceText}
          </p>
        </div>
        <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-primary-500/20 dark:bg-primary-900/10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
            {candidateLabel}
          </div>
          <p className={candidateTextClassName ?? 'mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-800 dark:text-dark-text'}>
            {candidateText}
          </p>
        </div>
      </div>
      <div className={actionsClassName ?? 'mt-3 flex flex-wrap gap-2'}>
        <button
          type="button"
          onClick={onPrimaryAction}
          className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary-600 text-white hover:bg-primary-500 active:scale-95 transition-all shadow-sm"
        >
          {primaryActionLabel}
        </button>
        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 active:scale-95 transition-all shadow-sm"
          >
            {secondaryActionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onUndoAction}
          className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-gray-100 dark:bg-dark-border dark:text-dark-text text-gray-700 hover:bg-gray-200 dark:hover:bg-dark-border2 active:scale-95 transition-all"
        >
          {undoActionLabel}
        </button>
      </div>
    </div>
  )
}
