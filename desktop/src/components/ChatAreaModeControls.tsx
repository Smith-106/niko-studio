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

const MODE_VISUAL: Record<'chat-write' | 'chat-comparison' | 'agent-write' | 'agent-revise' | 'agent-context', { dotColor: string; labelKey: string }> = {
  'chat-write': { dotColor: 'bg-primary-500', labelKey: 'normal' },
  'chat-comparison': { dotColor: 'bg-amber-500', labelKey: 'comparison' },
  'agent-write': { dotColor: 'bg-green-500', labelKey: 'write' },
  'agent-revise': { dotColor: 'bg-cyan-500', labelKey: 'revise' },
  'agent-context': { dotColor: 'bg-violet-500', labelKey: 'context' },
}

function getModeKey(chatMode: 'chat' | 'agent', enableModelComparison: boolean, agentAction: 'write' | 'revise' | 'context'): keyof typeof MODE_VISUAL {
  if (enableModelComparison) return 'chat-comparison'
  if (chatMode === 'agent') return `agent-${agentAction}`
  return 'chat-write'
}

export const ChatAreaModeControls = React.memo(function ChatAreaModeControls({
  modeLabel: _modeLabel,
  modePresetsLabel: _modePresetsLabel,
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
  const [skillsExpanded, setSkillsExpanded] = useState(false)

  const activeAgentActionLabel = agentAction === 'write'
    ? chatAgentActionWriteLabel
    : agentAction === 'revise'
      ? chatAgentActionReviseLabel
      : chatAgentActionContextLabel

  const modeKey = getModeKey(chatMode, enableModelComparison, agentAction)
  const modeVisual = MODE_VISUAL[modeKey]
  const activeModeSummary = enableModelComparison
    ? chatModeComparisonLabel
    : chatMode === 'agent'
      ? `${chatModeAgentLabel} · ${activeAgentActionLabel}`
      : chatModeNormalLabel

  const hasSkills = availableSkillIds && availableSkillIds.length > 0 && onToggleSkill && skillPacksLabel
  const activeSkillCount = selectedSkillIds?.length ?? 0

  return (
    <div className="mb-2 rounded-xl border border-gray-200 bg-white/80 dark:border-dark-border dark:bg-dark-surface/80 backdrop-blur-sm shadow-[var(--shadow-tiny)]">
      {/* Mode indicator + Presets — streamlined single row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-dark-bg px-2.5 py-1.5 text-[12px] font-semibold text-gray-800 dark:text-dark-text ring-1 ring-gray-200/80 dark:ring-dark-border shadow-[var(--shadow-tiny)]">
          <span className={`w-2 h-2 rounded-full ${modeVisual.dotColor} shadow-sm`} />
          {activeModeSummary}
          {selectedSkillsLabel && (
            <span className="ml-1 text-[10px] font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded-md">
              {selectedSkillsLabel}
            </span>
          )}
        </span>
        {modePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApplyPreset(preset.id)}
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all active:scale-95 bg-gray-50 hover:bg-gray-100 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary ring-1 ring-gray-200/80 dark:ring-dark-border/80 shadow-[var(--shadow-tiny)]"
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={onOpenTemplateLibrary}
          aria-label={templateLibraryEntryLabel}
          title={templateLibraryEntryLabel}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all active:scale-95 bg-gray-50 hover:bg-gray-100 dark:bg-dark-bg dark:hover:bg-dark-border text-gray-600 dark:text-dark-text-secondary ring-1 ring-gray-200/80 dark:ring-dark-border/80 shadow-[var(--shadow-tiny)]"
          type="button"
        >
          {templateLibraryEntryLabel}
        </button>
      </div>

      {/* Skills — collapsible with improved visual */}
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
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-[10px] font-bold w-4 h-4 leading-none shadow-sm">
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
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all active:scale-95 ${
                      selected
                        ? 'bg-primary-600 text-white ring-1 ring-primary-600 shadow-sm'
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
