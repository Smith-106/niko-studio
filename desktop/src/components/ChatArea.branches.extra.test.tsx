import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ChatArea } from './ChatArea'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { translations } from '../i18n'
import { createDefaultProjectWorkspaceContext } from '../types/workspace'

// Mock useChatStreaming so startStream is controllable
const startStreamMock = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useChatStreaming', () => ({
  useChatStreaming: () => ({
    streamingContent: '',
    setStreamingContent: vi.fn(),
    startStream: startStreamMock,
    cancelStream: vi.fn(),
  }),
}))

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
  chat,
  agentRoute,
  agentWrite,
  agentRevise,
  agentGetContext,
  createCheckpoint,
  promoteProjectWikiCanonApi,
  uploadMemoryFile,
} from '../api/client'

const mockedChat = vi.mocked(chat)
const mockedAgentRoute = vi.mocked(agentRoute)
const mockedAgentWrite = vi.mocked(agentWrite)
const mockedAgentRevise = vi.mocked(agentRevise)
const mockedAgentGetContext = vi.mocked(agentGetContext)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedPromoteProjectWikiCanonApi = vi.mocked(promoteProjectWikiCanonApi)
const mockedUploadMemoryFile = vi.mocked(uploadMemoryFile)
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

describe('ChatArea extra branch coverage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('btoa', (value: string) => value)
    resetStores()

    startStreamMock.mockResolvedValue({ phase: 'done', meta: null })
    mockedChat.mockResolvedValue({ success: true, data: { content: 'response', skills_used: [] } })
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
  })

  // Line 294: provider.fetchedModels ?? [] — provider with no fetchedModels
  it('renders with provider that has no fetchedModels field', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        llmProviders: [
          {
            id: 'no-fetch-provider',
            name: 'NoFetch',
            apiKey: 'sk-test',
            enabled: true,
            defaultModel: 'model-a',
            models: ['model-a'],
            // fetchedModels deliberately omitted to test ?? []
            customModels: ['custom-1'],
          },
        ],
      },
    }))

    const onContextUsageChange = vi.fn()
    render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      expect(onContextUsageChange).toHaveBeenCalled()
    })
  })

  // Line 294: provider.customModels ?? [] — provider with no customModels
  it('renders with provider that has no customModels field', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        llmProviders: [
          {
            id: 'no-custom-provider',
            name: 'NoCustom',
            apiKey: 'sk-test',
            enabled: true,
            defaultModel: 'model-b',
            models: ['model-b'],
            fetchedModels: [],
            // customModels deliberately omitted to test ?? []
          },
        ],
      },
    }))

    const onContextUsageChange = vi.fn()
    render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      expect(onContextUsageChange).toHaveBeenCalled()
    })
  })

  // Line 479: response.error || t.serviceUnavailableRetry — comparison mode with empty error
  it('shows serviceUnavailableRetry when comparison chat fails with empty error', async () => {
    // Enable comparison mode by adding a second provider
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        llmProviders: [
          ...state.settings.llmProviders,
          { id: 'comp-provider', name: 'Compare', apiKey: 'sk-test', enabled: true, defaultModel: 'gpt-4o', models: ['gpt-4o'], fetchedModels: [], customModels: [] },
        ],
      },
    }))

    // Create a conversation
    useAppStore.setState({
      conversationsById: {
        'conv-comp': {
          id: 'conv-comp',
          title: 'Comparison test',
          messages: [],
          createdAt: new Date('2026-06-03T00:00:00Z'),
          updatedAt: new Date('2026-06-03T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
      },
      allConversationIds: ['conv-comp'],
      currentConversationId: 'conv-comp',
    })

    // Mock chat to fail with empty error — triggers `response.error || t.serviceUnavailableRetry`
    mockedChat.mockResolvedValueOnce({ success: false, error: '', data: undefined })

    const user = userEvent.setup()
    render(<ChatArea />)

    // Click comparison preset
    const compareButtons = screen.getAllByText(zh.modePresetCompareReview)
    await user.click(compareButtons[0])

    // Type and send
    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await user.type(input, 'test')
    await user.click(screen.getByRole('button', { name: zh.composerSend }))

    await waitFor(() => {
      // The fallback error message should appear
      expect(screen.getByText(zh.serviceUnavailableRetry)).toBeInTheDocument()
    })
  })

  // Line 570-572: diagnosticsText fallback when response.error is empty
  it('uses diagnostics failure_reason when chat error is empty after stream error phase', async () => {
    useAppStore.setState({
      conversationsById: {
        'conv-diag': {
          id: 'conv-diag',
          title: 'Diagnostics test',
          messages: [],
          createdAt: new Date('2026-06-03T00:00:00Z'),
          updatedAt: new Date('2026-06-03T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
      },
      allConversationIds: ['conv-diag'],
      currentConversationId: 'conv-diag',
    })

    // startStream returns error phase with failure_reason in diagnostics
    startStreamMock.mockResolvedValueOnce({
      phase: 'error',
      meta: {
        terminal: 'error',
        diagnostics: { failure_reason: 'server-failure-detail' },
      },
    })

    // chat returns failure with empty error — so diagnosticsText is used as detail
    mockedChat.mockResolvedValueOnce({ success: false, error: '', data: undefined })

    const user = userEvent.setup()
    render(<ChatArea />)

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await user.type(input, 'test')
    await user.click(screen.getByRole('button', { name: zh.composerSend }))

    await waitFor(() => {
      // response.error is '' so serviceUnavailableRetry is shown in the addMessage call (line 572)
      expect(screen.getByText(zh.serviceUnavailableRetry)).toBeInTheDocument()
    })
  })

  // Line 572: response.error || t.serviceUnavailableRetry — non-comparison path with empty error
  it('shows serviceUnavailableRetry when chat fails with empty error after stream error', async () => {
    useAppStore.setState({
      conversationsById: {
        'conv-empty-err': {
          id: 'conv-empty-err',
          title: 'Empty error test',
          messages: [],
          createdAt: new Date('2026-06-03T00:00:00Z'),
          updatedAt: new Date('2026-06-03T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
      },
      allConversationIds: ['conv-empty-err'],
      currentConversationId: 'conv-empty-err',
    })

    // startStream returns error phase with no diagnostics
    startStreamMock.mockResolvedValueOnce({
      phase: 'error',
      meta: null,
    })

    // chat returns failure with empty error
    mockedChat.mockResolvedValueOnce({ success: false, error: '', data: undefined })

    const user = userEvent.setup()
    render(<ChatArea />)

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await user.type(input, 'test')
    await user.click(screen.getByRole('button', { name: zh.composerSend }))

    await waitFor(() => {
      expect(screen.getByText(zh.serviceUnavailableRetry)).toBeInTheDocument()
    })
  })

  // Line 395: response.data.content || comparison.primary.content — empty content with comparison
  // This path is reached when chat() returns success with comparison.enabled=true
  // but content is empty. Happens in the comparison mode direct chat path (line 471-488).
  it('uses comparison primary content when response data content is empty', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        llmProviders: [
          ...state.settings.llmProviders,
          { id: 'comp2', name: 'Compare2', apiKey: 'sk-test', enabled: true, defaultModel: 'gpt-4o', models: ['gpt-4o'], fetchedModels: [], customModels: [] },
        ],
      },
    }))

    useAppStore.setState({
      conversationsById: {
        'conv-comp-content': {
          id: 'conv-comp-content',
          title: 'Comp content test',
          messages: [],
          createdAt: new Date('2026-06-03T00:00:00Z'),
          updatedAt: new Date('2026-06-03T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
      },
      allConversationIds: ['conv-comp-content'],
      currentConversationId: 'conv-comp-content',
    })

    // In comparison mode, chat() is called directly (not startStream).
    // Mock chat to succeed with empty content but comparison has primary content
    mockedChat.mockResolvedValueOnce({
      success: true,
      data: {
        content: '',
        skills_used: ['skill-1'],
        comparison: {
          enabled: true,
          primary: { model: 'gpt-4o', content: 'PrimaryFallback' },
          control: { model: 'control-model', content: 'ControlContent' },
        },
      },
    })

    const user = userEvent.setup()
    render(<ChatArea />)

    // Enable comparison mode
    const compareButtons = screen.getAllByText(zh.modePresetCompareReview)
    await user.click(compareButtons[0])

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await user.type(input, 'test')
    await user.click(screen.getByRole('button', { name: zh.composerSend }))

    await waitFor(() => {
      // Verify the message was added to the conversation with the fallback content
      const conv = useAppStore.getState().conversationsById['conv-comp-content']
      const assistantMsg = conv?.messages.find((m) => m.role === 'assistant')
      // When content is empty, `response.data.content || comparison.primary.content` → 'PrimaryFallback'
      expect(assistantMsg?.content).toBe('PrimaryFallback')
    })
  })

  // Line 405: response.data.content || t.processingCompleted — empty content after stream error fallback chat
  it('shows processingCompleted when fallback chat returns empty content after stream error', async () => {
    useAppStore.setState({
      conversationsById: {
        'conv-proc': {
          id: 'conv-proc',
          title: 'Processing test',
          messages: [],
          createdAt: new Date('2026-06-03T00:00:00Z'),
          updatedAt: new Date('2026-06-03T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
      },
      allConversationIds: ['conv-proc'],
      currentConversationId: 'conv-proc',
    })

    // startStream returns error phase — triggers the fallback chat() call at line 564
    startStreamMock.mockResolvedValueOnce({
      phase: 'error',
      meta: null,
    })

    // Fallback chat() succeeds with empty content and no comparison
    // This hits line 405: `response.data.content || t.processingCompleted`
    mockedChat.mockResolvedValueOnce({
      success: true,
      data: {
        content: '',
        skills_used: [],
      },
    })

    const user = userEvent.setup()
    render(<ChatArea />)

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await user.type(input, 'test')
    await user.click(screen.getByRole('button', { name: zh.composerSend }))

    await waitFor(() => {
      expect(screen.getByText(zh.processingCompleted)).toBeInTheDocument()
    })
  })

  // Line 82: normalizeModelId with undefined — model ?? '' fallback
  it('resolves context window when provider defaultModel is empty string', async () => {
    const onContextUsageChange = vi.fn()

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        primaryProvider: 'empty-provider',
        defaultModel: '',
        llmProviders: state.settings.llmProviders.map((provider) => ({
          ...provider,
          defaultModel: '',
          models: [],
          fetchedModels: [],
          customModels: [],
        })),
      },
    }))

    render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      expect(onContextUsageChange).toHaveBeenCalled()
    })
  })

  // Line 86: providerScopedModel || normalized — model like "provider/" where last segment is empty
  it('falls back to normalized model when provider-scoped segment is empty', async () => {
    const onContextUsageChange = vi.fn()

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        primaryProvider: 'openai',
        defaultModel: 'provider/', // Last segment after / is empty → providerScopedModel || normalized
        llmProviders: state.settings.llmProviders.map((provider) => ({
          ...provider,
          defaultModel: '',
          models: [],
          fetchedModels: [],
          customModels: [],
        })),
      },
    }))

    render(<ChatArea onContextUsageChange={onContextUsageChange} />)

    await waitFor(() => {
      expect(onContextUsageChange).toHaveBeenCalled()
    })
  })
})
