import type { ReactNode } from 'react'

export type StoryBibleStyleOption = {
  id: 'tried' | 'matchMy' | 'soundsLike' | 'custom'
  icon: ReactNode
  label: string
  desc: string
}

type StoryBibleBraindumpProps = {
  variant: 'braindump'
  hint: string
  value: string
  onChange: (value: string) => void
  label: string
}

type StoryBibleGenreProps = {
  variant: 'genre'
  genrePresets: string[]
  genres: string[]
  genreInput: string
  genrePlaceholder: string
  onGenreInputChange: (value: string) => void
  onToggleGenre: (genre: string) => void
  onAddCustomGenre: () => void
}

type StoryBibleSynopsisProps = {
  variant: 'synopsis'
  value: string
  placeholder: string
  promotionHint: string
  promoteLabel: string
  promoteLoadingLabel: string
  canPromote: boolean
  promoting: boolean
  actionIcon?: ReactNode
  onChange: (value: string) => void
  onPromote: () => void
}

type StoryBibleStyleProps = {
  variant: 'style'
  styles: readonly StoryBibleStyleOption[]
  selectedStyle: StoryBibleStyleOption['id']
  onSelectStyle: (styleId: StoryBibleStyleOption['id']) => void
}

type StoryBibleOutlineProps = {
  variant: 'outline'
  value: string
  placeholder: string
  onChange: (value: string) => void
}

export type StoryBibleDraftSectionProps =
  | StoryBibleBraindumpProps
  | StoryBibleGenreProps
  | StoryBibleSynopsisProps
  | StoryBibleStyleProps
  | StoryBibleOutlineProps

export function StoryBibleDraftSection(
  props: StoryBibleDraftSectionProps,
) {
  if (props.variant === 'braindump') {
    return (
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-secondary)]">{props.hint}</p>
        <textarea
          id="story-bible-braindump"
          name="story-bible-braindump"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          aria-label={props.label}
          placeholder={props.hint}
          className="w-full min-h-32 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
        />
      </div>
    )
  }

  if (props.variant === 'genre') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {props.genrePresets.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => props.onToggleGenre(genre)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                props.genres.includes(genre)
                  ? 'bg-[var(--primary-cta)] text-white border-[var(--primary-cta)]'
                  : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] border-[var(--border-default)] hover:border-[var(--primary-cta)]/50'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            id="story-bible-genre-input"
            name="story-bible-genre-input"
            value={props.genreInput}
            onChange={(event) => props.onGenreInputChange(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && props.onAddCustomGenre()}
            aria-label={props.genrePlaceholder}
            placeholder={props.genrePlaceholder}
            className="flex-1 text-sm bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-3 py-1.5 outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            onClick={props.onAddCustomGenre}
            disabled={!props.genreInput.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-[var(--primary-cta)] text-white rounded-[var(--radius-sm)] hover:bg-[var(--primary-cta-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            +
          </button>
        </div>
        {props.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {props.genres.map((genre) => (
              <span
                key={genre}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[var(--primary-cta)]/10 text-[var(--primary-cta)] rounded-full border border-[var(--primary-cta)]/20"
              >
                {genre}
                <button
                  type="button"
                  onClick={() => props.onToggleGenre(genre)}
                  className="hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (props.variant === 'synopsis') {
    return (
      <div className="space-y-3">
        <textarea
          id="story-bible-synopsis"
          name="story-bible-synopsis"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          aria-label={props.placeholder}
          placeholder={props.placeholder}
          className="w-full min-h-28 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-secondary)]">{props.promotionHint}</p>
          <button
            type="button"
            onClick={props.onPromote}
            disabled={!props.canPromote || props.promoting}
            className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--primary-cta)]/30 bg-[var(--primary-cta)]/10 px-3 py-1.5 text-xs font-medium text-[var(--primary-cta)] hover:bg-[var(--primary-cta)]/15 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {props.actionIcon}
            {props.promoting ? props.promoteLoadingLabel : props.promoteLabel}
          </button>
        </div>
      </div>
    )
  }

  if (props.variant === 'style') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {props.styles.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => props.onSelectStyle(style.id)}
            aria-pressed={props.selectedStyle === style.id}
            className={`flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] border text-left transition-all ${
              props.selectedStyle === style.id
                ? 'bg-[var(--primary-cta)]/10 border-[var(--primary-cta)]/40 ring-1 ring-[var(--primary-cta)]/30'
                : 'bg-[var(--surface-sunken)] border-[var(--border-default)] hover:border-[var(--primary-cta)]/20'
            }`}
          >
            <span className={`mt-0.5 ${props.selectedStyle === style.id ? 'text-[var(--primary-cta)]' : 'text-[var(--text-muted)]'}`}>
              {style.icon}
            </span>
            <span className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)]">{style.label}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{style.desc}</div>
            </span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <textarea
      id="story-bible-outline"
      name="story-bible-outline"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      aria-label={props.placeholder}
      placeholder={props.placeholder}
      className="w-full min-h-40 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
    />
  )
}
