import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatArea } from './ChatArea'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { translations } from '../i18n'

vi.mock('../api/client', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
  agentRoute: vi.fn(),
  agentWrite: vi.fn(),
  agentRevise: vi.fn(),
  agentGetContext: vi.fn(),
  createCheckpoint: vi.fn(),
  restoreCheckpoint: vi.fn(),
  uploadMemoryFile: vi.fn(),
}))

import {
  chat,
  chatStream,
  createCheckpoint,
  restoreCheckpoint,
  uploadMemoryFile,
  agentGetContext,
} from '../api/client'

const mockedChat = vi.mocked(chat)
const mockedChatStream = vi.mocked(chatStream)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
const mockedUploadMemoryFile = vi.mocked(uploadMemoryFile)
const mockedAgentGetContext = vi.mocked(agentGetContext)
const zh = translations.zh

function resetStores(): void {
  localStorage.clear()
  useSettingsStore.getState().resetSettings()
  useSettingsStore.setState((state) => ({
    ...state,
    settings: {
      ...state.settings,
      language: 'zh',
    },
  }))

  useAppStore.setState({
    conversationsById: {},
    allConversationIds: [],
    currentConversationId: null,
    selectedSkills: [],
    workflowLevel: 'L3',
    allowLlmFallback: true,
    qualityGoals: {
      naturalness: 80,
      readability: 80,
      coherence: 80,
      styleConsistency: 80,
      humanizationPreset: 'human_writing',
      customHumanizationInstruction: '',
      sentenceEntropyTarget: 55,
      rhythmVariabilityTarget: 55,
    },
  })
}

function setConversationWithAssistant(content: string): void {
  const now = new Date()
  useAppStore.setState({
    conversationsById: {
      c1: {
        id: 'c1',
        title: 'test',
        messages: [
          { id: 'a1', role: 'assistant', content, timestamp: now, skills: [] },
        ],
        createdAt: now,
        updatedAt: now,
      },
    },
    allConversationIds: ['c1'],
    currentConversationId: 'c1',
  })
}

function ControlledTemplateChatArea() {
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)

  return (
    <ChatArea
      isTemplatePanelOpen={isTemplatePanelOpen}
      onTemplatePanelOpenChange={setIsTemplatePanelOpen}
    />
  )
}

