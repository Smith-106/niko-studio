import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'

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
  modeLabel: _modeLabel,
  modePresetsLabel: _modePresetsLabel,
  selectedSkillsLabel: _selectedSkillsLabel,
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
  const [skillsExpanded, setSkillsExpanded] = useState(false)

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

  const hasSkills = availableSkillIds && availableSkillIds.length > 0 && onToggleSkill && skillPacksLabel
  const activeSkillCount = selectedSkillIds?.length ?? 0

  return (
    <div className="mb-2 rounded-lg border border-gray-200 bg-white/80 dark:border-dark-border dark:bg-dark-surface/80 backdrop-blur-sm">
      {/* Mode badge + Presets — single-row compact */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="inline-flex items-center rounded-md bg-primary-50 dark:bg-primary-900/20 px-2 py-1 text-[11px] font-semibold text-primary-700 dark:text-primary-300 ring-1 ring-primary-100 dark:ring-primary-500/20">
          {activeModeSummary}
        </span>
        {modePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset.id)}
            className="px-2 py-1 text-[11px] font-medium rounded-md transition-all active:scale-95 bg-gray-50 hover:bg-gray-100 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary ring-1 ring-gray-200/80 dark:ring-dark-border/80"
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={onOpenTemplateLibrary}
          aria-label={templateLibraryEntryLabel}
          title={templateLibraryEntryLabel}
          className="px-2 py-1 text-[11px] font-medium rounded-md transition-all active:scale-95 bg-gray-50 hover:bg-gray-100 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary ring-1 ring-gray-200/80 dark:ring-dark-border/80"
          type="button"
        >
          {templateLibraryEntryLabel}
        </button>
      </div>

      {/* Skills — collapsible */}
      {hasSkills && (
        <div className="border-t border-gray-100 dark:border-dark-border/50">
          <button
            type="button"
            onClick={() => setSkillsExpanded((prev) => !prev)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-dark-text-muted hover:text-gray-600 dark:hover:text-dark-text transition-colors"
          >
            {skillsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Sparkles size={12} />
            <span>{skillPacksLabel}</span>
            {activeSkillCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-[10px] font-bold w-4 h-4 leading-none">
                {activeSkillCount}
              </span>
            )}
          </button>
          {skillsExpanded && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
              {availableSkillIds.slice(0, 8).map((skillId) => {
                const selected = selectedSkillIds?.includes(skillId) ?? false
                return (
                  <button
                    key={skillId}
                    type="button"
                    onClick={() => onToggleSkill(skillId)}
                    aria-pressed={selected}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md transition-all active:scale-95 ${
                      selected
                        ? 'bg-primary-600 text-white ring-1 ring-primary-600'
                        : 'bg-gray-50 hover:bg-gray-100 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary ring-1 ring-gray-200/80 dark:ring-dark-border/80'
                    }`}
                  >
                    {skillId}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
