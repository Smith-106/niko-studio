import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChatAreaComposer } from './ChatAreaComposer'

describe('ChatAreaComposer accessibility semantics', () => {
  it('adds deterministic id and name attributes to the composer textarea and upload input', () => {
    render(
      <ChatAreaComposer
        input=""
        isLoading={false}
        sendDisabled
        inputPlaceholder="告诉我你想创作什么..."
        uploadLabel="上传文件"
        voiceInputLabel="语音输入"
        sendLabel="发送"
        cancelLabel="取消"
        sendShortcutLabel="发送快捷键"
        sendShortcutHint="Enter"
        fileInputRef={createRef<HTMLInputElement>()}
        inputRef={createRef<HTMLTextAreaElement>()}
        onInputChange={() => {}}
        onKeyDown={vi.fn()}
        onFileUpload={vi.fn()}
        onOpenFilePicker={() => {}}
        onCancelStream={() => {}}
        onSend={() => {}}
      />,
    )

    const composerInput = screen.getByRole('textbox', { name: '告诉我你想创作什么...' })
    const uploadInput = document.getElementById('chat-composer-upload-input')

    expect(composerInput).toHaveAttribute('id', 'chat-composer-input')
    expect(composerInput).toHaveAttribute('name', 'chat-composer-input')
    expect(uploadInput).not.toBeNull()
    expect(uploadInput).toHaveAttribute('name', 'chat-composer-upload-input')
    expect(uploadInput).toHaveAttribute('aria-label', '上传文件')
  })
})
