import React from 'react'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'

/**
 * 从 ChatArea 中提取：写作上下文展示条
 * 原因：仅依赖 writerWorkspaceSummary，独立于流式状态和消息列表，避免不必要的重渲染
 */
interface ChatContextBarProps {
  writerContextTitle: string
  writerContextHint: string
}

export const ChatContextBar = React.memo(function ChatContextBar({
  writerContextTitle,
  writerContextHint,
}: ChatContextBarProps) {
  const writerWorkspaceSummary = useWriterWorkspaceSummary()

  if (!writerWorkspaceSummary.hasMeaningfulScope) return null

  return (
    <div className="mb-4 rounded-2xl border border-primary-100 bg-white/90 p-4 shadow-sm dark:border-primary-500/20 dark:bg-dark-surface/80">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
        {writerContextTitle}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {writerWorkspaceSummary.scopeChips.map((chip) => (
          <span
            key={`writer-scope-${chip}`}
            className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
          >
            {chip}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
        {writerContextHint}
      </p>
    </div>
  )
})