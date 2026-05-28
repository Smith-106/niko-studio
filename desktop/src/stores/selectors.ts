import { useAppStore, Conversation, Message, type AppState } from './appStore'
import { useSettingsStore } from './settingsStore'
import { useShallow } from 'zustand/react/shallow'

export type EvaluationSourceKind = 'latestAssistantReply' | 'editorSelection' | 'currentDraft'

export interface EvaluationSourceDescriptor {
  kind: EvaluationSourceKind
  label: string
  content: string
}

/**
 * Selector for current conversation ID only
 * Re-renders only when currentConversationId changes
 */
export function useCurrentConversationId(): string | null {
  return useAppStore((state) => state.currentConversationId)
}

/**
 * Selector for current conversation object
 * Re-renders only when the current conversation changes
 */
export function useCurrentConversation(): Conversation | undefined {
  return useAppStore((state) => {
    const { currentConversationId, conversationsById } = state
    if (!currentConversationId) return undefined
    return conversationsById[currentConversationId]
  })
}

/**
 * Selector for messages of current conversation
 * Re-renders only when messages array reference changes
 */
export function useMessages(): Message[] {
  return useAppStore((state) => {
    const { currentConversationId, conversationsById } = state
    if (!currentConversationId) return []
    return conversationsById[currentConversationId]?.messages || []
  })
}

/**
 * Selector for latest assistant message content
 */
export function useLatestAssistantMessageContent(): string {
  return useAppStore((state) => {
    const { currentConversationId, conversationsById } = state
    if (!currentConversationId) return ''

    const messages = conversationsById[currentConversationId]?.messages || []
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'assistant') {
        return messages[index]?.content || ''
      }
    }

    return ''
  })
}

/**
 * Selector for conversation list (for sidebar)
 * Uses shallow comparison to prevent unnecessary re-renders
 */
export function useConversationList(): Conversation[] {
  return useAppStore(
    useShallow(
      (state) => state.allConversationIds.map((id) => state.conversationsById[id]).filter(Boolean) as Conversation[]
    )
  )
}

/**
 * Selector for workflow level
 */
export function useWorkflowLevel(): 'L1' | 'L2' | 'L3' | 'L4' | 'L5' {
  return useSettingsStore((state) => state.settings.defaultWorkflowLevel)
}

/**
 * Selector for LLM fallback toggle
 */
export function useAllowLlmFallback(): boolean {
  return useSettingsStore((state) => state.settings.allowLlmFallback)
}

/**
 * Selector for quality goals
 */
export function useQualityGoals() {
  return useSettingsStore((state) => state.settings.qualityGoals)
}

/**
 * Selector for selected skills
 * Uses shallow comparison for array
 */
export function useSelectedSkills(): string[] {
  return useAppStore(useShallow((state) => state.selectedSkills))
}

export function useAvailableSkills(): string[] {
  return useAppStore(useShallow((state) => state.availableSkills))
}

export function useCreateConversation(): AppState['createConversation'] {
  return useAppStore((state) => state.createConversation)
}

export function useAddMessage(): AppState['addMessage'] {
  return useAppStore((state) => state.addMessage)
}

export function useSelectConversation(): AppState['selectConversation'] {
  return useAppStore((state) => state.selectConversation)
}

export function useCheckBackend(): AppState['checkBackend'] {
  return useAppStore((state) => state.checkBackend)
}

export function useBackendStatus(): AppState['backendStatus'] {
  return useAppStore((state) => state.backendStatus)
}

// ── Batched selectors with useShallow ─────────────────────────────
// Group related selectors into single calls to reduce re-render checks.
// Object-returning selectors use useShallow for shallow comparison.

/**
 * Batched selector for project sidebar state.
 * Returns all project navigation data in a single subscription.
 */
export function useProjectSidebarState() {
  return useAppStore(
    useShallow((state) => ({
      projectsById: state.projectsById,
      allProjectIds: state.allProjectIds,
      currentProjectId: state.currentProjectId,
      volumesByProjectId: state.volumesByProjectId,
      chaptersByVolumeId: state.chaptersByVolumeId,
      currentChapterId: state.currentChapterId,
      sidebarExpanded: state.sidebarExpanded,
      toggleSidebar: state.toggleSidebar,
      selectProject: state.selectProject,
      selectChapter: state.selectChapter,
      addVolume: state.addVolume,
      addChapter: state.addChapter,
      createNewProject: state.createNewProject,
      editorIsDirty: state.editorIsDirty,
      setEditorIsDirty: state.setEditorIsDirty,
    }))
  )
}

