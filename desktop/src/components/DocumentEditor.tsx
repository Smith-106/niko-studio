import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react'
import { useI18n } from '../i18n'
import { countWords, countChars, readingTimeMinutes } from '../utils/wordCount'
import { logger } from '../utils/logger'
const StoryBiblePanel = React.lazy(() => import('./StoryBiblePanel').then(m => ({ default: m.StoryBiblePanel })))
import { NikoEditor } from './NikoEditor'
import { HistoryPanel } from './HistoryPanel'
import { ExportDialog } from './ExportDialog'
import { EmptyEditorGuide } from './editor/EmptyEditorGuide'
import { setGeneratingListener, getEditorHandle } from '../utils/editorHandle'
import { readChapterContent, writeChapterContent } from '../services/projectFileService'
import { autoSaveSnapshot } from '../services/versionService'
import { useDocumentEditorState } from '../stores/selectors'
import type { JSONContent } from '@tiptap/react'
import {
  applyTelemetryEvent,
  createWritingSessionTelemetry,
  summarizeWritingSessionTelemetry,
  type WritingSessionTelemetry,
} from '../utils/writingSessionTelemetry'
import {
  buildPersonalizedCraftProfile,
  type PersonalizedCraftRecommendation,
} from '../api/analysis'

// Module-level cache: saves editor JSON + text across chapter switches
const editorStateCache = new Map<string, { json: JSONContent | null; text: string }>()

interface DocumentEditorProps {
  onOpenWritingHelper: () => void
  onOpenSettings?: () => void
  onOpenCharacterPanel?: () => void
  onOpenTemplateBrowser?: () => void
}

