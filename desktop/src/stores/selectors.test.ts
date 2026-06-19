import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@/api/client', () => ({
  checkBackendHealth: vi.fn().mockResolvedValue(true),
  listSkills: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))

import { useAppStore } from './appStore'
import {
  useAddMessage,
  useAllowLlmFallback,
  useAvailableSkills,
  useBackendStatus,
  useCheckBackend,
  useChatAreaSettings,
  useConversationList,
  useCreateConversation,
  useCurrentConversation,
  useCurrentConversationId,
  useDocumentEditorState,
  useEvaluationSettings,
  useLatestAssistantMessageContent,
  useMessages,
  useQualityGoals,
  useSelectConversation,
  useSelectedSkills,
  useWritingHelperSkillsState,
  useWorkflowLevel,
} from './selectors'

describe('selectors', () => {
  beforeEach(() => {
    useAppStore.setState({
      backendStatus: false,
      conversationsById: {},
      allConversationIds: [],
      currentConversationId: null,
      availableSkills: ['skill-a', 'skill-b'],
      selectedSkills: [],
      loadingMap: {},
    })
  })

  describe('useCurrentConversationId', () => {
    it('returns null when no conversation is selected', () => {
      const { result } = renderHook(() => useCurrentConversationId())
      expect(result.current).toBeNull()
    })

    it('returns current conversation id', () => {
      useAppStore.getState().createConversation()
      const convId = useAppStore.getState().currentConversationId!

      const { result } = renderHook(() => useCurrentConversationId())
      expect(result.current).toBe(convId)
    })
  })

  describe('useCurrentConversation', () => {
    it('returns undefined when no conversation is selected', () => {
      const { result } = renderHook(() => useCurrentConversation())
      expect(result.current).toBeUndefined()
    })

    it('returns the current conversation object', () => {
      useAppStore.getState().createConversation()
      const convId = useAppStore.getState().currentConversationId!

      const { result } = renderHook(() => useCurrentConversation())
      expect(result.current).toBeDefined()
      expect(result.current!.id).toBe(convId)
    })
  })

  describe('useMessages', () => {
    it('returns empty array when no conversation is selected', () => {
      const { result } = renderHook(() => useMessages())
      expect(result.current).toEqual([])
    })

    it('returns empty array when the selected conversation entry is missing', () => {
      act(() => {
        useAppStore.setState({
          currentConversationId: 'missing-conversation',
          conversationsById: {},
        })
      })

      const { result } = renderHook(() => useMessages())
      expect(result.current).toEqual([])
    })

    it('returns messages of the current conversation', () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().addMessage('user', 'Hello')
      useAppStore.getState().addMessage('assistant', 'Hi there')

      const { result } = renderHook(() => useMessages())
      expect(result.current).toHaveLength(2)
      expect(result.current[0].content).toBe('Hello')
      expect(result.current[1].content).toBe('Hi there')
    })
  })

  describe('useLatestAssistantMessageContent', () => {
    it('returns empty string when no conversation exists', () => {
      const { result } = renderHook(() => useLatestAssistantMessageContent())
      expect(result.current).toBe('')
    })

    it('returns empty string when no assistant messages', () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().addMessage('user', 'Only user message')

      const { result } = renderHook(() => useLatestAssistantMessageContent())
      expect(result.current).toBe('')
    })

    it('returns empty string when the selected conversation entry is missing', () => {
      act(() => {
        useAppStore.setState({
          currentConversationId: 'missing-conversation',
          conversationsById: {},
        })
      })

      const { result } = renderHook(() => useLatestAssistantMessageContent())
      expect(result.current).toBe('')
    })

    it('returns the last assistant message content', () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().addMessage('user', 'Q1')
      useAppStore.getState().addMessage('assistant', 'A1')
      useAppStore.getState().addMessage('user', 'Q2')
      useAppStore.getState().addMessage('assistant', 'A2')

      const { result } = renderHook(() => useLatestAssistantMessageContent())
      expect(result.current).toBe('A2')
    })

    it('falls back to empty content when the latest assistant message has no text', () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().addMessage('assistant', '')

      const { result } = renderHook(() => useLatestAssistantMessageContent())
      expect(result.current).toBe('')
    })
  })

  describe('useConversationList', () => {
    it('returns empty array when no conversations exist', () => {
      const { result } = renderHook(() => useConversationList())
      expect(result.current).toEqual([])
    })

    it('returns all conversations ordered by id list', () => {
      useAppStore.getState().createConversation()
      useAppStore.getState().createConversation()
      useAppStore.getState().createConversation()

      const { result } = renderHook(() => useConversationList())
      expect(result.current).toHaveLength(3)
    })

    it('reflects updates when conversations are added', () => {
      const { result } = renderHook(() => useConversationList())

      expect(result.current).toHaveLength(0)

      act(() => {
        useAppStore.getState().createConversation()
      })

      expect(result.current).toHaveLength(1)
    })
  })

  describe('useSelectedSkills', () => {
    it('returns empty array initially', () => {
      const { result } = renderHook(() => useSelectedSkills())
      expect(result.current).toEqual([])
    })

    it('returns updated skills after toggle', () => {
      const { result } = renderHook(() => useSelectedSkills())

      act(() => {
        useAppStore.getState().toggleSkill('skill-a')
      })

      expect(result.current).toEqual(['skill-a'])

      act(() => {
        useAppStore.getState().toggleSkill('skill-b')
      })

      expect(result.current).toEqual(['skill-a', 'skill-b'])

      act(() => {
        useAppStore.getState().toggleSkill('skill-a')
      })

      expect(result.current).toEqual(['skill-b'])
    })

    it('returns available skills through its shallow selector', () => {
      const { result } = renderHook(() => useAvailableSkills())
      expect(result.current).toEqual(['skill-a', 'skill-b'])
    })
  })

  describe('action selectors', () => {
    it('returns stable createConversation action reference', () => {
      const { result, rerender } = renderHook(() => useCreateConversation())
      const firstReference = result.current

      rerender()

      expect(result.current).toBe(firstReference)
    })

    it('returns stable addMessage action reference', () => {
      const { result, rerender } = renderHook(() => useAddMessage())
      const firstReference = result.current

      rerender()

      expect(result.current).toBe(firstReference)
    })

    it('returns stable selectConversation action reference', () => {
      const { result, rerender } = renderHook(() => useSelectConversation())
      const firstReference = result.current

      rerender()

      expect(result.current).toBe(firstReference)
    })

    it('returns stable checkBackend action reference', () => {
      const { result, rerender } = renderHook(() => useCheckBackend())
      const firstReference = result.current

      rerender()

      expect(result.current).toBe(firstReference)
    })
  })

  describe('useBackendStatus', () => {
    it('returns initial backendStatus value', () => {
      const { result } = renderHook(() => useBackendStatus())
      expect(result.current).toBe(false)
    })

    it('reflects backendStatus changes', () => {
      const { result } = renderHook(() => useBackendStatus())
      expect(result.current).toBe(false)

      act(() => {
        useAppStore.setState({ backendStatus: true })
      })

      expect(result.current).toBe(true)
    })
  })

  describe('batched selectors', () => {
    it('returns a null conversation title when the selected conversation entry is unavailable', () => {
      act(() => {
        useAppStore.setState({
          currentConversationId: 'missing-conversation',
          conversationsById: {},
        })
      })

      const { result } = renderHook(() => useDocumentEditorState())
      expect(result.current.currentConversationTitle).toBeNull()
    })

    it('normalizes missing personalized craft recommendations to an empty array', () => {
      act(() => {
        useAppStore.setState({
          personalizedCraftRecommendations: null as unknown as string[],
        })
      })

      const { result } = renderHook(() => useWritingHelperSkillsState())
      expect(result.current.selectedSkills).toEqual([])
      expect(result.current.availableSkills).toEqual(['skill-a', 'skill-b'])
      expect(result.current.personalizedCraftRecommendations).toEqual([])
    })
  })
})