/**
 * Batched selector for document editor state.
 * Groups primitive values and action references that are used together.
 */
export function useDocumentEditorState() {
  return useAppStore(
    useShallow((state) => ({
      currentChapterId: state.currentChapterId,
      currentProjectId: state.currentProjectId,
      currentConversationId: state.currentConversationId,
      currentConversationTitle: state.currentConversationId
        ? state.conversationsById[state.currentConversationId]?.title ?? null
        : null,
      updateConversationTitle: state.updateConversationTitle,
      historyPanelOpen: state.historyPanelOpen,
      toggleHistoryPanel: state.toggleHistoryPanel,
      sessionIntelligenceEnabled: state.sessionIntelligenceEnabled,
      setSessionIntelligenceSummary: state.setSessionIntelligenceSummary,
      setSessionIntelligenceInsights: state.setSessionIntelligenceInsights,
      setSessionIntelligenceSessionId: state.setSessionIntelligenceSessionId,
      personalizedCraftEnabled: state.personalizedCraftEnabled,
      setPersonalizedCraftSummary: state.setPersonalizedCraftSummary,
      setPersonalizedCraftTrajectory: state.setPersonalizedCraftTrajectory,
      setPersonalizedCraftRecommendations: state.setPersonalizedCraftRecommendations,
      setEditorIsDirty: state.setEditorIsDirty,
    }))
  )
}

/**
 * Batched selector for history panel state.
 * Groups intelligence and craft state used in the history panel.
 */
export function useHistoryPanelState() {
  return useAppStore(
    useShallow((state) => ({
      currentProjectId: state.currentProjectId,
      currentChapterId: state.currentChapterId,
      historyPanelOpen: state.historyPanelOpen,
      toggleHistoryPanel: state.toggleHistoryPanel,
      sessionIntelligenceEnabled: state.sessionIntelligenceEnabled,
      sessionIntelligenceSummary: state.sessionIntelligenceSummary,
      sessionIntelligenceInsights: state.sessionIntelligenceInsights,
      sessionIntelligenceSessionId: state.sessionIntelligenceSessionId,
      setSessionIntelligenceEnabled: state.setSessionIntelligenceEnabled,
      personalizedCraftEnabled: state.personalizedCraftEnabled,
      personalizedCraftSummary: state.personalizedCraftSummary,
      personalizedCraftTrajectory: state.personalizedCraftTrajectory,
      personalizedCraftRecommendations: state.personalizedCraftRecommendations,
      setPersonalizedCraftEnabled: state.setPersonalizedCraftEnabled,
    }))
  )
}

/**
 * Batched selector for writing helper panel skills state.
 * Uses useShallow for array comparison.
 */
export function useWritingHelperSkillsState() {
  return useAppStore(
    useShallow((state) => ({
      selectedSkills: state.selectedSkills,
      availableSkills: state.availableSkills,
      toggleSkill: state.toggleSkill,
      personalizedCraftSummary: state.personalizedCraftSummary,
      personalizedCraftTrajectory: state.personalizedCraftTrajectory,
      personalizedCraftRecommendations: Array.isArray(state.personalizedCraftRecommendations)
        ? state.personalizedCraftRecommendations
        : [],
    }))
  )
}

/**
 * Batched selector for ChatArea settings from useSettingsStore.
 * Groups settings fields that ChatArea reads together.
 */
export function useChatAreaSettings() {
  return useSettingsStore(
    useShallow((state) => ({
      settings: state.settings,
      toggleTemplateFavorite: state.toggleTemplateFavorite,
      recordTemplateUsage: state.recordTemplateUsage,
      setTemplateVariablePreset: state.setTemplateVariablePreset,
    }))
  )
}

/**
 * Batched selector for evaluation panel settings.
 */
export function useEvaluationSettings() {
  return useSettingsStore(
    useShallow((state) => ({
      qualityGoals: state.settings.qualityGoals,
      detectionEvasionGuardEnabled: state.settings.detectionEvasionGuardEnabled,
    }))
  )
}
