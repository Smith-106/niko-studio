import { useState, useEffect, useCallback, useRef, useId, type ChangeEvent } from 'react'
import {
  ChevronDown,
  BookOpen,
  Users,
  Map,
  FileText,
  Tag,
  Sparkles,
  PenLine,
  Wand2,
  SlidersHorizontal,
  Download,
  RotateCcw,
  Upload,
} from 'lucide-react'

import {
  listProjectWikiCanonPagesApi,
  promoteProjectWikiCanonApi,
  queryGraph,
  readProjectWikiCanonPageApi,
} from '../api/client'
import {
  buildGraphMergeMutation,
  buildStoryBibleGraphName,
  buildWorkspaceNotice,
  filterWorkspaceKnowledgeItems,
  readGraphMutationError,
  toGraphItems,
  WORKSPACE_KNOWLEDGE_CHANGED_EVENT,
} from './knowledge/knowledgeUtils'
import { useI18n } from '../i18n'
import { useAppStore } from '../stores/appStore'
import type {
  ProjectWikiCanonPageRecord,
  ProjectWikiCanonPageSummary,
} from '../api/wiki'

interface StoryBibleSection {
  key: string
  title: string
  icon: React.ReactNode
  content: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, icon, content, defaultOpen = false }: StoryBibleSection) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div className="border border-[var(--border-default)] rounded-[var(--radius-md)] overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-[var(--surface-elevated)] hover:bg-[var(--surface-sunken)] transition-colors"
      >
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{title}</span>
        <ChevronDown
          size={16}
          className={`text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div id={contentId} className="px-4 py-3 border-t border-[var(--border-default)]">{content}</div>}
    </div>
  )
}

interface GraphItem {
  name?: string
  title?: string
  description?: string
  content?: string
  id?: string
  [key: string]: unknown
}

function CardList({ items, emptyText }: { items: GraphItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] italic">{emptyText}</p>
  }
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
      {items.map((item, index) => (
        <div
          key={item.id ?? index}
          className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] border border-[var(--border-default)]"
        >
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {item.name || item.title || item.id || `条目 ${index + 1}`}
          </div>
          {(item.description || item.content) && (
            <div className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
              {String(item.description || item.content || '')}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function NarrativeRecordList({
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

const GENRE_PRESETS_ZH = ['奇幻', '言情', '悬疑', '科幻', '恐怖', '历史', '武侠', '都市', '青春', '冒险', '宫斗', '末世', '仙侠', '推理', '轻小说']
const STORY_BIBLE_DRAFT_VERSION = '1.0'
const STORY_BIBLE_STORAGE_KEYS = {
  braindump: 'niko.sb-braindump-v1',
  genres: 'niko.sb-genres-v1',
  synopsis: 'niko.sb-synopsis-v1',
  outline: 'niko.sb-outline-v1',
  style: 'niko.sb-style-v1',
} as const

type StyleId = 'tried' | 'matchMy' | 'soundsLike' | 'custom'
type StoryBibleMessage = { type: 'success' | 'error'; text: string } | null
type StoryBibleSyncState = 'loading' | 'idle' | 'saving' | 'saved' | 'error'

interface StoryBibleDraftPayload {
  version: string
  kind: 'story-bible-local-draft'
  exportedAt: string
  draft: {
    braindump: string
    genres: string[]
    synopsis: string
    outline: string
    style: StyleId
  }
}

function loadFromStorage(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function removeFromStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isStyleId(value: string): value is StyleId {
  return ['tried', 'matchMy', 'soundsLike', 'custom'].includes(value)
}

function clearLegacyStoryBibleDraft() {
  Object.values(STORY_BIBLE_STORAGE_KEYS).forEach(removeFromStorage)
}

type NarrativeRecordKind = 'scene' | 'event' | 'timeline'
type NarrativeTimelineMode = 'story' | 'narrative'

function readText(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return typeof value === 'string' ? value : ''
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function slugifyRecordSegment(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    || 'record'
}

function buildNarrativeItemKind(kind: NarrativeRecordKind): string {
  return `narrative-${kind}`
}

function buildNarrativeRecordId(kind: NarrativeRecordKind, workspaceId: string, title: string): string {
  return `${kind}-${workspaceId}-${slugifyRecordSegment(title)}`
}

function readNarrativeAuthoringCopy(language: 'zh' | 'en') {
  if (language === 'zh') {
    return {
      scene: {
        sectionTitle: '场景',
        titleLabel: '场景标题',
        titlePlaceholder: '输入场景标题',
        summaryLabel: '场景摘要',
        summaryPlaceholder: '记录场景目标、冲突、结果和关键线索。',
        chapterLabel: '章节 ID',
        chapterPlaceholder: 'chapter-1',
        orderLabel: '场次序号',
        orderPlaceholder: '1',
        addLabel: '添加场景',
        saveLabel: '保存场景',
        activateLabel: '设为当前场景',
        activeLabel: '当前场景',
        emptyLabel: '当前工作区还没有场景记录。',
        saveSuccess: '场景已保存到当前工作区。',
        saveError: '保存场景失败，请稍后重试。',
      },
      event: {
        sectionTitle: '事件',
        titleLabel: '事件标题',
        titlePlaceholder: '输入事件标题',
        summaryLabel: '事件摘要',
        summaryPlaceholder: '记录事件触发原因、参与者与后果。',
        sceneLabel: '关联场景 ID',
        scenePlaceholder: 'scene-default-project-opening',
        addLabel: '添加事件',
        saveLabel: '保存事件',
        activateLabel: '设为当前事件',
        activeLabel: '当前事件',
        emptyLabel: '当前工作区还没有事件记录。',
        saveSuccess: '事件已保存到当前工作区。',
        saveError: '保存事件失败，请稍后重试。',
      },
      timeline: {
        sectionTitle: '时间线',
        titleLabel: '时间线标题',
        titlePlaceholder: '输入时间线标题',
        summaryLabel: '时间线摘要',
        summaryPlaceholder: '说明这条时间线覆盖的范围和排序原则。',
        modeLabel: '时间线模式',
        modeStory: '故事时间',
        modeNarrative: '叙事时间',
        addLabel: '添加时间线',
        saveLabel: '保存时间线',
        activateLabel: '设为当前时间线',
        activeLabel: '当前时间线',
        emptyLabel: '当前工作区还没有时间线记录。',
        saveSuccess: '时间线已保存到当前工作区。',
        saveError: '保存时间线失败，请稍后重试。',
      },
    } as const
  }

  return {
    scene: {
      sectionTitle: 'Scenes',
      titleLabel: 'Scene title',
      titlePlaceholder: 'Enter a scene title',
      summaryLabel: 'Scene summary',
      summaryPlaceholder: 'Capture the goal, conflict, outcome, and key clues for this scene.',
      chapterLabel: 'Chapter ID',
      chapterPlaceholder: 'chapter-1',
      orderLabel: 'Scene order',
      orderPlaceholder: '1',
      addLabel: 'Add scene',
      saveLabel: 'Save scene',
      activateLabel: 'Set active scene',
      activeLabel: 'Active scene',
      emptyLabel: 'No scene records exist for this workspace yet.',
      saveSuccess: 'Scene saved to the current workspace.',
      saveError: 'Failed to save the scene. Please try again.',
    },
    event: {
      sectionTitle: 'Events',
      titleLabel: 'Event title',
      titlePlaceholder: 'Enter an event title',
      summaryLabel: 'Event summary',
      summaryPlaceholder: 'Capture the trigger, participants, and aftermath for this event.',
      sceneLabel: 'Related scene ID',
      scenePlaceholder: 'scene-default-project-opening',
      addLabel: 'Add event',
      saveLabel: 'Save event',
      activateLabel: 'Set active event',
      activeLabel: 'Active event',
      emptyLabel: 'No event records exist for this workspace yet.',
      saveSuccess: 'Event saved to the current workspace.',
      saveError: 'Failed to save the event. Please try again.',
    },
    timeline: {
      sectionTitle: 'Timelines',
      titleLabel: 'Timeline title',
      titlePlaceholder: 'Enter a timeline title',
      summaryLabel: 'Timeline summary',
      summaryPlaceholder: 'Describe the ordering principle and coverage for this timeline.',
      modeLabel: 'Timeline mode',
      modeStory: 'Story time',
      modeNarrative: 'Narrative time',
      addLabel: 'Add timeline',
      saveLabel: 'Save timeline',
      activateLabel: 'Set active timeline',
      activeLabel: 'Active timeline',
      emptyLabel: 'No timeline records exist for this workspace yet.',
      saveSuccess: 'Timeline saved to the current workspace.',
      saveError: 'Failed to save the timeline. Please try again.',
    },
  } as const
}

function buildLegacyDraftPayload(): StoryBibleDraftPayload | null {
  const braindump = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.braindump)
  const genres = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.genres)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const synopsis = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.synopsis)
  const outline = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.outline)
  const style = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.style)

  if (!braindump && genres.length === 0 && !synopsis && !outline && !style) {
    return null
  }

  return {
    version: STORY_BIBLE_DRAFT_VERSION,
    kind: 'story-bible-local-draft',
    exportedAt: new Date().toISOString(),
    draft: {
      braindump,
      genres,
      synopsis,
      outline,
      style: isStyleId(style) ? style : 'tried',
    },
  }
}

function readSyncCopy(language: 'zh' | 'en', state: StoryBibleSyncState): string {
  if (language === 'zh') {
    switch (state) {
      case 'loading':
        return '正在加载工作区 Story Bible...'
      case 'saving':
        return '正在同步到当前工作区...'
      case 'saved':
        return '已同步到当前工作区'
      case 'error':
        return '同步失败，请稍后重试'
      default:
        return '等待新的工作区改动'
    }
  }

  switch (state) {
    case 'loading':
      return 'Loading workspace Story Bible...'
    case 'saving':
      return 'Syncing to the active workspace...'
    case 'saved':
      return 'Synced to the active workspace'
    case 'error':
      return 'Sync failed. Please try again.'
    default:
      return 'Waiting for workspace edits'
  }
}

function readCanonCopy(language: 'zh' | 'en') {
  if (language === 'zh') {
    return {
      promoteSynopsis: '提升概要到 Canon',
      promoteSuccess: '已将概要提升到 Canon。',
      promoteFailed: '提升概要到 Canon 失败。',
      synopsisRequired: '请先填写概要后再提升到 Canon。',
      reviewTitle: 'Canon Review',
      reviewHint: '显式提升后的 canon 页面会出现在这里，并保持为只读检查视图。',
      reviewRefresh: '刷新 Canon',
      reviewLoading: '正在加载 canon…',
      reviewEmpty: '当前还没有 canon 页面。',
      reviewSelectHint: '选择一个 canon 页面以查看内容。',
      reviewReadFailed: '读取 canon 页面失败。',
      reviewLoadFailed: '刷新 canon 列表失败。',
    } as const
  }

  return {
    promoteSynopsis: 'Promote Synopsis to Canon',
    promoteSuccess: 'Synopsis promoted to canon.',
    promoteFailed: 'Failed to promote synopsis to canon.',
    synopsisRequired: 'Add a synopsis before promoting it to canon.',
    reviewTitle: 'Canon Review',
    reviewHint: 'Promoted canon pages appear here as an inspectable read-only view.',
    reviewRefresh: 'Refresh Canon',
    reviewLoading: 'Loading canon…',
    reviewEmpty: 'No canon pages exist yet.',
    reviewSelectHint: 'Select a canon page to inspect its content.',
    reviewReadFailed: 'Failed to read the selected canon page.',
    reviewLoadFailed: 'Failed to refresh canon pages.',
  } as const
}

function parseGenres(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      }
    } catch {
      return value.split(',').map((entry) => entry.trim()).filter(Boolean)
    }
  }
  return []
}

export function StoryBiblePanel() {
  const { t, language } = useI18n()
  const currentWorkspace = useAppStore((state) => state.currentWorkspace)
  const setCurrentWorkspace = useAppStore((state) => state.setCurrentWorkspace)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const lastSavedSignatureRef = useRef<string | null>(null)
  const draftMessageTimeoutRef = useRef<number | null>(null)
  const canonMessageTimeoutRef = useRef<number | null>(null)

  const [characters, setCharacters] = useState<GraphItem[]>([])
  const [locations, setLocations] = useState<GraphItem[]>([])
  const [sceneRecords, setSceneRecords] = useState<GraphItem[]>([])
  const [eventRecords, setEventRecords] = useState<GraphItem[]>([])
  const [timelineRecords, setTimelineRecords] = useState<GraphItem[]>([])
  const [braindump, setBraindump] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState('')
  const [synopsis, setSynopsis] = useState('')
  const [outline, setOutline] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<StyleId>('tried')
  const [sceneDraft, setSceneDraft] = useState({
    recordId: null as string | null,
    title: '',
    summary: '',
    chapterId: '',
    sceneOrder: '',
  })
  const [eventDraft, setEventDraft] = useState({
    recordId: null as string | null,
    title: '',
    summary: '',
    sceneId: '',
  })
  const [timelineDraft, setTimelineDraft] = useState({
    recordId: null as string | null,
    title: '',
    summary: '',
    mode: 'story' as NarrativeTimelineMode,
  })
  const [sceneSaving, setSceneSaving] = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [timelineSaving, setTimelineSaving] = useState(false)
  const [draftMessage, setDraftMessage] = useState<StoryBibleMessage>(null)
  const [canonMessage, setCanonMessage] = useState<StoryBibleMessage>(null)
  const [canonPages, setCanonPages] = useState<ProjectWikiCanonPageSummary[]>([])
  const [selectedCanonSlug, setSelectedCanonSlug] = useState<string | null>(null)
  const [selectedCanonPage, setSelectedCanonPage] = useState<ProjectWikiCanonPageRecord | null>(null)
  const [canonLoading, setCanonLoading] = useState(false)
  const [canonLoadingSlug, setCanonLoadingSlug] = useState<string | null>(null)
  const [canonPromoting, setCanonPromoting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncState, setSyncState] = useState<StoryBibleSyncState>('loading')

  const storyBibleName = buildStoryBibleGraphName(currentWorkspace)
  const workspaceNotice = buildWorkspaceNotice(language)
  const syncCopy = readSyncCopy(language, syncState)
  const canonCopy = readCanonCopy(language)
  const narrativeCopy = readNarrativeAuthoringCopy(language)

  const showDraftMessage = useCallback((type: 'success' | 'error', text: string) => {
    if (draftMessageTimeoutRef.current !== null) {
      window.clearTimeout(draftMessageTimeoutRef.current)
    }
    setDraftMessage({ type, text })
    draftMessageTimeoutRef.current = window.setTimeout(() => {
      setDraftMessage(null)
      draftMessageTimeoutRef.current = null
    }, 3000)
  }, [])

  const showCanonMessage = useCallback((type: 'success' | 'error', text: string) => {
    if (canonMessageTimeoutRef.current !== null) {
      window.clearTimeout(canonMessageTimeoutRef.current)
    }
    setCanonMessage({ type, text })
    canonMessageTimeoutRef.current = window.setTimeout(() => {
      setCanonMessage(null)
      canonMessageTimeoutRef.current = null
    }, 3000)
  }, [])

  const syncWorkspaceStoryBible = useCallback((next: {
    storyBibleId: string
    draftId: string
    version: string
    storage: 'local-draft' | 'workspace' | 'graph' | 'memory'
  }) => {
    const currentStoryBible = currentWorkspace.storyBible
    if (
      currentStoryBible.storyBibleId === next.storyBibleId
      && currentStoryBible.draftId === next.draftId
      && currentStoryBible.version === next.version
      && currentStoryBible.storage === next.storage
    ) {
      return
    }

    setCurrentWorkspace({
      storyBible: next,
    })
  }, [currentWorkspace.storyBible, setCurrentWorkspace])

  const applyDraftPayload = useCallback((payload: StoryBibleDraftPayload) => {
    const nextStyle = isStyleId(payload.draft.style) ? payload.draft.style : 'tried'
    setBraindump(payload.draft.braindump)
    setGenres(payload.draft.genres.filter((genre) => typeof genre === 'string' && genre.trim().length > 0))
    setGenreInput('')
    setSynopsis(payload.draft.synopsis)
    setOutline(payload.draft.outline)
    setSelectedStyle(nextStyle)
  }, [])

  const buildDraftPayload = useCallback(
    (): StoryBibleDraftPayload => ({
      version: STORY_BIBLE_DRAFT_VERSION,
      kind: 'story-bible-local-draft',
      exportedAt: new Date().toISOString(),
      draft: {
        braindump,
        genres,
        synopsis,
        outline,
        style: selectedStyle,
      },
    }),
    [braindump, genres, outline, selectedStyle, synopsis],
  )

  const refreshKnowledgeLists = useCallback(async () => {
    try {
      const [characterResult, locationResult] = await Promise.all([
        queryGraph('MATCH (c:Character) RETURN c LIMIT 100', { workspace: currentWorkspace }),
        queryGraph('MATCH (l:Location) RETURN l LIMIT 100', { workspace: currentWorkspace }),
      ])

      if (characterResult.success) {
        setCharacters(
          filterWorkspaceKnowledgeItems(toGraphItems(characterResult.data, 'c'), currentWorkspace, {
            itemKind: 'character',
          }),
        )
      }

      if (locationResult.success) {
        setLocations(
          filterWorkspaceKnowledgeItems(toGraphItems(locationResult.data, 'l'), currentWorkspace, {
            itemKind: 'location',
          }),
        )
      }
    } catch (error) {
      console.error('Failed to refresh Story Bible knowledge lists:', error)
    }
  }, [currentWorkspace])

  const buildNarrativeRecordProps = useCallback((kind: NarrativeRecordKind, base: {
    recordId: string
    title: string
    summary: string
  }) => {
    const recordSetId = currentWorkspace.authority.recordSetId || currentWorkspace.identity.workspaceId
    return {
      id: base.recordId,
      name: base.title,
      title: base.title,
      summary: base.summary,
      description: base.summary,
      content: base.summary,
      kind,
      itemKind: buildNarrativeItemKind(kind),
      schemaVersion: '2026-04-25',
      workspaceId: currentWorkspace.identity.workspaceId,
      projectId: currentWorkspace.identity.projectId,
      workspaceRoot: currentWorkspace.identity.workspaceRoot,
      recordSetId,
      scopeAuthority: 'workspace',
      canonAuthority: 'canon-page',
      projectionAuthority: 'derived',
      promotionMode: 'manual',
      status: 'draft',
      promotedFrom: 'manual',
      updatedAt: new Date().toISOString(),
    }
  }, [currentWorkspace])

  const refreshNarrativeRecords = useCallback(async () => {
    try {
      const [sceneResult, eventResult, timelineResult] = await Promise.all([
        queryGraph('MATCH (n:Item) WHERE n.itemKind = "narrative-scene" RETURN n LIMIT 100', { workspace: currentWorkspace }),
        queryGraph('MATCH (n:Item) WHERE n.itemKind = "narrative-event" RETURN n LIMIT 100', { workspace: currentWorkspace }),
        queryGraph('MATCH (n:Item) WHERE n.itemKind = "narrative-timeline" RETURN n LIMIT 100', { workspace: currentWorkspace }),
      ])

      if (sceneResult.success) {
        setSceneRecords(
          filterWorkspaceKnowledgeItems(toGraphItems(sceneResult.data, 'n'), currentWorkspace, {
            itemKind: 'narrative-scene',
          }),
        )
      }

      if (eventResult.success) {
        setEventRecords(
          filterWorkspaceKnowledgeItems(toGraphItems(eventResult.data, 'n'), currentWorkspace, {
            itemKind: 'narrative-event',
          }),
        )
      }

      if (timelineResult.success) {
        setTimelineRecords(
          filterWorkspaceKnowledgeItems(toGraphItems(timelineResult.data, 'n'), currentWorkspace, {
            itemKind: 'narrative-timeline',
          }),
        )
      }
    } catch (error) {
      console.error('Failed to refresh narrative records:', error)
    }
  }, [currentWorkspace])

  const activateNarrativeRecord = useCallback((kind: NarrativeRecordKind, item: GraphItem) => {
    const recordSetId = readText(item.recordSetId) || currentWorkspace.authority.recordSetId || currentWorkspace.identity.workspaceId
    const recordId = readText(item.id)
    setCurrentWorkspace({
      authority: {
        recordSetId,
        ...(kind === 'scene' ? { activeSceneId: recordId } : {}),
        ...(kind === 'event' ? { activeEventId: recordId } : {}),
        ...(kind === 'timeline' ? { activeTimelineId: recordId } : {}),
      },
    })
  }, [currentWorkspace, setCurrentWorkspace])

  const selectSceneRecord = useCallback((item: GraphItem) => {
    setSceneDraft({
      recordId: readText(item.id) || null,
      title: readText(item.title) || readText(item.name),
      summary: readText(item.summary) || readText(item.description) || readText(item.content),
      chapterId: readText(item.chapterId),
      sceneOrder: readText(item.sceneOrder),
    })
  }, [])

  const selectEventRecord = useCallback((item: GraphItem) => {
    setEventDraft({
      recordId: readText(item.id) || null,
      title: readText(item.title) || readText(item.name),
      summary: readText(item.summary) || readText(item.description) || readText(item.content),
      sceneId: readText(item.sceneId),
    })
  }, [])

  const selectTimelineRecord = useCallback((item: GraphItem) => {
    setTimelineDraft({
      recordId: readText(item.id) || null,
      title: readText(item.title) || readText(item.name),
      summary: readText(item.summary) || readText(item.description) || readText(item.content),
      mode: readText(item.mode) === 'narrative' ? 'narrative' : 'story',
    })
  }, [])

  const handleSaveSceneRecord = useCallback(async () => {
    const title = sceneDraft.title.trim()
    if (!title) {
      showDraftMessage('error', narrativeCopy.scene.titlePlaceholder)
      return
    }

    setSceneSaving(true)
    try {
      const recordId = sceneDraft.recordId || buildNarrativeRecordId('scene', currentWorkspace.identity.workspaceId, title)
      const response = await queryGraph(
        buildGraphMergeMutation(
          'Item',
          { id: recordId, workspaceId: currentWorkspace.identity.workspaceId },
          {
            ...buildNarrativeRecordProps('scene', {
              recordId,
              title,
              summary: sceneDraft.summary.trim(),
            }),
            chapterId: sceneDraft.chapterId.trim() || null,
            sceneOrder: parseOptionalNumber(sceneDraft.sceneOrder),
          },
        ),
        { workspace: currentWorkspace },
      )
      const graphError = readGraphMutationError(response.data)
      if (!response.success || graphError) {
        throw new Error(response.error || graphError || narrativeCopy.scene.saveError)
      }

      setSceneDraft((current) => ({ ...current, recordId, title }))
      await refreshNarrativeRecords()
      showDraftMessage('success', narrativeCopy.scene.saveSuccess)
      window.dispatchEvent(new CustomEvent(WORKSPACE_KNOWLEDGE_CHANGED_EVENT))
    } catch (error) {
      console.error('Failed to save scene record:', error)
      showDraftMessage('error', narrativeCopy.scene.saveError)
    } finally {
      setSceneSaving(false)
    }
  }, [buildNarrativeRecordProps, currentWorkspace, narrativeCopy.scene.saveError, narrativeCopy.scene.saveSuccess, narrativeCopy.scene.titlePlaceholder, refreshNarrativeRecords, sceneDraft, showDraftMessage])

  const handleSaveEventRecord = useCallback(async () => {
    const title = eventDraft.title.trim()
    if (!title) {
      showDraftMessage('error', narrativeCopy.event.titlePlaceholder)
      return
    }

    setEventSaving(true)
    try {
      const recordId = eventDraft.recordId || buildNarrativeRecordId('event', currentWorkspace.identity.workspaceId, title)
      const response = await queryGraph(
        buildGraphMergeMutation(
          'Item',
          { id: recordId, workspaceId: currentWorkspace.identity.workspaceId },
          {
            ...buildNarrativeRecordProps('event', {
              recordId,
              title,
              summary: eventDraft.summary.trim(),
            }),
            sceneId: eventDraft.sceneId.trim() || null,
          },
        ),
        { workspace: currentWorkspace },
      )
      const graphError = readGraphMutationError(response.data)
      if (!response.success || graphError) {
        throw new Error(response.error || graphError || narrativeCopy.event.saveError)
      }

      setEventDraft((current) => ({ ...current, recordId, title }))
      await refreshNarrativeRecords()
      showDraftMessage('success', narrativeCopy.event.saveSuccess)
      window.dispatchEvent(new CustomEvent(WORKSPACE_KNOWLEDGE_CHANGED_EVENT))
    } catch (error) {
      console.error('Failed to save event record:', error)
      showDraftMessage('error', narrativeCopy.event.saveError)
    } finally {
      setEventSaving(false)
    }
  }, [buildNarrativeRecordProps, currentWorkspace, eventDraft, narrativeCopy.event.saveError, narrativeCopy.event.saveSuccess, narrativeCopy.event.titlePlaceholder, refreshNarrativeRecords, showDraftMessage])

  const handleSaveTimelineRecord = useCallback(async () => {
    const title = timelineDraft.title.trim()
    if (!title) {
      showDraftMessage('error', narrativeCopy.timeline.titlePlaceholder)
      return
    }

    setTimelineSaving(true)
    try {
      const recordId = timelineDraft.recordId || buildNarrativeRecordId('timeline', currentWorkspace.identity.workspaceId, title)
      const response = await queryGraph(
        buildGraphMergeMutation(
          'Item',
          { id: recordId, workspaceId: currentWorkspace.identity.workspaceId },
          {
            ...buildNarrativeRecordProps('timeline', {
              recordId,
              title,
              summary: timelineDraft.summary.trim(),
            }),
            mode: timelineDraft.mode,
          },
        ),
        { workspace: currentWorkspace },
      )
      const graphError = readGraphMutationError(response.data)
      if (!response.success || graphError) {
        throw new Error(response.error || graphError || narrativeCopy.timeline.saveError)
      }

      setTimelineDraft((current) => ({ ...current, recordId, title }))
      await refreshNarrativeRecords()
      showDraftMessage('success', narrativeCopy.timeline.saveSuccess)
      window.dispatchEvent(new CustomEvent(WORKSPACE_KNOWLEDGE_CHANGED_EVENT))
    } catch (error) {
      console.error('Failed to save timeline record:', error)
      showDraftMessage('error', narrativeCopy.timeline.saveError)
    } finally {
      setTimelineSaving(false)
    }
  }, [buildNarrativeRecordProps, currentWorkspace, narrativeCopy.timeline.saveError, narrativeCopy.timeline.saveSuccess, narrativeCopy.timeline.titlePlaceholder, refreshNarrativeRecords, showDraftMessage, timelineDraft])

  const refreshWorkspaceLists = useCallback(async () => {
    await Promise.all([
      refreshKnowledgeLists(),
      refreshNarrativeRecords(),
    ])
  }, [refreshKnowledgeLists, refreshNarrativeRecords])

  const refreshCanonPages = useCallback(async (preferredSlug?: string | null) => {
    setCanonLoading(true)
    try {
      const response = await listProjectWikiCanonPagesApi(currentWorkspace, {
        status: 'curated',
        limit: 20,
      })

      if (!response.success || !response.data?.available) {
        throw new Error(response.error || response.data?.reason || 'Canon list failed')
      }

      const pages = response.data.pages
      setCanonPages(pages)

      const nextSelectedSlug = preferredSlug ?? selectedCanonSlug
      if (nextSelectedSlug && !pages.some((page) => page.slug === nextSelectedSlug)) {
        setSelectedCanonSlug(null)
        setSelectedCanonPage(null)
      }
    } catch (error) {
      console.error('Failed to refresh canon pages:', error)
      showCanonMessage('error', canonCopy.reviewLoadFailed)
    } finally {
      setCanonLoading(false)
    }
  }, [canonCopy.reviewLoadFailed, currentWorkspace, selectedCanonSlug, showCanonMessage])

  const loadCanonPage = useCallback(async (slug: string) => {
    setCanonLoadingSlug(slug)
    try {
      const response = await readProjectWikiCanonPageApi(slug, currentWorkspace)
      if (!response.success || !response.data?.page) {
        throw new Error(response.error || response.data?.reason || 'Canon page read failed')
      }

      setSelectedCanonSlug(slug)
      setSelectedCanonPage(response.data.page)
    } catch (error) {
      console.error('Failed to read canon page:', error)
      showCanonMessage('error', canonCopy.reviewReadFailed)
    } finally {
      setCanonLoadingSlug(null)
    }
  }, [canonCopy.reviewReadFailed, currentWorkspace, showCanonMessage])

  const loadWorkspaceStoryBible = useCallback(async () => {
    setLoading(true)
    setSyncState('loading')

    try {
      const [storyBibleResult] = await Promise.all([
        queryGraph(`MATCH (n:Item) WHERE n.name = ${JSON.stringify(storyBibleName)} RETURN n`, {
          workspace: currentWorkspace,
        }),
        refreshWorkspaceLists(),
      ])

      if (storyBibleResult.success) {
        const graphError = readGraphMutationError(storyBibleResult.data)
        if (graphError) {
          throw new Error(graphError)
        }

        const persistedItem = toGraphItems(storyBibleResult.data, 'n')[0]
        if (persistedItem) {
          setBraindump(readString(persistedItem.braindump))
          setGenres(parseGenres(persistedItem.genres))
          setGenreInput('')
          setSynopsis(readString(persistedItem.synopsis))
          setOutline(readString(persistedItem.outline))
          setSelectedStyle(
            isStyleId(readString(persistedItem.style)) ? (persistedItem.style as StyleId) : 'tried',
          )

          lastSavedSignatureRef.current = JSON.stringify({
            name: storyBibleName,
            braindump: readString(persistedItem.braindump),
            genres: parseGenres(persistedItem.genres),
            synopsis: readString(persistedItem.synopsis),
            outline: readString(persistedItem.outline),
            style: isStyleId(readString(persistedItem.style)) ? persistedItem.style : 'tried',
          })

          syncWorkspaceStoryBible({
            storyBibleId: readString(persistedItem.id) || storyBibleName,
            draftId: storyBibleName,
            version: readString(persistedItem.version) || STORY_BIBLE_DRAFT_VERSION,
            storage: 'graph',
          })
          clearLegacyStoryBibleDraft()
          setSyncState('saved')
          return
        }
      }

      const legacyDraft = buildLegacyDraftPayload()
      if (legacyDraft) {
        applyDraftPayload(legacyDraft)
        lastSavedSignatureRef.current = null
      } else {
        setBraindump('')
        setGenres([])
        setGenreInput('')
        setSynopsis('')
        setOutline('')
        setSelectedStyle('tried')
        lastSavedSignatureRef.current = null
      }

      setSyncState('idle')
    } catch (error) {
      console.error('Failed to load Story Bible:', error)
      setSyncState('error')
      showDraftMessage(
        'error',
        language === 'zh' ? '加载 Story Bible 失败，请稍后重试。' : 'Failed to load the Story Bible. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }, [
    applyDraftPayload,
    currentWorkspace,
    language,
    refreshWorkspaceLists,
    syncWorkspaceStoryBible,
    showDraftMessage,
    storyBibleName,
  ])

  useEffect(() => {
    loadWorkspaceStoryBible()
  }, [loadWorkspaceStoryBible])

  useEffect(() => {
    const handleKnowledgeChange = () => {
      void refreshWorkspaceLists()
    }

    window.addEventListener(WORKSPACE_KNOWLEDGE_CHANGED_EVENT, handleKnowledgeChange)
    return () => window.removeEventListener(WORKSPACE_KNOWLEDGE_CHANGED_EVENT, handleKnowledgeChange)
  }, [refreshWorkspaceLists])

  useEffect(() => {
    void refreshCanonPages()
  }, [refreshCanonPages])

  useEffect(() => () => {
    if (draftMessageTimeoutRef.current !== null) {
      window.clearTimeout(draftMessageTimeoutRef.current)
    }
    if (canonMessageTimeoutRef.current !== null) {
      window.clearTimeout(canonMessageTimeoutRef.current)
    }
  }, [])

  const storyBibleSignature = JSON.stringify({
    name: storyBibleName,
    braindump,
    genres,
    synopsis,
    outline,
    style: selectedStyle,
  })

  useEffect(() => {
    if (loading) return
    if (storyBibleSignature === lastSavedSignatureRef.current) return

    const isEmpty =
      !braindump.trim()
      && genres.length === 0
      && !synopsis.trim()
      && !outline.trim()
      && selectedStyle === 'tried'

    if (isEmpty && lastSavedSignatureRef.current === null) {
      return
    }

    const timeoutId = window.setTimeout(async () => {
      setSyncState('saving')
      try {
        const response = await queryGraph(
          buildGraphMergeMutation(
            'Item',
            { name: storyBibleName },
            {
              name: storyBibleName,
              itemKind: 'story-bible',
              workspaceId: currentWorkspace.identity.workspaceId,
              projectId: currentWorkspace.identity.projectId,
              workspaceRoot: currentWorkspace.identity.workspaceRoot,
              version: STORY_BIBLE_DRAFT_VERSION,
              braindump,
              genres: JSON.stringify(genres),
              synopsis,
              outline,
              style: selectedStyle,
            },
          ),
          { workspace: currentWorkspace },
        )

        const graphError = readGraphMutationError(response.data)
        if (!response.success || graphError) {
          throw new Error(response.error || graphError || 'Story Bible save failed')
        }

        const savedItem = toGraphItems(response.data, 'n')[0]
        lastSavedSignatureRef.current = storyBibleSignature
        syncWorkspaceStoryBible({
          storyBibleId: readString(savedItem?.id) || storyBibleName,
          draftId: storyBibleName,
          version: STORY_BIBLE_DRAFT_VERSION,
          storage: 'graph',
        })
        clearLegacyStoryBibleDraft()
        setSyncState('saved')
      } catch (error) {
        console.error('Failed to persist Story Bible:', error)
        setSyncState('error')
        showDraftMessage(
          'error',
          language === 'zh'
            ? 'Story Bible 保存失败，当前草稿已保留，请重试。'
            : 'Failed to save the Story Bible. Your current draft is still here. Please retry.',
        )
      }
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [
    braindump,
    currentWorkspace,
    genres,
    loading,
    outline,
    selectedStyle,
    showDraftMessage,
    syncWorkspaceStoryBible,
    storyBibleName,
    storyBibleSignature,
    synopsis,
  ])

  const toggleGenre = useCallback((genre: string) => {
    setGenres((previous) => (
      previous.includes(genre) ? previous.filter((entry) => entry !== genre) : [...previous, genre]
    ))
  }, [])

  const addCustomGenre = useCallback(() => {
    const trimmed = genreInput.trim()
    if (trimmed && !genres.includes(trimmed)) {
      setGenres((previous) => [...previous, trimmed])
      setGenreInput('')
    }
  }, [genreInput, genres])

  const handleExportDraft = useCallback(() => {
    const payload = buildDraftPayload()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `niko-story-bible-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
    showDraftMessage('success', t.storyBibleDraftExported)
  }, [buildDraftPayload, showDraftMessage, t.storyBibleDraftExported])

  const handleImportDraft = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      try {
        const raw = String(loadEvent.target?.result ?? '')
        const payload = JSON.parse(raw) as Partial<StoryBibleDraftPayload>
        if (
          payload.kind !== 'story-bible-local-draft'
          || !payload.draft
          || typeof payload.draft.braindump !== 'string'
          || !Array.isArray(payload.draft.genres)
          || typeof payload.draft.synopsis !== 'string'
          || typeof payload.draft.outline !== 'string'
          || typeof payload.draft.style !== 'string'
        ) {
          throw new Error(t.storyBibleDraftImportInvalid)
        }

        applyDraftPayload({
          version: readString(payload.version) || STORY_BIBLE_DRAFT_VERSION,
          kind: 'story-bible-local-draft',
          exportedAt: readString(payload.exportedAt) || new Date().toISOString(),
          draft: {
            braindump: payload.draft.braindump,
            genres: payload.draft.genres.filter((genre): genre is string => typeof genre === 'string'),
            synopsis: payload.draft.synopsis,
            outline: payload.draft.outline,
            style: isStyleId(payload.draft.style) ? payload.draft.style : 'tried',
          },
        })
        lastSavedSignatureRef.current = null
        showDraftMessage('success', t.storyBibleDraftImported)
      } catch {
        showDraftMessage('error', t.storyBibleDraftImportInvalid)
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
    reader.readAsText(file)
  }, [applyDraftPayload, showDraftMessage, t.storyBibleDraftImportInvalid, t.storyBibleDraftImported])

  const handleResetDraft = useCallback(() => {
    setBraindump('')
    setGenres([])
    setGenreInput('')
    setSynopsis('')
    setOutline('')
    setSelectedStyle('tried')
    clearLegacyStoryBibleDraft()
    lastSavedSignatureRef.current = '__reset__'
    showDraftMessage('success', t.storyBibleDraftReset)
  }, [showDraftMessage, t.storyBibleDraftReset])

  const handlePromoteSynopsis = useCallback(async () => {
    const trimmedSynopsis = synopsis.trim()
    if (!trimmedSynopsis) {
      showCanonMessage('error', canonCopy.synopsisRequired)
      return
    }

    setCanonPromoting(true)
    try {
      const workspaceLabel = currentWorkspace.identity.projectName || currentWorkspace.identity.workspaceId
      const synopsisSlug = `story-bible/${currentWorkspace.identity.workspaceId}-synopsis`
      const response = await promoteProjectWikiCanonApi({
        title: `${workspaceLabel} Story Bible Synopsis`,
        body: trimmedSynopsis,
        slug: synopsisSlug,
        idSeed: `${currentWorkspace.identity.workspaceId}:story-bible:synopsis`,
        promotedFrom: 'story-bible',
        sourceId: `${currentWorkspace.identity.workspaceId}-synopsis`,
        sourceRef: 'story-bible.synopsis',
        rawEvidence: {
          relativePath: `imports/story-bible/${currentWorkspace.identity.workspaceId}-synopsis.md`,
          content: trimmedSynopsis,
        },
        metadata: {
          section: 'synopsis',
          story_bible_name: storyBibleName,
          story_bible_id: currentWorkspace.storyBible.storyBibleId,
          draft_id: currentWorkspace.storyBible.draftId,
        },
      }, currentWorkspace)

      if (!response.success || !response.data?.available || !response.data.page) {
        throw new Error(response.error || response.data?.reason || 'Canon promotion failed')
      }

      showCanonMessage('success', canonCopy.promoteSuccess)
      await refreshCanonPages(response.data.page.slug)
      await loadCanonPage(response.data.page.slug)
    } catch (error) {
      console.error('Failed to promote Story Bible synopsis to canon:', error)
      showCanonMessage('error', canonCopy.promoteFailed)
    } finally {
      setCanonPromoting(false)
    }
  }, [
    canonCopy.promoteFailed,
    canonCopy.promoteSuccess,
    canonCopy.synopsisRequired,
    currentWorkspace,
    loadCanonPage,
    refreshCanonPages,
    showCanonMessage,
    storyBibleName,
    synopsis,
  ])

  const genrePresets = language === 'zh'
    ? GENRE_PRESETS_ZH
    : ['Fantasy', 'Romance', 'Mystery', 'Sci-Fi', 'Horror', 'Historical', 'Martial Arts', 'Urban', 'Coming-of-Age', 'Adventure', 'Court Drama', 'Post-Apocalyptic', 'Xianxia', 'Detective', 'Light Novel']
  const canPromoteSynopsis = synopsis.trim().length > 0
  const synopsisPromotionHint = canPromoteSynopsis ? canonCopy.reviewHint : canonCopy.synopsisRequired

  const styles = [
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
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-secondary)]">{t.storyBibleBraindumpHint}</p>
          <textarea
            id="story-bible-braindump"
            name="story-bible-braindump"
            value={braindump}
            onChange={(event) => setBraindump(event.target.value)}
            aria-label={t.storyBibleBraindump}
            placeholder={t.storyBibleBraindumpHint}
            className="w-full min-h-32 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
          />
        </div>
      ),
    },
    {
      key: 'genre',
      title: t.storyBibleGenre,
      icon: <Tag size={16} />,
      defaultOpen: true,
      content: (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {genrePresets.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                  genres.includes(genre)
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
              value={genreInput}
              onChange={(event) => setGenreInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addCustomGenre()}
              aria-label={t.storyBibleGenrePlaceholder}
              placeholder={t.storyBibleGenrePlaceholder}
              className="flex-1 text-sm bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] px-3 py-1.5 outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
            />
            <button
              onClick={addCustomGenre}
              disabled={!genreInput.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--primary-cta)] text-white rounded-[var(--radius-sm)] hover:bg-[var(--primary-cta-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              +
            </button>
          </div>
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[var(--primary-cta)]/10 text-[var(--primary-cta)] rounded-full border border-[var(--primary-cta)]/20"
                >
                  {genre}
                  <button
                    onClick={() => toggleGenre(genre)}
                    className="hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'synopsis',
      title: t.storyBibleSynopsis,
      icon: <FileText size={16} />,
      content: (
        <div className="space-y-3">
          <textarea
            value={synopsis}
            onChange={(event) => setSynopsis(event.target.value)}
            placeholder={t.storyBibleSynopsisPlaceholder}
            className="w-full min-h-28 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">
              {synopsisPromotionHint}
            </p>
            <button
              type="button"
              onClick={() => void handlePromoteSynopsis()}
              disabled={!canPromoteSynopsis || canonPromoting}
              className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--primary-cta)]/30 bg-[var(--primary-cta)]/10 px-3 py-1.5 text-xs font-medium text-[var(--primary-cta)] hover:bg-[var(--primary-cta)]/15 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              <BookOpen size={14} />
              {canonPromoting ? canonCopy.reviewLoading : canonCopy.promoteSynopsis}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'canon-review',
      title: canonCopy.reviewTitle,
      icon: <BookOpen size={16} />,
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">{canonCopy.reviewHint}</p>
            <button
              type="button"
              onClick={() => void refreshCanonPages()}
              disabled={canonLoading}
              className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--primary-cta)]/40 hover:text-[var(--primary-cta)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              <RotateCcw size={14} />
              {canonLoading ? canonCopy.reviewLoading : canonCopy.reviewRefresh}
            </button>
          </div>
          {canonPages.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic">
              {canonLoading ? canonCopy.reviewLoading : canonCopy.reviewEmpty}
            </p>
          ) : (
            <div className="space-y-2">
              {canonPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => void loadCanonPage(page.slug)}
                  className={`w-full rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors ${
                    selectedCanonSlug === page.slug
                      ? 'border-[var(--primary-cta)]/40 bg-[var(--primary-cta)]/10'
                      : 'border-[var(--border-default)] bg-[var(--surface-sunken)] hover:border-[var(--primary-cta)]/30'
                  }`}
                >
                  <div className="text-sm font-medium text-[var(--text-primary)]">{page.title}</div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">{page.slug}</div>
                  {canonLoadingSlug === page.slug && (
                    <div className="mt-1 text-[11px] text-[var(--primary-cta)]">{canonCopy.reviewLoading}</div>
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
            <p className="text-xs text-[var(--text-muted)]">{canonCopy.reviewSelectHint}</p>
          )}
        </div>
      ),
    },
    {
      key: 'characters',
      title: `${t.storyBibleCharacters} (${characters.length})`,
      icon: <Users size={16} />,
      content: loading
        ? <p className="text-sm text-[var(--text-muted)]">{t.storyBibleLoading}</p>
        : <CardList items={characters} emptyText={t.storyBibleEmpty} />,
    },
    {
      key: 'worldbuilding',
      title: `${t.storyBibleWorldbuilding} (${locations.length})`,
      icon: <Map size={16} />,
      content: loading
        ? <p className="text-sm text-[var(--text-muted)]">{t.storyBibleLoading}</p>
        : <CardList items={locations} emptyText={t.storyBibleEmpty} />,
    },
    {
      key: 'scenes',
      title: `${narrativeCopy.scene.sectionTitle} (${sceneRecords.length})`,
      icon: <FileText size={16} />,
      content: (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.scene.titleLabel}</span>
              <input
                value={sceneDraft.title}
                onChange={(event) => setSceneDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder={narrativeCopy.scene.titlePlaceholder}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.scene.chapterLabel}</span>
              <input
                value={sceneDraft.chapterId}
                onChange={(event) => setSceneDraft((current) => ({ ...current, chapterId: event.target.value }))}
                placeholder={narrativeCopy.scene.chapterPlaceholder}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.scene.summaryLabel}</span>
              <textarea
                value={sceneDraft.summary}
                onChange={(event) => setSceneDraft((current) => ({ ...current, summary: event.target.value }))}
                placeholder={narrativeCopy.scene.summaryPlaceholder}
                className="min-h-24 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.scene.orderLabel}</span>
              <input
                value={sceneDraft.sceneOrder}
                onChange={(event) => setSceneDraft((current) => ({ ...current, sceneOrder: event.target.value }))}
                placeholder={narrativeCopy.scene.orderPlaceholder}
                inputMode="numeric"
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveSceneRecord()}
              disabled={sceneSaving}
              className="rounded-[var(--radius-sm)] bg-[var(--primary-cta)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-cta-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {sceneSaving ? narrativeCopy.scene.saveLabel : (sceneDraft.recordId ? narrativeCopy.scene.saveLabel : narrativeCopy.scene.addLabel)}
            </button>
            {currentWorkspace.authority.activeSceneId && (
              <span className="text-xs text-[var(--text-secondary)]">
                {narrativeCopy.scene.activeLabel}: {currentWorkspace.authority.activeSceneId}
              </span>
            )}
          </div>
          <NarrativeRecordList
            items={sceneRecords}
            emptyText={narrativeCopy.scene.emptyLabel}
            activeRecordId={currentWorkspace.authority.activeSceneId}
            activeLabel={narrativeCopy.scene.activeLabel}
            activateLabel={narrativeCopy.scene.activateLabel}
            onSelect={selectSceneRecord}
            onActivate={(item) => activateNarrativeRecord('scene', item)}
          />
        </div>
      ),
    },
    {
      key: 'events',
      title: `${narrativeCopy.event.sectionTitle} (${eventRecords.length})`,
      icon: <Sparkles size={16} />,
      content: (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.event.titleLabel}</span>
              <input
                value={eventDraft.title}
                onChange={(event) => setEventDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder={narrativeCopy.event.titlePlaceholder}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.event.sceneLabel}</span>
              <input
                value={eventDraft.sceneId}
                onChange={(event) => setEventDraft((current) => ({ ...current, sceneId: event.target.value }))}
                placeholder={narrativeCopy.event.scenePlaceholder}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.event.summaryLabel}</span>
              <textarea
                value={eventDraft.summary}
                onChange={(event) => setEventDraft((current) => ({ ...current, summary: event.target.value }))}
                placeholder={narrativeCopy.event.summaryPlaceholder}
                className="min-h-24 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveEventRecord()}
              disabled={eventSaving}
              className="rounded-[var(--radius-sm)] bg-[var(--primary-cta)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-cta-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {eventSaving ? narrativeCopy.event.saveLabel : (eventDraft.recordId ? narrativeCopy.event.saveLabel : narrativeCopy.event.addLabel)}
            </button>
            {currentWorkspace.authority.activeEventId && (
              <span className="text-xs text-[var(--text-secondary)]">
                {narrativeCopy.event.activeLabel}: {currentWorkspace.authority.activeEventId}
              </span>
            )}
          </div>
          <NarrativeRecordList
            items={eventRecords}
            emptyText={narrativeCopy.event.emptyLabel}
            activeRecordId={currentWorkspace.authority.activeEventId}
            activeLabel={narrativeCopy.event.activeLabel}
            activateLabel={narrativeCopy.event.activateLabel}
            onSelect={selectEventRecord}
            onActivate={(item) => activateNarrativeRecord('event', item)}
          />
        </div>
      ),
    },
    {
      key: 'timelines',
      title: `${narrativeCopy.timeline.sectionTitle} (${timelineRecords.length})`,
      icon: <Map size={16} />,
      content: (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.timeline.titleLabel}</span>
              <input
                value={timelineDraft.title}
                onChange={(event) => setTimelineDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder={narrativeCopy.timeline.titlePlaceholder}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.timeline.modeLabel}</span>
              <select
                value={timelineDraft.mode}
                onChange={(event) => setTimelineDraft((current) => ({
                  ...current,
                  mode: event.target.value === 'narrative' ? 'narrative' : 'story',
                }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30"
              >
                <option value="story">{narrativeCopy.timeline.modeStory}</option>
                <option value="narrative">{narrativeCopy.timeline.modeNarrative}</option>
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs text-[var(--text-secondary)]">{narrativeCopy.timeline.summaryLabel}</span>
              <textarea
                value={timelineDraft.summary}
                onChange={(event) => setTimelineDraft((current) => ({ ...current, summary: event.target.value }))}
                placeholder={narrativeCopy.timeline.summaryPlaceholder}
                className="min-h-24 w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSaveTimelineRecord()}
              disabled={timelineSaving}
              className="rounded-[var(--radius-sm)] bg-[var(--primary-cta)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-cta-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {timelineSaving ? narrativeCopy.timeline.saveLabel : (timelineDraft.recordId ? narrativeCopy.timeline.saveLabel : narrativeCopy.timeline.addLabel)}
            </button>
            {currentWorkspace.authority.activeTimelineId && (
              <span className="text-xs text-[var(--text-secondary)]">
                {narrativeCopy.timeline.activeLabel}: {currentWorkspace.authority.activeTimelineId}
              </span>
            )}
          </div>
          <NarrativeRecordList
            items={timelineRecords}
            emptyText={narrativeCopy.timeline.emptyLabel}
            activeRecordId={currentWorkspace.authority.activeTimelineId}
            activeLabel={narrativeCopy.timeline.activeLabel}
            activateLabel={narrativeCopy.timeline.activateLabel}
            onSelect={selectTimelineRecord}
            onActivate={(item) => activateNarrativeRecord('timeline', item)}
          />
        </div>
      ),
    },
    {
      key: 'style',
      title: t.storyBibleStyleTitle,
      icon: <Sparkles size={16} />,
      content: (
        <div className="grid grid-cols-2 gap-2">
          {styles.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              aria-pressed={selectedStyle === style.id}
              className={`flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] border text-left transition-all ${
                selectedStyle === style.id
                  ? 'bg-[var(--primary-cta)]/10 border-[var(--primary-cta)]/40 ring-1 ring-[var(--primary-cta)]/30'
                  : 'bg-[var(--surface-sunken)] border-[var(--border-default)] hover:border-[var(--primary-cta)]/20'
              }`}
            >
              <span className={`mt-0.5 ${selectedStyle === style.id ? 'text-[var(--primary-cta)]' : 'text-[var(--text-muted)]'}`}>
                {style.icon}
              </span>
              <span className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">{style.label}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{style.desc}</div>
              </span>
            </button>
          ))}
        </div>
      ),
    },
    {
      key: 'outline',
      title: t.storyBibleOutline,
      icon: <BookOpen size={16} />,
      content: (
        <textarea
          value={outline}
          onChange={(event) => setOutline(event.target.value)}
          placeholder={t.storyBibleSynopsisPlaceholder}
          className="w-full min-h-40 text-sm leading-relaxed bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-default)] rounded-[var(--radius-sm)] p-3 resize-y outline-none focus:ring-2 focus:ring-[var(--primary-cta)]/30 placeholder:text-[var(--text-muted)] custom-scrollbar"
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
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">{t.storyBibleTitle}</h3>
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
          />
        ))}
      </div>
    </div>
  )
}
