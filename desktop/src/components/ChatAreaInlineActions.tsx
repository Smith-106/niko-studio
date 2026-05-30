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

const actionBtnClass = (active: boolean) =>
  `px-2.5 py-1.5 text-xs rounded-lg transition-all duration-200 active:scale-95 ${
    active
      ? 'bg-blue-600 text-white bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/30 shadow-sm'
      : 'bg-gray-200 bg-dark-surface2 text-dark-text-secondary hover:bg-dark-surface hover:text-dark-text'
  }`

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
    <div className="mb-3 rounded-lg border border-dark-border bg-dark-surface p-2.5 animate-fade-in">
      <div className="text-xs text-dark-text-secondary mb-2">{selectedTextInfo}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelectAction('continue')}
          className={actionBtnClass(inlineAction === 'continue')}
          type="button"
        >
          {continueLabel}
        </button>
        <button
          onClick={() => onSelectAction('revise')}
          disabled={!selectedText}
          className={`${actionBtnClass(inlineAction === 'revise')} disabled:opacity-50 disabled:cursor-not-allowed`}
          type="button"
        >
          {reviseLabel}
        </button>
        <button
          onClick={() => onSelectAction('generate')}
          className={actionBtnClass(inlineAction === 'generate')}
          type="button"
        >
          {generateLabel}
        </button>
        <button
          onClick={onRun}
          disabled={runDisabled}
          className="px-2.5 py-1.5 text-xs rounded-lg bg-primary-600 text-white transition-all duration-200 active:scale-95 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
          type="button"
        >
          {runLabel}
        </button>
        <button
          onClick={onClear}
          className="px-2.5 py-1.5 text-xs rounded-lg bg-dark-surface2 text-dark-text-secondary hover:bg-dark-surface hover:text-dark-text transition-all duration-200"
          type="button"
        >
          {clearSelectionLabel}
        </button>
      </div>
    </div>
  )
})
