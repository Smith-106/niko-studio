import { useWritingContextStore } from '@/stores/writingContextStore'
import { Send, X } from 'lucide-react'

const TOKEN_BUDGET = 4000

export function AiContextSelector() {
  const { contextNotes, aiSelectedNoteIds, getSelectedTokenCount, clearAiSelection } =
    useWritingContextStore()

  const totalTokens = getSelectedTokenCount()
  const tokenPercent = Math.min(100, (totalTokens / TOKEN_BUDGET) * 100)
  const isOverBudget = totalTokens > TOKEN_BUDGET

  const applyContext = () => {
    // Dispatch event for ChatAreaComposer to pick up
    window.dispatchEvent(
      new CustomEvent('ai-context-apply', {
        detail: {
          noteIds: aiSelectedNoteIds,
          tokenCount: totalTokens,
        },
      }),
    )
  }

  return (
    <div className="p-3 border-t border-gray-700 bg-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">
          已选 {aiSelectedNoteIds.length} 篇笔记 ({totalTokens} tokens)
        </span>
        <button
          onClick={clearAiSelection}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          <X size={12} />
        </button>
      </div>

      <div className="w-full h-1.5 bg-gray-700 rounded-full mb-2">
        <div
          className={`h-full rounded-full transition-all ${
            isOverBudget ? 'bg-red-500' : tokenPercent > 80 ? 'bg-yellow-500' : 'bg-blue-500'
          }`}
          style={{ width: `${Math.min(100, tokenPercent)}%` }}
        />
      </div>

      <button
        onClick={applyContext}
        disabled={aiSelectedNoteIds.length === 0 || isOverBudget}
        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send size={12} />
        应用到 AI 对话
      </button>

      {isOverBudget && (
        <p className="text-xs text-red-400 mt-1">超出 token 预算，请减少选择</p>
      )}
    </div>
  )
}
