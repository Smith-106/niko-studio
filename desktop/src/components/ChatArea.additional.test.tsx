import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ChatArea } from './ChatArea'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { translations } from '../i18n'
import { createDefaultProjectWorkspaceContext } from '../types/workspace'

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
  quickRollbackWorkflow: vi.fn(),
  buildConsistencyGovernanceMetadata: vi.fn(({ decision, evaluation }) => {
    const feedback = typeof evaluation?.feedback === 'string' ? evaluation.feedback.trim() : ''
    const score = typeof evaluation?.score === 'number' && Number.isFinite(evaluation.score)
      ? evaluation.score
      : undefined
    const publishRecommendation = decision === 'go'
      ? 'pass'
      : decision === 'soft_go'
        ? 'revise'
        : decision === 'no_go'
          ? 'block'
          : undefined

    if (!decision && publishRecommendation === undefined && score === undefined && !feedback) {
      return undefined
    }

    return {
      decision,
      publish_recommendation: publishRecommendation,
      score,
      feedback: feedback || undefined,
    }
  }),
  mergeWriterMetadataGovernance: vi.fn((writerMetadata, governance) => {
    if (!governance) {
      return writerMetadata
    }

    return {
      ...(writerMetadata ?? {}),
      consistency_governance: {
        ...(writerMetadata?.consistency_governance ?? {}),
        ...governance,
      },
    }
  }),
}))

import {
  agentGetContext,
  agentRevise,
  agentRoute,
  agentWrite,
  chat,
  chatStream,
  createCheckpoint,
  promoteProjectWikiCanonApi,
  quickRollbackWorkflow,
  restoreCheckpoint,
  uploadMemoryFile,
} from '../api/client'

const mockedChat = vi.mocked(chat)
const mockedChatStream = vi.mocked(chatStream)
const mockedAgentRoute = vi.mocked(agentRoute)
const mockedAgentRevise = vi.mocked(agentRevise)
const mockedAgentWrite = vi.mocked(agentWrite)
const mockedAgentGetContext = vi.mocked(agentGetContext)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
const mockedPromoteProjectWikiCanonApi = vi.mocked(promoteProjectWikiCanonApi)
const mockedUploadMemoryFile = vi.mocked(uploadMemoryFile)
const mockedQuickRollbackWorkflow = vi.mocked(quickRollbackWorkflow)
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

