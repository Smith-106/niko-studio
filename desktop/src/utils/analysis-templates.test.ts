import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BUILTIN_TEMPLATES,
  deleteTemplate,
  loadTemplates,
  saveTemplate,
  updateTemplate,
} from './analysis-templates'

const STORAGE_KEY = 'niko-writing-analysis-templates'

describe('analysis templates', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('loads builtin templates and falls back when stored data is malformed', () => {
    expect(loadTemplates()).toEqual(BUILTIN_TEMPLATES)

    localStorage.setItem(STORAGE_KEY, '{bad json')

    expect(loadTemplates()).toEqual(BUILTIN_TEMPLATES)
  })

  it('saves custom templates and appends them after builtin entries', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_717_171_717_000)

    const saved = saveTemplate({
      name: '情绪优先',
      dimensions: ['emotion', 'dialogue'],
      weights: {
        structure: 0,
        character: 0,
        suspense: 0,
        emotion: 3,
        dialogue: 2,
        webnovel: 0,
        show_tell: 1,
      },
    })

    expect(saved).toMatchObject({
      id: 'custom-1717171717000',
      name: '情绪优先',
    })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      id: 'custom-1717171717000',
      name: '情绪优先',
    })

    expect(loadTemplates()).toEqual([...BUILTIN_TEMPLATES, saved])
  })

  it('recovers from malformed custom template storage during mutations', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000)
    localStorage.setItem(STORAGE_KEY, '{bad json')

    const saved = saveTemplate({
      name: 'Recovered template',
      dimensions: ['structure'],
      weights: {
        structure: 1,
        character: 0,
        suspense: 0,
        emotion: 0,
        dialogue: 0,
        webnovel: 0,
        show_tell: 0,
      },
    })

    expect(saved.id).toBe('custom-2000')
    expect(loadTemplates()).toEqual([...BUILTIN_TEMPLATES, saved])

    localStorage.setItem(STORAGE_KEY, '{bad json')
    expect(updateTemplate('custom-2000', { name: 'Ignored' })).toBeNull()
    expect(deleteTemplate('custom-2000')).toBe(false)
  })

  it('updates only existing custom templates', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'custom-1',
          name: '原模板',
          dimensions: ['structure'],
          weights: {
            structure: 1,
            character: 0,
            suspense: 0,
            emotion: 0,
            dialogue: 0,
            webnovel: 0,
            show_tell: 0,
          },
        },
      ]),
    )

    expect(updateTemplate('full-analysis', { name: '不该更新' })).toBeNull()
    expect(updateTemplate('custom-missing', { name: '缺失模板' })).toBeNull()

    const updated = updateTemplate('custom-1', {
      name: '新模板',
      dimensions: ['structure', 'character'],
    })

    expect(updated).toMatchObject({
      id: 'custom-1',
      name: '新模板',
      dimensions: ['structure', 'character'],
    })

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>
    expect(stored[0]).toMatchObject({
      id: 'custom-1',
      name: '新模板',
      dimensions: ['structure', 'character'],
    })
  })

  it('deletes existing custom templates and reports missing ids', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'custom-1',
          name: '模板一',
          dimensions: ['structure'],
          weights: {
            structure: 1,
            character: 0,
            suspense: 0,
            emotion: 0,
            dialogue: 0,
            webnovel: 0,
            show_tell: 0,
          },
        },
        {
          id: 'custom-2',
          name: '模板二',
          dimensions: ['character'],
          weights: {
            structure: 0,
            character: 1,
            suspense: 0,
            emotion: 0,
            dialogue: 0,
            webnovel: 0,
            show_tell: 0,
          },
        },
      ]),
    )

    expect(deleteTemplate('custom-missing')).toBe(false)
    expect(deleteTemplate('custom-1')).toBe(true)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<Record<string, unknown>>
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id: 'custom-2', name: '模板二' })
  })
})
