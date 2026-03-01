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
  uploadMemoryFile: vi.fn(),
}))

import {
  chat,
  chatStream,
  createCheckpoint,
  restoreCheckpoint,
  uploadMemoryFile,
} from '../api/client'

const mockedChat = vi.mocked(chat)
const mockedChatStream = vi.mocked(chatStream)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
const mockedUploadMemoryFile = vi.mocked(uploadMemoryFile)

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

  it('sends comparison request and renders dual-model response when comparison is enabled', async () => {
    mockedChatStream.mockResolvedValue()
    mockedChat.mockResolvedValue({
      success: true,
      data: {
        content: 'fallback',
        skills_used: [],
        comparison: {
          enabled: true,
          primary: { model: 'primary', content: '主模型结果' },
          control: { model: 'gpt-4-turbo', content: '对照模型结果' },
        },
      },
    })

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: '模型对比' }))
    const modelSelect = screen.getByLabelText('对照模型')
    await userEvent.selectOptions(modelSelect, 'gpt-4-turbo')

    const input = screen.getByRole('textbox')
    await userEvent.type(input, '比较测试{enter}')

    await waitFor(() => {
      expect(mockedChat).toHaveBeenCalledWith(
        expect.objectContaining({
          comparison: {
            enabled: true,
            controlModel: 'gpt-4-turbo',
          },
        })
      )
    })

    expect(mockedChatStream).not.toHaveBeenCalled()
    expect(screen.getByText('主模型：primary')).toBeInTheDocument()
    expect(screen.getByText('对照模型：gpt-4-turbo')).toBeInTheDocument()
    expect(screen.getByText('主模型结果')).toBeInTheDocument()
    expect(screen.getByText('对照模型结果')).toBeInTheDocument()
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
      expect(screen.getByText('流式生成已中断。')).toBeInTheDocument()
    })
    expect(mockedChat).not.toHaveBeenCalled()
  })

  it('shows interrupted message when stream is interrupted', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onError?.('stream interrupted', { terminal: 'interrupted', status: 'aborted' })
    })

    render(<ChatArea />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '触发中断{enter}')

    await waitFor(() => {
      expect(screen.getByText('流式生成已中断。')).toBeInTheDocument()
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
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '触发恢复态{enter}')

    await waitFor(() => {
      expect(screen.getByText('已恢复内容')).toBeInTheDocument()
      expect(screen.getByText('已从流式降级恢复，结果可继续使用。')).toBeInTheDocument()
    })
  })

  it('persists stream terminal diagnostics metadata into assistant message', async () => {
    mockedChatStream.mockImplementation(async (_request, callbacks) => {
      callbacks.onContent?.('元数据流式结果', 0)
      callbacks.onDone?.({
        status: 'completed',
        terminal: 'done',
        decision: 'soft_go',
        diagnostics: { fallback_reason: 'critic_unavailable' },
      })
    })

    render(<ChatArea />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '触发元数据写入{enter}')

    await waitFor(() => {
      const state = useAppStore.getState()
      const conversationId = state.currentConversationId
      expect(conversationId).toBeTruthy()
      const conversation = conversationId ? state.conversationsById[conversationId] : undefined
      const assistantMessages = conversation?.messages.filter((message) => message.role === 'assistant') ?? []
      const assistant = assistantMessages[assistantMessages.length - 1]
      expect(assistant?.content).toContain('元数据流式结果')
      expect(assistant?.metadata?.runtime).toMatchObject({
        terminal: 'done',
        decision: 'soft_go',
        diagnostics: { fallback_reason: 'critic_unavailable' },
        degraded: true,
      })
      expect(typeof assistant?.metadata?.runtime?.latencyMs).toBe('number')
    })
  })

  it('shows reconnecting hint when connection enters reconnecting state', async () => {
    render(<ChatArea connectionState="reconnecting" />)

    await waitFor(() => {
      expect(screen.getByText('连接恢复中，请稍候...')).toBeInTheDocument()
    })
  })

  it('shows recovered hint when connection returns from reconnecting to connected', async () => {
    const { rerender } = render(<ChatArea connectionState="reconnecting" />)

    await waitFor(() => {
      expect(screen.getByText('连接恢复中，请稍候...')).toBeInTheDocument()
    })

    rerender(<ChatArea connectionState="connected" />)

    await waitFor(() => {
      expect(screen.getByText('已从流式降级恢复，结果可继续使用。')).toBeInTheDocument()
    })
  })

  it('shows interrupted hint when connection becomes disconnected', async () => {
    render(<ChatArea connectionState="disconnected" />)

    await waitFor(() => {
      expect(screen.getByText('流式生成已中断。')).toBeInTheDocument()
    })
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
      expect(screen.getByText('文件已注入上下文：context.txt（2 段）')).toBeInTheDocument()
      expect(screen.getByText('已完成文件上下文注入：context.txt（2 段）')).toBeInTheDocument()
    })
  })

  it('opens template library panel and applies template in replace mode', async () => {
    mockedChatStream.mockResolvedValue()

    render(<ChatArea />)

    await userEvent.click(screen.getByRole('button', { name: '模板库' }))
    expect(await screen.findByRole('dialog', { name: '模板库' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('主题 *'), '冒险')
    await userEvent.click(screen.getByRole('button', { name: '一键填充' }))

    const input = screen.getByRole('textbox') as HTMLTextAreaElement
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
        })
      )
    })
  })

  it('applies template in append mode with existing input', async () => {
    render(<ChatArea />)

    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    await userEvent.type(input, '已有内容')

    await userEvent.click(screen.getByRole('button', { name: '模板库' }))
    await userEvent.type(screen.getByLabelText('主题 *'), '科幻')
    await userEvent.click(screen.getByRole('button', { name: '追加到输入框' }))
    await userEvent.click(screen.getByRole('button', { name: '一键填充' }))

    expect(input.value).toContain('已有内容')
    expect(input.value).toContain('主题「科幻」')
    expect(input.value).toContain('\n\n')
  })
})

