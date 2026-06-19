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
  agentRevise,
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
const mockedAgentRevise = vi.mocked(agentRevise)
const mockedAgentWrite = vi.mocked(agentWrite)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
const mockedUploadMemoryFile = vi.mocked(uploadMemoryFile)
const mockedPromoteProjectWikiCanonApi = vi.mocked(promoteProjectWikiCanonApi)
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

function selectAssistantText(container: HTMLElement, selectedText: string) {
  const selectionMock = vi.spyOn(window, 'getSelection')
  selectionMock.mockReturnValue({ toString: () => selectedText } as Selection)

  const markdownBody = container.querySelector('.markdown-body')
  expect(markdownBody).not.toBeNull()
  fireEvent.mouseUp(markdownBody!)

  return selectionMock
}

describe('ChatArea uncovered lines coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('btoa', (value: string) => value)
    resetStores()

    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onDone?.({ status: 'completed', skills_used: [] })
    })
    mockedChat.mockResolvedValue({ success: true, data: { content: 'fallback', skills_used: [] } })
    mockedAgentRevise.mockResolvedValue({ success: true, data: { content: 'agent revise' } })
    mockedAgentWrite.mockResolvedValue({ success: true, data: { content: 'agent write', wordcount: 10 } })
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

  // Lines 589-591: inlineAction === 'continue' with empty promptText
  it('uses default continue prompt when composer is empty for inline continue', async () => {
    const user = userEvent.setup()
    setConversationWithAssistant('some assistant text for continue')
    mockedAgentWrite.mockResolvedValueOnce({ success: true, data: { content: 'continue result', wordcount: 12 } })

    const { container } = render(<ChatArea />)
    const selectionMock = selectAssistantText(container, 'continue snippet')

    // Click continue action
    await user.click(screen.getByRole('button', { name: zh.inlineContinue }))

    // Run with empty input - should use default prompt
    await user.click(screen.getByRole('button', { name: zh.inlineRun }))

    await waitFor(() => {
      expect(mockedAgentWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          task: `${zh.inlineContinuePromptPrefix}\ncontinue snippet`,
          scene_type: 'inline_continue',
        }),
        expect.any(Array),
        undefined,
        expect.any(Object),
        expect.any(Object),
      )
      expect(screen.getByText('continue result')).toBeInTheDocument()
    })

    selectionMock.mockRestore()
  })

  // Line 626: finalizeInlineFailure() when write fails with no content
  it('shows inline failure when write succeeds but returns no content', async () => {
    const user = userEvent.setup()
    setConversationWithAssistant('some assistant text')
    // Success but no content - should hit finalizeInlineFailure
    mockedAgentWrite.mockResolvedValueOnce({ success: true, data: { content: '', wordcount: 0 } })

    const { container } = render(<ChatArea />)
    const selectionMock = selectAssistantText(container, 'generate snippet')

    await user.click(screen.getByRole('button', { name: zh.inlineGenerate }))
    await user.click(screen.getByRole('button', { name: zh.inlineRun }))

    await waitFor(() => {
      expect(screen.getByText(zh.inlineActionFailed)).toBeInTheDocument()
    })

    selectionMock.mockRestore()
  })
})
