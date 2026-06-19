import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
  quickRollbackWorkflow: vi.fn(),
  buildConsistencyGovernanceMetadata: vi.fn(() => undefined),
  mergeWriterMetadataGovernance: vi.fn((writerMetadata) => writerMetadata),
}))

vi.mock('./ChatAreaModeControls', () => ({
  ChatAreaModeControls: (props: {
    onApplyPreset: (presetId: 'focusWriting' | 'agentDiagnose' | 'compareReview') => void
    onSetAgentAction: (action: 'write' | 'revise' | 'context') => void
  }) => React.createElement(
    'div',
    { 'aria-label': 'mock mode controls' },
    React.createElement('button', { type: 'button', onClick: () => props.onApplyPreset('focusWriting') }, 'focus writing mode'),
    React.createElement('button', { type: 'button', onClick: () => props.onApplyPreset('agentDiagnose') }, 'agent mode'),
    React.createElement('button', { type: 'button', onClick: () => props.onSetAgentAction('write') }, 'agent write action'),
    React.createElement('button', { type: 'button', onClick: () => props.onSetAgentAction('revise') }, 'agent revise action'),
  ),
}))

import {
  agentGetContext,
  agentRevise,
  agentRoute,
  agentWrite,
  chat,
  chatStream,
  createCheckpoint,
  quickRollbackWorkflow,
  restoreCheckpoint,
  uploadMemoryFile,
} from '../api/client'
import { ChatArea } from './ChatArea'

const mockedChat = vi.mocked(chat)
const mockedChatStream = vi.mocked(chatStream)
const mockedAgentRoute = vi.mocked(agentRoute)
const mockedAgentWrite = vi.mocked(agentWrite)
const mockedAgentRevise = vi.mocked(agentRevise)
const mockedAgentGetContext = vi.mocked(agentGetContext)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
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

describe('ChatArea agent action whitebox coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('btoa', (value: string) => value)
    resetStores()

    mockedChatStream.mockResolvedValue()
    mockedChat.mockResolvedValue({ success: true, data: { content: 'fallback', skills_used: [] } })
    mockedAgentRoute.mockResolvedValue({
      success: true,
      data: {
        workflow_level: 'L3',
        workflow_level_slug: 'plan-and-execute',
        scene_type: 'dialogue',
        dispatched_skills: [],
        task_assignments: [{ id: 'writer', task: 'draft' }],
      },
    })
    mockedAgentWrite.mockResolvedValue({ success: true, data: { content: 'agent write result', wordcount: 12 } })
    mockedAgentRevise.mockResolvedValue({ success: true, data: { content: 'agent revise result' } })
    mockedAgentGetContext.mockResolvedValue({ success: true, data: { context: 'ok' } as Record<string, unknown> })
    mockedCreateCheckpoint.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    mockedRestoreCheckpoint.mockResolvedValue({ success: true, data: { status: 'ok' } })
    mockedUploadMemoryFile.mockResolvedValue({
      success: true,
      data: { status: 'created', file_name: 'a.txt', session_id: 'c1', chunks: 1, memory_ids: ['m1'] },
    })
    mockedQuickRollbackWorkflow.mockResolvedValue({ success: true, data: { status: 'ok' } as Record<string, unknown> })
  })

  it('runs the agent write branch with write-only quality goals', async () => {
    useAppStore.setState((state) => ({
      ...state,
      availableSkills: ['dialogue-system'],
      selectedSkills: ['dialogue-system'],
    }))
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        qualityGoals: {
          ...state.settings.qualityGoals,
          naturalness: 91,
          readability: 82,
          coherence: 73,
          styleConsistency: 64,
          humanizationPreset: 'custom',
          customHumanizationInstruction: 'not passed to write',
        },
      },
    }))

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: 'agent mode' }))
    await userEvent.click(screen.getByRole('button', { name: 'agent write action' }))
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), 'write this scene{enter}')

    await waitFor(() => {
      expect(mockedAgentWrite).toHaveBeenCalledWith(
        {
          task: 'write this scene',
          scene_type: 'dialogue',
          workflow_level: 'L3',
          task_assignments: [{ id: 'writer', task: 'draft' }],
        },
        ['dialogue-system'],
        undefined,
        {
          naturalness: 91,
          readability: 82,
          coherence: 73,
          style_consistency: 64,
        },
        expect.any(Object),
      )
    })

    expect(mockedAgentRoute).toHaveBeenCalledWith('write this scene')
    expect(await screen.findByText('agent write result')).toBeInTheDocument()
    expect(mockedChatStream).not.toHaveBeenCalled()
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('runs the agent revise branch against the latest assistant message', async () => {
    setConversationWithAssistant('previous assistant draft')

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: 'agent mode' }))
    await userEvent.click(screen.getByRole('button', { name: 'agent revise action' }))
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), 'revise the last answer{enter}')

    await waitFor(() => {
      expect(mockedAgentRevise).toHaveBeenCalledWith(
        'previous assistant draft',
        {
          instruction: 'revise the last answer',
          workflow_level: 'L4',
          skills: [],
        },
        expect.objectContaining({
          naturalness: 85,
          readability: 80,
          coherence: 80,
          style_consistency: 78,
          humanization_preset: 'human_writing',
        }),
      )
    })

    expect(await screen.findByText('agent revise result')).toBeInTheDocument()
    expect(mockedChatStream).not.toHaveBeenCalled()
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('applies the focus-writing preset before sending through normal chat', async () => {
    mockedChatStream.mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onContent?.('focus writing stream result', 0)
      callbacks.onDone?.({ status: 'completed', skills_used: [] })
    })

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: 'agent mode' }))
    await userEvent.click(screen.getByRole('button', { name: 'focus writing mode' }))
    await userEvent.type(screen.getByPlaceholderText(zh.inputPlaceholder), 'focus this draft{enter}')

    await waitFor(() => {
      expect(mockedChatStream).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowLevel: 'L3',
          messages: [{ role: 'user', content: 'focus this draft' }],
        }),
        expect.any(Object),
        expect.any(Object),
      )
    })

    expect(mockedAgentGetContext).not.toHaveBeenCalled()
    expect(mockedAgentRoute).not.toHaveBeenCalled()
    expect(mockedAgentWrite).not.toHaveBeenCalled()
    expect(mockedAgentRevise).not.toHaveBeenCalled()
    expect(await screen.findByText('focus writing stream result')).toBeInTheDocument()
  })
})
