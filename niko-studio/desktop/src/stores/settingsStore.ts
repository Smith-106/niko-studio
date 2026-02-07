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
}

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
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4-turbo',
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-pro', 'gemini-pro-vision'],
    defaultModel: 'gemini-pro',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    enabled: false,
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-3-opus', 'openai/gpt-4-turbo', 'google/gemini-pro'],
    defaultModel: 'anthropic/claude-3-opus',
  },
  {
    id: 'local',
    name: '本地模型 (Ollama)',
    enabled: false,
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    models: ['llama2', 'mistral', 'codellama'],
    defaultModel: 'mistral',
  },
]

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
  theme: 'light',
  fontSize: 'medium',
  language: 'zh',
  sidebarCollapsed: false,
}

interface SettingsStore {
  settings: Settings
  updateSettings: (partial: Partial<Settings>) => void
  updateProvider: (providerId: string, updates: Partial<LLMProvider>) => void
  resetSettings: () => void
  getEnabledProviders: () => LLMProvider[]
  getPrimaryProvider: () => LLMProvider | undefined
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
      updateProvider: (providerId, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmProviders: state.settings.llmProviders.map((p) =>
              p.id === providerId ? { ...p, ...updates } : p
            ),
          },
        })),
      resetSettings: () => set({ settings: defaultSettings }),
      getEnabledProviders: () => {
        return get().settings.llmProviders.filter((p) => p.enabled && p.apiKey)
      },
      getPrimaryProvider: () => {
        const { llmProviders, primaryProvider } = get().settings
        return llmProviders.find((p) => p.id === primaryProvider)
      },
    }),
    {
      name: 'niko-settings',
    }
  )
)
