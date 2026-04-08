export const PERSISTED_SETTINGS_KEYS = [
  'apiBaseUrl',
  'apiKey',
  'llmProviders',
  'primaryProvider',
  'useMultiModel',
  'allowLlmFallback',
  'defaultModel',
  'temperature',
  'defaultWorkflowLevel',
  'workflowBackendMode',
  'targetWordsPerChapter',
  'autoSkillMatch',
  'detectionEvasionGuardEnabled',
  'writingHelperUseLegacyPolish',
  'qualityGoals',
  'retrieval',
  'contextTypes',
  'promptTemplateLibrary',
  'theme',
  'fontSize',
  'language',
  'sendShortcut',
] as const

export type PersistedSettingsKey = typeof PERSISTED_SETTINGS_KEYS[number]

export const WORKFLOW_UI_STATE_KEYS = [
  'sidebarCollapsed',
  'chatSidebarCollapsed',
  'activeRightPanel',
  'writingHelperDraft',
] as const

export const AUTHORITATIVE_PROJECT_STATE_KEYS = [
  'currentProjectId',
  'projectMetadata',
  'manuscript',
  'storyBible',
  'knowledgeGraph',
  'memoryEntries',
  'workflowContext',
] as const

// Legacy alias kept so earlier wave code and persisted assumptions keep compiling.
export const FUTURE_AUTHORITATIVE_PROJECT_STATE_KEYS = AUTHORITATIVE_PROJECT_STATE_KEYS

export const SETTINGS_OWNERSHIP_BOUNDARIES = {
  persistedSettings: 'Store only long-lived user preferences and workspace defaults in persisted settings.',
  workflowUiState: 'Desktop shell chrome and transient workflow UI state belong in app-scoped UI persistence, not settings.',
  authoritativeProjectState: 'Project and workspace authority belong in a dedicated project model, not persisted user preferences.',
} as const
