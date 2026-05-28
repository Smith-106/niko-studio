import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import type { SecretsResponse } from '@/contracts/backendConfig'
import { setRuntimePreferences } from '@/runtime/preferences'

// 防抖写入 localStorage：300ms 内多次设置更新只写一次，避免频繁 JSON.stringify + 写盘
// pendingValue 保存最近一次待写入的值，removeItem 时一并清空，避免竞态导致已删数据被重新持久化
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let pendingValue: { name: string; value: string } | null = null

const debouncedLocalStorage: StateStorage = {
  getItem: (name: string) => {
    return localStorage.getItem(name)
  },
  setItem: (name: string, value: string) => {
    clearTimeout(debounceTimer)
    pendingValue = { name, value }
    debounceTimer = setTimeout(() => {
      if (typeof localStorage !== 'undefined' && pendingValue) {
        localStorage.setItem(pendingValue.name, pendingValue.value)
      }
      pendingValue = null
    }, 300)
  },
  removeItem: (name: string) => {
    clearTimeout(debounceTimer)
    pendingValue = null
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(name)
    }
  },
}

import {
  defaultSettings,
  normalizePromptTemplateLibrary,
  normalizeProvider,
  normalizeSettings,
  normalizeTemplate,
  nowIso,
  sanitizeSettingsForPersist,
  type SettingsInput,
} from './settings/state'
import {
  loadBackendConfigRuntime,
  reloadBackendConfigRuntime,
  updateBackendConfigRuntime,
  updateBackendSecretsRuntime,
} from './settings/backendConfig'
import type { LLMProvider, PromptTemplate, Settings } from './settings/types'

export {
  QUALITY_GOAL_METRIC_FIELDS,
  QUALITY_PRESET_TEMPLATES,
  type BackendConfigState,
  type ContextType,
  type LLMProvider,
  type PromptTemplate,
  type PromptTemplateCategory,
  type PromptTemplateLibrarySettings,
  type PromptTemplateVariable,
  type QualityGoalsSettings,
  type QualityPresetId,
  type RetrievalSearchMode,
  type RetrievalSettings,
  type SendShortcut,
  type Settings,
  type WorkflowBackendMode,
} from './settings/types'

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
  loadBackendConfig: () => Promise<void>
  updateBackendConfig: (fields: Record<string, unknown>) => Promise<string[]>
  updateSecrets: (secrets: SecretsResponse['secrets']) => Promise<void>
  reloadBackendConfig: () => Promise<void>
}

function projectRuntimePreferences(settings: Settings) {
  setRuntimePreferences({
    apiBaseUrl: settings.apiBaseUrl,
    workflowBackendMode: settings.workflowBackendMode,
  })
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
            llmProviders: state.settings.llmProviders.map((provider) =>
              provider.id === providerId
                ? normalizeProvider({ ...provider, ...updates })
                : normalizeProvider(provider),
            ),
          }),
        })),
      resetSettings: () => set({ settings: normalizeSettings(defaultSettings) }),
      getEnabledProviders: () => {
        return get().settings.llmProviders.filter((provider) => provider.enabled && provider.apiKey)
      },
      getPrimaryProvider: () => {
        const { llmProviders, primaryProvider } = get().settings
        return llmProviders.find((provider) => provider.id === primaryProvider)
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
              : template,
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
      loadBackendConfig: async () =>
        loadBackendConfigRuntime((recipe) =>
          set((state) => ({ settings: recipe(state.settings) })),
        ),
      updateBackendConfig: async (fields: Record<string, unknown>) =>
        updateBackendConfigRuntime(
          (recipe) => set((state) => ({ settings: recipe(state.settings) })),
          fields,
        ),
      updateSecrets: async (secrets) =>
        updateBackendSecretsRuntime(
          (recipe) => set((state) => ({ settings: recipe(state.settings) })),
          secrets,
        ),
      reloadBackendConfig: async () =>
        reloadBackendConfigRuntime(
          (recipe) => set((state) => ({ settings: recipe(state.settings) })),
          () => get().loadBackendConfig(),
        ),
    }),
    {
      name: 'niko-settings',
      storage: createJSONStorage(() => debouncedLocalStorage),
      partialize: (state) => ({
        ...state,
        settings: sanitizeSettingsForPersist(state.settings),
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SettingsStore> | undefined

        return {
          ...currentState,
          ...persisted,
          settings: normalizeSettings((persisted?.settings ?? {}) as SettingsInput, { includeRuntimeState: false }),
        }
      },
    },
  ),
)

projectRuntimePreferences(useSettingsStore.getState().settings)

useSettingsStore.subscribe((state, previousState) => {
  if (
    state.settings.apiBaseUrl === previousState.settings.apiBaseUrl &&
    state.settings.workflowBackendMode === previousState.settings.workflowBackendMode
  ) {
    return
  }

  projectRuntimePreferences(state.settings)
})
