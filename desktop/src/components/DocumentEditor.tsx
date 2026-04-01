import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '../i18n'
import { countWords, countChars, readingTimeMinutes } from '../utils/wordCount'
import { exportToMarkdown, exportToHtml } from '../utils/export'
import { StoryBiblePanel } from './StoryBiblePanel'
import { NikoEditor } from './NikoEditor'
import { getEditorHandle } from '../utils/editorHandle'
import type { JSONContent } from '@tiptap/react'

interface DocumentEditorProps {
  onOpenWritingHelper: () => void
}

export function DocumentEditor({ onOpenWritingHelper }: DocumentEditorProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState(t.appTitle || '未命名文档')
  const [editorText, setEditorText] = useState('')
  const [editorJson, setEditorJson] = useState<JSONContent | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stats = useMemo(() => ({
    words: countWords(editorText),
    chars: countChars(editorText),
    readingTime: readingTimeMinutes(editorText),
  }), [editorText])

  const handleEditorUpdate = useCallback((json: JSONContent, text: string) => {
    setEditorJson(json)
    setEditorText(text)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 2000)
    }, 1500)
  }, [])

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

  return (
    <div className="flex-1 flex flex-col bg-transparent z-0 min-w-0 h-full">
      {/* Editor Canvas Area */}
      <div className="flex-1 flex flex-col items-center overflow-y-auto custom-scrollbar p-6 sm:p-10 bg-slate-50/50 dark:bg-[#0f0f0f]">
        <div className="w-full max-w-[680px] flex flex-col bg-white dark:bg-[#1a1a1a] shadow-sm ring-1 ring-gray-200/60 dark:ring-dark-border rounded-xl min-h-[85vh] p-12 sm:p-20 mb-4 transition-all">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none placeholder-gray-300 dark:placeholder-gray-700 tracking-tight"
            placeholder="文档标题"
          />
          <div className="w-full h-px bg-gray-100 dark:bg-dark-border/50 my-8" />
          <NikoEditor
            onOpenWritingHelper={onOpenWritingHelper}
            onUpdate={handleEditorUpdate}
          />
        </div>

        <StoryBiblePanel />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between h-7 px-4 border-t border-gray-100 dark:border-dark-border bg-gray-50/80 dark:bg-dark-surface2/20 text-[11px] text-gray-400 dark:text-dark-text-muted shrink-0">
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
