import React from 'react'

interface ChatAreaInlineActionsProps {
  selectedText: string
  inlineAction: 'continue' | 'revise' | 'generate' | null
  selectedTextInfo: string
  continueLabel: string
  reviseLabel: string
  generateLabel: string
  runLabel: string
  clearSelectionLabel: string
  runDisabled: boolean
  onSelectAction: (action: 'continue' | 'revise' | 'generate') => void
  onRun: () => void
  onClear: () => void
}

export const ChatAreaInlineActions = React.memo(function ChatAreaInlineActionsComponent({
  selectedText,
  inlineAction,
  selectedTextInfo,
  continueLabel,
  reviseLabel,
  generateLabel,
  runLabel,
  clearSelectionLabel,
  runDisabled,
  onSelectAction,
  onRun,
  onClear,
}: ChatAreaInlineActionsProps) {
  return (
    <div className="mb-3 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-2">
      <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">{selectedTextInfo}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelectAction('continue')}
          className={`px-2 py-1 text-xs rounded ${inlineAction === 'continue' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'}`}
          type="button"
        >
          {continueLabel}
        </button>
        <button
          onClick={() => onSelectAction('revise')}
          disabled={!selectedText}
          className={`px-2 py-1 text-xs rounded ${inlineAction === 'revise' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'} disabled:opacity-50`}
          type="button"
        >
          {reviseLabel}
        </button>
        <button
          onClick={() => onSelectAction('generate')}
          className={`px-2 py-1 text-xs rounded ${inlineAction === 'generate' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'}`}
          type="button"
        >
          {generateLabel}
        </button>
        <button
          onClick={onRun}
          disabled={runDisabled}
          className="px-2 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50"
          type="button"
        >
          {runLabel}
        </button>
        <button
          onClick={onClear}
          className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text"
          type="button"
        >
          {clearSelectionLabel}
        </button>
      </div>
    </div>
  )
})
