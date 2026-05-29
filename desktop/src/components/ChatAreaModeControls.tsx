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
    <div className="mb-3 rounded-xl border border-gray-200 bg-white/80 dark:border-dark-border dark:bg-dark-surface/80 backdrop-blur-sm shadow-sm">
      {/* Mode + Presets — compact single-row */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        <span className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 dark:border-primary-500/20 dark:bg-primary-900/20 dark:text-primary-300">
          {activeModeSummary}
        </span>
        {modePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset.id)}
            className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-all active:scale-95 bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text"
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={onOpenTemplateLibrary}
          aria-label={templateLibraryEntryLabel}
          title={templateLibraryEntryLabel}
          className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-all active:scale-95 bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text"
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
            className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text transition-colors"
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
            <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5">
              {availableSkillIds.slice(0, 8).map((skillId) => {
                const selected = selectedSkillIds?.includes(skillId) ?? false
                return (
                  <button
                    key={skillId}
                    type="button"
                    onClick={() => onToggleSkill(skillId)}
                    aria-pressed={selected}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all active:scale-95 border ${
                      selected
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text border-gray-200 dark:border-dark-border'
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
