import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getConfig,
  reloadConfig as reloadConfigApi,
  updateConfig,
  updateSecrets as updateSecretsApi,
  type SecretsResponse,
} from '@/api/config'

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
      loadBackendConfig: async () => {
        set((state) => ({
          settings: {
            ...state.settings,
            backendConfig: {
              ...state.settings.backendConfig,
              syncStatus: 'loading',
              error: null,
            },
          },
        }))

        try {
          const response = await getConfig()
          if (response.success && response.data) {
            const configData = response.data
            set((state) => ({
              settings: {
                ...state.settings,
                backendConfig: {
                  config: configData.config,
                  modifiableFields: configData.modifiable_fields,
                  syncStatus: 'idle',
                  lastSync: nowIso(),
                  error: null,
                },
              },
            }))
          } else {
            set((state) => ({
              settings: {
                ...state.settings,
                backendConfig: {
                  ...state.settings.backendConfig,
                  syncStatus: 'error',
                  error: response.error ?? 'Failed to load backend config',
                },
              },
            }))
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error loading config'
          set((state) => ({
            settings: {
              ...state.settings,
              backendConfig: {
                ...state.settings.backendConfig,
                syncStatus: 'error',
                error: errorMessage,
              },
            },
          }))
        }
      },
      updateBackendConfig: async (fields: Record<string, unknown>) => {
        set((state) => ({
          settings: {
            ...state.settings,
            backendConfig: {
              ...state.settings.backendConfig,
              syncStatus: 'syncing',
              error: null,
            },
          },
        }))

        try {
          const response = await updateConfig(fields)
          if (response.success && response.data) {
            const configResponse = await getConfig()
            if (configResponse.success && configResponse.data) {
              const configData = configResponse.data
              set((state) => ({
                settings: {
                  ...state.settings,
                  backendConfig: {
                    config: configData.config,
                    modifiableFields: configData.modifiable_fields,
                    syncStatus: 'idle',
                    lastSync: nowIso(),
                    error: null,
                  },
                },
              }))
            }
            return response.data.updated ?? []
          }

          set((state) => ({
            settings: {
              ...state.settings,
              backendConfig: {
                ...state.settings.backendConfig,
                syncStatus: 'error',
                error: response.error ?? 'Failed to update backend config',
              },
            },
          }))
          return []
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error updating config'
          set((state) => ({
            settings: {
              ...state.settings,
              backendConfig: {
                ...state.settings.backendConfig,
                syncStatus: 'error',
                error: errorMessage,
              },
            },
          }))
          return []
        }
      },
      updateSecrets: async (secrets) => {
        set((state) => ({
          settings: {
            ...state.settings,
            backendConfig: {
              ...state.settings.backendConfig,
              syncStatus: 'syncing',
              error: null,
            },
          },
        }))

        try {
          const secretValues: Record<string, string> = {}
          for (const [key, field] of Object.entries(secrets)) {
            if (typeof field.value === 'string') {
              secretValues[key] = field.value
            }
          }

          const response = await updateSecretsApi(secretValues)
          if (response.success) {
            const configResponse = await getConfig()
            if (configResponse.success && configResponse.data) {
              const configData = configResponse.data
              set((state) => ({
                settings: {
                  ...state.settings,
                  backendConfig: {
                    config: configData.config,
                    modifiableFields: configData.modifiable_fields,
                    syncStatus: 'idle',
                    lastSync: nowIso(),
                    error: null,
                  },
                },
              }))
              return
            }
          }

          set((state) => ({
            settings: {
              ...state.settings,
              backendConfig: {
                ...state.settings.backendConfig,
                syncStatus: 'error',
                error: response.error ?? 'Failed to update secrets',
              },
            },
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error updating secrets'
          set((state) => ({
            settings: {
              ...state.settings,
              backendConfig: {
                ...state.settings.backendConfig,
                syncStatus: 'error',
                error: errorMessage,
              },
            },
          }))
        }
      },
      reloadBackendConfig: async () => {
        set((state) => ({
          settings: {
            ...state.settings,
            backendConfig: {
              ...state.settings.backendConfig,
              syncStatus: 'syncing',
              error: null,
            },
          },
        }))

        try {
          const reloadResponse = await reloadConfigApi()
          if (reloadResponse.success) {
            await get().loadBackendConfig()
            return
          }

          set((state) => ({
            settings: {
              ...state.settings,
              backendConfig: {
                ...state.settings.backendConfig,
                syncStatus: 'error',
                error: reloadResponse.error ?? 'Failed to reload backend config',
              },
            },
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error reloading config'
          set((state) => ({
            settings: {
              ...state.settings,
              backendConfig: {
                ...state.settings.backendConfig,
                syncStatus: 'error',
                error: errorMessage,
              },
            },
          }))
        }
      },
    }),
    {
      name: 'niko-settings',
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