describe('settings-based selectors', () => {
  it('useWorkflowLevel returns a default value', () => {
    const { result } = renderHook(() => useWorkflowLevel())
    expect(['L1', 'L2', 'L3', 'L4', 'L5']).toContain(result.current)
  })

  it('useAllowLlmFallback returns a boolean', () => {
    const { result } = renderHook(() => useAllowLlmFallback())
    expect(typeof result.current).toBe('boolean')
  })

  it('useQualityGoals returns quality goals object', () => {
    const { result } = renderHook(() => useQualityGoals())
    expect(result.current).toBeDefined()
    expect(typeof result.current).toBe('object')
  })

  it('useChatAreaSettings returns grouped template helpers', () => {
    const { result } = renderHook(() => useChatAreaSettings())
    expect(result.current.settings).toBeDefined()
    expect(typeof result.current.toggleTemplateFavorite).toBe('function')
    expect(typeof result.current.recordTemplateUsage).toBe('function')
    expect(typeof result.current.setTemplateVariablePreset).toBe('function')
  })

  it('useEvaluationSettings returns grouped evaluation preferences', () => {
    const { result } = renderHook(() => useEvaluationSettings())
    expect(result.current.qualityGoals).toBeDefined()
    expect(typeof result.current.detectionEvasionGuardEnabled).toBe('boolean')
  })
})
