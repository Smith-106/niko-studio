import type { ReactNode } from 'react'
import { BookOpen, Users, Map, FileText, Tag, Sparkles, PenLine, Wand2, SlidersHorizontal, Download, Upload, RotateCcw } from 'lucide-react'

import { CollapsibleSection } from './CollapsibleSection'
import { StoryBibleDraftSection, type StoryBibleStyleOption } from './StoryBibleDraftSection'
import { StoryBibleKnowledgeSection } from './StoryBibleKnowledgeSection'
import { StoryBibleCanonSection } from './StoryBibleCanonSection'
import { StoryBibleNarrativeSection } from './StoryBibleNarrativeSection'
import { useStoryBiblePanelController } from './useStoryBiblePanelController'

type StoryBibleSection = {
  key: string
  title: string
  icon: ReactNode
  content: ReactNode
  defaultOpen?: boolean
}

export function StoryBiblePanel() {
  const {
    t,
    currentWorkspace,
    fileInputRef,
    characters,
    locations,
    sceneRecords,
    eventRecords,
    timelineRecords,
    braindump,
    genres,
    genreInput,
    synopsis,
    outline,
    selectedStyle,
    sceneDraft,
    eventDraft,
    timelineDraft,
    sceneSaving,
    eventSaving,
    timelineSaving,
    draftMessage,
    canonMessage,
    canonPages,
    selectedCanonSlug,
    selectedCanonPage,
    canonLoading,
    canonLoadingSlug,
    canonPromoting,
    loading,
    workspaceNotice,
    syncCopy,
    canonCopy,
    narrativeCopy,
    genrePresets,
    canPromoteSynopsis,
    synopsisPromotionHint,
    setBraindump,
    setGenreInput,
    setSynopsis,
    setOutline,
    setSelectedStyle,
    setSceneDraft,
    setEventDraft,
    setTimelineDraft,
    toggleGenre,
    addCustomGenre,
    handleExportDraft,
    handleImportDraft,
    handleResetDraft,
    handlePromoteSynopsis,
    refreshCanonPages,
    loadCanonPage,
    selectSceneRecord,
    selectEventRecord,
    selectTimelineRecord,
    activateNarrativeRecord,
    handleSaveSceneRecord,
    handleSaveEventRecord,
    handleSaveTimelineRecord,
  } = useStoryBiblePanelController()

  const styles: readonly StoryBibleStyleOption[] = [
    { id: 'tried', icon: <Sparkles size={16} />, label: t.storyBibleStyleTried, desc: t.storyBibleStyleTriedDesc },
    { id: 'matchMy', icon: <PenLine size={16} />, label: t.storyBibleStyleMatchMy, desc: t.storyBibleStyleMatchMyDesc },
    { id: 'soundsLike', icon: <Wand2 size={16} />, label: t.storyBibleStyleSoundsLike, desc: t.storyBibleStyleSoundsLikeDesc },
    { id: 'custom', icon: <SlidersHorizontal size={16} />, label: t.storyBibleStyleCustom, desc: t.storyBibleStyleCustomDesc },
  ] as const

  const sections: StoryBibleSection[] = [
    {
      key: 'braindump',
      title: t.storyBibleBraindump,
      icon: <BookOpen size={16} />,
      defaultOpen: true,
      content: (
        <StoryBibleDraftSection
          variant="braindump"
          hint={t.storyBibleBraindumpHint}
          value={braindump}
          onChange={setBraindump}
          label={t.storyBibleBraindump}
        />
      ),
    },
    {
      key: 'genre',
      title: t.storyBibleGenre,
      icon: <Tag size={16} />,
      defaultOpen: true,
      content: (
        <StoryBibleDraftSection
          variant="genre"
          genrePresets={genrePresets}
          genres={genres}
          genreInput={genreInput}
          genrePlaceholder={t.storyBibleGenrePlaceholder}
          onGenreInputChange={setGenreInput}
          onToggleGenre={toggleGenre}
          onAddCustomGenre={addCustomGenre}
        />
      ),
    },
    {
      key: 'synopsis',
      title: t.storyBibleSynopsis,
      icon: <FileText size={16} />,
      content: (
        <StoryBibleDraftSection
          variant="synopsis"
          value={synopsis}
          placeholder={t.storyBibleSynopsisPlaceholder}
          promotionHint={synopsisPromotionHint}
          promoteLabel={canonCopy.promoteSynopsis}
          promoteLoadingLabel={canonCopy.reviewLoading}
          canPromote={canPromoteSynopsis}
          promoting={canonPromoting}
          actionIcon={<BookOpen size={14} />}
          onChange={setSynopsis}
          onPromote={() => {
            void handlePromoteSynopsis()
          }}
        />
      ),
    },
    {
      key: 'canon-review',
      title: canonCopy.reviewTitle,
      icon: <BookOpen size={16} />,
      content: (
        <StoryBibleCanonSection
          reviewHint={canonCopy.reviewHint}
          reviewRefresh={canonCopy.reviewRefresh}
          reviewLoading={canonCopy.reviewLoading}
          reviewEmpty={canonCopy.reviewEmpty}
          reviewSelectHint={canonCopy.reviewSelectHint}
          canonPages={canonPages}
          selectedCanonSlug={selectedCanonSlug}
          selectedCanonPage={selectedCanonPage}
          canonLoading={canonLoading}
          canonLoadingSlug={canonLoadingSlug}
          onRefresh={() => {
            void refreshCanonPages()
          }}
          onLoadPage={(slug) => {
            void loadCanonPage(slug)
          }}
        />
      ),
    },
    {
      key: 'characters',
      title: `${t.storyBibleCharacters} (${characters.length})`,
      icon: <Users size={16} />,
      content: (
        <StoryBibleKnowledgeSection
          items={characters}
          loading={loading}
          loadingText={t.storyBibleLoading}
          emptyText={t.storyBibleEmpty}
        />
      ),
    },
    {
      key: 'worldbuilding',
      title: `${t.storyBibleWorldbuilding} (${locations.length})`,
      icon: <Map size={16} />,
      content: (
        <StoryBibleKnowledgeSection
          items={locations}
          loading={loading}
          loadingText={t.storyBibleLoading}
          emptyText={t.storyBibleEmpty}
        />
      ),
    },
    {
      key: 'scenes',
      title: `${narrativeCopy.scene.sectionTitle} (${sceneRecords.length})`,
      icon: <FileText size={16} />,
      content: (
        <StoryBibleNarrativeSection
          variant="scene"
          copy={narrativeCopy.scene}
          draft={sceneDraft}
          saving={sceneSaving}
          activeRecordId={currentWorkspace.authority.activeSceneId}
          items={sceneRecords}
          onDraftChange={(patch) => setSceneDraft((current) => ({ ...current, ...patch }))}
          onSave={() => {
            void handleSaveSceneRecord()
          }}
          onSelect={selectSceneRecord}
          onActivate={(item) => activateNarrativeRecord('scene', item)}
        />
      ),
    },
    {
      key: 'events',
      title: `${narrativeCopy.event.sectionTitle} (${eventRecords.length})`,
      icon: <Sparkles size={16} />,
      content: (
        <StoryBibleNarrativeSection
          variant="event"
          copy={narrativeCopy.event}
          draft={eventDraft}
          saving={eventSaving}
          activeRecordId={currentWorkspace.authority.activeEventId}
          items={eventRecords}
          onDraftChange={(patch) => setEventDraft((current) => ({ ...current, ...patch }))}
          onSave={() => {
            void handleSaveEventRecord()
          }}
          onSelect={selectEventRecord}
          onActivate={(item) => activateNarrativeRecord('event', item)}
        />
      ),
    },
    {
      key: 'timelines',
      title: `${narrativeCopy.timeline.sectionTitle} (${timelineRecords.length})`,
      icon: <Map size={16} />,
      content: (
        <StoryBibleNarrativeSection
          variant="timeline"
          copy={narrativeCopy.timeline}
          draft={timelineDraft}
          saving={timelineSaving}
          activeRecordId={currentWorkspace.authority.activeTimelineId}
          items={timelineRecords}
          onDraftChange={(patch) => setTimelineDraft((current) => ({ ...current, ...patch }))}
          onSave={() => {
            void handleSaveTimelineRecord()
          }}
          onSelect={selectTimelineRecord}
          onActivate={(item) => activateNarrativeRecord('timeline', item)}
        />
      ),
    },
    {
      key: 'style',
      title: t.storyBibleStyleTitle,
      icon: <Sparkles size={16} />,
      content: (
        <StoryBibleDraftSection
          variant="style"
          styles={styles}
          selectedStyle={selectedStyle}
          onSelectStyle={setSelectedStyle}
        />
      ),
    },
    {
      key: 'outline',
      title: t.storyBibleOutline,
      icon: <BookOpen size={16} />,
      content: (
        <StoryBibleDraftSection
          variant="outline"
          value={outline}
          placeholder={t.storyBibleSynopsisPlaceholder}
          onChange={setOutline}
        />
      ),
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--primary-cta)]/12 flex items-center justify-center">
          <BookOpen size={16} className="text-[var(--primary-cta)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted">{t.storyBibleTitle}</h3>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{syncCopy}</div>
        </div>
      </div>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">{t.storyBibleDesc}</p>
      <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-4 py-3 text-xs text-[var(--text-secondary)]">
        <div className="font-semibold text-[var(--text-primary)]">{t.storyBiblePersistenceTitle}</div>
        {workspaceNotice.map((line) => (
          <p key={line} className="mt-2">{line}</p>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExportDraft}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--primary-cta)]/40 hover:text-[var(--primary-cta)] transition-colors"
          title={t.storyBibleExportDraft}
        >
          <Download size={14} />
          {t.storyBibleExportDraft}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--primary-cta)]/40 hover:text-[var(--primary-cta)] transition-colors"
          title={t.storyBibleImportDraft}
        >
          <Upload size={14} />
          {t.storyBibleImportDraft}
        </button>
        <button
          type="button"
          onClick={handleResetDraft}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-red-400/40 hover:text-red-500 transition-colors"
          title={t.storyBibleResetDraft}
        >
          <RotateCcw size={14} />
          {t.storyBibleResetDraft}
        </button>
        <input
          ref={fileInputRef}
          id="story-bible-import-input"
          name="story-bible-import-input"
          type="file"
          accept="application/json"
          aria-label={t.storyBibleImportDraft}
          className="hidden"
          onChange={handleImportDraft}
          data-testid="story-bible-import-input"
        />
      </div>
      {draftMessage && (
        <div className={`mb-3 text-xs font-medium ${draftMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {draftMessage.text}
        </div>
      )}
      {canonMessage && (
        <div className={`mb-3 text-xs font-medium ${canonMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {canonMessage.text}
        </div>
      )}
      <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.key}
            title={section.title}
            icon={section.icon}
            content={section.content}
            defaultOpen={section.defaultOpen}
            contentId={`story-bible-section-${section.key}`}
          />
        ))}
      </div>
    </div>
  )
}
