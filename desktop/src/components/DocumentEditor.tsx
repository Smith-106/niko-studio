import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react'
import { useI18n } from '../i18n'
import { countWords, countChars, readingTimeMinutes } from '../utils/wordCount'
import { exportToMarkdown, exportToHtml } from '../utils/export'
const StoryBiblePanel = React.lazy(() => import('./StoryBiblePanel').then(m => ({ default: m.StoryBiblePanel })))
import { NikoEditor } from './NikoEditor'
import { getEditorHandle } from '../utils/editorHandle'
import { useDraftCache } from '../hooks/useDraftCache'
import { useAppStore } from '../stores/appStore'
import type { JSONContent } from '@tiptap/react'

interface DocumentEditorProps {
  onOpenWritingHelper: () => void
}

export function DocumentEditor({ onOpenWritingHelper }: DocumentEditorProps) {
  const { t, language } = useI18n()
  const currentConversationId = useAppStore((state) => state.currentConversationId)
  const currentConversationTitle = useAppStore((state) => (
    state.currentConversationId ? state.conversationsById[state.currentConversationId]?.title ?? null : null
  ))
  const updateConversationTitle = useAppStore((state) => state.updateConversationTitle)
  const { persistedText, persist } = useDraftCache(currentConversationId)
  const fallbackTitle = currentConversationTitle ?? t.appTitle ?? '未命名文档'
  const [title, setTitle] = useState(fallbackTitle)
  const [editorText, setEditorText] = useState('')
  const [editorJson, setEditorJson] = useState<JSONContent | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleFieldLabel = language === 'zh' ? '文档标题' : 'Document title'

  const stats = useMemo(() => ({
    words: countWords(editorText),
    chars: countChars(editorText),
    readingTime: readingTimeMinutes(editorText),
  }), [editorText])

  const handleEditorUpdate = useCallback((json: JSONContent, text: string) => {
    setEditorJson(json)
    setEditorText(text)
    persist(text)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 2000)
    }, 1500)
  }, [persist])

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
    setEditorText(persistedText)
    setEditorJson(null)
    setShowSaved(false)
  }, [persistedText, currentConversationId])

  return (
    <div className="flex-1 flex flex-col bg-transparent z-0 min-w-0 h-full">
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
            key={currentConversationId ?? '__global__'}
            initialContent={persistedText}
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
                onClick={() => exportToMarkdown(editorJson, title)}
                className="hover:text-primary-500 transition-colors"
              >
                {t.exportMarkdown}
              </button>
              <button
                onClick={() => exportToHtml(editorJson, title)}
                className="hover:text-primary-500 transition-colors"
              >
                {t.exportHtml}
              </button>
            </>
          )}
          {showSaved && (
            <span className="text-green-500 dark:text-green-400 animate-fade-in">{t.editorAutoSaved}</span>
          )}
        </div>
      </div>
    </div>
  )
}
