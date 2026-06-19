import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
  stat: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => mockFs)

import {
  clearChapterContentCache,
  extractText,
  getChapterContentCacheSize,
  invalidateChapterContentCache,
  listProjectIds,
  readChapterContent,
} from './projectFileService'

describe('projectFileService additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearChapterContentCache()
  })

  it('returns plain text when content is not structured json', () => {
    expect(extractText('plain text content')).toBe('plain text content')
  })

  it('extracts text recursively from TipTap content trees', () => {
    const tiptap = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: ' world' },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '!' }],
        },
      ],
    })

    expect(extractText(tiptap)).toBe('Hello world!')
  })

  it('invalidates cached chapter content so the next read hits the filesystem again', async () => {
    mockFs.stat.mockResolvedValue({ mtime: new Date(1000) })
    mockFs.readTextFile
      .mockResolvedValueOnce('chapter data v1')
      .mockResolvedValueOnce('chapter data v2')

    await expect(readChapterContent('project-1', 'chapter-1')).resolves.toBe('chapter data v1')
    await expect(readChapterContent('project-1', 'chapter-1')).resolves.toBe('chapter data v1')
    expect(getChapterContentCacheSize()).toBe(1)
    expect(mockFs.readTextFile).toHaveBeenCalledTimes(1)

    invalidateChapterContentCache('project-1', 'chapter-1')

    expect(getChapterContentCacheSize()).toBe(0)
    await expect(readChapterContent('project-1', 'chapter-1')).resolves.toBe('chapter data v2')
    expect(mockFs.readTextFile).toHaveBeenCalledTimes(2)
  })

  it('returns empty arrays or strings when directory listing or chapter reads fail mid-flight', async () => {
    mockFs.exists.mockResolvedValue(true)
    mockFs.readDir.mockRejectedValue(new Error('fs unavailable'))

    await expect(listProjectIds()).resolves.toEqual([])

    mockFs.stat.mockResolvedValue({ mtime: new Date(2000) })
    mockFs.readTextFile.mockRejectedValue(new Error('read failed'))

    await expect(readChapterContent('project-2', 'chapter-2')).resolves.toBe('')
  })
})
