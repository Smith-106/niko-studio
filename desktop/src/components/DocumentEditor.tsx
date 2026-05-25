import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react'
import { useI18n } from '../i18n'
import { countWords, countChars, readingTimeMinutes } from '../utils/wordCount'
const StoryBiblePanel = React.lazy(() => import('./StoryBiblePanel').then(m => ({ default: m.StoryBiblePanel })))
import { NikoEditor } from './NikoEditor'
import { HistoryPanel } from './HistoryPanel'
import { ExportDialog } from './ExportDialog'
import { setGeneratingListener } from '../utils/editorHandle'
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
} from '../../../src-ts/analysis/personalized-craft-profile'

interface DocumentEditorProps {
  onOpenWritingHelper: () => void
}

export function DocumentEditor({ onOpenWritingHelper }: DocumentEditorProps) {
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
  } = useDocumentEditorState()
  const [chapterContent, setChapterContent] = useState<string>('')
  const [contentLoaded, setContentLoaded] = useState(false)
  const fallbackTitle = currentConversationTitle ?? t.appTitle ?? '未命名文档'
  const [title, setTitle] = useState(fallbackTitle)
  const [editorText, setEditorText] = useState('')
  const [editorJson, setEditorJson] = useState<JSONContent | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveTime, setSaveTime] = useState<string>('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const craftProfileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorTextRef = useRef<string>('')
  const telemetryRef = useRef<WritingSessionTelemetry | null>(null)
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
    setContentLoaded(false)
    readChapterContent(currentProjectId, currentChapterId).then((content) => {
      setChapterContent(content || JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }))
      setContentLoaded(true)
    })
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
    setSaveStatus('saving')
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
      // Persist to filesystem
      if (currentProjectId && currentChapterId) {
        writeChapterContent(currentProjectId, currentChapterId, JSON.stringify(json))
        autoSaveSnapshot(currentProjectId, currentChapterId)
      }
      updateSessionTelemetry({ type: 'save' })
      setTimeout(() => setSaveStatus('idle'), 4000)
    }, 1500)
  }, [currentProjectId, currentChapterId, updateSessionTelemetry])

  useEffect(() => {
    if (historyPanelOpen) {
      updateSessionTelemetry({ type: 'history_open' })
    }
  }, [historyPanelOpen, updateSessionTelemetry])

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
    setEditorText('')
    editorTextRef.current = ''
    setEditorJson(null)
    setSaveStatus('idle')
    if (craftProfileTimerRef.current) {
      clearTimeout(craftProfileTimerRef.current)
      craftProfileTimerRef.current = null
    }
  }, [currentChapterId])

  return (
    <div className="flex-1 flex min-w-0 h-full">
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
            <NikoEditor
              key={currentChapterId ?? currentConversationId ?? '__global__'}
              initialContent={contentLoaded ? (chapterContent || undefined) : undefined}
              onOpenWritingHelper={onOpenWritingHelper}
              onUpdate={handleEditorUpdate}
            />
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
          </div>
        </div>
      </div>

      <HistoryPanel />
    </div>
  )
}