describe('ChatArea P0 flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('btoa', (value: string) => value)
    resetStores()
    mockedCreateCheckpoint.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    mockedRestoreCheckpoint.mockResolvedValue({ success: true, data: { status: 'ok' } })
    mockedChat.mockResolvedValue({ success: true, data: { content: 'fallback', skills_used: [] } })
    mockedUploadMemoryFile.mockResolvedValue({
      success: true,
      data: {
        status: 'created',
        file_name: 'a.txt',
        session_id: 'c1',
        chunks: 2,
        memory_ids: ['m1', 'm2'],
      },
    })
    mockedAgentGetContext.mockResolvedValue({ success: true, data: { context: 'ok' } as Record<string, unknown> })
  })

  it('streams content and commits on done without fallback chat', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onContent?.('流式结果', 0)
      callbacks.onDone?.({ status: 'completed', skills_used: [] })
    })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '测试消息{enter}')

    await waitFor(() => {
      expect(screen.getByText('流式结果')).toBeInTheDocument()
    })
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('uses updated quality goals in chat request payload', async () => {
    mockedChatStream.mockResolvedValue()
    mockedChat.mockResolvedValue({
      success: true,
      data: {
        content: 'ok',
        skills_used: [],
      },
    })

    useAppStore.setState({
      qualityGoals: {
        naturalness: 92,
        readability: 74,
        coherence: 88,
        styleConsistency: 67,
        humanizationPreset: 'ai_edit_guidance',
        customHumanizationInstruction: '减少模板化表达',
        sentenceEntropyTarget: 62,
        rhythmVariabilityTarget: 58,
      },
    })

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: zh.chatModeComparison }))
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '质量目标回归{enter}')

    await waitFor(() => {
      expect(mockedChat).toHaveBeenCalledWith(
        expect.objectContaining({
          qualityGoals: {
            naturalness: 92,
            readability: 74,
            coherence: 88,
            style_consistency: 67,
            humanization_preset: 'ai_edit_guidance',
            custom_humanization_instruction: '减少模板化表达',
            sentence_entropy_target: 62,
            rhythm_variability_target: 58,
          },
        })
      )
    })
  })

  it('passes retrieval settings through chat request payload', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onContent?.('检索透传结果', 0)
      callbacks.onDone?.({ status: 'completed', skills_used: [] })
    })

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        retrieval: {
          enabled: true,
          searchMode: 'iterative',
          profile: 'strict',
          minScore: 0.42,
          budgetTokens: 1234,
          rerank: true,
          maxIterations: 5,
          confidenceThreshold: 0.91,
        },
      },
    }))

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '检索参数透传{enter}')

    await waitFor(() => {
      expect(mockedChatStream).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledge_retrieval: true,
          search_mode: 'iterative',
          profile: 'strict',
          min_score: 0.42,
          budget_tokens: 1234,
          rerank: true,
          max_iterations: 5,
          confidence_threshold: 0.91,
        }),
        expect.any(Object),
        expect.any(Object)
      )
    })
  })

  it('uses configured context types for agent context action', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        contextTypes: ['world', 'plot'],
      },
    }))

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: zh.chatModeAgent }))
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: zh.chatModeAgent }),
      'context'
    )

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '获取上下文{enter}')

    await waitFor(() => {
      expect(mockedAgentGetContext).toHaveBeenCalledWith(
        expect.objectContaining({
          task: '获取上下文',
          workflow_level: 'L3',
        }),
        ['world', 'plot']
      )
    })
  })

  it('renders retrieval status when stream done includes writer metadata', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onContent?.('带检索状态', 0)
      callbacks.onDone?.({
        status: 'completed',
        skills_used: [],
        writer_metadata: {
          knowledge_retrieved: {
            entities_count: 2,
            relations_count: 1,
            memories_count: 4,
          },
        },
      })
    })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '渲染检索状态{enter}')

    await waitFor(() => {
      expect(
        screen.getByText(
          zh.messageBubbleRetrievalStatus
            .replace('{entities}', '2')
            .replace('{relations}', '1')
            .replace('{memories}', '4')
        )
      ).toBeInTheDocument()
    })
  })

  it('sends comparison request and renders dual-model response when comparison is enabled', async () => {
    mockedChatStream.mockResolvedValue()
    mockedChat.mockResolvedValue({
      success: true,
      data: {
        content: 'fallback',
        skills_used: [],
        comparison: {
          enabled: true,
          primary: { model: 'primary', content: '共享段落\n主模型结果' },
          control: { model: 'gpt-4-turbo', content: '共享段落\n对照模型结果' },
        },
      },
    })

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: zh.chatModeComparison }))
    const modelSelect = screen.getByLabelText(zh.chatComparisonModelLabel)
    await userEvent.selectOptions(modelSelect, 'gpt-4-turbo')

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '比较测试{enter}')

    await waitFor(() => {
      expect(mockedChat).toHaveBeenCalledWith(
        expect.objectContaining({
          comparison: {
            enabled: true,
            controlModel: 'gpt-4-turbo',
          },
          qualityGoals: expect.objectContaining({
            naturalness: 80,
            readability: 80,
            coherence: 80,
            style_consistency: 80,
            humanization_preset: 'human_writing',
            sentence_entropy_target: 55,
            rhythm_variability_target: 55,
          }),
        })
      )
    })

    expect(mockedChatStream).not.toHaveBeenCalled()
    expect(screen.getByText(`${zh.messageBubblePrimaryModelLabel}primary`)).toBeInTheDocument()
    expect(screen.getByText(`${zh.messageBubbleControlModelLabel}gpt-4-turbo`)).toBeInTheDocument()
    expect(screen.getByText('主模型结果')).toBeInTheDocument()
    expect(screen.getByText('对照模型结果')).toBeInTheDocument()
    expect(screen.getAllByText(zh.messageBubbleDiffHighlightsLabel)).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: zh.messageBubbleAcceptPrimary }))
    expect((screen.getByPlaceholderText(zh.inputPlaceholder) as HTMLTextAreaElement).value).toBe('共享段落\n主模型结果')

    await userEvent.click(screen.getByRole('button', { name: zh.messageBubbleAcceptControl }))
    expect((screen.getByPlaceholderText(zh.inputPlaceholder) as HTMLTextAreaElement).value).toBe('共享段落\n对照模型结果')
  })

  it('cancels streaming and does not trigger fallback chat', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks, options) => {
      await new Promise<void>((resolve) => {
        options?.signal?.addEventListener('abort', () => {
          callbacks.onError?.('AbortError')
          resolve()
        })
      })
    })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '需要取消{enter}')

    const cancelButton = await screen.findByRole('button', { name: zh.cancel })
    await userEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText(zh.streamInterrupted)).toBeInTheDocument()
    })
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('shows interrupted message when stream is interrupted', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onError?.('stream interrupted', { terminal: 'interrupted', status: 'aborted' })
    })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '触发中断{enter}')

    await waitFor(() => {
      expect(screen.getByText(zh.streamInterrupted)).toBeInTheDocument()
    })
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('shows recovered hint when stream emits recovered terminal', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onContent?.('已恢复内容', 0)
      callbacks.onDone?.({
        status: 'completed',
        terminal: 'recovered',
        decision: 'soft_go',
        diagnostics: { fallback_reason: 'critic_unavailable' },
      })
    })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '触发恢复态{enter}')

    await waitFor(() => {
      expect(screen.getByText('已恢复内容')).toBeInTheDocument()
      expect(screen.getByText(zh.streamRecovered)).toBeInTheDocument()
    })
  })

  it('shows reconnecting hint when connection enters reconnecting state', async () => {
    const { rerender } = render(<ChatArea connectionState="connected" />)

    rerender(<ChatArea connectionState="reconnecting" />)

    await waitFor(() => {
      expect(screen.getByText(zh.streamReconnecting)).toBeInTheDocument()
    })
  })

  it('shows recovered hint when connection returns from reconnecting to connected', async () => {
    const { rerender } = render(<ChatArea connectionState="connected" />)

    rerender(<ChatArea connectionState="reconnecting" />)

    await waitFor(() => {
      expect(screen.getByText(zh.streamReconnecting)).toBeInTheDocument()
    })

    rerender(<ChatArea connectionState="connected" />)

    await waitFor(() => {
      expect(screen.getByText(zh.streamRecovered)).toBeInTheDocument()
    })
  })

  it('shows interrupted hint when connection becomes disconnected', async () => {
    const { rerender } = render(<ChatArea connectionState="connected" />)

    rerender(<ChatArea connectionState="disconnected" />)

    await waitFor(() => {
      expect(screen.getByText(zh.streamInterrupted)).toBeInTheDocument()
    })
  })

  it('shows restore entry when stream fails and fallback chat also fails', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onError?.('stream failed')
    })
    mockedChat.mockResolvedValue({ success: false, error: 'chat failed' })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '触发失败{enter}')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: zh.streamRestoreToBeforeSend })).toBeInTheDocument()
    })
  })

  it('restores checkpoint and clears recover action after click', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onError?.('stream failed')
    })
    mockedChat.mockResolvedValue({ success: false, error: 'chat failed' })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '触发恢复{enter}')

    const restoreButton = await screen.findByRole('button', { name: zh.streamRestoreToBeforeSend })
    await userEvent.click(restoreButton)

    await waitFor(() => {
      expect(mockedRestoreCheckpoint).toHaveBeenCalledWith('cp-1')
      expect(screen.getByText(zh.streamRestoreBeforeSendSuccess)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: zh.streamRestoreToBeforeSend })).not.toBeInTheDocument()
  })

  it('shows inline actions after assistant selection and no action before selection', async () => {
    setConversationWithAssistant('这是可选中的 assistant 文本')
    const selectionMock = vi.spyOn(window, 'getSelection')

    selectionMock.mockReturnValue({ toString: () => '' } as Selection)
    const { container } = render(<ChatArea />)

    expect(screen.queryByRole('button', { name: zh.inlineRevise })).not.toBeInTheDocument()

    selectionMock.mockReturnValue({ toString: () => '选中的文本' } as Selection)
    const markdownBody = container.querySelector('.markdown-body')
    expect(markdownBody).not.toBeNull()
    fireEvent.mouseUp(markdownBody!)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: zh.inlineContinue })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: zh.inlineRevise })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: zh.inlineGenerate })).toBeInTheDocument()
    })

    selectionMock.mockRestore()
  })

  it('uploads txt file and injects chunks into memory context', async () => {
    render(<ChatArea />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).not.toBeNull()

    const file = new File(['hello upload'], 'context.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode('hello upload').buffer,
    })
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(mockedUploadMemoryFile).toHaveBeenCalledTimes(1)
      // Upload status is now shown in banner, not as assistant message
      expect(screen.getByText(zh.uploadInjectedChunks.replace('{fileName}', 'context.txt').replace('{chunks}', '2'))).toBeInTheDocument()
    })
  })

  it('opens template library panel and applies template in replace mode', async () => {
    mockedChatStream.mockResolvedValue()

    render(<ControlledTemplateChatArea />)

    expect(screen.queryByRole('dialog', { name: zh.templateLibraryTitle })).not.toBeInTheDocument()

    await userEvent.click(screen.getByLabelText(zh.templateLibraryEntry))
    expect(await screen.findByRole('dialog', { name: zh.templateLibraryTitle })).toBeInTheDocument()

    await userEvent.type(screen.getAllByLabelText(/.+ \*$/)[0], '冒险')
    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAction }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: zh.templateLibraryTitle })).not.toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(zh.inputPlaceholder) as HTMLTextAreaElement
    expect(input.value).toContain('主题「冒险」')

    await userEvent.type(input, '{enter}')

    await waitFor(() => {
      expect(mockedChatStream).toHaveBeenCalled()
      expect(mockedChatStream.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('主题「冒险」'),
            }),
          ],
          qualityGoals: expect.objectContaining({
            naturalness: 80,
            readability: 80,
            coherence: 80,
            style_consistency: 80,
            humanization_preset: 'human_writing',
            sentence_entropy_target: 55,
            rhythm_variability_target: 55,
          }),
        })
      )
    })
  })

  it('applies template in append mode with existing input', async () => {
    render(<ControlledTemplateChatArea />)

    const input = screen.getByPlaceholderText(zh.inputPlaceholder) as HTMLTextAreaElement
    await userEvent.type(input, '已有内容')

    await userEvent.click(screen.getByLabelText(zh.templateLibraryEntry))
    expect(await screen.findByRole('dialog', { name: zh.templateLibraryTitle })).toBeInTheDocument()
    await userEvent.type(screen.getAllByLabelText(/.+ \*$/)[0], '科幻')
    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAppend }))
    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAction }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: zh.templateLibraryTitle })).not.toBeInTheDocument()
    })

    expect(input.value).toContain('已有内容')
    expect(input.value).toContain('主题「科幻」')
    expect(input.value).toContain('\n\n')
  })
})

