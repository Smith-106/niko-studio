import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'

import {
  listProjectWikiCanonPagesApi,
  promoteProjectWikiCanonApi,
  queryGraph,
  readProjectWikiCanonPageApi,
} from '../../api/client'
import {
  buildGraphMergeMutation,
  buildStoryBibleGraphName,
  buildWorkspaceNotice,
  filterWorkspaceKnowledgeItems,
  readGraphMutationError,
  toGraphItems,
  WORKSPACE_KNOWLEDGE_CHANGED_EVENT,
} from '../knowledge/knowledgeUtils'
import { useI18n } from '../../i18n'
import { useAppStore } from '../../stores/appStore'
import { logger } from '../../utils/logger'
import type {
  ProjectWikiCanonPageRecord,
  ProjectWikiCanonPageSummary,
} from '../../api/wiki'
import type { GraphItem } from './CardList'
import {
  clearLegacyStoryBibleDraft,
  isStyleId,
  parseGenres,
  STORY_BIBLE_DRAFT_VERSION,
  type StoryBibleDraftPayload,
} from './storyBibleDraftUtils'
import {
  parseOptionalNumber,
  buildNarrativeRecordId,
  buildNarrativeItemKind,
  type NarrativeRecordKind,
  type NarrativeTimelineMode,
} from './storyBibleNarrativeUtils'
import { readString, readText } from './storyBibleTextUtils'
import {
  buildLegacyDraftPayload,
  GENRE_PRESETS_ZH,
  readCanonCopy,
  readNarrativeAuthoringCopy,
  readSyncCopy,
  type StoryBibleMessage,
  type StoryBibleSyncState,
  type StyleId,
} from './storyBiblePanelUtils'

export function useStoryBiblePanelController() {
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
      logger.error('Failed to refresh Story Bible knowledge lists:', error)
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
      logger.error('Failed to refresh narrative records:', error)
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
      logger.error('Failed to save scene record:', error)
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
      logger.error('Failed to save event record:', error)
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
      logger.error('Failed to save timeline record:', error)
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
      logger.error('Failed to refresh canon pages:', error)
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
      logger.error('Failed to read canon page:', error)
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
      logger.error('Failed to load Story Bible:', error)
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
    void loadWorkspaceStoryBible()
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
        logger.error('Failed to persist Story Bible:', error)
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
    language,
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
      logger.error('Failed to promote Story Bible synopsis to canon:', error)
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

  return {
    t,
    language,
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
    syncState,
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
  }
}