export function DocumentEditor({ onOpenWritingHelper, onOpenSettings, onOpenCharacterPanel, onOpenTemplateBrowser }: DocumentEditorProps) {
  const { t, language } = useI18n()
  const {
    currentChapterId,
    currentProjectId,
    currentConversationId,
    currentConversationTitle,
    updateConversationTitle,
    historyPanelOpen,
    toggleHistoryPanel,
    sessionIntelligenceEnabled,
    setSessionIntelligenceSummary,
    setSessionIntelligenceInsights,
    setSessionIntelligenceSessionId,
    personalizedCraftEnabled,
    setPersonalizedCraftSummary,
    setPersonalizedCraftTrajectory,
    setPersonalizedCraftRecommendations,
    setEditorIsDirty,
    editorIsDirty,
  } = useDocumentEditorState()
  const [chapterContent, setChapterContent] = useState<string>('')
  const [contentLoaded, setContentLoaded] = useState(false)
  const fallbackTitle = currentConversationTitle ?? t.appTitle ?? '未命名文档'
  const [title, setTitle] = useState(fallbackTitle)
  const [editorText, setEditorText] = useState('')
  const [editorJson, setEditorJson] = useState<JSONContent | null>(null)
  const [isEditorEmpty, setIsEditorEmpty] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveTime, setSaveTime] = useState<string>('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const craftProfileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorTextRef = useRef<string>('')
  const prevChapterIdRef = useRef<string | null>(null)
  const telemetryRef = useRef<WritingSessionTelemetry | null>(null)
  // Refs for auto-save timer to always use latest values instead of closure capture
  const currentProjectIdRef = useRef(currentProjectId)
  currentProjectIdRef.current = currentProjectId
  const currentChapterIdRef = useRef(currentChapterId)
  currentChapterIdRef.current = currentChapterId
  const titleFieldLabel = language === 'zh' ? '文档标题' : 'Document title'

  const updateSessionTelemetry = useCallback((event: {
    type: 'editor_update' | 'save' | 'history_open'
    characterFocus?: string[]
    keywordFocus?: string[]
  }) => {
    const sessionKey = currentConversationId ?? currentChapterId ?? currentProjectId ?? 'session-global'
    if (!telemetryRef.current || telemetryRef.current.sessionId !== sessionKey) {
      telemetryRef.current = createWritingSessionTelemetry(sessionKey, currentChapterId)
    }
    telemetryRef.current = applyTelemetryEvent(telemetryRef.current, {
      type: event.type,
      timestamp: new Date().toISOString(),
      chapterId: currentChapterId,
      characterFocus: event.characterFocus,
      keywordFocus: event.keywordFocus,
    })

    if (sessionIntelligenceEnabled) {
      const intelligence = summarizeWritingSessionTelemetry(telemetryRef.current)
      setSessionIntelligenceSessionId(intelligence.telemetry.sessionId)
      setSessionIntelligenceSummary(intelligence.insights[0]?.summary ?? null)
      setSessionIntelligenceInsights(intelligence.insights.map((item) => item.suggestion).slice(0, 3))
    }

    if (personalizedCraftEnabled) {
      // 每次按键都调用 buildPersonalizedCraftProfile 会导致输入卡顿，
      // 用 3 秒防抖延迟执行，首次加载（内容为空）时立即执行
      const runCraftProfile = () => {
        const telemetry = telemetryRef.current
        const profile = buildPersonalizedCraftProfile({
          sessionIntelligence: telemetry ? [summarizeWritingSessionTelemetry(telemetry)] : [],
        })
        setPersonalizedCraftSummary(profile.dominantWeaknesses[0]
          ? `近期重点：${profile.dominantWeaknesses[0].dimensionId} · ${profile.dominantWeaknesses[0].latestStatus}`
          : '个性化画像数据不足，先继续积累真实写作与修订行为。')
        setPersonalizedCraftTrajectory(profile.growthTrajectory.summary)
        setPersonalizedCraftRecommendations(
          profile.recommendations.map((item: PersonalizedCraftRecommendation) => item.summary).slice(0, 3),
        )
      }

      if (event.type === 'editor_update' && editorTextRef.current.length > 0) {
        // 非首次输入时防抖，避免每次按键触发重计算
        if (craftProfileTimerRef.current) clearTimeout(craftProfileTimerRef.current)
        craftProfileTimerRef.current = setTimeout(runCraftProfile, 3000)
      } else {
        // 保存事件或首次输入（editorText 为空）时立即执行
        runCraftProfile()
      }
    }
  }, [
    currentChapterId,
    currentConversationId,
    currentProjectId,
    personalizedCraftEnabled,
    sessionIntelligenceEnabled,
    setPersonalizedCraftRecommendations,
    setPersonalizedCraftSummary,
    setPersonalizedCraftTrajectory,
    setSessionIntelligenceInsights,
    setSessionIntelligenceSessionId,
    setSessionIntelligenceSummary,
  ])

  // Load chapter content from filesystem when chapter changes
  useEffect(() => {
    if (!currentChapterId || !currentProjectId) {
      setChapterContent('')
      setContentLoaded(true)
      return
    }
    let cancelled = false
    setContentLoaded(false)
    readChapterContent(currentProjectId, currentChapterId).then((content) => {
      if (cancelled) return
      setChapterContent(content || JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }))
      setContentLoaded(true)
    }).catch(() => {
      if (cancelled) return
      setChapterContent(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }))
      setContentLoaded(true)
    })
    return () => { cancelled = true }
  }, [currentChapterId, currentProjectId])

  const stats = useMemo(() => ({
    words: countWords(editorText),
    chars: countChars(editorText),
    readingTime: readingTimeMinutes(editorText),
  }), [editorText])

  const handleEditorUpdate = useCallback((json: JSONContent, text: string) => {
    setEditorJson(json)
    setEditorText(text)
    editorTextRef.current = text
    setIsEditorEmpty(!text.trim())
    setSaveStatus('saving')
    setEditorIsDirty(true)
    updateSessionTelemetry({
      type: 'editor_update',
      keywordFocus: text.split(/[\s，。！？,.!?\n]+/).filter((item) => item.length >= 2).slice(0, 5),
    })
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const now = new Date()
      const h = now.getHours().toString().padStart(2, '0')
      const m = now.getMinutes().toString().padStart(2, '0')
      setSaveTime(`${h}:${m}`)
      setSaveStatus('saved')
      setEditorIsDirty(false)
      // Use refs for project/chapter IDs to avoid stale closure in auto-save timer
      if (currentProjectIdRef.current && currentChapterIdRef.current) {
        writeChapterContent(currentProjectIdRef.current, currentChapterIdRef.current, JSON.stringify(json)).catch((e) => { logger.error('[auto-save] write failed:', e); setSaveStatus('error') })
        autoSaveSnapshot(currentProjectIdRef.current, currentChapterIdRef.current).catch((e) => { logger.error('[auto-save] snapshot failed:', e) })
      }
      updateSessionTelemetry({ type: 'save' })
      setTimeout(() => setSaveStatus('idle'), 4000)
    }, 1500)
  }, [updateSessionTelemetry])

  const handleSave = useCallback(() => {
    if (currentProjectId && currentChapterId && editorJson) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      writeChapterContent(currentProjectId, currentChapterId, JSON.stringify(editorJson)).catch((e) => { logger.error('[manual-save] write failed:', e); setSaveStatus('error') })
      autoSaveSnapshot(currentProjectId, currentChapterId).catch((e) => { logger.error('[manual-save] snapshot failed:', e) })
      const now = new Date()
      const h = now.getHours().toString().padStart(2, '0')
      const m = now.getMinutes().toString().padStart(2, '0')
      setSaveTime(`${h}:${m}`)
      setSaveStatus('saved')
      setEditorIsDirty(false)
      updateSessionTelemetry({ type: 'save' })
      setTimeout(() => setSaveStatus('idle'), 4000)
    }
  }, [currentProjectId, currentChapterId, editorJson, updateSessionTelemetry])

  useEffect(() => {
    if (historyPanelOpen) {
      updateSessionTelemetry({ type: 'history_open' })
    }
  }, [historyPanelOpen, updateSessionTelemetry])

  // Listen for template:apply events and insert template content into editor
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail?.content) return
      const handle = getEditorHandle()
      if (handle?.insertContent) {
        handle.insertContent(detail.content)
      }
    }
    window.addEventListener('template:apply', handler)
    return () => window.removeEventListener('template:apply', handler)
  }, [])

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value)
    if (currentConversationId) {
      updateConversationTitle(currentConversationId, value)
    }
  }, [currentConversationId, updateConversationTitle])

  // AI generating 状态：由 NikoEditor 通过回调直接通知，替代 500ms 轮询
  useEffect(() => {
    setGeneratingListener(setAiGenerating)
    return () => setGeneratingListener(null)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (craftProfileTimerRef.current) clearTimeout(craftProfileTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setTitle(fallbackTitle)
  }, [fallbackTitle, currentConversationId])

  useEffect(() => {
    const prevId = prevChapterIdRef.current
    const currId = currentChapterId

    // Save current state before switching away
    if (prevId && (editorJson || editorTextRef.current)) {
      editorStateCache.set(prevId, { json: editorJson, text: editorTextRef.current })
    }

    // Restore cached state if available, otherwise clear
    const cached = currId ? editorStateCache.get(currId) : null
    if (cached) {
      setEditorJson(cached.json)
      setEditorText(cached.text)
      editorTextRef.current = cached.text
    } else {
      setEditorText('')
      editorTextRef.current = ''
      setEditorJson(null)
    }
    setSaveStatus('idle')
    setEditorIsDirty(false)
    if (craftProfileTimerRef.current) {
      clearTimeout(craftProfileTimerRef.current)
      craftProfileTimerRef.current = null
    }

    prevChapterIdRef.current = currId
  }, [currentChapterId])

  // beforeunload + Tauri close protection: prevent closing when unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editorIsDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    let unlistenClose: (() => void) | null = null
    try {
      import('@tauri-apps/api/window').then((mod) => {
        const getCurrentWindow = (mod as any).getCurrentWindow
        if (typeof getCurrentWindow !== 'function') return
        const win = getCurrentWindow()
        if (!win || typeof win.onCloseRequested !== 'function') return
        win.onCloseRequested((event: { preventDefault: () => void }) => {
          if (editorIsDirty) {
            event.preventDefault()
          }
        }).then((unlisten: () => void) => {
          unlistenClose = unlisten
        }).catch(() => {
          // Tauri API not available, silently ignore
        })
      }).catch(() => {
        // Tauri API not available, silently ignore
      })
    } catch {
      // Tauri API not available, silently ignore
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (unlistenClose) {
        unlistenClose()
      }
    }
  }, [editorIsDirty])

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      <div className="flex-1 flex flex-col bg-transparent z-0 min-w-0">
        {/* Editor Canvas Area */}
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 sm:p-10 bg-slate-50/50 dark:bg-[#0f0f0f]">
          <div className="w-full flex flex-col bg-white dark:bg-[#1a1a1a] shadow-sm ring-1 ring-gray-200/60 dark:ring-dark-border rounded-xl min-h-[85vh] p-8 sm:p-12 mb-4 transition-all">
            <input
              id="document-title-input"
              name="document-title-input"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              aria-label={titleFieldLabel}
              className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none placeholder-gray-300 dark:placeholder-gray-700 tracking-tight"
              placeholder={titleFieldLabel}
            />
            <div className="w-full h-px bg-gray-100 dark:bg-dark-border/50 my-8" />
            <div className="relative flex-1">
              <NikoEditor
                key={currentProjectId ?? '__no-project__'}
                initialContent={contentLoaded
                  ? (currentChapterId && editorStateCache.has(currentChapterId)
                    ? editorStateCache.get(currentChapterId)?.json ?? chapterContent
                    : chapterContent || undefined)
                  : undefined}
                onOpenWritingHelper={onOpenWritingHelper}
                onOpenSettings={onOpenSettings}
                onUpdate={handleEditorUpdate}
                onSave={handleSave}
              />
              {isEditorEmpty && currentChapterId && (
                <EmptyEditorGuide
                  onAIContinue={() => { getEditorHandle()?.triggerAIContinue() }}
                  onAddCharacter={onOpenCharacterPanel ?? (() => {})}
                  onFromTemplate={onOpenTemplateBrowser ?? (() => {})}
                />
              )}
            </div>
          </div>

          <Suspense fallback={<div className="h-32" />}>
            <StoryBiblePanel />
          </Suspense>
        </div>

        {/* Status Bar */}
        <div className="shell-text-compact flex items-center justify-between h-7 px-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/80 dark:bg-dark-surface2/20 text-gray-400 dark:text-dark-text-muted shrink-0">
          <div className="flex items-center gap-4">
            {aiGenerating && (
              <span className="flex items-center gap-1.5 text-primary-500 dark:text-primary-400">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                {t.editorAiGenerating}
              </span>
            )}
            <span>{t.editorWordCount}: {stats.words.toLocaleString()}</span>
            <span>{t.editorCharCount}: {stats.chars.toLocaleString()}</span>
            <span>{t.editorReadingTime.replace('{min}', String(stats.readingTime))}</span>
          </div>
          <div className="flex items-center gap-3">
            {editorJson && (
              <>
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="hover:text-primary-500 transition-colors"
                >
                  {t.exportDialogTitle}
                </button>
                {showExportDialog && (
                  <ExportDialog
                    editorJson={editorJson}
                    title={title}
                    onClose={() => setShowExportDialog(false)}
                  />
                )}
              </>
            )}
            <button
              onClick={toggleHistoryPanel}
              className={`hover:text-primary-500 transition-colors ${historyPanelOpen ? 'text-primary-500' : ''}`}
            >
              History
            </button>
            {saveStatus === 'saving' && (
              <span>{t.editorStatusSaving}</span>
            )}
            {saveStatus === 'saved' && saveTime && (
              <span className="text-green-500 dark:text-green-400 animate-fade-in">
                {t.editorStatusSavedAt.replace('{time}', saveTime)}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-500 dark:text-red-400 animate-fade-in">
                {t.editorStatusError}
              </span>
            )}
          </div>
        </div>
      </div>

      <HistoryPanel />
    </div>
  )
}
