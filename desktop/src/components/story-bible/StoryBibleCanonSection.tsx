import type {
  ProjectWikiCanonPageRecord,
  ProjectWikiCanonPageSummary,
} from '../../api/wiki'

export interface StoryBibleCanonSectionProps {
  reviewHint: string
  reviewRefresh: string
  reviewLoading: string
  reviewEmpty: string
  reviewSelectHint: string
  canonPages: ProjectWikiCanonPageSummary[]
  selectedCanonSlug: string | null
  selectedCanonPage: ProjectWikiCanonPageRecord | null
  canonLoading: boolean
  canonLoadingSlug: string | null
  onRefresh: () => void
  onLoadPage: (slug: string) => void
}

export function StoryBibleCanonSection({
  reviewHint,
  reviewRefresh,
  reviewLoading,
  reviewEmpty,
  reviewSelectHint,
  canonPages,
  selectedCanonSlug,
  selectedCanonPage,
  canonLoading,
  canonLoadingSlug,
  onRefresh,
  onLoadPage,
}: StoryBibleCanonSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--text-secondary)]">{reviewHint}</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={canonLoading}
          className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--primary-cta)]/40 hover:text-[var(--primary-cta)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {canonLoading ? reviewLoading : reviewRefresh}
        </button>
      </div>
      {canonPages.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic">
          {canonLoading ? reviewLoading : reviewEmpty}
        </p>
      ) : (
        <div className="space-y-2">
          {canonPages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onLoadPage(page.slug)}
              className={`w-full rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
                selectedCanonSlug === page.slug
                  ? 'border-[var(--primary-cta)]/40 bg-[var(--primary-cta)]/10'
                  : 'border-[var(--border-default)] bg-[var(--surface-sunken)] hover:border-[var(--primary-cta)]/30'
              }`}
            >
              <div className="text-sm font-medium text-[var(--text-primary)]">{page.title}</div>
              <div className="mt-1 text-[11px] text-[var(--text-muted)]">{page.slug}</div>
              {canonLoadingSlug === page.slug && (
                <div className="mt-1 text-[11px] text-[var(--primary-cta)]">{reviewLoading}</div>
              )}
            </button>
          ))}
        </div>
      )}
      {selectedCanonPage ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{selectedCanonPage.title}</div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">{selectedCanonPage.file_path}</div>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--text-secondary)]">{selectedCanonPage.markdown}</pre>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">{reviewSelectHint}</p>
      )}
    </div>
  )
}
