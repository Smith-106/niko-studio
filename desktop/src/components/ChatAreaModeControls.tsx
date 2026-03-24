import { useEffect, useState } from 'react'

interface ChatModePreset {
  id: 'focusWriting' | 'agentDiagnose' | 'compareReview'
  label: string
}

interface ChatAreaModeControlsProps {
  modeLabel: string
  workflowLabel: string
  modePresetsLabel: string
  selectedSkillsLabel?: string
  chatMode: 'chat' | 'agent'
  agentAction: 'write' | 'revise' | 'context'
  enableModelComparison: boolean
  comparisonModel: string
  comparisonModels: string[]
  workflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  chatModeNormalLabel: string
  chatModeAgentLabel: string
  chatModeComparisonLabel: string
  templateLibraryEntryLabel: string
  comparisonModelLabel: string
  chatAgentActionWriteLabel: string
  chatAgentActionReviseLabel: string
  chatAgentActionContextLabel: string
  workflowQuickLabel: string
  workflowLiteLabel: string
  workflowStandardLabel: string
  workflowBrainstormLabel: string
  workflowCoordinatorLabel: string
  showMoreLabel: string
  showLessLabel: string
  modePresets: ChatModePreset[]
  onSetChatMode: (mode: 'chat' | 'agent') => void
  onToggleModelComparison: () => void
  onOpenTemplateLibrary: () => void
  onSetComparisonModel: (model: string) => void
  onSetAgentAction: (action: 'write' | 'revise' | 'context') => void
  onSetWorkflowLevel: (level: 'L1' | 'L2' | 'L3' | 'L4' | 'L5') => void
  onApplyPreset: (presetId: ChatModePreset['id']) => void
}

export function ChatAreaModeControls({
  modeLabel,
  workflowLabel,
  modePresetsLabel,
  selectedSkillsLabel,
  chatMode,
  agentAction,
  enableModelComparison,
  comparisonModel,
  comparisonModels,
  workflowLevel,
  chatModeNormalLabel,
  chatModeAgentLabel,
  chatModeComparisonLabel,
  templateLibraryEntryLabel,
  comparisonModelLabel,
  chatAgentActionWriteLabel,
  chatAgentActionReviseLabel,
  chatAgentActionContextLabel,
  workflowQuickLabel,
  workflowLiteLabel,
  workflowStandardLabel,
  workflowBrainstormLabel,
  workflowCoordinatorLabel,
  showMoreLabel,
  showLessLabel,
  modePresets,
  onSetChatMode,
  onToggleModelComparison,
  onOpenTemplateLibrary,
  onSetComparisonModel,
  onSetAgentAction,
  onSetWorkflowLevel,
  onApplyPreset,
}: ChatAreaModeControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(chatMode === 'agent' || enableModelComparison || workflowLevel !== 'L1')

  useEffect(() => {
    if (chatMode === 'agent' || enableModelComparison || workflowLevel !== 'L1') {
      setShowAdvanced(true)
    }
  }, [chatMode, enableModelComparison, workflowLevel])

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-dark-border dark:bg-dark-surface/80 backdrop-blur-sm shadow-sm transition-all animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mr-1">{modeLabel}</span>
        <button
          onClick={() => onSetChatMode('chat')}
          aria-label={chatModeNormalLabel}
          title={chatModeNormalLabel}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 ${
            chatMode === 'chat'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text'
          }`}
          type="button"
        >
          {chatModeNormalLabel}
        </button>
        <button
          onClick={() => onSetChatMode('agent')}
          aria-label={chatModeAgentLabel}
          title={chatModeAgentLabel}
          className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 ${
            chatMode === 'agent'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text'
          }`}
          type="button"
        >
          {chatModeAgentLabel}
        </button>
        <button
          onClick={onOpenTemplateLibrary}
          aria-label={templateLibraryEntryLabel}
          title={templateLibraryEntryLabel}
          className="px-4 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text"
          type="button"
        >
          {templateLibraryEntryLabel}
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="ml-auto px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-full transition-all bg-gray-50 dark:bg-dark-bg text-gray-500 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface2 active:scale-95 border border-gray-100 dark:border-dark-border/50"
        >
          {showAdvanced ? showLessLabel : showMoreLabel}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mr-1">{modePresetsLabel}</span>
        {modePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset.id)}
            className="px-4 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-300 dark:hover:bg-primary-900/40 border border-primary-100 dark:border-primary-500/20"
          >
            {preset.label}
          </button>
        ))}
        {selectedSkillsLabel ? (
          <span className="text-xs font-medium text-primary-600 dark:text-primary-400 ml-2 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-full border border-primary-100 dark:border-primary-500/20">{selectedSkillsLabel}</span>
        ) : null}
      </div>

      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border/50 space-y-4 animate-fade-in">
          <div className="flex flex-wrap items-center gap-2">
            {chatMode === 'chat' ? (
              <>
                <button
                  onClick={onToggleModelComparison}
                  aria-label={chatModeComparisonLabel}
                  title={chatModeComparisonLabel}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 ${
                    enableModelComparison
                      ? 'bg-success-500 text-white shadow-md'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text'
                  }`}
                  type="button"
                >
                  {chatModeComparisonLabel}
                </button>
                {enableModelComparison && (
                  <select
                    aria-label={comparisonModelLabel}
                    value={comparisonModel}
                    onChange={(event) => onSetComparisonModel(event.target.value)}
                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                  >
                    {comparisonModels.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mr-1">{chatModeAgentLabel}</span>
                <select
                  aria-label={chatModeAgentLabel}
                  value={agentAction}
                  onChange={(event) => onSetAgentAction(event.target.value as 'write' | 'revise' | 'context')}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
                >
                  <option value="write">{chatAgentActionWriteLabel}</option>
                  <option value="revise">{chatAgentActionReviseLabel}</option>
                  <option value="context">{chatAgentActionContextLabel}</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mr-1">{workflowLabel}</span>
            <div className="flex flex-wrap gap-2">
              {([
                { level: 'L1' as const, label: workflowQuickLabel },
                { level: 'L2' as const, label: workflowLiteLabel },
                { level: 'L3' as const, label: workflowStandardLabel },
                { level: 'L4' as const, label: workflowBrainstormLabel },
                { level: 'L5' as const, label: workflowCoordinatorLabel },
              ]).map(({ level, label }) => (
                <button
                  key={level}
                  onClick={() => onSetWorkflowLevel(level)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 ${
                    workflowLevel === level
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text'
                  }`}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
