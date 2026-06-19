import { beforeEach, describe, expect, it } from 'vitest'

import { type WriterMetadata } from '@/api/client'
import { createDefaultProjectWorkspaceContext } from '@/types/workspace'
import { useAppStore } from '@/stores/appStore'

function buildMeaningfulWorkspace() {
  return {
    identity: {
      projectId: 'atlas-project',
      projectName: 'Atlas Project',
      workspaceRoot: '/tmp/atlas-project',
    },
    manuscript: {
      chapterId: 'chapter-1',
    },
  }
}

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
    useAppStore.getState().setCurrentWorkspace(buildMeaningfulWorkspace())

    useAppStore.getState().createConversation()
    const created = useAppStore.getState().conversationsById[useAppStore.getState().currentConversationId ?? '']

    expect(created?.workspace).toMatchObject({
      identity: {
        projectId: 'atlas-project',
      },
      manuscript: {
        chapterId: 'chapter-1',
      },
      workflow: {
        planId: null,
      },
      chat: {
        conversationId: null,
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

  it('updates both conversation workspace and current workspace when syncing the active conversation', () => {
    useAppStore.getState().createConversation()
    const conversationId = useAppStore.getState().currentConversationId!

    useAppStore.getState().syncConversationWorkspace(conversationId, {
      identity: {
        projectId: 'atlas-project',
      },
      workflow: {
        sessionId: 'workflow-session-sync',
      },
    })

    const state = useAppStore.getState()
    expect(state.currentWorkspace).toMatchObject({
      identity: {
        projectId: 'atlas-project',
      },
      workflow: {
        sessionId: 'workflow-session-sync',
      },
    })
    expect(state.conversationsById[conversationId]?.workspace).toMatchObject({
      identity: {
        projectId: 'atlas-project',
      },
      workflow: {
        sessionId: 'workflow-session-sync',
      },
    })
  })

  it('keeps state unchanged when syncing a conversation id that does not exist', () => {
    const baselineWorkspace = useAppStore.getState().currentWorkspace
    useAppStore.getState().syncConversationWorkspace('missing-conversation', {
      identity: {
        projectId: 'ignored-project',
      },
    })

    const state = useAppStore.getState()
    expect(state.currentWorkspace).toBe(baselineWorkspace)
    expect(state.conversationsById).toEqual({})
  })

  it('keeps current workspace stable when syncing an inactive conversation', async () => {
    useAppStore.getState().createConversation()
    const firstId = useAppStore.getState().currentConversationId!
    useAppStore.getState().syncConversationWorkspace(firstId, {
      identity: {
        projectId: 'first-project',
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 2))

    useAppStore.getState().createConversation()
    const secondId = useAppStore.getState().currentConversationId!

    useAppStore.getState().syncConversationWorkspace(firstId, {
      identity: {
        projectId: 'synced-inactive-project',
      },
    })

    const state = useAppStore.getState()
    expect(state.currentConversationId).toBe(secondId)
    expect(state.currentWorkspace).toMatchObject({
      chat: {
        conversationId: null,
      },
    })
    expect(state.currentWorkspace.identity.projectId).not.toBe('synced-inactive-project')
    expect(state.conversationsById[firstId]?.workspace).toMatchObject({
      identity: {
        projectId: 'synced-inactive-project',
      },
    })
  })


  it('resets legacy conversations without stored workspace to a safe default', () => {
    useAppStore.getState().setCurrentWorkspace({
      ...buildMeaningfulWorkspace(),
      workflow: {
        sessionId: 'workflow-session-9',
        planId: 'plan-9',
        level: 'L4',
      },
      chat: {
        conversationId: 'chat-9',
        comparisonEnabled: true,
      },
    })

    const legacyConversationId = 'legacy-conversation'
    useAppStore.setState((state) => ({
      ...state,
      conversationsById: {
        [legacyConversationId]: {
          id: legacyConversationId,
          title: 'Legacy conversation',
          messages: [],
          createdAt: new Date('2026-04-08T00:00:00Z'),
          updatedAt: new Date('2026-04-08T00:00:00Z'),
        },
      },
      allConversationIds: [legacyConversationId],
    }))

    useAppStore.getState().selectConversation(legacyConversationId)

    expect(useAppStore.getState().currentWorkspace).toMatchObject({
      identity: {
        projectId: 'default-project',
        workspaceId: 'default-project',
      },
      manuscript: {
        chapterId: null,
      },
      workflow: {
        sessionId: null,
        planId: null,
        level: null,
      },
      chat: {
        conversationId: null,
        comparisonEnabled: null,
      },
    })
  })

  it('drops workflow and chat identifiers when creating a new conversation', () => {
    useAppStore.getState().setCurrentWorkspace({
      ...buildMeaningfulWorkspace(),
      workflow: {
        sessionId: 'workflow-session-9',
        planId: 'plan-9',
        level: 'L4',
      },
      chat: {
        conversationId: 'chat-9',
        comparisonEnabled: true,
      },
    })

    useAppStore.getState().createConversation()
    const state = useAppStore.getState()
    const created = state.conversationsById[state.currentConversationId ?? '']

    expect(created?.workspace).toMatchObject({
      identity: {
        projectId: 'atlas-project',
      },
      manuscript: {
        chapterId: 'chapter-1',
      },
      workflow: {
        sessionId: null,
        planId: null,
        level: null,
      },
      chat: {
        conversationId: null,
        comparisonEnabled: null,
      },
    })
    expect(state.currentWorkspace).toMatchObject({
      workflow: {
        sessionId: null,
        planId: null,
        level: null,
      },
      chat: {
        conversationId: null,
        comparisonEnabled: null,
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
        authority: {
          recordSetId: null,
          activeSceneId: null,
          activeEventId: null,
          activeTimelineId: null,
          consistencyRunId: null,
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
