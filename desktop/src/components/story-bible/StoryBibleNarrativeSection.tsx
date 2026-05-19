import type { GraphItem } from './CardList'
import { NarrativeRecordList } from './NarrativeRecordList'
import type { NarrativeTimelineMode } from './storyBibleNarrativeUtils'

type NarrativeSectionCommonCopy = {
  titleLabel: string
  titlePlaceholder: string
  summaryLabel: string
  summaryPlaceholder: string
  addLabel: string
  saveLabel: string
  activateLabel: string
  activeLabel: string
  emptyLabel: string
}

type SceneNarrativeCopy = NarrativeSectionCommonCopy & {
  chapterLabel: string
  chapterPlaceholder: string
  orderLabel: string
  orderPlaceholder: string
}

type EventNarrativeCopy = NarrativeSectionCommonCopy & {
  sceneLabel: string
  scenePlaceholder: string
}

type TimelineNarrativeCopy = NarrativeSectionCommonCopy & {
  modeLabel: string
  modeStory: string
  modeNarrative: string
}

type SceneDraft = {
  recordId: string | null
  title: string
  summary: string
  chapterId: string
  sceneOrder: string
}

type EventDraft = {
  recordId: string | null
  title: string
  summary: string
  sceneId: string
}

type TimelineDraft = {
  recordId: string | null
  title: string
  summary: string
  mode: NarrativeTimelineMode
}

type NarrativeSectionCommonProps<TCopy extends NarrativeSectionCommonCopy, TDraft> = {
  copy: TCopy
  draft: TDraft & {
    recordId: string | null
    title: string
    summary: string
  }
  saving: boolean
  activeRecordId: string | null
  items: GraphItem[]
  onSave: () => void
  onSelect: (item: GraphItem) => void
  onActivate: (item: GraphItem) => void
}

type SceneNarrativeSectionProps = NarrativeSectionCommonProps<SceneNarrativeCopy, SceneDraft> & {
  variant: 'scene'
  onDraftChange: (patch: Partial<SceneDraft>) => void
}

type EventNarrativeSectionProps = NarrativeSectionCommonProps<EventNarrativeCopy, EventDraft> & {
  variant: 'event'
  onDraftChange: (patch: Partial<EventDraft>) => void
}

type TimelineNarrativeSectionProps = NarrativeSectionCommonProps<TimelineNarrativeCopy, TimelineDraft> & {
  variant: 'timeline'
  onDraftChange: (patch: Partial<TimelineDraft>) => void
}

export type StoryBibleNarrativeSectionProps =
  | SceneNarrativeSectionProps
  | EventNarrativeSectionProps
  | TimelineNarrativeSectionProps

const fieldClassName = 'w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]'
const textareaClassName = 'min-h-24 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar'

