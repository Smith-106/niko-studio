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
    <div className="mb-3 rounded-2xl border border-gray-200 bg-white/80 p-3 dark:border-dark-border dark:bg-dark-surface/80">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-dark-text-secondary">{modeLabel}</span>
        <button
          onClick={() => onSetChatMode('chat')}
          aria-label={chatModeNormalLabel}
          title={chatModeNormalLabel}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            chatMode === 'chat'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          type="button"
        >
          {chatModeNormalLabel}
        </button>
        <button
          onClick={() => onSetChatMode('agent')}
          aria-label={chatModeAgentLabel}
          title={chatModeAgentLabel}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            chatMode === 'agent'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          type="button"
        >
          {chatModeAgentLabel}
        </button>
        <button
          onClick={onOpenTemplateLibrary}
          aria-label={templateLibraryEntryLabel}
          title={templateLibraryEntryLabel}
          className="px-3 py-1 text-xs rounded-full transition-colors bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600"
          type="button"
        >
          {templateLibraryEntryLabel}
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="ml-auto px-3 py-1 text-xs rounded-full transition-colors bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {showAdvanced ? showLessLabel : showMoreLabel}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-dark-text-secondary">{modePresetsLabel}</span>
        {modePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset.id)}
            className="px-3 py-1 text-xs rounded-full transition-colors bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            {preset.label}
          </button>
        ))}
        {selectedSkillsLabel ? (
          <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">{selectedSkillsLabel}</span>
        ) : null}
      </div>

      {showAdvanced && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {chatMode === 'chat' ? (
              <>
                <button
                  onClick={onToggleModelComparison}
                  aria-label={chatModeComparisonLabel}
                  title={chatModeComparisonLabel}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    enableModelComparison
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'
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
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded"
                  >
                    {comparisonModels.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <select
                aria-label={chatModeAgentLabel}
                value={agentAction}
                onChange={(event) => onSetAgentAction(event.target.value as 'write' | 'revise' | 'context')}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded"
              >
                <option value="write">{chatAgentActionWriteLabel}</option>
                <option value="revise">{chatAgentActionReviseLabel}</option>
                <option value="context">{chatAgentActionContextLabel}</option>
              </select>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-dark-text-secondary">{workflowLabel}</span>
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
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  workflowLevel === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
