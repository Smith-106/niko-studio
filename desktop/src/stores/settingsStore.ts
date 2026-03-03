import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// LLM 提供商配置
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

interface Settings {
  // API
  apiBaseUrl: string
  apiKey: string

  // LLM 多模型配置
  llmProviders: LLMProvider[]
  primaryProvider: string  // 主要使用的提供商 ID
  useMultiModel: boolean   // 是否启用多模型并行
  allowLlmFallback: boolean  // 是否允许 LLM 降级

  // Model
  defaultModel: string
  temperature: number

  // Writing
  defaultWorkflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  targetWordsPerChapter: number
  autoSkillMatch: boolean
  detectionEvasionGuardEnabled: boolean
  writingHelperUseLegacyPolish: boolean
  qualityGoals: QualityGoalsSettings

  // Prompt templates
  promptTemplateLibrary?: PromptTemplateLibrarySettings

  // UI
  theme: 'light' | 'dark' | 'system'
  fontSize: 'small' | 'medium' | 'large'
  language: 'zh' | 'en'
  sidebarCollapsed: boolean
}

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

const nowIso = () => new Date().toISOString()

const defaultPromptTemplates = (): PromptTemplate[] => {
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

const defaultPromptTemplateLibrary = (): PromptTemplateLibrarySettings => ({
  version: 1,
  templates: defaultPromptTemplates(),
  recentTemplateIds: [],
  variablePresets: {},
})

const defaultQualityGoals = (): QualityGoalsSettings => {
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

const defaultSettings: Settings = {
  apiBaseUrl: 'http://127.0.0.1:8000',
  apiKey: '',
  llmProviders: defaultProviders,
  primaryProvider: 'anthropic',
  useMultiModel: false,
  allowLlmFallback: true,
  defaultModel: 'claude-3-sonnet',
  temperature: 0.7,
  defaultWorkflowLevel: 'L3',
  targetWordsPerChapter: 2000,
  autoSkillMatch: true,
  detectionEvasionGuardEnabled: true,
  writingHelperUseLegacyPolish: false,
  qualityGoals: defaultQualityGoals(),
  promptTemplateLibrary: defaultPromptTemplateLibrary(),
  theme: 'light',
  fontSize: 'medium',
  language: 'zh',
  sidebarCollapsed: false,
}

const normalizeModelId = (model: string): string => model.trim()

const deduplicateModels = (models: string[]): string[] => {
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

const normalizeProvider = (provider: LLMProvider): LLMProvider => {
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

const normalizeTemplateVariable = (variable: PromptTemplateVariable): PromptTemplateVariable => ({
  ...variable,
  id: variable.id.trim(),
  label: variable.label.trim() || variable.id.trim(),
  required: Boolean(variable.required),
  defaultValue: variable.defaultValue,
  description: variable.description,
})

const normalizeTemplate = (template: PromptTemplate): PromptTemplate => {
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

const normalizePromptTemplateLibrary = (
  library: PromptTemplateLibrarySettings | undefined
): PromptTemplateLibrarySettings => {
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
    if (!templateIds.has(templateId)) continue
    if (!values || typeof values !== 'object') continue

    const entries = Object.entries(values)
      .filter(([key, value]) => Boolean(key) && typeof value === 'string')
    if (entries.length === 0) continue

    variablePresets[templateId] = Object.fromEntries(entries)
  }

  return {
    version: library?.version ?? fallback.version,
    templates: uniqueTemplates,
    recentTemplateIds,
    variablePresets,
  }
}

const normalizeSettings = (settings: Partial<Settings>): Settings => {
  const merged: Settings = {
    ...defaultSettings,
    ...settings,
    llmProviders: settings.llmProviders ?? defaultSettings.llmProviders,
    promptTemplateLibrary: settings.promptTemplateLibrary,
    qualityGoals: {
      ...defaultQualityGoals(),
      ...(settings.qualityGoals ?? {}),
    },
  }

  return {
    ...merged,
    llmProviders: merged.llmProviders.map(normalizeProvider),
    promptTemplateLibrary: normalizePromptTemplateLibrary(merged.promptTemplateLibrary),
  }
}

interface SettingsStore {
  settings: Settings
  updateSettings: (partial: Partial<Settings>) => void
  updateProvider: (providerId: string, updates: Partial<LLMProvider>) => void
  resetSettings: () => void
  getEnabledProviders: () => LLMProvider[]
  getPrimaryProvider: () => LLMProvider | undefined
  addTemplate: (template: PromptTemplate) => void
  updateTemplate: (templateId: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>) => void
  deleteTemplate: (templateId: string) => void
  toggleTemplateFavorite: (templateId: string) => void
  recordTemplateUsage: (templateId: string) => void
  setTemplateVariablePreset: (templateId: string, variableId: string, value: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: normalizeSettings(defaultSettings),
      updateSettings: (partial) =>
        set((state) => ({
          settings: normalizeSettings({ ...state.settings, ...partial }),
        })),
      updateProvider: (providerId, updates) =>
        set((state) => ({
          settings: normalizeSettings({
            ...state.settings,
            llmProviders: state.settings.llmProviders.map((p) =>
              p.id === providerId ? normalizeProvider({ ...p, ...updates }) : normalizeProvider(p)
            ),
          }),
        })),
      resetSettings: () => set({ settings: normalizeSettings(defaultSettings) }),
      getEnabledProviders: () => {
        return get().settings.llmProviders.filter((p) => p.enabled && p.apiKey)
      },
      getPrimaryProvider: () => {
        const { llmProviders, primaryProvider } = get().settings
        return llmProviders.find((p) => p.id === primaryProvider)
      },
      addTemplate: (template) =>
        set((state) => {
          const library = normalizePromptTemplateLibrary(state.settings.promptTemplateLibrary)
          const normalizedTemplate = normalizeTemplate(template)
          const existingIndex = library.templates.findIndex((item) => item.id === normalizedTemplate.id)
          const templates = [...library.templates]

          if (existingIndex >= 0) {
            templates[existingIndex] = {
              ...templates[existingIndex],
              ...normalizedTemplate,
              updatedAt: nowIso(),
            }
          } else {
            templates.unshift(normalizedTemplate)
          }

          return {
            settings: normalizeSettings({
              ...state.settings,
              promptTemplateLibrary: {
                ...library,
                templates,
              },
            }),
          }
        }),
      updateTemplate: (templateId, updates) =>
        set((state) => {
          const library = normalizePromptTemplateLibrary(state.settings.promptTemplateLibrary)
          const templates = library.templates.map((template) => {
            if (template.id !== templateId) return template
            return normalizeTemplate({
              ...template,
              ...updates,
              updatedAt: nowIso(),
            })
          })

          return {
            settings: normalizeSettings({
              ...state.settings,
              promptTemplateLibrary: {
                ...library,
                templates,
              },
            }),
          }
        }),
      deleteTemplate: (templateId) =>
        set((state) => {
          const library = normalizePromptTemplateLibrary(state.settings.promptTemplateLibrary)
          const templates = library.templates.filter((template) => template.id !== templateId)
          const recentTemplateIds = library.recentTemplateIds.filter((id) => id !== templateId)
          const { [templateId]: _removed, ...variablePresets } = library.variablePresets

          return {
            settings: normalizeSettings({
              ...state.settings,
              promptTemplateLibrary: {
                ...library,
                templates,
                recentTemplateIds,
                variablePresets,
              },
            }),
          }
        }),
      toggleTemplateFavorite: (templateId) =>
        set((state) => {
          const library = normalizePromptTemplateLibrary(state.settings.promptTemplateLibrary)
          const templates = library.templates.map((template) =>
            template.id === templateId
              ? { ...template, isFavorite: !template.isFavorite, updatedAt: nowIso() }
              : template
          )

          return {
            settings: normalizeSettings({
              ...state.settings,
              promptTemplateLibrary: {
                ...library,
                templates,
              },
            }),
          }
        }),
      recordTemplateUsage: (templateId) =>
        set((state) => {
          const library = normalizePromptTemplateLibrary(state.settings.promptTemplateLibrary)
          const recentTemplateIds = [templateId, ...library.recentTemplateIds.filter((id) => id !== templateId)].slice(0, 20)

          return {
            settings: normalizeSettings({
              ...state.settings,
              promptTemplateLibrary: {
                ...library,
                recentTemplateIds,
              },
            }),
          }
        }),
      setTemplateVariablePreset: (templateId, variableId, value) =>
        set((state) => {
          const library = normalizePromptTemplateLibrary(state.settings.promptTemplateLibrary)
          const currentPreset = library.variablePresets[templateId] ?? {}

          return {
            settings: normalizeSettings({
              ...state.settings,
              promptTemplateLibrary: {
                ...library,
                variablePresets: {
                  ...library.variablePresets,
                  [templateId]: {
                    ...currentPreset,
                    [variableId]: value,
                  },
                },
              },
            }),
          }
        }),
    }),
    {
      name: 'niko-settings',
    }
  )
)
