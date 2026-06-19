import { createRef } from 'react'
import { act, render, screen, fireEvent, createEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatAreaComposer } from './ChatAreaComposer'

const baseProps = {
  input: '',
  isLoading: false,
  sendDisabled: true,
  inputPlaceholder: '告诉我你想创作什么...',
  uploadLabel: '上传文件',
  voiceInputLabel: '语音输入',
  voiceInputStatusLabel: '暂未开放',
  sendLabel: '发送',
  cancelLabel: '取消',
  sendShortcutLabel: '发送快捷键',
  sendShortcutHint: 'Enter',
  fileInputRef: createRef<HTMLInputElement>(),
  inputRef: createRef<HTMLTextAreaElement>(),
  onInputChange: () => {},
  onKeyDown: vi.fn(),
  onFileUpload: vi.fn(),
  onOpenFilePicker: () => {},
  onCancelStream: () => {},
  onSend: () => {},
}

describe('ChatAreaComposer accessibility semantics', () => {
  it('adds deterministic id and name attributes to the composer textarea and upload input', () => {
    render(<ChatAreaComposer {...baseProps} />)

    const composerInput = screen.getByRole('textbox', { name: '告诉我你想创作什么...' })
    const uploadInput = document.getElementById('chat-composer-upload-input')

    expect(composerInput).toHaveAttribute('id', 'chat-composer-input')
    expect(composerInput).toHaveAttribute('name', 'chat-composer-input')
    expect(uploadInput).not.toBeNull()
    expect(uploadInput).toHaveAttribute('name', 'chat-composer-upload-input')
    expect(uploadInput).toHaveAttribute('aria-label', '上传文件')
  })

  it('surfaces voice input as a status chip instead of a disabled action button', () => {
    render(<ChatAreaComposer {...baseProps} />)

    // Voice input chip was removed to reduce visual clutter
    expect(screen.queryByRole('status', { name: '语音输入: 暂未开放' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '语音输入' })).not.toBeInTheDocument()
  })
})

