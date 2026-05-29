import { useWritingContextStore } from '@/stores/writingContextStore'
import { BookOpen, Check, Loader2 } from 'lucide-react'
import { AiContextSelector } from './AiContextSelector'

export function WritingContextPanel() {
  const {
    contextNotes,
    aiSelectedNoteIds,
    recommendationsLoading,
    searchQuery,
    setSearchQuery,
    toggleNoteForAi,
  } = useWritingContextStore()

  const filteredNotes = contextNotes.filter(
    (n) =>
      searchQuery === '' ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200 mb-2">写作上下文</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索相关笔记..."
          className="w-full bg-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {recommendationsLoading && (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-sm">加载推荐笔记...</span>
          </div>
        )}

        {!recommendationsLoading && filteredNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <BookOpen size={24} className="mb-2 opacity-50" />
            <span className="text-sm">暂无相关笔记</span>
            <span className="text-xs mt-1">连接 Obsidian Vault 后将自动推荐</span>
          </div>
        )}

        {filteredNotes.map((note) => {
          const isSelected = aiSelectedNoteIds.includes(note.id)
          return (
            <div
              key={note.id}
              className={`px-3 py-2 border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${
                isSelected ? 'bg-blue-900/20' : ''
              }`}
              onClick={() => toggleNoteForAi(note.id)}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                  }`}
                >
                  {isSelected && <Check size={10} className="text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-200 truncate">{note.title}</div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">{note.preview}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        note.source === 'obsidian'
                          ? 'bg-purple-900/30 text-purple-400'
                          : note.source === 'ai-recommendation'
                            ? 'bg-pink-900/30 text-pink-400'
                            : 'bg-blue-900/30 text-blue-400'
                      }`}
                    >
                      {note.source === 'obsidian'
                        ? 'Obsidian'
                        : note.source === 'ai-recommendation'
                          ? 'AI 推荐'
                          : 'Niko'}
                    </span>
                    <span className="text-xs text-gray-600">{note.tokenCount} tokens</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {aiSelectedNoteIds.length > 0 && <AiContextSelector />}
    </div>
  )
}
