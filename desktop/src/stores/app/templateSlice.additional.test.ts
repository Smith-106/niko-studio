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

describe('templateSlice additional coverage', () => {
  it('uses fallback messages for non-Error rejections', async () => {
    const store = createStore()

    mockListTemplates.mockRejectedValueOnce('load failed')
    await store.loadTemplates()
    expect(store.templatesError).toBe('Failed to load templates')
    expect(store.templatesLoading).toBe(false)

    mockSaveTemplate.mockRejectedValueOnce({ message: 'save failed' })
    await store.saveAsTemplate(templateFixture)
    expect(store.templatesError).toBe('Failed to save template')

    mockDeleteTemplate.mockRejectedValueOnce(false)
    await store.removeTemplate(templateFixture.id)
    expect(store.templatesError).toBe('Failed to delete template')
  })

  it('reloads after duplicateTemplate resolves', async () => {
    const duplicate: Template = {
      ...templateFixture,
      id: 'duplicate-1',
      title: 'Duplicate',
      isBuiltIn: false,
      category: 'custom',
    }
    const store = createStore()

    mockDuplicateTemplate.mockResolvedValueOnce(duplicate)
    mockListTemplates.mockResolvedValueOnce([templateFixture, duplicate])

    const result = await store.duplicateTemplate(templateFixture.id, duplicate.title)

    expect(result).toEqual(duplicate)
    expect(mockDuplicateTemplate).toHaveBeenCalledWith(templateFixture.id, duplicate.title)
    expect(store.templates).toEqual([templateFixture, duplicate])
  })
})
