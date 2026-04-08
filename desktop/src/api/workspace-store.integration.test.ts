import { beforeEach, describe, expect, it } from 'vitest'

import { type WriterMetadata } from '@/api/client'
import { createDefaultProjectWorkspaceContext } from '@/types/workspace'
import { useAppStore } from '@/stores/appStore'

function resetStore() {
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
}

describe('workspace store integration', () => {
  beforeEach(() => {
    resetStore()
  })

  it('seeds new conversations from the current workspace and restores it on selection', () => {
    useAppStore.getState().setCurrentWorkspace({
      identity: {
        projectId: 'atlas-project',
      },
      manuscript: {
        chapterId: 'chapter-1',
      },
    })

    useAppStore.getState().createConversation()
    const created = useAppStore.getState().conversationsById[useAppStore.getState().currentConversationId ?? '']

    expect(created?.workspace).toMatchObject({
      identity: {
        projectId: 'atlas-project',
      },
      manuscript: {
        chapterId: 'chapter-1',
      },
    })

    useAppStore.getState().setCurrentWorkspace({
      identity: {
        projectId: 'different-project',
      },
    })
    useAppStore.getState().selectConversation(created!.id)

    expect(useAppStore.getState().currentWorkspace).toMatchObject({
      identity: {
        projectId: 'atlas-project',
      },
      manuscript: {
        chapterId: 'chapter-1',
      },
    })
  })

  it('syncs assistant workspace metadata into conversation and current workspace authority', () => {
    useAppStore.getState().createConversation()

    const writerMetadata: WriterMetadata = {
      workspace_context: {
        schemaVersion: '2026-04-08',
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'atlas-project',
          workspaceRoot: '/tmp/atlas',
        },
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: 'chapter-4',
          chapterTitle: null,
          chapterNumber: 4,
        },
        storyBible: {
          storyBibleId: null,
          draftId: 'draft-4',
          version: null,
          storage: 'local-draft',
        },
        knowledge: {
          focusEntityId: 'hero-4',
          graphEntityIds: ['hero-4'],
          memoryEntryIds: ['memory-4'],
        },
        workflow: {
          sessionId: 'workflow-session-4',
          planId: 'plan-4',
          level: 'L3',
        },
        chat: {
          conversationId: 'conversation-4',
          comparisonEnabled: false,
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: [],
          notes: [],
        },
      },
    }

    useAppStore.getState().addMessage('assistant', 'workspace-aware reply', [], undefined, writerMetadata)

    const state = useAppStore.getState()
    const conversation = state.conversationsById[state.currentConversationId ?? '']
    const message = conversation?.messages[0]

    expect(state.currentWorkspace).toMatchObject({
      identity: {
        projectId: 'atlas-project',
      },
      workflow: {
        sessionId: 'workflow-session-4',
      },
    })
    expect(conversation?.workspace).toMatchObject({
      manuscript: {
        chapterId: 'chapter-4',
      },
      storyBible: {
        draftId: 'draft-4',
      },
    })
    expect(message?.workspaceContext).toMatchObject({
      knowledge: {
        focusEntityId: 'hero-4',
      },
    })
  })
})
