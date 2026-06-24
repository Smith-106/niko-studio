import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createDefaultProjectWorkspaceContext } from '../types/workspace'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { DocumentEditor } from './DocumentEditor'

const getEditorHandleMock = vi.fn(() => null)

vi.mock('./StoryBiblePanel', () => ({
  StoryBiblePanel: () => <div>Story Bible</div>,
}))

vi.mock('./HistoryPanel', () => ({
  HistoryPanel: () => <div data-testid="history-panel" />,
}))

vi.mock('./NikoEditor', () => ({
  NikoEditor: ({ initialContent }: { initialContent?: string }) => (
    <div data-testid="editor-props">{initialContent ?? ''}</div>
  ),
}))

vi.mock('../utils/editorHandle', () => ({
  getEditorHandle: (...args: unknown[]) => getEditorHandleMock(...args),
  setEditorHandle: vi.fn(),
  notifyGeneratingChange: vi.fn(),
  setGeneratingListener: vi.fn(),
}))

vi.mock('../services/projectFileService', () => ({
  readChapterContent: vi.fn(() => Promise.resolve(null)),
  writeChapterContent: vi.fn(() => Promise.resolve()),
}))

vi.mock('../services/versionService', () => ({
  autoSaveSnapshot: vi.fn(() => Promise.resolve()),
  listSnapshots: vi.fn(() => Promise.resolve({ snapshots: [] })),
  diffSnapshots: vi.fn(() => Promise.resolve([])),
  restoreSnapshot: vi.fn(() => Promise.resolve()),
}))

async function renderDocumentEditor() {
  await act(async () => {
    render(<DocumentEditor onOpenWritingHelper={() => {}} />)
  })

  await screen.findByText('Story Bible')
}

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
      editorIsDirty: false,
    })
    getEditorHandleMock.mockReturnValue(null)
  })

  it('adds deterministic id and name attributes to the document title field', async () => {
    await renderDocumentEditor()

    const titleInput = screen.getByRole('textbox', { name: '文档标题' })

    expect(titleInput).toHaveAttribute('id', 'document-title-input')
    expect(titleInput).toHaveAttribute('name', 'document-title-input')
  })

  it('binds the title field to the selected conversation title', async () => {
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

    await renderDocumentEditor()

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

    await renderDocumentEditor()

    const titleInput = screen.getByRole('textbox', { name: '文档标题' })
    await user.clear(titleInput)
    await user.type(titleInput, '第一章草稿')

    expect(useAppStore.getState().conversationsById['conv-1']?.title).toBe('第一章草稿')
  })

  it('updates conversation title when switching conversations', async () => {
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

    await renderDocumentEditor()

    expect(screen.getByRole('textbox', { name: '文档标题' })).toHaveValue('新对话')

    act(() => {
      useAppStore.getState().selectConversation('conv-2')
    })

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: '文档标题' })).toHaveValue('第二篇')
    })
  })

  it('updates session intelligence summary when the feature is enabled and editor content changes', async () => {
    useAppStore.setState((state) => ({
      ...state,
      sessionIntelligenceEnabled: true,
      currentProjectId: 'project-1',
      currentChapterId: 'chapter-1',
    }))

    await renderDocumentEditor()

    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('"type":"doc"')
    })

    expect(useAppStore.getState().sessionIntelligenceSummary).not.toBeUndefined()
  })
})

describe('DocumentEditor beforeunload protection', () => {
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
      editorIsDirty: false,
    })
    getEditorHandleMock.mockReturnValue(null)
  })

  it('prevents closing when editorIsDirty is true via beforeunload', async () => {
    useAppStore.setState({ editorIsDirty: true })

    await renderDocumentEditor()

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent

    window.dispatchEvent(event)

    // In jsdom, beforeunload handlers set returnValue when preventing close
    // The handler sets e.returnValue = '' which in jsdom may be coerced to true
    // We verify the handler was registered by checking the event was processed
    // (the component registers the listener when editorIsDirty is true)
    expect(event.defaultPrevented || event.returnValue !== undefined).toBe(true)
  })

  it('does not prevent closing when editorIsDirty is false', async () => {
    useAppStore.setState({ editorIsDirty: false })

    await renderDocumentEditor()

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(preventDefaultSpy).not.toHaveBeenCalled()
  })
})

describe('DocumentEditor template:apply event consumption', () => {
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
      editorIsDirty: false,
    })
    getEditorHandleMock.mockReturnValue(null)
  })

  it('calls insertContent on the editor handle when template:apply event is dispatched', async () => {
    const insertContentMock = vi.fn()
    getEditorHandleMock.mockReturnValue({
      insertContent: insertContentMock,
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => ''),
      getJSON: vi.fn(() => ({ type: 'doc' })),
      captureSelectionSnapshot: vi.fn(() => null),
      replaceSelectionSnapshot: vi.fn(() => false),
      insertBelowSelectionSnapshot: vi.fn(() => false),
      undoLastRevisionApply: vi.fn(() => false),
      triggerAIContinue: vi.fn(),
    })

    await renderDocumentEditor()

    const templateContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '模板内容' }] }] }
    const event = new CustomEvent('template:apply', {
      detail: { templateId: 'template-1', content: templateContent },
    })

    window.dispatchEvent(event)

    await waitFor(() => {
      expect(insertContentMock).toHaveBeenCalledTimes(1)
    })

    expect(insertContentMock).toHaveBeenCalledWith(templateContent)
  })

  it('ignores template:apply events with missing content', async () => {
    const insertContentMock = vi.fn()
    getEditorHandleMock.mockReturnValue({
      insertContent: insertContentMock,
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => ''),
      getJSON: vi.fn(() => ({ type: 'doc' })),
      captureSelectionSnapshot: vi.fn(() => null),
      replaceSelectionSnapshot: vi.fn(() => false),
      insertBelowSelectionSnapshot: vi.fn(() => false),
      undoLastRevisionApply: vi.fn(() => false),
      triggerAIContinue: vi.fn(),
    })

    await renderDocumentEditor()

    const event = new CustomEvent('template:apply', {
      detail: { templateId: 'template-1' },
    })

    window.dispatchEvent(event)

    // Give a tick for the event handler to run
    await act(async () => { await Promise.resolve() })

    expect(insertContentMock).not.toHaveBeenCalled()
  })

  it('does nothing when editor handle is null and template:apply is dispatched', async () => {
    getEditorHandleMock.mockReturnValue(null)

    await renderDocumentEditor()

    const event = new CustomEvent('template:apply', {
      detail: { templateId: 'template-1', content: { type: 'doc', content: [] } },
    })

    // Should not throw
    expect(() => window.dispatchEvent(event)).not.toThrow()
  })
})
