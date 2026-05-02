import React from 'react'

interface ChatModePreset {
  id: 'focusWriting' | 'agentDiagnose' | 'compareReview'
  label: string
}

interface ChatAreaModeControlsProps {
  modeLabel: string
  modePresetsLabel: string
  selectedSkillsLabel?: string
  availableSkillIds?: string[]
  selectedSkillIds?: string[]
  skillPacksLabel?: string
  chatMode: 'chat' | 'agent'
  agentAction: 'write' | 'revise' | 'context'
  enableModelComparison: boolean
  chatModeNormalLabel: string
  chatModeAgentLabel: string
  chatModeComparisonLabel: string
  templateLibraryEntryLabel: string
  chatAgentActionWriteLabel: string
  chatAgentActionReviseLabel: string
  chatAgentActionContextLabel: string
  modePresets: ChatModePreset[]
  onOpenTemplateLibrary: () => void
  onSetComparisonModel: (model: string) => void
  onSetAgentAction: (action: 'write' | 'revise' | 'context') => void
  onApplyPreset: (presetId: ChatModePreset['id']) => void
  onToggleSkill?: (skillId: string) => void
}

export const ChatAreaModeControls = React.memo(function ChatAreaModeControls({
  modeLabel,
  modePresetsLabel,
  selectedSkillsLabel,
  availableSkillIds,
  selectedSkillIds,
  skillPacksLabel,
  chatMode,
  agentAction,
  enableModelComparison,
  chatModeNormalLabel,
  chatModeAgentLabel,
  chatModeComparisonLabel,
  templateLibraryEntryLabel,
  chatAgentActionWriteLabel,
  chatAgentActionReviseLabel,
  chatAgentActionContextLabel,
  modePresets,
  onOpenTemplateLibrary,
  onApplyPreset,
  onToggleSkill,
}: ChatAreaModeControlsProps) {
  const activeAgentActionLabel = agentAction === 'write'
    ? chatAgentActionWriteLabel
    : agentAction === 'revise'
      ? chatAgentActionReviseLabel
      : chatAgentActionContextLabel

  const activeModeSummary = enableModelComparison
    ? chatModeComparisonLabel
    : chatMode === 'agent'
      ? `${chatModeAgentLabel} · ${activeAgentActionLabel}`
      : chatModeNormalLabel

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-dark-border dark:bg-dark-surface/80 backdrop-blur-sm shadow-sm transition-all animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mr-1">{modeLabel}</span>
        <span className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:border-primary-500/20 dark:bg-primary-900/20 dark:text-primary-300">
          {activeModeSummary}
        </span>
        <button
          onClick={onOpenTemplateLibrary}
          aria-label={templateLibraryEntryLabel}
          title={templateLibraryEntryLabel}
          className="px-4 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text"
          type="button"
        >
          {templateLibraryEntryLabel}
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

      {availableSkillIds && availableSkillIds.length > 0 && onToggleSkill && skillPacksLabel ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mr-1">{skillPacksLabel}</span>
          {availableSkillIds.slice(0, 8).map((skillId) => {
            const selected = selectedSkillIds?.includes(skillId) ?? false
            return (
              <button
                key={skillId}
                type="button"
                onClick={() => onToggleSkill(skillId)}
                aria-pressed={selected}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all active:scale-95 border ${
                  selected
                    ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text border-gray-200 dark:border-dark-border'
                }`}
              >
                {skillId}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})
