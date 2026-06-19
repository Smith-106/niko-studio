import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    const next = typeof partial === 'function' ? partial(state as never) : partial
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

const templateFixture: Template = {
  id: 'builtin-1',
  title: 'Builtin template',
  description: '',
  category: 'structure',
  content: { type: 'doc' },
  placeholders: [],
  isBuiltIn: true,
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListTemplates.mockResolvedValue([templateFixture])
})

describe('templateSlice branch coverage additional', () => {
  describe('loadTemplates error and loading boundaries', () => {
    it('clears templatesError at start of loadTemplates', async () => {
      const store = createStore()
      store.templatesError = 'stale error'

      mockListTemplates.mockResolvedValue([templateFixture])
      await store.loadTemplates()

      expect(store.templatesError).toBeNull()
      expect(store.templates).toEqual([templateFixture])
    })

    it('sets templatesLoading to false after successful load', async () => {
      const store = createStore()

      await store.loadTemplates()

      expect(store.templatesLoading).toBe(false)
    })

    it('sets templatesLoading to false after failed load', async () => {
      mockListTemplates.mockRejectedValue(new Error('disk error'))
      const store = createStore()

      await store.loadTemplates()

      expect(store.templatesLoading).toBe(false)
      expect(store.templatesError).toBe('disk error')
    })

    it('handles loadTemplates with category filter returning empty results', async () => {
      mockListTemplates.mockResolvedValue([])
      const store = createStore()

      await store.loadTemplates('custom')

      expect(store.templates).toEqual([])
      expect(store.templatesLoading).toBe(false)
      expect(mockListTemplates).toHaveBeenCalledWith('custom')
    })

    it('handles loadTemplates error with non-Error value (number)', async () => {
      mockListTemplates.mockRejectedValue(503)
      const store = createStore()

      await store.loadTemplates()

      expect(store.templatesError).toBe('Failed to load templates')
      expect(store.templatesLoading).toBe(false)
    })

    it('handles loadTemplates error with non-Error value (null)', async () => {
      mockListTemplates.mockRejectedValue(null)
      const store = createStore()

      await store.loadTemplates()

      expect(store.templatesError).toBe('Failed to load templates')
    })
  })

  describe('empty template list handling', () => {
    it('starts with empty templates array', () => {
      const store = createStore()
      expect(store.templates).toEqual([])
    })

    it('replaces existing templates with empty array from server', async () => {
      const store = createStore()
      store.templates = [templateFixture]

      mockListTemplates.mockResolvedValue([])
      await store.loadTemplates()

      expect(store.templates).toEqual([])
    })

    it('loads templates with all categories', async () => {
      const multiCategoryTemplates: Template[] = [
        templateFixture,
        {
          ...templateFixture,
          id: 'tpl-2',
          title: 'Genre template',
          category: 'genre',
        },
        {
          ...templateFixture,
          id: 'tpl-3',
          title: 'Format template',
          category: 'format',
        },
      ]
      mockListTemplates.mockResolvedValue(multiCategoryTemplates)
      const store = createStore()

      await store.loadTemplates()

      expect(store.templates).toHaveLength(3)
    })
  })

  describe('invalid template data boundaries', () => {
    it('stores templates returned by the service even with unusual field values', async () => {
      const unusualTemplate: Template = {
        id: '',
        title: '',
        description: '',
        category: 'custom',
        content: {},
        placeholders: [],
        isBuiltIn: false,
        createdAt: '',
        updatedAt: '',
      }
      mockListTemplates.mockResolvedValue([unusualTemplate])
      const store = createStore()

      await store.loadTemplates()

      expect(store.templates).toEqual([unusualTemplate])
    })

    it('stores template with empty content and placeholders', async () => {
      const minimalTemplate: Template = {
        id: 'min-1',
        title: 'Minimal',
        description: '',
        category: 'custom',
        content: {},
        placeholders: [],
        isBuiltIn: false,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }
      mockListTemplates.mockResolvedValue([minimalTemplate])
      const store = createStore()

      await store.loadTemplates()

      expect(store.templates[0].content).toEqual({})
      expect(store.templates[0].placeholders).toEqual([])
    })
  })

  describe('saveAsTemplate error paths', () => {
    it('re-fetches templates after successful save', async () => {
      mockSaveTemplate.mockResolvedValue(undefined)
      const store = createStore()

      await store.saveAsTemplate(templateFixture)

      expect(mockSaveTemplate).toHaveBeenCalledWith(templateFixture)
      expect(mockListTemplates).toHaveBeenCalled()
    })

    it('does not re-fetch templates after failed save', async () => {
      mockSaveTemplate.mockRejectedValue(new Error('write error'))
      const store = createStore()
      mockListTemplates.mockClear()

      await store.saveAsTemplate(templateFixture)

      expect(mockListTemplates).not.toHaveBeenCalled()
      expect(store.templatesError).toBe('write error')
    })

    it('sets generic error for non-Error save rejection (boolean)', async () => {
      mockSaveTemplate.mockRejectedValue(false)
      const store = createStore()

      await store.saveAsTemplate(templateFixture)

      expect(store.templatesError).toBe('Failed to save template')
    })

    it('sets generic error for non-Error save rejection (object)', async () => {
      mockSaveTemplate.mockRejectedValue({ status: 409 })
      const store = createStore()

      await store.saveAsTemplate(templateFixture)

      expect(store.templatesError).toBe('Failed to save template')
    })
  })

  describe('removeTemplate error paths', () => {
    it('re-fetches templates after successful remove', async () => {
      mockDeleteTemplate.mockResolvedValue(undefined)
      const store = createStore()

      await store.removeTemplate('builtin-1')

      expect(mockDeleteTemplate).toHaveBeenCalledWith('builtin-1')
      expect(mockListTemplates).toHaveBeenCalled()
    })

    it('does not re-fetch templates after failed remove', async () => {
      mockDeleteTemplate.mockRejectedValue(new Error('permission denied'))
      const store = createStore()
      mockListTemplates.mockClear()

      await store.removeTemplate('builtin-1')

      expect(mockListTemplates).not.toHaveBeenCalled()
      expect(store.templatesError).toBe('permission denied')
    })
  })

  describe('duplicateTemplate error propagation', () => {
    it('propagates error when cloneTemplate throws (no catch block)', async () => {
      mockDuplicateTemplate.mockRejectedValue(new Error('duplicate failed'))
      const store = createStore()

      await expect(store.duplicateTemplate('builtin-1', 'Copy')).rejects.toThrow('duplicate failed')
    })

    it('propagates error with non-Error value when cloneTemplate throws', async () => {
      mockDuplicateTemplate.mockRejectedValue('string error')
      const store = createStore()

      await expect(store.duplicateTemplate('builtin-1', 'Copy')).rejects.toBe('string error')
    })

    it('re-fetches templates after successful duplicate', async () => {
      const duplicate: Template = {
        ...templateFixture,
        id: 'dup-1',
        title: 'Copy',
        isBuiltIn: false,
      }
      mockDuplicateTemplate.mockResolvedValue(duplicate)
      mockListTemplates.mockResolvedValue([templateFixture, duplicate])
      const store = createStore()

      const result = await store.duplicateTemplate('builtin-1', 'Copy')

      expect(result).toEqual(duplicate)
      expect(mockListTemplates).toHaveBeenCalled()
      expect(store.templates).toHaveLength(2)
    })

    it('does not set templatesError when duplicateTemplate throws', async () => {
      mockDuplicateTemplate.mockRejectedValue(new Error('clone error'))
      const store = createStore()

      try {
        await store.duplicateTemplate('builtin-1', 'Copy')
      } catch {
        // Expected to throw
      }

      // duplicateTemplate has no catch block, so templatesError is never set
      expect(store.templatesError).toBeNull()
    })
  })

  describe('saveAsTemplate and removeTemplate interaction', () => {
    it('preserves templatesError from save when remove also fails', async () => {
      const store = createStore()

      mockSaveTemplate.mockRejectedValue(new Error('save fail'))
      await store.saveAsTemplate(templateFixture)
      expect(store.templatesError).toBe('save fail')

      mockDeleteTemplate.mockRejectedValue(new Error('delete fail'))
      await store.removeTemplate('builtin-1')
      // The most recent error overwrites the previous one
      expect(store.templatesError).toBe('delete fail')
    })
  })
})