describe('ChatArea additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('btoa', (value: string) => value)
    resetStores()

    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onDone?.({ status: 'completed', skills_used: [] })
    })
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
    mockedAgentRevise.mockResolvedValue({ success: true, data: { content: 'agent revise' } })
    mockedAgentWrite.mockResolvedValue({ success: true, data: { content: 'agent write', wordcount: 10 } })
    mockedAgentGetContext.mockResolvedValue({ success: true, data: { context: 'ok' } as Record<string, unknown> })
    mockedCreateCheckpoint.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    mockedRestoreCheckpoint.mockResolvedValue({ success: true, data: { status: 'ok' } })
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
    mockedQuickRollbackWorkflow.mockResolvedValue({ success: true, data: { status: 'ok' } as Record<string, unknown> })
  })

  it('uses the current document fallback when no chapter or project label exists', async () => {
    const defaultWorkspace = createDefaultProjectWorkspaceContext()
    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: {
        ...defaultWorkspace,
        identity: {
          ...defaultWorkspace.identity,
          projectName: null,
          workspaceRoot: null,
        },
        manuscript: {
          ...defaultWorkspace.manuscript,
          title: null,
          chapterId: null,
          chapterTitle: null,
          chapterNumber: null,
        },
      },
    }))

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: new RegExp(zh.chatStarterContinue) }))

    expect(screen.getByPlaceholderText(zh.inputPlaceholder)).toHaveValue(
      zh.starterContinuePrompt.replace('{target}', zh.currentDocumentFallback),
    )
  })

  it('falls back to normal streaming when comparison mode has no available models', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        llmProviders: state.settings.llmProviders.map((provider) => ({
          ...provider,
          defaultModel: '',
          models: [],
          fetchedModels: [],
          customModels: [],
        })),
      },
    }))

    render(<ChatArea />)

    await userEvent.click(screen.getAllByText(zh.modePresetCompareReview)[0])
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), '没有对照模型{enter}')

    await waitFor(() => {
      expect(mockedChatStream).toHaveBeenCalled()
    })

    const streamRequest = mockedChatStream.mock.calls[0]?.[0]
    const fallbackRequest = mockedChat.mock.calls[0]?.[0]
    expect(streamRequest?.comparison).toBeUndefined()
    expect(fallbackRequest).not.toHaveProperty('comparison')
  })

  it('shows the recovery banner when comparison chat fails', async () => {
    mockedChat.mockResolvedValueOnce({ success: false, error: 'comparison failed' })

    render(<ChatArea />)

    await userEvent.click(screen.getAllByText(zh.modePresetCompareReview)[0])
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), 'comparison 失败{enter}')

    await waitFor(() => {
      expect(mockedChat).toHaveBeenCalledWith(
        expect.objectContaining({
          comparison: expect.objectContaining({ enabled: true }),
        }),
      )
      expect(screen.getByText('comparison failed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: zh.streamRestoreToBeforeSend })).toBeInTheDocument()
    })

    expect(mockedChatStream).not.toHaveBeenCalled()
  })

  it('returns early on plain enter when send shortcut requires ctrl enter', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        sendShortcut: 'ctrlEnter',
      },
    }))

    render(<ChatArea />)

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '只输入不发送')
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockedCreateCheckpoint).not.toHaveBeenCalled()
    expect(mockedChatStream).not.toHaveBeenCalled()
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('keeps the error banner unchanged when copying the recover detail fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    mockedChatStream.mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onError?.('stream failed')
    })
    mockedChat.mockResolvedValueOnce({ success: false, error: 'chat failed' })

    render(<ChatArea />)
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), '复制失败{enter}')

    const copyButton = await screen.findByRole('button', { name: zh.streamCopyError })
    await userEvent.click(copyButton)

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('chat failed')
    })

    expect(screen.getByText('chat failed')).toBeInTheDocument()
    expect(screen.queryByText((content) => content.includes(zh.streamErrorCopied))).not.toBeInTheDocument()
  })

  it('dismisses the recover banner from the stream status controls', async () => {
    mockedChat.mockResolvedValueOnce({ success: false, error: 'dismissable comparison failed' })

    render(<ChatArea />)

    await userEvent.click(screen.getAllByText(zh.modePresetCompareReview)[0])
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), 'dismiss banner{enter}')

    expect(await screen.findByText('dismissable comparison failed')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'dismiss' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'dismiss' })).not.toBeInTheDocument()
    })
  })

  it('normalizes an aborted stream-done payload into an interrupted state', async () => {
    mockedChatStream.mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onDone?.({ status: 'aborted', skills_used: [] })
    })

    render(<ChatArea />)
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), 'aborted terminal{enter}')

    await waitFor(() => {
      expect(screen.getAllByText(zh.streamInterrupted).length).toBeGreaterThan(0)
    })
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('normalizes a restored stream-done payload into a recovered state', async () => {
    mockedChatStream.mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onContent?.('restored stream content', 0)
      callbacks.onDone?.({ status: 'restored', skills_used: [] })
    })

    render(<ChatArea />)
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), 'restored terminal{enter}')

    await waitFor(() => {
      expect(screen.getByText('restored stream content')).toBeInTheDocument()
      expect(screen.getByText(zh.streamRecovered)).toBeInTheDocument()
    })
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('does not report unchanged context usage when only the callback identity changes', async () => {
    const firstUsageCallback = vi.fn()
    const secondUsageCallback = vi.fn()

    const { rerender } = render(<ChatArea onContextUsageChange={firstUsageCallback} />)

    await waitFor(() => {
      expect(firstUsageCallback).toHaveBeenCalledTimes(1)
    })

    rerender(<ChatArea onContextUsageChange={secondUsageCallback} />)

    await waitFor(() => {
      expect(secondUsageCallback).not.toHaveBeenCalled()
    })
  })

  it('uses the default context window when no model or backend limit is configured', async () => {
    const onContextUsageChange = vi.fn()

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        primaryProvider: 'openai',
        defaultModel: '',
        llmProviders: state.settings.llmProviders.map((provider) => ({
          ...provider,
          defaultModel: '',
          models: [],
          fetchedModels: [],
          customModels: [],
        })),
        backendConfig: {
          ...state.settings.backendConfig,
          config: null,
        },
      },
    }))

    render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      expect(onContextUsageChange).toHaveBeenCalledWith(
        expect.objectContaining({
          totalK: 128,
        }),
      )
    })
  })
})
