import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'
import { translations } from '../i18n'

const zh = translations.zh

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

  it('renders structured dual-column comparison content for assistant message', () => {
    const onComparisonAccept = vi.fn()

    render(
      <MessageBubble
        message={{
          id: 'm3',
          role: 'assistant',
          content: 'comparison fallback',
          timestamp: new Date(),
          comparison: {
            enabled: true,
            primary: { model: 'primary', content: '共享行\n主模型独有' },
            control: { model: 'gpt-4-turbo', content: '共享行\n对照模型独有' },
          },
        }}
        onComparisonAccept={onComparisonAccept}
      />
    )

    expect(screen.getByText(`${zh.messageBubblePrimaryModelLabel}primary`)).toBeInTheDocument()
    expect(screen.getByText(`${zh.messageBubbleControlModelLabel}gpt-4-turbo`)).toBeInTheDocument()
    expect(screen.getByText('主模型独有')).toBeInTheDocument()
    expect(screen.getByText('对照模型独有')).toBeInTheDocument()
    expect(screen.getAllByText(zh.messageBubbleDiffHighlightsLabel)).toHaveLength(2)
    expect(screen.getByRole('button', { name: zh.messageBubbleAcceptPrimary })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.messageBubbleAcceptControl })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: zh.messageBubbleAcceptPrimary }))
    expect(onComparisonAccept).toHaveBeenCalledWith('共享行\n主模型独有')

    fireEvent.click(screen.getByRole('button', { name: zh.messageBubbleAcceptControl }))
    expect(onComparisonAccept).toHaveBeenCalledWith('共享行\n对照模型独有')
  })

  it('renders retrieval status when writer metadata is present', () => {
    render(
      <MessageBubble
        message={{
          id: 'm4',
          role: 'assistant',
          content: '带检索状态的回复',
          timestamp: new Date(),
          writerMetadata: {
            knowledge_retrieved: {
              entities_count: 3,
              relations_count: 2,
              memories_count: 5,
            },
          },
        }}
      />
    )

    expect(
      screen.getByText(
        zh.messageBubbleRetrievalStatus
          .replace('{entities}', '3')
          .replace('{relations}', '2')
          .replace('{memories}', '5')
      )
    ).toBeInTheDocument()
  })
})
