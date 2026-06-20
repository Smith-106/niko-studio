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
  saveTemplate,
} from './templateService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('templateService branch-gap additional coverage', () => {
  describe('listTemplates', () => {
    it('covers outer catch when readDir throws (line 46)', async () => {
      mockFs.exists.mockResolvedValue(true)
      mockFs.readDir.mockRejectedValue(new Error('filesystem error'))

      const templates = await listTemplates()

      // Should return only builtins since readDir failed
      expect(templates.length).toBeGreaterThanOrEqual(5)
      expect(templates.every((t) => t.isBuiltIn)).toBe(true)
    })

    it('covers hidden file filter - entry ending with .json but starting with dot (line 36)', async () => {
      const userTpl = {
        id: 'user1', title: 'Visible', description: '', category: 'custom',
        content: {}, placeholders: [], isBuiltIn: false, createdAt: '', updatedAt: '',
      }

      mockFs.exists.mockResolvedValue(true)
      mockFs.readDir.mockResolvedValue([
        { name: '.hidden.json' } as any,
        { name: 'user1.json' } as any,
        { name: 'readme.txt' } as any,
      ])
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(userTpl))

      const templates = await listTemplates()

      // .hidden.json should be filtered out; readme.txt should be filtered out
      expect(templates.some((t) => t.id === 'user1')).toBe(true)
      expect(templates.some((t) => t.id === '.hidden')).toBe(false)
    })
  })

  describe('saveTemplate', () => {
    it('covers ensureDir when directory already exists (line 8 false branch)', async () => {
      mockFs.exists.mockResolvedValue(true)

      const tpl = {
        id: 'existing1', title: 'Existing', description: '', category: 'custom' as const,
        content: {}, placeholders: [], isBuiltIn: true, createdAt: '', updatedAt: '',
      }

      await saveTemplate(tpl)

      expect(mockFs.mkdir).not.toHaveBeenCalled()
      expect(mockFs.writeTextFile).toHaveBeenCalled()
    })
  })
})
