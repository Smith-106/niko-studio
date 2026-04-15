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
  promoteProjectWikiCanonApi: vi.fn(),
  createCheckpoint: vi.fn(),
  restoreCheckpoint: vi.fn(),
  uploadMemoryFile: vi.fn(),
}))

import {
  agentRoute,
  agentWrite,
  chat,
  chatStream,
  createCheckpoint,
  restoreCheckpoint,
  uploadMemoryFile,
  agentGetContext,
  promoteProjectWikiCanonApi,
} from '../api/client'

const mockedChat = vi.mocked(chat)
const mockedChatStream = vi.mocked(chatStream)
const mockedAgentRoute = vi.mocked(agentRoute)
const mockedAgentWrite = vi.mocked(agentWrite)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
const mockedUploadMemoryFile = vi.mocked(uploadMemoryFile)
const mockedAgentGetContext = vi.mocked(agentGetContext)
const mockedPromoteProjectWikiCanonApi = vi.mocked(promoteProjectWikiCanonApi)
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

function resolveExpectedCheckpointWorkspace() {
  const { currentConversationId, currentWorkspace } = useAppStore.getState()

  return {
    ...currentWorkspace,
    workflow: {
      ...currentWorkspace.workflow,
      sessionId: currentWorkspace.workflow.sessionId ?? currentConversationId,
    },
    chat: {
      ...currentWorkspace.chat,
      conversationId: currentWorkspace.chat.conversationId ?? currentConversationId,
    },
  }
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
    mockedAgentRoute.mockResolvedValue({
      success: true,
      data: {
        workflow_level: 'L3',
        workflow_level_slug: 'plan-and-execute',
        scene_type: 'dialogue',
        dispatched_skills: [],
        task_assignments: [],
      },
    })
    mockedAgentWrite.mockResolvedValue({ success: true, data: { content: 'agent write', wordcount: 10 } })
    mockedPromoteProjectWikiCanonApi.mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'default-project',
        page: {
          id: 'canon-chat-1',
          slug: 'chat/default-project-conversation-1-reply-1',
          title: 'Chat Reply',
          status: 'curated',
          path: '/tmp/chat.md',
          markdown: '# Chat Reply',
          promoted_from: 'chat',
        },
        raw_evidence_path: '/tmp/raw.md',
        log_entry: { type: 'promotion' },
      },
    })
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

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
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
      },
    }))

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

  it('renders canon traceability when stream done includes canon context', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onContent?.('带 canon 来源', 0)
      callbacks.onDone?.({
        status: 'completed',
        skills_used: [],
        writer_metadata: {
          canon_context: {
            available: true,
            reason: null,
            total_pages: 3,
            match_count: 1,
            injected: true,
            matches: [
              {
                page_id: 'wpg_harbor_1',
                slug: 'locations/atlas-harbor',
                title: 'Atlas Harbor Canon',
                score: 77,
                excerpt: 'Atlas Harbor is the canonical smuggler hub for the project.',
                authority: {
                  workspaceId: 'atlas-project',
                  scopeAuthority: 'workspace',
                  canonAuthority: 'canon-page',
                  projectionAuthority: 'derived',
                  promotion: 'manual',
                  promotedFrom: 'story-bible',
                  status: 'curated',
                },
              },
            ],
          },
        },
      })
    })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '渲染 canon 来源{enter}')

    await waitFor(() => {
      expect(screen.getByText(zh.messageBubbleCanonContextTitle)).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        zh.messageBubbleCanonContextApplied
          .replace('{matches}', '1')
          .replace('{pages}', '3')
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Atlas Harbor Canon')).toBeInTheDocument()
    expect(screen.getByText('locations/atlas-harbor')).toBeInTheDocument()
  })

  it('promotes streamed assistant replies into canon from message actions', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onContent?.('Chat reply body', 0)
      callbacks.onDone?.({
        status: 'completed',
        skills_used: [],
        writer_metadata: {
          workspace_context: {
            schemaVersion: '2026-04-08',
            identity: {
              workspaceId: 'default-project',
              projectId: 'default-project',
              projectName: 'Default Project',
              workspaceRoot: '/tmp/default-project',
            },
            manuscript: {
              manuscriptId: null,
              title: null,
              chapterId: 'chapter-1',
              chapterTitle: null,
              chapterNumber: 1,
            },
            storyBible: {
              storyBibleId: null,
              draftId: 'draft-1',
              version: null,
              storage: 'workspace',
            },
            knowledge: {
              focusEntityId: null,
              graphEntityIds: [],
              memoryEntryIds: [],
            },
            workflow: {
              sessionId: 'workflow-session-1',
              planId: null,
              level: 'L3',
            },
            chat: {
              conversationId: 'conversation-1',
              comparisonEnabled: false,
            },
            compatibility: {
              additiveContract: true,
              migratedLegacyFields: [],
              notes: [],
            },
          },
        },
      })
    })

    render(<ChatArea />)
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '提升聊天回复{enter}')

    await userEvent.click(await screen.findByRole('button', { name: zh.messageBubblePromoteCanon }))

    await waitFor(() => {
      expect(mockedPromoteProjectWikiCanonApi).toHaveBeenCalled()
    })
    expect(screen.getByText(zh.messageBubblePromoteCanonSuccess)).toBeInTheDocument()
  })

  it('renders retrieval status for agent write responses with writer metadata', async () => {
    mockedAgentWrite.mockResolvedValue({
      success: true,
      data: {
        content: 'agent 带检索状态',
        wordcount: 280,
        writer_metadata: {
          knowledge_retrieved: {
            entities_count: 2,
            relations_count: 2,
            memories_count: 1,
          },
          workspace_context: {
            schemaVersion: '2026-04-08',
            identity: {
              workspaceId: 'atlas-project',
              projectId: 'atlas-project',
              projectName: 'Atlas',
              workspaceRoot: '/tmp/atlas',
            },
            manuscript: {
              manuscriptId: null,
              title: null,
              chapterId: 'chapter-3',
              chapterTitle: null,
              chapterNumber: 3,
            },
            storyBible: {
              storyBibleId: null,
              draftId: 'draft-3',
              version: null,
              storage: 'workspace',
            },
            knowledge: {
              focusEntityId: null,
              graphEntityIds: [],
              memoryEntryIds: [],
            },
            workflow: {
              sessionId: 'workflow-session-3',
              planId: null,
              level: 'L3',
            },
            chat: {
              conversationId: 'conversation-3',
              comparisonEnabled: false,
            },
            compatibility: {
              additiveContract: true,
              migratedLegacyFields: [],
              notes: [],
            },
          },
        },
      },
    })

    render(<ChatArea />)
    await userEvent.click(screen.getByRole('button', { name: zh.chatModeAgent }))
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, 'agent 写作检索状态{enter}')

    await waitFor(() => {
      expect(
        screen.getByText(
          zh.messageBubbleRetrievalStatus
            .replace('{entities}', '2')
            .replace('{relations}', '2')
            .replace('{memories}', '1')
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
            naturalness: 85,
            readability: 80,
            coherence: 80,
            style_consistency: 78,
            humanization_preset: 'human_writing',
            sentence_entropy_target: 60,
            rhythm_variability_target: 60,
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
      expect(screen.getAllByText(zh.streamInterrupted).length).toBeGreaterThan(0)
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
      expect(screen.getAllByText(zh.streamInterrupted).length).toBeGreaterThan(0)
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
      expect(screen.getAllByText(zh.streamInterrupted).length).toBeGreaterThan(0)
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

    const conversationId = useAppStore.getState().currentConversationId
    expect(conversationId).toBeTruthy()
    const expectedWorkspace = resolveExpectedCheckpointWorkspace()
    expect(expectedWorkspace.workflow.sessionId).toBe(conversationId)
    expect(expectedWorkspace.chat.conversationId).toBe(conversationId)

    const restoreButton = await screen.findByRole('button', { name: zh.streamRestoreToBeforeSend })
    await userEvent.click(restoreButton)

    await waitFor(() => {
      expect(mockedRestoreCheckpoint).toHaveBeenCalledWith('cp-1', expectedWorkspace)
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
            naturalness: 85,
            readability: 80,
            coherence: 80,
            style_consistency: 78,
            humanization_preset: 'human_writing',
            sentence_entropy_target: 60,
            rhythm_variability_target: 60,
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

  it('restores focus to the trigger on escape and to the composer after apply', async () => {
    render(<ControlledTemplateChatArea />)

    const trigger = screen.getByLabelText(zh.templateLibraryEntry)
    trigger.focus()
    await userEvent.click(trigger)

    expect(await screen.findByRole('dialog', { name: zh.templateLibraryTitle })).toBeInTheDocument()

    const searchInput = screen.getByRole('textbox', { name: zh.templateSearchPlaceholder })
    await waitFor(() => {
      expect(searchInput).toHaveFocus()
    })

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: zh.templateLibraryTitle })).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()

    await userEvent.click(trigger)
    expect(await screen.findByRole('dialog', { name: zh.templateLibraryTitle })).toBeInTheDocument()
    await userEvent.type(screen.getAllByLabelText(/.+ \*$/)[0], '回焦测试')
    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAction }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: zh.templateLibraryTitle })).not.toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText(zh.inputPlaceholder)).toHaveFocus()
  })
})

