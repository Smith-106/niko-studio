import { useState } from 'react'
import { Sparkles, Wand2, RefreshCw } from 'lucide-react'
import { useI18n } from '../i18n'

interface DocumentEditorProps {
  onOpenWritingHelper: () => void
}

export function DocumentEditor({ onOpenWritingHelper }: DocumentEditorProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState(t.appTitle || 'Untitled Document')
  const [content, setContent] = useState('')

  return (
    <div className="flex-1 flex flex-col bg-transparent z-0 min-w-0 h-full">
      {/* Top Toolbar */}
      <div className="flex items-center justify-center h-12 border-b border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-surface2/30 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenWritingHelper}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
          >
            <Sparkles size={16} />
            AI Assist
          </button>
          <div className="w-px h-4 bg-gray-300 dark:bg-dark-border mx-2" />
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface rounded-md transition-colors">
            <Wand2 size={16} />
            Describe
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface rounded-md transition-colors">
            <RefreshCw size={16} />
            Rewrite
          </button>
        </div>
      </div>

      {/* Editor Canvas Area */}
      <div className="flex-1 flex flex-col items-center overflow-y-auto custom-scrollbar p-6 sm:p-10 bg-slate-50/50 dark:bg-[#0f0f0f]">
        <div className="w-full max-w-[850px] flex flex-col bg-white dark:bg-[#1a1a1a] shadow-sm ring-1 ring-gray-200/60 dark:ring-dark-border rounded-xl min-h-[85vh] p-12 sm:p-20 mb-12 transition-all">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none placeholder-gray-300 dark:placeholder-gray-700 tracking-tight"
            placeholder="Document Title"
          />
          <div className="w-full h-px bg-gray-100 dark:bg-dark-border/50 my-8" />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full flex-1 min-h-[60vh] text-lg md:text-[21px] leading-[1.8] text-gray-800 dark:text-gray-300 bg-transparent border-none outline-none resize-none custom-scrollbar placeholder-gray-300 dark:placeholder-gray-700 font-serif"
            placeholder="Start writing your masterpiece..."
          />
        </div>
      </div>
    </div>
  )
}
