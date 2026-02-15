import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatArea } from './ChatArea'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
  agentRoute: vi.fn(),
  agentWrite: vi.fn(),
  agentRevise: vi.fn(),
  agentGetContext: vi.fn(),
  createCheckpoint: vi.fn(),
  restoreCheckpoint: vi.fn(),
}))

import {
  chat,
  chatStream,
  createCheckpoint,
  restoreCheckpoint,
} from '../api/client'

const mockedChat = vi.mocked(chat)
const mockedChatStream = vi.mocked(chatStream)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)

function resetStores(): void {
  localStorage.clear()
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

describe('ChatArea P0 flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStores()
    mockedCreateCheckpoint.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    mockedRestoreCheckpoint.mockResolvedValue({ success: true, data: { status: 'ok' } })
    mockedChat.mockResolvedValue({ success: true, data: { content: 'fallback', skills_used: [] } })
  })

  it('streams content and commits on done without fallback chat', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onContent?.('流式结果', 0)
      callbacks.onDone?.({ status: 'completed', skills_used: [] })
    })

    render(<ChatArea />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '测试消息{enter}')

    await waitFor(() => {
      expect(screen.getByText('流式结果')).toBeInTheDocument()
    })
    expect(mockedChat).not.toHaveBeenCalled()
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
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '需要取消{enter}')

    const cancelButton = await screen.findByRole('button', { name: '取消' })
    await userEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText('已取消本次生成。')).toBeInTheDocument()
    })
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('shows restore entry when stream fails and fallback chat also fails', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onError?.('stream failed')
    })
    mockedChat.mockResolvedValue({ success: false, error: 'chat failed' })

    render(<ChatArea />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '触发失败{enter}')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '恢复到发送前' })).toBeInTheDocument()
    })
  })

  it('restores checkpoint and clears recover action after click', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onError?.('stream failed')
    })
    mockedChat.mockResolvedValue({ success: false, error: 'chat failed' })

    render(<ChatArea />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '触发恢复{enter}')

    const restoreButton = await screen.findByRole('button', { name: '恢复到发送前' })
    await userEvent.click(restoreButton)

    await waitFor(() => {
      expect(mockedRestoreCheckpoint).toHaveBeenCalledWith('cp-1')
      expect(screen.getByText('已恢复到发送前状态。')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: '恢复到发送前' })).not.toBeInTheDocument()
  })

  it('shows inline actions after assistant selection and no action before selection', async () => {
    setConversationWithAssistant('这是可选中的 assistant 文本')
    const selectionMock = vi.spyOn(window, 'getSelection')

    selectionMock.mockReturnValue({ toString: () => '' } as Selection)
    const { container } = render(<ChatArea />)

    expect(screen.queryByRole('button', { name: '改写' })).not.toBeInTheDocument()

    selectionMock.mockReturnValue({ toString: () => '选中的文本' } as Selection)
    const markdownBody = container.querySelector('.markdown-body')
    expect(markdownBody).not.toBeNull()
    fireEvent.mouseUp(markdownBody!)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '续写' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '改写' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '生成' })).toBeInTheDocument()
    })

    selectionMock.mockRestore()
  })
})
