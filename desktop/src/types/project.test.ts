import { describe, expect, it } from 'vitest'
import {
  createProject,
  createVolume,
  createChapter,
  emptyProjectMeta,
} from './project'

describe('project factory functions', () => {
  it('createProject generates valid project', () => {
    const p = createProject('Test')
    expect(p.id).toBeTruthy()
    expect(p.name).toBe('Test')
    expect(p.createdAt).toBeTruthy()
    expect(p.updatedAt).toBeTruthy()
  })

  it('createProject generates unique IDs', () => {
    const a = createProject('A')
    const b = createProject('B')
    expect(a.id).not.toBe(b.id)
  })

  it('createVolume links to project', () => {
    const v = createVolume('pid1', '卷一', 0)
    expect(v.id).toBeTruthy()
    expect(v.projectId).toBe('pid1')
    expect(v.title).toBe('卷一')
    expect(v.order).toBe(0)
  })

  it('createChapter links to volume', () => {
    const c = createChapter('vid1', '第一章', 2)
    expect(c.id).toBeTruthy()
    expect(c.volumeId).toBe('vid1')
    expect(c.title).toBe('第一章')
    expect(c.order).toBe(2)
  })

  it('emptyProjectMeta creates valid default meta', () => {
    const meta = emptyProjectMeta()
    expect(meta.project.name).toBe('未命名项目')
    expect(meta.project.id).toBeTruthy()
    expect(meta.volumes).toHaveLength(0)
    expect(meta.chapters).toHaveLength(0)
  })
})
