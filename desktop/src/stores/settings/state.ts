import { PERSISTED_SETTINGS_KEYS } from '@/types/settingsOwnership'

import {
  QUALITY_PRESET_TEMPLATES,
  type BackendConfigState,
  type ContextType,
  type LLMProvider,
  type QualityGoalsSettings,
  type PromptTemplate,
  type PromptTemplateLibrarySettings,
  type PromptTemplateVariable,
  type RetrievalSearchMode,
  type RetrievalSettings,
  type SendShortcut,
  type Settings,
} from './types'

type PersistedSettingsInternal = Pick<Settings, (typeof PERSISTED_SETTINGS_KEYS)[number]>
export type SettingsInput = Partial<Settings> & { sidebarCollapsed?: boolean }

const defaultProviders: LLMProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-3-sonnet-20240229',
    fetchedModels: [],
    customModels: [],
    modelSelectionMode: 'list',
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4-turbo',
    fetchedModels: [],
    customModels: [],
    modelSelectionMode: 'list',
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-pro', 'gemini-pro-vision'],
    defaultModel: 'gemini-pro',
    fetchedModels: [],
    customModels: [],
    modelSelectionMode: 'list',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-3-opus', 'openai/gpt-4-turbo', 'google/gemini-pro'],
    defaultModel: 'anthropic/claude-3-opus',
    fetchedModels: [],
    customModels: [],
    modelSelectionMode: 'list',
  },
  {
    id: 'local',
    name: '本地模型 (Ollama)',
    enabled: false,
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    models: ['llama2', 'mistral', 'codellama'],
    defaultModel: 'mistral',
    fetchedModels: [],
    customModels: [],
    modelSelectionMode: 'list',
  },
]

export const nowIso = () => new Date().toISOString()

function defaultPromptTemplates(): PromptTemplate[] {
  const createdAt = nowIso()
  return [
    {
      id: 'tpl-brainstorm-idea',
      title: '故事脑暴',
      category: 'brainstorm',
      content: '请围绕主题「{topic}」给出 {count} 个高概念创意，并补充每个创意的核心冲突。',
      variables: [
        { id: 'topic', label: '主题', required: true, defaultValue: '' },
        { id: 'count', label: '数量', required: true, defaultValue: '5' },
      ],
      isFavorite: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'tpl-outline-chapter',
      title: '章节大纲',
      category: 'outline',
      content: '请为小说《{title}》生成第 {chapter} 章大纲，重点是目标、冲突和转折。',
      variables: [
        { id: 'title', label: '作品名', required: true, defaultValue: '' },
        { id: 'chapter', label: '章节号', required: true, defaultValue: '1' },
      ],
      isFavorite: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'tpl-rewrite-tone',
      title: '语气改写',
      category: 'rewrite',
      content: '请将以下文本改写为「{tone}」风格，保留原意并提升可读性：\n\n{text}',
      variables: [
        { id: 'tone', label: '目标语气', required: true, defaultValue: '克制冷静' },
        { id: 'text', label: '原文本', required: true, defaultValue: '' },
      ],
      isFavorite: false,
      createdAt,
      updatedAt: createdAt,
    },
  ]
}

function defaultPromptTemplateLibrary(): PromptTemplateLibrarySettings {
  return {
    version: 1,
    templates: defaultPromptTemplates(),
    recentTemplateIds: [],
    variablePresets: {},
  }
}

function defaultQualityGoals(): QualityGoalsSettings {
  const presetTemplate = QUALITY_PRESET_TEMPLATES.find((preset) => preset.id === 'human_writing')
  return {
    naturalness: presetTemplate?.goals.naturalness ?? 80,
    readability: presetTemplate?.goals.readability ?? 80,
    coherence: presetTemplate?.goals.coherence ?? 80,
    styleConsistency: presetTemplate?.goals.styleConsistency ?? 80,
    humanizationPreset: 'human_writing',
    customHumanizationInstruction: '',
    sentenceEntropyTarget: presetTemplate?.sentenceEntropyTarget ?? 55,
    rhythmVariabilityTarget: presetTemplate?.rhythmVariabilityTarget ?? 55,
  }
}

function defaultRetrievalSettings(): RetrievalSettings {
  return {
    enabled: true,
    searchMode: 'hybrid',
    profile: 'balanced',
    minScore: undefined,
    budgetTokens: undefined,
    rerank: false,
    maxIterations: 3,
    confidenceThreshold: 0.8,
  }
}

function sanitizeNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeRetrievalSettings(retrieval: Partial<RetrievalSettings> | undefined): RetrievalSettings {
  const merged = {
    ...defaultRetrievalSettings(),
    ...(retrieval ?? {}),
  }

  const minScore = sanitizeNumeric(merged.minScore)
  const budgetTokens = sanitizeNumeric(merged.budgetTokens)
  const maxIterations = sanitizeNumeric(merged.maxIterations)
  const confidenceThreshold = sanitizeNumeric(merged.confidenceThreshold)
  const allowedModes: RetrievalSearchMode[] = ['hybrid', 'iterative', 'context']
  const searchMode = allowedModes.includes(merged.searchMode) ? merged.searchMode : 'hybrid'

  return {
    enabled: Boolean(merged.enabled),
    searchMode,
    profile: (merged.profile ?? '').trim(),
    minScore,
    budgetTokens,
    rerank: Boolean(merged.rerank),
    maxIterations: maxIterations !== undefined ? Math.max(1, Math.floor(maxIterations)) : 3,
    confidenceThreshold:
      confidenceThreshold !== undefined
        ? Math.max(0, Math.min(1, Number(confidenceThreshold.toFixed(3))))
        : 0.8,
  }
}

function normalizeContextTypes(contextTypes: ContextType[] | undefined): ContextType[] {
  const fallback: ContextType[] = ['world', 'character', 'plot']
  const allowed = new Set<ContextType>(fallback)
  const list = (contextTypes ?? fallback).filter((item): item is ContextType => allowed.has(item))
  const deduped = list.filter((item, index, arr) => arr.indexOf(item) === index)
  return deduped.length > 0 ? deduped : fallback
}

export function defaultBackendConfigState(): BackendConfigState {
  return {
    config: null,
    modifiableFields: [],
    syncStatus: 'idle',
    lastSync: null,
    error: null,
  }
}

export const defaultSettings: Settings = {
  apiBaseUrl: 'http://127.0.0.1:8000',
  apiKey: '',
  llmProviders: defaultProviders,
  primaryProvider: 'anthropic',
  useMultiModel: false,
  allowLlmFallback: true,
  defaultModel: 'claude-3-sonnet',
  temperature: 0.7,
  defaultWorkflowLevel: 'L3',
  workflowBackendMode: 'standard',
  targetWordsPerChapter: 2000,
  autoSkillMatch: true,
  detectionEvasionGuardEnabled: true,
  writingHelperUseLegacyPolish: false,
  qualityGoals: defaultQualityGoals(),
  retrieval: defaultRetrievalSettings(),
  contextTypes: ['world', 'character', 'plot'],
  promptTemplateLibrary: defaultPromptTemplateLibrary(),
  backendConfig: defaultBackendConfigState(),
  theme: 'slate',
  fontSize: 'medium',
  language: 'zh',
  sendShortcut: 'enter',
}

function normalizeModelId(model: string): string {
  return model.trim()
}