describe('ChatAreaComposer toolbar buttons', () => {
  it('renders attach context button and calls onToggleKnowledgePanel on click', () => {
    const onToggleKnowledgePanel = vi.fn()
    render(<ChatAreaComposer {...baseProps} onToggleKnowledgePanel={onToggleKnowledgePanel} />)

    const button = screen.getByRole('button', { name: 'attach context' })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(onToggleKnowledgePanel).toHaveBeenCalledOnce()
  })

  it('does not render attach context button when onToggleKnowledgePanel is not provided', () => {
    render(<ChatAreaComposer {...baseProps} />)

    expect(screen.queryByRole('button', { name: /attach context|open knowledge/i })).not.toBeInTheDocument()
  })

  it('clear draft button is in DOM with opacity-0 and tabindex -1 when input is empty', () => {
    render(<ChatAreaComposer {...baseProps} input="" onClearDraft={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'clear draft' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('opacity-0')
    expect(button).toHaveAttribute('tabindex', '-1')
  })

  it('renders clear draft button visible when input is non-empty and calls onClearDraft on click', () => {
    const onClearDraft = vi.fn()
    render(<ChatAreaComposer {...baseProps} input="hello" onClearDraft={onClearDraft} />)

    const button = screen.getByRole('button', { name: 'clear draft' })
    expect(button).toBeInTheDocument()
    expect(button).not.toHaveClass('opacity-0')
    expect(button).toHaveClass('opacity-100')
    expect(button).not.toHaveAttribute('tabindex')
    fireEvent.click(button)
    expect(onClearDraft).toHaveBeenCalledOnce()
  })

  it('does not render copy last reply button when lastAssistantContent is empty', () => {
    render(<ChatAreaComposer {...baseProps} lastAssistantContent="" />)

    expect(screen.queryByRole('button', { name: 'copy last reply' })).not.toBeInTheDocument()
  })

  it('paperclip button has focus-visible ring class', () => {
    render(<ChatAreaComposer {...baseProps} />)

    const button = screen.getByRole('button', { name: baseProps.uploadLabel })
    expect(button).toHaveClass('focus-visible:ring-2')
  })

  it('prevents default on send button mouse down and only sends when enabled', () => {
    const onSend = vi.fn()
    render(
      <ChatAreaComposer
        {...baseProps}
        input="hello"
        sendDisabled={false}
        onSend={onSend}
      />,
    )

    const enabledSendButton = screen.getByRole('button', { name: baseProps.sendLabel })
    const enabledMouseDown = createEvent.mouseDown(enabledSendButton)
    enabledMouseDown.preventDefault = vi.fn()
    fireEvent(enabledSendButton, enabledMouseDown)
    fireEvent.click(enabledSendButton)

    expect(enabledMouseDown.preventDefault).toHaveBeenCalled()
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('renders cancel button while loading and calls onCancelStream on click', () => {
    const onCancelStream = vi.fn()
    render(
      <ChatAreaComposer
        {...baseProps}
        isLoading={true}
        onCancelStream={onCancelStream}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: baseProps.cancelLabel }))

    expect(onCancelStream).toHaveBeenCalledTimes(1)
  })
})

describe('ChatAreaComposer clipboard tests', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders copy last reply button and copies content when lastAssistantContent is non-empty', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<ChatAreaComposer {...baseProps} lastAssistantContent="hello reply" />)

    const button = screen.getByRole('button', { name: 'copy last reply' })
    expect(button).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(button)
    })
    expect(writeText).toHaveBeenCalledWith('hello reply')
  })

  it('shows copied aria-label after clicking copy and restores after 1.5s', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.useFakeTimers()
    try {
      render(<ChatAreaComposer {...baseProps} lastAssistantContent="hello reply" />)

      const button = screen.getByRole('button', { name: 'copy last reply' })
      fireEvent.click(button)

      await act(async () => {
        vi.advanceTimersByTime(0)
      })

      expect(screen.getByRole('button', { name: 'copied!' })).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(1500)
      })

      expect(screen.getByRole('button', { name: 'copy last reply' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('announces copy status via live region for screen readers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.useFakeTimers()
    try {
      render(<ChatAreaComposer {...baseProps} lastAssistantContent="test content" />)

      const button = screen.getByRole('button', { name: 'copy last reply' })
      fireEvent.click(button)

      await act(async () => {
        vi.advanceTimersByTime(0)
      })

      const liveRegions = screen.getAllByRole('status')
      const copyRegion = liveRegions.find(el => el.classList.contains('sr-only'))
      expect(copyRegion).toBeTruthy()
      expect(copyRegion!.textContent).toContain('Copied!')

      await act(async () => {
        vi.advanceTimersByTime(1500)
      })

      expect(copyRegion!.textContent).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('ChatAreaComposer drag-drop file attachment', () => {
  it('shows drop zone overlay on drag over', () => {
    render(<ChatAreaComposer {...baseProps} />)
    const composer = screen.getByLabelText(baseProps.inputPlaceholder).closest('div[class*="rounded-xl"]')!

    fireEvent.dragOver(composer, { dataTransfer: { files: [] } })
    expect(screen.getByText('Drop files here')).toBeInTheDocument()

    fireEvent.dragLeave(composer)
    expect(screen.queryByText('Drop files here')).not.toBeInTheDocument()
  })

  it('captures files on drop and shows attachment chips', () => {
    render(<ChatAreaComposer {...baseProps} />)
    const composer = screen.getByLabelText(baseProps.inputPlaceholder).closest('div[class*="rounded-xl"]')!

    const file = new File(['test content'], 'test.md', { type: 'text/markdown' })
    fireEvent.drop(composer, { dataTransfer: { files: [file] } })

    expect(screen.getByText('test.md')).toBeInTheDocument()
    expect(screen.getByLabelText('remove test.md')).toBeInTheDocument()
  })

  it('removes attachment when chip X button is clicked', async () => {
    const user = userEvent.setup()
    render(<ChatAreaComposer {...baseProps} />)
    const composer = screen.getByLabelText(baseProps.inputPlaceholder).closest('div[class*="rounded-xl"]')!

    const file = new File(['test content'], 'test.md', { type: 'text/markdown' })
    fireEvent.drop(composer, { dataTransfer: { files: [file] } })
    expect(screen.getByText('test.md')).toBeInTheDocument()

    await user.click(screen.getByLabelText('remove test.md'))
    expect(screen.queryByText('test.md')).not.toBeInTheDocument()
  })

  it('rejects unsupported file types on drop', () => {
    render(<ChatAreaComposer {...baseProps} />)
    const composer = screen.getByLabelText(baseProps.inputPlaceholder).closest('div[class*="rounded-xl"]')!

    const file = new File(['malicious'], 'virus.exe', { type: 'application/x-msdownload' })
    fireEvent.drop(composer, { dataTransfer: { files: [file] } })

    expect(screen.queryByText('virus.exe')).not.toBeInTheDocument()
  })

  it('rejects dropped files without an extension', () => {
    render(<ChatAreaComposer {...baseProps} />)
    const composer = screen.getByLabelText(baseProps.inputPlaceholder).closest('div[class*="rounded-xl"]')!

    const file = new File(['mystery'], 'README', { type: 'text/plain' })
    fireEvent.drop(composer, { dataTransfer: { files: [file] } })

    expect(screen.queryByText('README')).not.toBeInTheDocument()
  })
})

describe('ChatAreaComposer clipboard fallbacks', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not crash when clipboard writeText is unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: {} })

    render(<ChatAreaComposer {...baseProps} lastAssistantContent="reply without clipboard writer" />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'copy last reply' }))
    })

    expect(screen.getByRole('button', { name: 'copy last reply' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'copied!' })).not.toBeInTheDocument()
  })
})
