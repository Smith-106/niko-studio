import type { AppSlice } from '../appStore'
import type { Template, TemplateCategory } from '../../types/template'
import { listTemplates as fetchTemplates, saveTemplate as persistTemplate, deleteTemplate as removeTemplate, duplicateTemplate as cloneTemplate } from '../../services/templateService'

export interface TemplateSlice {
  templates: Template[]
  templatesLoading: boolean
  templatesError: string | null

  loadTemplates: (category?: TemplateCategory) => Promise<void>
  saveAsTemplate: (template: Template) => Promise<void>
  removeTemplate: (id: string) => Promise<void>
  duplicateTemplate: (id: string, newTitle: string) => Promise<Template>
}

export const createTemplateSlice: AppSlice<TemplateSlice> = (set, get) => ({
  templates: [],
  templatesLoading: false,
  templatesError: null,

  loadTemplates: async (category) => {
    set({ templatesLoading: true, templatesError: null })
    try {
      const templates = await fetchTemplates(category)
      set({ templates, templatesLoading: false })
    } catch (err) {
      set({
        templatesError: err instanceof Error ? err.message : 'Failed to load templates',
        templatesLoading: false,
      })
    }
  },

  saveAsTemplate: async (template) => {
    try {
      await persistTemplate(template)
      await get().loadTemplates()
    } catch (err) {
      set({
        templatesError: err instanceof Error ? err.message : 'Failed to save template',
      })
    }
  },

  removeTemplate: async (id) => {
    try {
      await removeTemplate(id)
      await get().loadTemplates()
    } catch (err) {
      set({
        templatesError: err instanceof Error ? err.message : 'Failed to delete template',
      })
    }
  },

  duplicateTemplate: async (id, newTitle) => {
    const duplicate = await cloneTemplate(id, newTitle)
    await get().loadTemplates()
    return duplicate
  },
})
