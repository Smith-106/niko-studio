import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkBackendHealthMock = vi.hoisted(() => vi.fn())
const listSkillsMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  checkBackendHealth: checkBackendHealthMock,
  listSkills: listSkillsMock,
}))

import { useAppStore } from './appStore'
import { DEFAULT_AVAILABLE_SKILLS } from './app/skillsSlice'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      backendStatus: false,
      currentWorkspace: useAppStore.getState().currentWorkspace,
      conversationsById: {},
      allConversationIds: [],
      currentConversationId: null,
      availableSkills: DEFAULT_AVAILABLE_SKILLS.slice(0, 4),
      selectedSkills: [],
      loadingMap: {},
      focusMode: false,
      wordMetrics: { wordCount: 0, charCount: 0, readingTime: 0 },
    })
    vi.clearAllMocks()
  })

  describe('backend health', () => {
    it('sets backendStatus to true when health check passes', async () => {
      checkBackendHealthMock.mockResolvedValue(true)

      await useAppStore.getState().checkBackend()

      expect(useAppStore.getState().backendStatus).toBe(true)
    })

    it('sets backendStatus to false when health check fails', async () => {
      checkBackendHealthMock.mockResolvedValue(false)

      await useAppStore.getState().checkBackend()

      expect(useAppStore.getState().backendStatus).toBe(false)
    })

    it('sets backendStatus to false when health check throws', async () => {
      checkBackendHealthMock.mockRejectedValue(new Error('network error'))

      await useAppStore.getState().checkBackend()

      expect(useAppStore.getState().backendStatus).toBe(false)
    })
  })

  describe('conversations', () => {
    it('creates a new conversation and sets it as current', () => {
      useAppStore.getState().createConversation()

      const state = useAppStore.getState()
      expect(state.allConversationIds).toHaveLength(1)
      expect(state.currentConversationId).not.toBeNull()
      const convId = state.currentConversationId!
      expect(state.conversationsById[convId]).toBeDefined()
      expect(state.conversationsById[convId].messages).toHaveLength(0)
      expect(state.conversationsById[convId].title).toBe('新对话')
    })

    it('adds a user message to the current conversation', () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().addMessage('user', 'Hello world')

      const convId = useAppStore.getState().currentConversationId!
      const messages = useAppStore.getState().conversationsById[convId].messages
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Hello world')
    })

    it('auto-creates conversation when adding message without one', () => {
      expect(useAppStore.getState().currentConversationId).toBeNull()

      useAppStore.getState().addMessage('user', 'First message')

      expect(useAppStore.getState().currentConversationId).not.toBeNull()
      const convId = useAppStore.getState().currentConversationId!
      expect(useAppStore.getState().conversationsById[convId].messages).toHaveLength(1)
    })

    it('adds assistant message with skills', () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().addMessage('assistant', 'Response text', ['writer'])

      const convId = useAppStore.getState().currentConversationId!
      const msg = useAppStore.getState().conversationsById[convId].messages[0]
      expect(msg.role).toBe('assistant')
      expect(msg.skills).toEqual(['writer'])
    })

    it('deletes a message by id', async () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().addMessage('user', 'Keep')

      await new Promise((r) => setTimeout(r, 2))

      useAppStore.getState().addMessage('user', 'Delete')

      const convId = useAppStore.getState().currentConversationId!
      const messages = useAppStore.getState().conversationsById[convId].messages
      expect(messages).toHaveLength(2)
      expect(messages[0].id).not.toBe(messages[1].id)

      const deleteId = messages[1].id
      useAppStore.getState().deleteMessage(deleteId)

      const remaining = useAppStore.getState().conversationsById[convId].messages
      expect(remaining).toHaveLength(1)
      expect(remaining[0].content).toBe('Keep')
    })

    it('edits a message content', () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().addMessage('user', 'Original')

      const convId = useAppStore.getState().currentConversationId!
      const msgId = useAppStore.getState().conversationsById[convId].messages[0].id
      useAppStore.getState().editMessage(msgId, 'Edited')

      const edited = useAppStore.getState().conversationsById[convId].messages[0]
      expect(edited.content).toBe('Edited')
    })

    it('selects a conversation and updates currentConversationId', () => {
      useAppStore.getState().createConversation()
      const firstId = useAppStore.getState().currentConversationId!
      useAppStore.getState().createConversation()
      const secondId = useAppStore.getState().currentConversationId!

      expect(useAppStore.getState().currentConversationId).toBe(secondId)

      useAppStore.getState().selectConversation(firstId)
      expect(useAppStore.getState().currentConversationId).toBe(firstId)
    })

    it('ignores selectConversation for non-existent id', () => {
      useAppStore.getState().createConversation()
      const currentId = useAppStore.getState().currentConversationId!

      useAppStore.getState().selectConversation('non-existent')
      expect(useAppStore.getState().currentConversationId).toBe(currentId)
    })

    it('updates conversation title', () => {
      useAppStore.getState().createConversation()
      const convId = useAppStore.getState().currentConversationId!

      useAppStore.getState().updateConversationTitle(convId, 'New Title')
      expect(useAppStore.getState().conversationsById[convId].title).toBe('New Title')
    })

    it('does not update title when value is unchanged', () => {
      useAppStore.getState().createConversation()
      const convId = useAppStore.getState().currentConversationId!
      const conv = useAppStore.getState().conversationsById[convId]

      useAppStore.getState().updateConversationTitle(convId, conv.title)
      expect(useAppStore.getState().conversationsById[convId].title).toBe(conv.title)
    })

    it('getConversationById returns conversation or undefined', () => {
      useAppStore.getState().createConversation()
      const convId = useAppStore.getState().currentConversationId!

      expect(useAppStore.getState().getConversationById(convId)).toBeDefined()
      expect(useAppStore.getState().getConversationById('missing')).toBeUndefined()
    })
  })

  describe('skills', () => {
    it('toggles a skill on', () => {
      useAppStore.getState().toggleSkill('character-forge')
      expect(useAppStore.getState().selectedSkills).toContain('character-forge')
    })

    it('toggles a skill off', () => {
      useAppStore.getState().toggleSkill('character-forge')
      useAppStore.getState().toggleSkill('character-forge')
      expect(useAppStore.getState().selectedSkills).not.toContain('character-forge')
    })

    it('refreshes available skills from API', async () => {
      listSkillsMock.mockResolvedValue({
        success: true,
        data: [
          { id: 'skill-a' },
          { id: 'skill-b' },
          { id: 'skill-c' },
        ],
      })

      await useAppStore.getState().refreshAvailableSkills()

      const state = useAppStore.getState()
      expect(state.availableSkills).toEqual(['skill-a', 'skill-b', 'skill-c'])
    })

    it('filters out invalid skill ids from API response', async () => {
      listSkillsMock.mockResolvedValue({
        success: true,
        data: [
          { id: 'valid' },
          { id: '' },
          { id: '   ' },
          { id: null },
          {},
        ],
      })

      await useAppStore.getState().refreshAvailableSkills()

      expect(useAppStore.getState().availableSkills).toEqual(['valid'])
    })

    it('removes selected skills that are no longer available after refresh', async () => {
      useAppStore.getState().toggleSkill('character-forge')
      listSkillsMock.mockResolvedValue({
        success: true,
        data: [{ id: 'new-skill' }],
      })

      await useAppStore.getState().refreshAvailableSkills()

      expect(useAppStore.getState().selectedSkills).not.toContain('character-forge')
    })

    it('keeps selected skills that remain available after refresh', async () => {
      useAppStore.setState({
        availableSkills: ['skill-a', 'skill-b'],
        selectedSkills: ['skill-a'],
      })
      listSkillsMock.mockResolvedValue({
        success: true,
        data: [{ id: 'skill-a' }, { id: 'skill-c' }],
      })

      await useAppStore.getState().refreshAvailableSkills()

      expect(useAppStore.getState().selectedSkills).toEqual(['skill-a'])
      expect(useAppStore.getState().availableSkills).toEqual(['skill-a', 'skill-c'])
    })

    it('keeps static fallback skills when API returns empty', async () => {
      listSkillsMock.mockResolvedValue({ success: true, data: [] })

      await useAppStore.getState().refreshAvailableSkills()

      expect(useAppStore.getState().availableSkills.length).toBeGreaterThan(0)
    })

    it('ignores dynamic fetch failures and keeps fallback list', async () => {
      listSkillsMock.mockRejectedValue(new Error('network error'))

      await useAppStore.getState().refreshAvailableSkills()

      expect(useAppStore.getState().availableSkills.length).toBeGreaterThan(0)
    })
  })

  describe('loading map', () => {
    it('starts and finishes loading', () => {
      useAppStore.getState().startLoading('test-key')
      expect(useAppStore.getState().isLoading('test-key')).toBe(true)

      useAppStore.getState().finishLoading('test-key')
      expect(useAppStore.getState().isLoading('test-key')).toBe(false)
    })

    it('isLoading returns false for unknown keys', () => {
      expect(useAppStore.getState().isLoading('unknown')).toBe(false)
    })
  })
})