function deduplicateModels(models: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const model of models) {
    const normalized = normalizeModelId(model)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

export function normalizeProvider(provider: LLMProvider): LLMProvider {
  const models = deduplicateModels(provider.models ?? [])
  const fetchedModels = deduplicateModels(provider.fetchedModels ?? [])
  const customModels = deduplicateModels(provider.customModels ?? [])
  const effectiveModels = deduplicateModels([...models, ...fetchedModels, ...customModels])

  const fallbackDefaultModel = effectiveModels[0] ?? provider.defaultModel
  const currentDefault = normalizeModelId(provider.defaultModel)
  const hasCurrentDefault = effectiveModels.some((model) => model.toLowerCase() === currentDefault.toLowerCase())

  return {
    ...provider,
    models,
    fetchedModels,
    customModels,
    modelSelectionMode: provider.modelSelectionMode ?? 'list',
    defaultModel: hasCurrentDefault ? currentDefault : fallbackDefaultModel,
  }
}

function normalizeTemplateVariable(variable: PromptTemplateVariable): PromptTemplateVariable {
  return {
    ...variable,
    id: variable.id.trim(),
    label: variable.label.trim() || variable.id.trim(),
    required: Boolean(variable.required),
    defaultValue: variable.defaultValue,
    description: variable.description,
  }
}

export function normalizeTemplate(template: PromptTemplate): PromptTemplate {
  const createdAt = template.createdAt || nowIso()
  const updatedAt = template.updatedAt || createdAt
  return {
    ...template,
    id: template.id.trim(),
    title: template.title.trim() || template.id.trim(),
    content: template.content,
    category: template.category,
    variables: (template.variables ?? [])
      .map(normalizeTemplateVariable)
      .filter((variable) => Boolean(variable.id)),
    isFavorite: Boolean(template.isFavorite),
    createdAt,
    updatedAt,
  }
}

export function normalizePromptTemplateLibrary(
  library: PromptTemplateLibrarySettings | undefined,
): PromptTemplateLibrarySettings {
  const fallback = defaultPromptTemplateLibrary()
  const templates = (library?.templates ?? fallback.templates)
    .map(normalizeTemplate)
    .filter((template) => Boolean(template.id))

  const uniqueTemplates = Array.from(new Map(templates.map((template) => [template.id, template])).values())
  const templateIds = new Set(uniqueTemplates.map((template) => template.id))
  const recentTemplateIds = (library?.recentTemplateIds ?? fallback.recentTemplateIds)
    .filter((id) => templateIds.has(id))
    .filter((id, index, arr) => arr.indexOf(id) === index)
    .slice(0, 20)

  const presets = library?.variablePresets ?? fallback.variablePresets
  const variablePresets: Record<string, Record<string, string>> = {}

  for (const [templateId, values] of Object.entries(presets)) {
    if (!templateIds.has(templateId) || !values || typeof values !== 'object') continue
    const entries = Object.entries(values).filter(([key, value]) => Boolean(key) && typeof value === 'string')
    if (entries.length > 0) {
      variablePresets[templateId] = Object.fromEntries(entries)
    }
  }

  return {
    version: library?.version ?? fallback.version,
    templates: uniqueTemplates,
    recentTemplateIds,
    variablePresets,
  }
}

function normalizeSendShortcut(value: unknown): SendShortcut {
  return value === 'ctrlEnter' ? 'ctrlEnter' : 'enter'
}

function normalizeFontSize(value: unknown): Settings['fontSize'] {
  if (value === 'small' || value === 'large') return value
  return 'medium'
}

function normalizeLanguage(value: unknown): Settings['language'] {
  return value === 'en' ? 'en' : 'zh'
}

const VALID_THEMES = ['system', 'sorbet', 'slate', 'amber', 'forest', 'charcoal', 'cauldron', 'aurora', 'moonbeam', 'sepia'] as const
type ValidTheme = typeof VALID_THEMES[number]

function normalizeTheme(value: unknown): ValidTheme {
  if (typeof value === 'string' && (VALID_THEMES as readonly string[]).includes(value)) return value as ValidTheme
  if (value === 'light') return 'sorbet'
  if (value === 'dark') return 'slate'
  return 'slate'
}

function pickPersistedSettings(
  settings: Partial<Record<string, unknown>>,
): Partial<PersistedSettingsInternal> {
  const persisted: Partial<PersistedSettingsInternal> = {}

  for (const key of PERSISTED_SETTINGS_KEYS) {
    const value = settings[key]
    if (value !== undefined) {
      ;(persisted as Record<string, unknown>)[key] = value
    }
  }

  return persisted
}

function normalizeBackendConfigState(
  backendConfig: Partial<BackendConfigState> | undefined,
): BackendConfigState {
  const fallback = defaultBackendConfigState()
  if (!backendConfig) return fallback

  return {
    config: backendConfig.config ?? fallback.config,
    modifiableFields: Array.isArray(backendConfig.modifiableFields)
      ? backendConfig.modifiableFields.filter((field): field is string => typeof field === 'string')
      : fallback.modifiableFields,
    syncStatus:
      backendConfig.syncStatus === 'loading'
      || backendConfig.syncStatus === 'syncing'
      || backendConfig.syncStatus === 'error'
        ? backendConfig.syncStatus
        : fallback.syncStatus,
    lastSync: typeof backendConfig.lastSync === 'string' ? backendConfig.lastSync : fallback.lastSync,
    error: typeof backendConfig.error === 'string' ? backendConfig.error : fallback.error,
  }
}

export function normalizeSettings(
  settings: SettingsInput = {},
  options: { includeRuntimeState?: boolean } = {},
): Settings {
  const persisted = pickPersistedSettings(settings as Partial<Record<string, unknown>>)
  const includeRuntimeState = options.includeRuntimeState ?? true
  const merged: Settings = {
    ...defaultSettings,
    ...persisted,
    llmProviders: persisted.llmProviders ?? defaultSettings.llmProviders,
    promptTemplateLibrary: persisted.promptTemplateLibrary,
    qualityGoals: {
      ...defaultQualityGoals(),
      ...(persisted.qualityGoals ?? {}),
    },
    retrieval: normalizeRetrievalSettings(persisted.retrieval),
    contextTypes: normalizeContextTypes(persisted.contextTypes),
    backendConfig: includeRuntimeState
      ? normalizeBackendConfigState(settings.backendConfig)
      : defaultBackendConfigState(),
    sendShortcut: normalizeSendShortcut(persisted.sendShortcut),
    fontSize: normalizeFontSize(persisted.fontSize),
    language: normalizeLanguage(persisted.language),
    theme: normalizeTheme(persisted.theme),
  }

  return {
    ...merged,
    llmProviders: merged.llmProviders.map(normalizeProvider),
    promptTemplateLibrary: normalizePromptTemplateLibrary(merged.promptTemplateLibrary),
  }
}

export function sanitizeSettingsForPersist(settings: Settings): PersistedSettingsInternal {
  const persisted = pickPersistedSettings(settings as unknown as Partial<Record<string, unknown>>) as PersistedSettingsInternal

  return {
    ...persisted,
    apiKey: '',
    llmProviders: settings.llmProviders.map((provider) => ({
      ...provider,
      apiKey: '',
    })),
  }
}
