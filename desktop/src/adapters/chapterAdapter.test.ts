import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolveCurrentContentId, resolveCurrentProjectId } from './chapterAdapter'
import { useAppStore } from '../stores/appStore'

vi.mock('../stores/appStore', () => ({
  useAppStore: {
    getState: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('chapterAdapter', () => {
  describe('resolveCurrentContentId', () => {
    it('returns chapter id when set', () => {
      vi.mocked(useAppStore.getState).mockReturnValue({
        currentChapterId: 'ch1',
        currentConversationId: null,
      } as never)

      expect(resolveCurrentContentId()).toBe('ch1')
    })

    it('returns conversation id when no chapter', () => {
      vi.mocked(useAppStore.getState).mockReturnValue({
        currentChapterId: null,
        currentConversationId: 'conv1',
      } as never)

      expect(resolveCurrentContentId()).toBe('conv1')
    })

    it('returns global fallback', () => {
      vi.mocked(useAppStore.getState).mockReturnValue({
        currentChapterId: null,
        currentConversationId: null,
      } as never)

      expect(resolveCurrentContentId()).toBe('__global__')
    })
  })

  describe('resolveCurrentProjectId', () => {
    it('returns current project id', () => {
      vi.mocked(useAppStore.getState).mockReturnValue({
        currentProjectId: 'proj1',
      } as never)

      expect(resolveCurrentProjectId()).toBe('proj1')
    })

    it('returns null when no project', () => {
      vi.mocked(useAppStore.getState).mockReturnValue({
        currentProjectId: null,
      } as never)

      expect(resolveCurrentProjectId()).toBeNull()
    })
  })
})
