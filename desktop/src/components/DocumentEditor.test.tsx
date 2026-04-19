import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultProjectWorkspaceContext } from '../types/workspace'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { DocumentEditor } from './DocumentEditor'

vi.mock('./StoryBiblePanel', () => ({
  StoryBiblePanel: () => <div>Story Bible</div>,
}))

vi.mock('./NikoEditor', () => ({
  NikoEditor: ({ initialContent }: { initialContent?: string }) => (
    <div data-testid="editor-props">{initialContent ?? ''}</div>
  ),
}))

vi.mock('../utils/editorHandle', () => ({
  getEditorHandle: vi.fn(() => null),
}))

describe('DocumentEditor accessibility semantics', () => {
  beforeEach(() => {
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    localStorage.clear()
    useAppStore.setState({
      backendStatus: false,
      conversationsById: {},
      allConversationIds: [],
      currentConversationId: null,
      currentWorkspace: createDefaultProjectWorkspaceContext(),
      selectedSkills: [],
      availableSkills: [],
      loadingMap: {},
    })
  })

  it('adds deterministic id and name attributes to the document title field', () => {
    render(<DocumentEditor onOpenWritingHelper={() => {}} />)

    const titleInput = screen.getByRole('textbox', { name: '文档标题' })

    expect(titleInput).toHaveAttribute('id', 'document-title-input')
    expect(titleInput).toHaveAttribute('name', 'document-title-input')
  })

  it('binds the title field to the selected conversation title', () => {
    useAppStore.setState((state) => ({
      ...state,
      currentConversationId: 'conv-1',
      conversationsById: {
        'conv-1': {
          id: 'conv-1',
          title: '新对话',
          messages: [],
          createdAt: new Date('2026-04-18T00:00:00Z'),
          updatedAt: new Date('2026-04-18T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
      },
      allConversationIds: ['conv-1'],
    }))

    render(<DocumentEditor onOpenWritingHelper={() => {}} />)

    expect(screen.getByRole('textbox', { name: '文档标题' })).toHaveValue('新对话')
  })

  it('updates the current conversation title when the user edits the field', async () => {
    const user = userEvent.setup()
    useAppStore.setState((state) => ({
      ...state,
      currentConversationId: 'conv-1',
      conversationsById: {
        'conv-1': {
          id: 'conv-1',
          title: '新对话',
          messages: [],
          createdAt: new Date('2026-04-18T00:00:00Z'),
          updatedAt: new Date('2026-04-18T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
      },
      allConversationIds: ['conv-1'],
    }))

    render(<DocumentEditor onOpenWritingHelper={() => {}} />)

    const titleInput = screen.getByRole('textbox', { name: '文档标题' })
    await user.clear(titleInput)
    await user.type(titleInput, '第一章草稿')

    expect(useAppStore.getState().conversationsById['conv-1']?.title).toBe('第一章草稿')
  })

  it('reloads per-conversation draft content when switching conversations', async () => {
    localStorage.setItem('niko.draft:conv-1', JSON.stringify({
      text: '第一篇正文',
      timestamp: Date.now(),
    }))
    localStorage.setItem('niko.draft:conv-2', JSON.stringify({
      text: '第二篇正文',
      timestamp: Date.now(),
    }))
    useAppStore.setState((state) => ({
      ...state,
      currentConversationId: 'conv-1',
      conversationsById: {
        'conv-1': {
          id: 'conv-1',
          title: '新对话',
          messages: [],
          createdAt: new Date('2026-04-18T00:00:00Z'),
          updatedAt: new Date('2026-04-18T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
        'conv-2': {
          id: 'conv-2',
          title: '第二篇',
          messages: [],
          createdAt: new Date('2026-04-18T00:00:00Z'),
          updatedAt: new Date('2026-04-18T00:00:00Z'),
          workspace: createDefaultProjectWorkspaceContext(),
        },
      },
      allConversationIds: ['conv-2', 'conv-1'],
    }))

    render(<DocumentEditor onOpenWritingHelper={() => {}} />)

    expect(screen.getByRole('textbox', { name: '文档标题' })).toHaveValue('新对话')
    expect(screen.getByTestId('editor-props')).toHaveTextContent('第一篇正文')

    act(() => {
      useAppStore.getState().selectConversation('conv-2')
    })

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: '文档标题' })).toHaveValue('第二篇')
      expect(screen.getByTestId('editor-props')).toHaveTextContent('第二篇正文')
    })
  })
})