function NarrativeSectionActions({
  activeLabel,
  activeRecordId,
  addLabel,
  saveLabel,
  saving,
  hasRecordId,
  onSave,
}: {
  activeLabel: string
  activeRecordId: string | null
  addLabel: string
  saveLabel: string
  saving: boolean
  hasRecordId: boolean
  onSave: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-[var(--radius-sm)] bg-[var(--primary-cta)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-cta-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {saving ? saveLabel : (hasRecordId ? saveLabel : addLabel)}
      </button>
      {activeRecordId && (
        <span className="text-xs text-[var(--text-secondary)]">
          {activeLabel}: {activeRecordId}
        </span>
      )}
    </div>
  )
}

function NarrativeSectionList({
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
  return (
    <NarrativeRecordList
      items={items}
      emptyText={emptyText}
      activeRecordId={activeRecordId}
      activeLabel={activeLabel}
      activateLabel={activateLabel}
      onSelect={onSelect}
      onActivate={onActivate}
    />
  )
}

export function StoryBibleNarrativeSection(
  props: StoryBibleNarrativeSectionProps,
) {
  if (props.variant === 'scene') {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">{props.copy.titleLabel}</span>
            <input
              value={props.draft.title}
              onChange={(event) => props.onDraftChange({ title: event.target.value })}
              placeholder={props.copy.titlePlaceholder}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">{props.copy.chapterLabel}</span>
            <input
              value={props.draft.chapterId}
              onChange={(event) => props.onDraftChange({ chapterId: event.target.value })}
              placeholder={props.copy.chapterPlaceholder}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-[var(--text-secondary)]">{props.copy.summaryLabel}</span>
            <textarea
              value={props.draft.summary}
              onChange={(event) => props.onDraftChange({ summary: event.target.value })}
              placeholder={props.copy.summaryPlaceholder}
              className={textareaClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">{props.copy.orderLabel}</span>
            <input
              value={props.draft.sceneOrder}
              onChange={(event) => props.onDraftChange({ sceneOrder: event.target.value })}
              placeholder={props.copy.orderPlaceholder}
              inputMode="numeric"
              className={fieldClassName}
            />
          </label>
        </div>
        <NarrativeSectionActions
          activeLabel={props.copy.activeLabel}
          activeRecordId={props.activeRecordId}
          addLabel={props.copy.addLabel}
          saveLabel={props.copy.saveLabel}
          saving={props.saving}
          hasRecordId={Boolean(props.draft.recordId)}
          onSave={props.onSave}
        />
        <NarrativeSectionList
          items={props.items}
          emptyText={props.copy.emptyLabel}
          activeRecordId={props.activeRecordId}
          activeLabel={props.copy.activeLabel}
          activateLabel={props.copy.activateLabel}
          onSelect={props.onSelect}
          onActivate={props.onActivate}
        />
      </div>
    )
  }

  if (props.variant === 'event') {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">{props.copy.titleLabel}</span>
            <input
              value={props.draft.title}
              onChange={(event) => props.onDraftChange({ title: event.target.value })}
              placeholder={props.copy.titlePlaceholder}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">{props.copy.sceneLabel}</span>
            <input
              value={props.draft.sceneId}
              onChange={(event) => props.onDraftChange({ sceneId: event.target.value })}
              placeholder={props.copy.scenePlaceholder}
              className={fieldClassName}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-[var(--text-secondary)]">{props.copy.summaryLabel}</span>
            <textarea
              value={props.draft.summary}
              onChange={(event) => props.onDraftChange({ summary: event.target.value })}
              placeholder={props.copy.summaryPlaceholder}
              className={textareaClassName}
            />
          </label>
        </div>
        <NarrativeSectionActions
          activeLabel={props.copy.activeLabel}
          activeRecordId={props.activeRecordId}
          addLabel={props.copy.addLabel}
          saveLabel={props.copy.saveLabel}
          saving={props.saving}
          hasRecordId={Boolean(props.draft.recordId)}
          onSave={props.onSave}
        />
        <NarrativeSectionList
          items={props.items}
          emptyText={props.copy.emptyLabel}
          activeRecordId={props.activeRecordId}
          activeLabel={props.copy.activeLabel}
          activateLabel={props.copy.activateLabel}
          onSelect={props.onSelect}
          onActivate={props.onActivate}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-secondary)]">{props.copy.titleLabel}</span>
          <input
            value={props.draft.title}
            onChange={(event) => props.onDraftChange({ title: event.target.value })}
            placeholder={props.copy.titlePlaceholder}
            className={fieldClassName}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-[var(--text-secondary)]">{props.copy.modeLabel}</span>
          <select
            value={props.draft.mode}
            onChange={(event) => props.onDraftChange({ mode: event.target.value === 'narrative' ? 'narrative' : 'story' })}
            className={fieldClassName}
          >
            <option value="story">{props.copy.modeStory}</option>
            <option value="narrative">{props.copy.modeNarrative}</option>
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-[var(--text-secondary)]">{props.copy.summaryLabel}</span>
          <textarea
            value={props.draft.summary}
            onChange={(event) => props.onDraftChange({ summary: event.target.value })}
            placeholder={props.copy.summaryPlaceholder}
            className={textareaClassName}
          />
        </label>
      </div>
      <NarrativeSectionActions
        activeLabel={props.copy.activeLabel}
        activeRecordId={props.activeRecordId}
        addLabel={props.copy.addLabel}
        saveLabel={props.copy.saveLabel}
        saving={props.saving}
        hasRecordId={Boolean(props.draft.recordId)}
        onSave={props.onSave}
      />
      <NarrativeSectionList
        items={props.items}
        emptyText={props.copy.emptyLabel}
        activeRecordId={props.activeRecordId}
        activeLabel={props.copy.activeLabel}
        activateLabel={props.copy.activateLabel}
        onSelect={props.onSelect}
        onActivate={props.onActivate}
      />
    </div>
  )
}
