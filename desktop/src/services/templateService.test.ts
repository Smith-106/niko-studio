import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => mockFs)

import {
  listTemplates,
  getTemplate,
  saveTemplate,
  deleteTemplate,
  duplicateTemplate,
  substitutePlaceholders,
  extractPlaceholders,
} from './templateService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('templateService', () => {
  describe('listTemplates', () => {
    it('returns builtins when no user templates', async () => {
      mockFs.exists.mockResolvedValue(false)
      const templates = await listTemplates()
      expect(templates.length).toBeGreaterThanOrEqual(5) // 5 builtins
      expect(templates.some((t) => t.isBuiltIn)).toBe(true)
    })

    it('filters by category', async () => {
      mockFs.exists.mockResolvedValue(false)
      const structure = await listTemplates('structure')
      expect(structure.every((t) => t.category === 'structure')).toBe(true)
    })

    it('merges user templates with builtins', async () => {
      const userTpl = {
        id: 'user1', title: 'My Template', description: '', category: 'custom',
        content: {}, placeholders: [], isBuiltIn: false, createdAt: '', updatedAt: '',
      }
      mockFs.exists.mockResolvedValue(true)
      mockFs.readDir.mockResolvedValue([{ name: 'user1.json' } as any])
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(userTpl))

      const templates = await listTemplates()
      expect(templates.some((t) => t.id === 'user1')).toBe(true)
      expect(templates.some((t) => t.isBuiltIn)).toBe(true)
    })

    it('skips corrupted user template files and keeps valid ones', async () => {
      const userTpl = {
        id: 'user2', title: 'Healthy Template', description: '', category: 'custom',
        content: {}, placeholders: [], isBuiltIn: false, createdAt: '', updatedAt: '',
      }

      mockFs.exists.mockResolvedValue(true)
      mockFs.readDir.mockResolvedValue([{ name: 'broken.json' } as any, { name: 'user2.json' } as any])
      mockFs.readTextFile
        .mockResolvedValueOnce('{broken json')
        .mockResolvedValueOnce(JSON.stringify(userTpl))

      const templates = await listTemplates()

      expect(templates.some((t) => t.id === 'user2')).toBe(true)
      expect(templates.some((t) => t.id === 'broken')).toBe(false)
    })
  })

  describe('getTemplate', () => {
    it('returns builtin by id', async () => {
      const result = await getTemplate('builtin-basic-chapter')
      expect(result).not.toBeNull()
      expect(result!.isBuiltIn).toBe(true)
    })

    it('returns user template from filesystem', async () => {
      const userTpl = { id: 'u1', title: 'T', category: 'custom' }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(userTpl))
      const result = await getTemplate('u1')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('u1')
    })

    it('returns null when not found', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('not found'))
      const result = await getTemplate('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('saveTemplate', () => {
    it('writes template with isBuiltIn=false and timestamps', async () => {
      const tpl = {
        id: 'new1', title: 'New', description: '', category: 'custom' as const,
        content: {}, placeholders: [], isBuiltIn: true, createdAt: '', updatedAt: '',
      }
      mockFs.exists.mockResolvedValue(false)
      await saveTemplate(tpl)

      expect(mockFs.mkdir).toHaveBeenCalled()
      const written = JSON.parse(mockFs.writeTextFile.mock.calls[0][1])
      expect(written.isBuiltIn).toBe(false)
      expect(written.updatedAt).toBeTruthy()
    })
  })

  describe('deleteTemplate', () => {
    it('removes file when it exists', async () => {
      mockFs.exists.mockResolvedValue(true)
      await deleteTemplate('u1')
      expect(mockFs.remove).toHaveBeenCalledWith('templates/u1.json')
    })

    it('does nothing when file does not exist', async () => {
      mockFs.exists.mockResolvedValue(false)
      await deleteTemplate('u1')
      expect(mockFs.remove).not.toHaveBeenCalled()
    })
  })

  describe('duplicateTemplate', () => {
    it('creates copy with new id and custom category', async () => {
      const source = {
        id: 'builtin-basic-chapter', title: 'Basic', description: '', category: 'structure' as const,
        content: { type: 'doc' }, placeholders: [], isBuiltIn: true, createdAt: '2024-01-01', updatedAt: '2024-01-01',
      }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(source))
      mockFs.exists.mockResolvedValue(false)

      const dup = await duplicateTemplate('builtin-basic-chapter', 'My Copy')
      expect(dup.title).toBe('My Copy')
      expect(dup.category).toBe('custom')
      expect(dup.isBuiltIn).toBe(false)
      expect(dup.id).not.toBe('builtin-basic-chapter')
    })

    it('throws when the source template cannot be resolved', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('not found'))

      await expect(duplicateTemplate('missing-template', 'Missing Copy')).rejects.toThrow(
        'Template not found: missing-template',
      )
    })
  })

  describe('substitutePlaceholders', () => {
    it('replaces {{key}} patterns in content', () => {
      const content = { text: 'Hello {{name}}, welcome to {{place}}!' }
      const result = substitutePlaceholders(content, { name: 'World', place: 'Niko' })
      expect(result.text).toBe('Hello World, welcome to Niko!')
    })

    it('leaves unreferenced placeholders intact', () => {
      const content = { text: '{{a}} {{b}}' }
      const result = substitutePlaceholders(content, { a: 'X' })
      expect(result.text).toBe('X {{b}}')
    })
  })

  describe('extractPlaceholders', () => {
    it('finds unique placeholder names', () => {
      const content = { a: '{{x}}', b: '{{x}} {{y}}' }
      const placeholders = extractPlaceholders(content)
      expect(placeholders).toEqual(expect.arrayContaining(['x', 'y']))
      expect(placeholders.length).toBe(2)
    })

    it('returns empty array when no placeholders', () => {
      const content = { text: 'no placeholders here' }
      expect(extractPlaceholders(content)).toEqual([])
    })
  })
})
