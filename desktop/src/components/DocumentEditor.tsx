import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react'
import { useI18n } from '../i18n'
import { countWords, countChars, readingTimeMinutes } from '../utils/wordCount'
const StoryBiblePanel = React.lazy(() => import('./StoryBiblePanel').then(m => ({ default: m.StoryBiblePanel })))
import { NikoEditor } from './NikoEditor'
import { HistoryPanel } from './HistoryPanel'
import { ExportDialog } from './ExportDialog'
import { getEditorHandle } from '../utils/editorHandle'
import { readChapterContent, writeChapterContent } from '../services/projectFileService'
import { autoSaveSnapshot } from '../services/versionService'
import { useAppStore } from '../stores/appStore'
import type { JSONContent } from '@tiptap/react'
import {
  applyTelemetryEvent,
  createWritingSessionTelemetry,
  summarizeWritingSessionTelemetry,
  type WritingSessionTelemetry,
} from '../utils/writingSessionTelemetry'

interface DocumentEditorProps {
  onOpenWritingHelper: () => void
}

export function DocumentEditor({ onOpenWritingHelper }: DocumentEditorProps) {
  const { t, language } = useI18n()
  const currentChapterId = useAppStore((state) => state.currentChapterId)
  const currentProjectId = useAppStore((state) => state.currentProjectId)
  const currentConversationId = useAppStore((state) => state.currentConversationId)
  const currentConversationTitle = useAppStore((state) => (
    state.currentConversationId ? state.conversationsById[state.currentConversationId]?.title ?? null : null
  ))
  const updateConversationTitle = useAppStore((state) => state.updateConversationTitle)
  const historyPanelOpen = useAppStore((state) => state.historyPanelOpen)
  const toggleHistoryPanel = useAppStore((state) => state.toggleHistoryPanel)
  const sessionIntelligenceEnabled = useAppStore((state) => state.sessionIntelligenceEnabled)
  const setSessionIntelligenceSummary = useAppStore((state) => state.setSessionIntelligenceSummary)
  const setSessionIntelligenceInsights = useAppStore((state) => state.setSessionIntelligenceInsights)
  const setSessionIntelligenceSessionId = useAppStore((state) => state.setSessionIntelligenceSessionId)
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
  }, [
    currentChapterId,
    currentConversationId,
    currentProjectId,
    sessionIntelligenceEnabled,
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

  // Poll editor AI generating state
  useEffect(() => {
    const id = setInterval(() => {
      const handle = getEditorHandle()
      setAiGenerating(handle?.isGenerating ?? false)
    }, 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    setTitle(fallbackTitle)
  }, [fallbackTitle, currentConversationId])

  useEffect(() => {
    setEditorText('')
    setEditorJson(null)
    setSaveStatus('idle')
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
