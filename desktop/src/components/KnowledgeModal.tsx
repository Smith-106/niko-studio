import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Search, User, MapPin, BookOpen, Sparkles, X } from 'lucide-react'
import { promoteProjectWikiCanonApi } from '../api/client'
import { useI18n } from '../i18n'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { useAppStore } from '../stores/appStore'
import type { TabType, KnowledgeItem, OperationStatus, TabConfig } from './knowledge/KnowledgeTypes'
import { CharacterTab } from './knowledge/CharacterTab'
import { LocationTab } from './knowledge/LocationTab'
import { PlotTab } from './knowledge/PlotTab'
import { SkillTab } from './knowledge/SkillTab'
import { MemoryForm } from './knowledge/MemoryForm'

interface KnowledgeModalProps {
  isOpen: boolean
  onClose: () => void
}

type KnowledgeTask = 'lookup' | 'augment' | 'reference'
type KnowledgeAugmentMode = 'memory' | 'skills'
type StoryTabType = Exclude<TabType, 'skills'>

function slugifySegment(value: unknown): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'item'
}

function formatKnowledgeValue(value: unknown): string {
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}

function buildKnowledgeCanonBody(title: string, summary: string, detailEntries: Array<[string, unknown]>): string {
  const sections = [`# ${title}`]

  if (summary) {
    sections.push('', summary)
  }

  if (detailEntries.length > 0) {
    sections.push('', '## Details')
    for (const [key, value] of detailEntries) {
      sections.push('', `### ${key}`)
      sections.push(formatKnowledgeValue(value))
    }
  }

  return sections.join('\n')
}

