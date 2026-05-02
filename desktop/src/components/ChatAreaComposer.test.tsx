import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

    expect(screen.getByRole('status', { name: '语音输入: 暂未开放' })).toBeInTheDocument()
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

  it('does not render clear draft button when input is empty', () => {
    render(<ChatAreaComposer {...baseProps} input="" onClearDraft={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'clear draft' })).not.toBeInTheDocument()
  })

  it('renders clear draft button when input is non-empty and calls onClearDraft on click', () => {
    const onClearDraft = vi.fn()
    render(<ChatAreaComposer {...baseProps} input="hello" onClearDraft={onClearDraft} />)

    const button = screen.getByRole('button', { name: 'clear draft' })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(onClearDraft).toHaveBeenCalledOnce()
  })

  it('does not render copy last reply button when lastAssistantContent is empty', () => {
    render(<ChatAreaComposer {...baseProps} lastAssistantContent="" />)

    expect(screen.queryByRole('button', { name: 'copy last reply' })).not.toBeInTheDocument()
  })

  it('renders copy last reply button and copies content when lastAssistantContent is non-empty', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    render(<ChatAreaComposer {...baseProps} lastAssistantContent="hello reply" />)

    const button = screen.getByRole('button', { name: 'copy last reply' })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(writeText).toHaveBeenCalledWith('hello reply')
  })
})
