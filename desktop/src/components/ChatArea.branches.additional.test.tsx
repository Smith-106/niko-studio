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
  buildConsistencyGovernanceMetadata: vi.fn(() => undefined),
  mergeWriterMetadataGovernance: vi.fn((writerMetadata) => writerMetadata),
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

describe('ChatArea branch coverage', () => {
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
        page: { id: 'canon-1', slug: 'chat/test', title: 'Chat', status: 'curated', path: '/tmp/chat.md', markdown: '# Chat', promoted_from: 'chat' },
        raw_evidence_path: '/tmp/raw.md',
        log_entry: { type: 'promotion' },
      },
    })
    mockedUploadMemoryFile.mockResolvedValue({
      success: true,
      data: { status: 'created', file_name: 'a.txt', session_id: 'c1', chunks: 2, memory_ids: ['m1', 'm2'] },
    })
    mockedQuickRollbackWorkflow.mockResolvedValue({ success: true, data: { status: 'ok' } as Record<string, unknown> })
  })

  it('uses backend config max_tokens_per_request when no model prefix matches (line 112-115)', async () => {
    const onContextUsageChange = vi.fn()

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        primaryProvider: 'openai',
        defaultModel: 'unknown-model-xyz',
        llmProviders: state.settings.llmProviders.map((provider) => ({
          ...provider,
          defaultModel: '',
          models: [],
          fetchedModels: [],
          customModels: [],
        })),
        backendConfig: {
          ...state.settings.backendConfig,
          config: {
            agent: { max_tokens_per_request: 50000 },
          },
        },
      },
    }))

    render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      expect(onContextUsageChange).toHaveBeenCalledWith(
        expect.objectContaining({
          totalK: 50,
        }),
      )
    })
  })

  it('uses default context window when backend config is null and no model matches (line 115)', async () => {
    const onContextUsageChange = vi.fn()

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        primaryProvider: 'openai',
        defaultModel: 'unknown-model-xyz',
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

  it('sends with Ctrl+Enter when send shortcut requires ctrl and user presses Ctrl+Enter (line 878-886)', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        sendShortcut: 'ctrlEnter',
      },
    }))

    render(<ChatArea />)

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, 'ctrl enter sends')
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(mockedCreateCheckpoint).toHaveBeenCalled()
    })
  })

  it('handles the compareReview mode preset branch (line 852-858)', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        llmProviders: [
          ...state.settings.llmProviders,
          { id: 'test-provider', name: 'Test', apiKey: 'sk-test', enabled: true, defaultModel: 'gpt-4o', models: ['gpt-4o'], fetchedModels: [], customModels: [] },
        ],
      },
    }))

    const user = userEvent.setup()
    render(<ChatArea />)

    // Click the compareReview preset button in the mode controls
    const compareButtons = screen.getAllByText(zh.modePresetCompareReview)
    await user.click(compareButtons[0])

    // Verify the mode was switched by typing a message and checking comparison in the request
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await user.type(input, 'compare test')
    // Click send button
    await user.click(screen.getByRole('button', { name: zh.composerSend }))

    await waitFor(() => {
      // Comparison mode uses chat() not chatStream() (line 471-488)
      expect(mockedChat).toHaveBeenCalledWith(
        expect.objectContaining({
          comparison: expect.objectContaining({ enabled: true }),
        }),
      )
    })
  })

  it('resolves context window for claude model via primaryProvider (line 100-104)', async () => {
    const onContextUsageChange = vi.fn()

    // Set up a provider that has a claude model as defaultModel
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        primaryProvider: 'anthropic',
        defaultModel: '',
        llmProviders: [
          ...state.settings.llmProviders,
          { id: 'anthropic', name: 'Anthropic', apiKey: 'sk-test', enabled: true, defaultModel: 'claude-3-5-sonnet', models: ['claude-3-5-sonnet'], fetchedModels: [], customModels: [] },
        ],
      },
    }))

    render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      expect(onContextUsageChange).toHaveBeenCalledWith(
        expect.objectContaining({
          totalK: 200,
        }),
      )
    })
  })

  it('skips duplicate context usage reports when values are unchanged (line 332-340)', async () => {
    const onContextUsageChange = vi.fn()

    const { rerender } = render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      expect(onContextUsageChange).toHaveBeenCalled()
    })

    const initialCallCount = onContextUsageChange.mock.calls.length

    // Re-render with same callback — usage values are the same, so no new calls
    rerender(<ChatArea onContextUsageChange={onContextUsageChange} />)

    // The duplicate-check branch should skip the report
    expect(onContextUsageChange.mock.calls.length).toBe(initialCallCount)
  })

  it('uses default context window when backend config max_tokens_per_request is 0 (line 113-114)', async () => {
    const onContextUsageChange = vi.fn()

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        primaryProvider: 'openai',
        defaultModel: 'unknown-model-xyz',
        llmProviders: state.settings.llmProviders.map((provider) => ({
          ...provider,
          defaultModel: '',
          models: [],
          fetchedModels: [],
          customModels: [],
        })),
        backendConfig: {
          ...state.settings.backendConfig,
          config: {
            agent: { max_tokens_per_request: 0 },
          },
        },
      },
    }))

    render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      // 0 is not > 0, so falls back to default 128K
      expect(onContextUsageChange).toHaveBeenCalledWith(
        expect.objectContaining({
          totalK: 128,
        }),
      )
    })
  })
})
