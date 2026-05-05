import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Template } from '../../types/template'
import { createTemplateSlice, type TemplateSlice } from './templateSlice'

type SetFn = Parameters<typeof createTemplateSlice>[0]

function createStore(): TemplateSlice {
  const state: TemplateSlice = {
    templates: [],
    templatesLoading: false,
    templatesError: null,
    loadTemplates: async () => {},
    saveAsTemplate: async () => {},
    removeTemplate: async () => {},
    duplicateTemplate: async () => ({} as Template),
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    Object.assign(state, next)
  }
  const get = () => state

  const slice = createTemplateSlice(set as never, get as never, {} as never)
  Object.assign(state, slice)
  return state
}

const mockListTemplates = vi.fn()
const mockSaveTemplate = vi.fn()
const mockDeleteTemplate = vi.fn()
const mockDuplicateTemplate = vi.fn()

vi.mock('../../services/templateService', () => ({
  listTemplates: (...args: unknown[]) => mockListTemplates(...args),
  saveTemplate: (...args: unknown[]) => mockSaveTemplate(...args),
  deleteTemplate: (...args: unknown[]) => mockDeleteTemplate(...args),
  duplicateTemplate: (...args: unknown[]) => mockDuplicateTemplate(...args),
}))

const builtinTemplate: Template = {
  id: 'builtin-basic-chapter', title: 'Basic Chapter', description: '', category: 'structure',
  content: { type: 'doc' }, placeholders: [], isBuiltIn: true, createdAt: '', updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListTemplates.mockResolvedValue([builtinTemplate])
})

describe('templateSlice', () => {
  describe('loadTemplates', () => {
    it('loads templates into state', async () => {
      const store = createStore()
      await store.loadTemplates()

      expect(store.templates).toEqual([builtinTemplate])
      expect(store.templatesLoading).toBe(false)
    })

    it('sets error on failure', async () => {
      mockListTemplates.mockRejectedValue(new Error('fs error'))
      const store = createStore()

      await store.loadTemplates()

      expect(store.templatesError).toBe('fs error')
      expect(store.templatesLoading).toBe(false)
    })

    it('passes category filter', async () => {
      mockListTemplates.mockResolvedValue([])
      const store = createStore()

      await store.loadTemplates('structure')

      expect(mockListTemplates).toHaveBeenCalledWith('structure')
    })
  })

  describe('saveAsTemplate', () => {
    it('persists and reloads templates', async () => {
      mockSaveTemplate.mockResolvedValue(undefined)
      const store = createStore()
      await store.loadTemplates()

      const newTpl: Template = {
        id: 'u1', title: 'User Tpl', description: '', category: 'custom',
        content: {}, placeholders: [], isBuiltIn: false, createdAt: '', updatedAt: '',
      }
      mockListTemplates.mockResolvedValue([builtinTemplate, newTpl])

      await store.saveAsTemplate(newTpl)

      expect(mockSaveTemplate).toHaveBeenCalledWith(newTpl)
      expect(store.templates.length).toBe(2)
    })

    it('sets error on save failure', async () => {
      mockSaveTemplate.mockRejectedValue(new Error('write failed'))
      const store = createStore()

      await store.saveAsTemplate(builtinTemplate)

      expect(store.templatesError).toBe('write failed')
    })
  })

  describe('removeTemplate', () => {
    it('deletes and reloads templates', async () => {
      mockDeleteTemplate.mockResolvedValue(undefined)
      const store = createStore()
      await store.loadTemplates()

      mockListTemplates.mockResolvedValue([])
      await store.removeTemplate('u1')

      expect(mockDeleteTemplate).toHaveBeenCalledWith('u1')
      expect(store.templates).toEqual([])
    })
  })

  describe('duplicateTemplate', () => {
    it('clones template and reloads list', async () => {
      const dup: Template = {
        ...builtinTemplate, id: 'dup1', title: 'Copy', isBuiltIn: false, category: 'custom',
      }
      mockDuplicateTemplate.mockResolvedValue(dup)
      const store = createStore()
      await store.loadTemplates()

      mockListTemplates.mockResolvedValue([builtinTemplate, dup])
      const result = await store.duplicateTemplate('builtin-basic-chapter', 'Copy')

      expect(result.title).toBe('Copy')
      expect(mockDuplicateTemplate).toHaveBeenCalledWith('builtin-basic-chapter', 'Copy')
    })
  })
})