export function KnowledgeModal({ isOpen, onClose }: KnowledgeModalProps) {
  const { t } = useI18n()
  const currentWorkspace = useAppStore((state) => state.currentWorkspace)
  const setCurrentWorkspace = useAppStore((state) => state.setCurrentWorkspace)
  const workspaceSummary = useWriterWorkspaceSummary()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [activeTask, setActiveTask] = useState<KnowledgeTask>('lookup')
  const [activeTab, setActiveTab] = useState<StoryTabType>('characters')
  const [augmentMode, setAugmentMode] = useState<KnowledgeAugmentMode>('memory')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null)
  const [promotingItem, setPromotingItem] = useState(false)
  const [selectedSkillId, setSelectedSkillId] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
    isActive: isOpen,
  })

  // Reset transient list/detail state when the visible surface changes.
  useEffect(() => {
    setItems([])
    setSelectedItem(null)
    setOperationStatus(null)
  }, [activeTask, activeTab, augmentMode])

  const handleStatusChange = useCallback((status: OperationStatus | null) => {
    setOperationStatus(status)
  }, [])

  const handleItemsChange = useCallback((newItems: KnowledgeItem[]) => {
    setItems(newItems)
  }, [])

  const handleLoadingChange = useCallback((isLoading: boolean) => {
    setLoading(isLoading)
  }, [])

  const handleItemClick = (item: KnowledgeItem) => {
    setSelectedItem(item)
    setCurrentWorkspace({
      knowledge: {
        focusEntityId: String(item.id ?? item.name ?? ''),
      },
    })
  }

  const selectedItemId =
    selectedItem && typeof selectedItem === 'object'
      ? String(selectedItem.id ?? selectedItem.name ?? '')
      : ''

  const renderSelectedItemDetails = () => {
    if (!selectedItem) return null

    const title =
      (selectedItem.name as string) ||
      (selectedItem.title as string) ||
      (selectedItem.id as string) ||
      t.knowledgeNoDescription

    const summary =
      (selectedItem.description as string) ||
      (selectedItem.content as string) ||
      (selectedItem.type as string) ||
      t.knowledgeNoDescription

    const detailEntries = Object.entries(selectedItem).filter(([, value]) => {
      if (value === null || value === undefined || value === '') {
        return false
      }
      return true
    })

    const handlePromoteSelectedItem = async () => {
      if (promotingItem) return

      setPromotingItem(true)
      try {
        const workspaceId = slugifySegment(currentWorkspace.identity.workspaceId)
        const itemId = slugifySegment(selectedItem.id ?? selectedItem.name ?? selectedItem.title)
        const slugPrefix = activeTab === 'characters'
          ? 'characters'
          : activeTab === 'locations'
            ? 'locations'
            : 'plots'
        const body = buildKnowledgeCanonBody(title, summary, detailEntries)
        const rawEvidenceContent = JSON.stringify(selectedItem, null, 2)

        const response = await promoteProjectWikiCanonApi({
          title,
          body,
          slug: `${slugPrefix}/${workspaceId}-${itemId}`,
          idSeed: `${workspaceId}:${activeTab}:${itemId}`,
          promotedFrom: 'manual',
          sourceId: selectedItemId || itemId,
          sourceRef: `knowledge.${activeTab}.${selectedItemId || itemId}`,
          rawEvidence: {
            relativePath: `imports/knowledge/${slugPrefix}/${workspaceId}-${itemId}.json`,
            content: rawEvidenceContent,
          },
          metadata: {
            source_surface: 'knowledge-modal',
            knowledge_tab: activeTab,
            item_id: selectedItemId || itemId,
            item_title: title,
            workflow_session_id: currentWorkspace.workflow.sessionId,
            chapter_id: currentWorkspace.manuscript.chapterId,
          },
        }, currentWorkspace)

        if (!response.success || !response.data?.available || !response.data.page) {
          throw new Error(response.error || response.data?.reason || 'knowledge-canon-promotion-failed')
        }

        setOperationStatus({ type: 'success', message: t.knowledgePromoteCanonSuccess })
      } catch {
        setOperationStatus({ type: 'error', message: t.knowledgePromoteCanonFailure })
      } finally {
        setPromotingItem(false)
      }
    }

    return (
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-500/30 dark:bg-blue-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-dark-text">{title}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-dark-text-secondary">{summary}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handlePromoteSelectedItem()}
              disabled={promotingItem}
              className="rounded-md border border-blue-300/70 px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-900/20"
            >
              {promotingItem ? t.knowledgePromotingCanon : t.knowledgePromoteCanon}
            </button>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/20"
            >
              {t.knowledgeClose}
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          {detailEntries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-blue-100 bg-white/80 px-3 py-2 text-xs dark:border-blue-500/20 dark:bg-dark-surface"
            >
              <div className="font-medium uppercase tracking-wide text-slate-500 dark:text-dark-text-secondary">
                {key}
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words text-slate-800 dark:text-dark-text">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  const taskSections = [
    {
      id: 'lookup' as const,
      label: t.knowledgeTaskLookup,
      hint: t.knowledgeTaskLookupHint,
      icon: Search,
    },
    {
      id: 'augment' as const,
      label: t.knowledgeTaskAugment,
      hint: t.knowledgeTaskAugmentHint,
      icon: Sparkles,
    },
    {
      id: 'reference' as const,
      label: t.knowledgeTaskReference,
      hint: t.knowledgeTaskReferenceHint,
      icon: BookOpen,
    },
  ]

  const tabs: Array<TabConfig & { id: StoryTabType }> = [
    { id: 'characters', label: t.knowledgeTabCharacters, icon: User },
    { id: 'locations', label: t.knowledgeTabLocations, icon: MapPin },
    { id: 'plots', label: t.knowledgeTabPlots, icon: BookOpen },
  ]

  const renderSearchField = () => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t.knowledgeSearchPlaceholder}
        aria-label={t.knowledgeSearchPlaceholder}
        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
      />
    </div>
  )

  const renderTabContent = () => {
    const tabContent: Record<StoryTabType, ReactNode> = {
      characters: (
        <CharacterTab
          items={items}
          onItemsChange={handleItemsChange}
          loading={loading}
          onLoadingChange={handleLoadingChange}
          onItemClick={handleItemClick}
          selectedItemId={selectedItemId}
          selectedItem={selectedItem}
          searchQuery={searchQuery}
          onStatusChange={handleStatusChange}
        />
      ),
      locations: (
        <LocationTab
          items={items}
          onItemsChange={handleItemsChange}
          loading={loading}
          onLoadingChange={handleLoadingChange}
          onItemClick={handleItemClick}
          selectedItemId={selectedItemId}
          selectedItem={selectedItem}
          searchQuery={searchQuery}
          onStatusChange={handleStatusChange}
        />
      ),
      plots: (
        <PlotTab
          items={items}
          onItemsChange={handleItemsChange}
          loading={loading}
          onLoadingChange={handleLoadingChange}
          onItemClick={handleItemClick}
          selectedItemId={selectedItemId}
          selectedItem={selectedItem}
          searchQuery={searchQuery}
          onStatusChange={handleStatusChange}
        />
      ),
    }
    return tabContent[activeTab]
  }

  const renderSurfaceNotice = () => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-dark-border dark:bg-dark-surface/50">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-dark-text-muted">
        {t.knowledgeTaskScopeTitle}
      </div>
      {workspaceSummary.scopeChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {workspaceSummary.scopeChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs text-primary-700 dark:border-primary-500/20 dark:bg-primary-900/10 dark:text-primary-300"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600 dark:text-dark-text-secondary">{t.knowledgeTaskScopeEmpty}</p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-dark-text-secondary">
        {taskSections.find((section) => section.id === activeTask)?.hint}
      </p>
    </div>
  )

  const renderOperationStatus = () => {
    if (!operationStatus) return null

    return (
      <div
        className={`rounded-lg border p-3 text-xs font-medium shadow-sm animate-fade-in ${
          operationStatus.type === 'success'
            ? 'bg-success-50 text-success-700 border-success-100 dark:bg-success-900/20 dark:text-success-400 dark:border-success-500/20'
            : 'bg-danger-50 text-danger-700 border-danger-100 dark:bg-danger-900/20 dark:text-danger-400 dark:border-danger-500/20'
        }`}
      >
        {operationStatus.message}
      </div>
    )
  }

  const renderStoryBrowser = () => (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-dark-border dark:bg-dark-surface/40">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
          {t.knowledgeTaskBrowseTitle}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-dark-text-secondary">
          {t.knowledgeTaskBrowseHint}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-900/10 dark:text-primary-300'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary dark:hover:text-dark-text'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTask === 'reference' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-900/10 dark:text-amber-200">
          {t.knowledgeTaskReferenceHint}
        </div>
      ) : null}

      {renderOperationStatus()}

      <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-dark-border dark:bg-dark-surface/40">
        {renderSelectedItemDetails()}
        {renderTabContent()}
      </div>
    </>
  )

  const renderAugmentSurface = () => (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAugmentMode('memory')}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            augmentMode === 'memory'
              ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-900/10 dark:text-primary-300'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary dark:hover:text-dark-text'
          }`}
        >
          {t.knowledgeTaskAugmentMemory}
        </button>
        <button
          type="button"
          onClick={() => setAugmentMode('skills')}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            augmentMode === 'skills'
              ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/20 dark:bg-primary-900/10 dark:text-primary-300'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary dark:hover:text-dark-text'
          }`}
        >
          {t.knowledgeTaskAugmentSkills}
        </button>
      </div>

      {augmentMode === 'skills' ? renderSearchField() : null}
      {renderOperationStatus()}

      {augmentMode === 'memory' ? (
        <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-dark-border dark:bg-dark-surface/40">
          <MemoryForm onStatusChange={handleStatusChange} onItemsChange={handleItemsChange} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-dark-border dark:bg-dark-surface/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
              {t.knowledgeTaskAugmentSkills}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-dark-text-secondary">
              {t.knowledgeTaskSkillsHint}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-dark-border dark:bg-dark-surface/40">
            <SkillTab
              items={items}
              onItemsChange={handleItemsChange}
              loading={loading}
              onLoadingChange={handleLoadingChange}
              selectedSkillId={selectedSkillId}
              onSelectedSkillIdChange={setSelectedSkillId}
              searchQuery={searchQuery}
            />
          </div>
        </div>
      )}
    </>
  )

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="h-full w-full max-w-[800px] bg-slate-50 dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={t.knowledgeTitle}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md">
        <h2 className="text-base font-semibold text-gray-800 dark:text-dark-text tracking-wide">{t.knowledgeTitle}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none rounded-md p-1 hover:bg-gray-200 dark:hover:bg-dark-surface2 transition-colors"
          aria-label={t.knowledgeClose}
          title={t.knowledgeClose}
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg overflow-x-auto custom-scrollbar">
        {taskSections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveTask(section.id)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all focus:outline-none shrink-0 text-sm font-medium ${
              activeTask === section.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-primary-50/30 dark:bg-primary-900/10'
                : 'border-transparent text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2'
            }`}
          >
            <section.icon size={18} className={activeTask === section.id ? 'text-primary-600' : ''} />
            {section.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-dark-bg">
        <div className="space-y-4">
          {renderSurfaceNotice()}
          {activeTask === 'augment' ? (
            renderAugmentSurface()
          ) : (
            <>
              {renderSearchField()}
              {renderStoryBrowser()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
