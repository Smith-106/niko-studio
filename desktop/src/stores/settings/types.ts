import type { BackendConfig } from '@/contracts/backendConfig'
import type { WorkflowBackendMode } from '@/contracts/runtimePreferences'

export type { WorkflowBackendMode } from '@/contracts/runtimePreferences'

export interface LLMProvider {
  id: string
  name: string
  enabled: boolean
  apiKey: string
  baseUrl: string
  models: string[]
  defaultModel: string
  fetchedModels?: string[]
  customModels?: string[]
  modelSelectionMode?: 'list' | 'custom'
  lastModelSyncAt?: string
}

export type PromptTemplateCategory = 'brainstorm' | 'outline' | 'character' | 'rewrite' | 'analysis' | 'custom'
export type ContextType = 'world' | 'character' | 'plot'
export type RetrievalSearchMode = 'hybrid' | 'iterative' | 'context'
export type SendShortcut = 'enter' | 'ctrlEnter'

export interface RetrievalSettings {
  enabled: boolean
  searchMode: RetrievalSearchMode
  profile: string
  minScore?: number
  budgetTokens?: number
  rerank: boolean
  maxIterations: number
  confidenceThreshold: number
}

export interface PromptTemplateVariable {
  id: string
  label: string
  required: boolean
  defaultValue?: string
  description?: string
}

export interface PromptTemplate {
  id: string
  title: string
  category: PromptTemplateCategory
  content: string
  variables: PromptTemplateVariable[]
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

export interface PromptTemplateLibrarySettings {
  version: number
  templates: PromptTemplate[]
  recentTemplateIds: string[]
  variablePresets: Record<string, Record<string, string>>
}

export type QualityPresetId = 'human_writing' | 'ai_edit_guidance' | 'custom'

export interface QualityGoalsSettings {
  naturalness: number
  readability: number
  coherence: number
  styleConsistency: number
  humanizationPreset: QualityPresetId
  customHumanizationInstruction: string
  sentenceEntropyTarget: number
  rhythmVariabilityTarget: number
}

export interface QualityPresetTemplate {
  id: Exclude<QualityPresetId, 'custom'>
  labelKey: 'qualityPresetHumanWriting' | 'qualityPresetAiEditGuidance'
  goals: Pick<QualityGoalsSettings, 'naturalness' | 'readability' | 'coherence' | 'styleConsistency'>
  sentenceEntropyTarget: number
  rhythmVariabilityTarget: number
}

export interface QualityGoalMetricField {
  key: keyof Pick<QualityGoalsSettings, 'naturalness' | 'readability' | 'coherence' | 'styleConsistency'>
  labelKey: 'qualityGoalNaturalness' | 'qualityGoalReadability' | 'qualityGoalCoherence' | 'qualityGoalStyleConsistency'
}

export const QUALITY_GOAL_METRIC_FIELDS: QualityGoalMetricField[] = [
  { key: 'naturalness', labelKey: 'qualityGoalNaturalness' },
  { key: 'readability', labelKey: 'qualityGoalReadability' },
  { key: 'coherence', labelKey: 'qualityGoalCoherence' },
  { key: 'styleConsistency', labelKey: 'qualityGoalStyleConsistency' },
]

export const QUALITY_PRESET_TEMPLATES: QualityPresetTemplate[] = [
  {
    id: 'human_writing',
    labelKey: 'qualityPresetHumanWriting',
    goals: { naturalness: 85, readability: 80, coherence: 80, styleConsistency: 78 },
    sentenceEntropyTarget: 60,
    rhythmVariabilityTarget: 60,
  },
  {
    id: 'ai_edit_guidance',
    labelKey: 'qualityPresetAiEditGuidance',
    goals: { naturalness: 80, readability: 88, coherence: 86, styleConsistency: 84 },
    sentenceEntropyTarget: 52,
    rhythmVariabilityTarget: 50,
  },
]

export interface BackendConfigState {
  config: BackendConfig | null
  modifiableFields: string[]
  syncStatus: 'idle' | 'loading' | 'syncing' | 'error'
  lastSync: string | null
  error: string | null
}

export interface Settings {
  apiBaseUrl: string
  apiKey: string
  llmProviders: LLMProvider[]
  primaryProvider: string
  useMultiModel: boolean
  allowLlmFallback: boolean
  defaultModel: string
  temperature: number
  defaultWorkflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  workflowBackendMode: WorkflowBackendMode
  targetWordsPerChapter: number
  autoSkillMatch: boolean
  detectionEvasionGuardEnabled: boolean
  writingHelperUseLegacyPolish: boolean
  qualityGoals: QualityGoalsSettings
  retrieval: RetrievalSettings
  contextTypes: ContextType[]
  promptTemplateLibrary?: PromptTemplateLibrarySettings
  backendConfig: BackendConfigState
  theme: 'system' | 'sorbet' | 'slate' | 'amber' | 'forest' | 'charcoal' | 'cauldron' | 'aurora' | 'moonbeam' | 'sepia'
  fontSize: 'small' | 'medium' | 'large'
  language: 'zh' | 'en'
  sendShortcut: SendShortcut
}
