import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'

describe('MessageBubble selection', () => {
  it('triggers selection callback for assistant message', () => {
    const onAssistantSelection = vi.fn()
    const selectionSpy = vi.spyOn(window, 'getSelection')
    selectionSpy.mockReturnValue({ toString: () => 'selected text' } as Selection)

    const { container } = render(
      <MessageBubble
        message={{
          id: 'm1',
          role: 'assistant',
          content: 'assistant content',
          timestamp: new Date(),
        }}
        onAssistantSelection={onAssistantSelection}
      />
    )

    const markdownBody = container.querySelector('.markdown-body')
    expect(markdownBody).not.toBeNull()
    fireEvent.mouseUp(markdownBody!)

    expect(onAssistantSelection).toHaveBeenCalledWith({
      messageId: 'm1',
      selectedText: 'selected text',
    })

    selectionSpy.mockRestore()
  })

  it('renders collapsible metadata details for assistant message', async () => {
    render(
      <MessageBubble
        message={{
          id: 'm4',
          role: 'assistant',
          content: '带详情的消息',
          timestamp: new Date(),
          metadata: {
            runtime: {
              terminal: 'done',
              decision: 'soft_go',
              latencyMs: 123,
              diagnostics: {
                fallback_reason: 'critic_unavailable',
              },
            },
            writerWarnings: ['quality-check-warning'],
          },
        }}
      />
    )

    const toggleButton = screen.getByRole('button')
    fireEvent.click(toggleButton)

    expect(screen.getByText('soft_go')).toBeInTheDocument()
    expect(screen.getByText('123ms')).toBeInTheDocument()
    expect(screen.getByText('critic_unavailable')).toBeInTheDocument()
    expect(screen.getByText(/quality-check-warning/)).toBeInTheDocument()
  })

  it('renders structured dual-column comparison content for assistant message', () => {
    render(
      <MessageBubble
        message={{
          id: 'm3',
          role: 'assistant',
          content: 'comparison fallback',
          timestamp: new Date(),
          comparison: {
            enabled: true,
            primary: { model: 'primary', content: '主模型内容' },
            control: { model: 'gpt-4-turbo', content: '对照模型内容' },
          },
        }}
      />
    )

    expect(screen.getByText('主模型：primary')).toBeInTheDocument()
    expect(screen.getByText('对照模型：gpt-4-turbo')).toBeInTheDocument()
    expect(screen.getByText('主模型内容')).toBeInTheDocument()
    expect(screen.getByText('对照模型内容')).toBeInTheDocument()
  })
})
