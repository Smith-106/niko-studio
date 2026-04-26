import { createDefaultProjectWorkspaceContext, mergeProjectWorkspaceContext, type ProjectWorkspaceContext } from '@/types/workspace'

import { resolveConversationWorkspaceForSync } from './shared'
import type { AppSlice } from '../appStore'

export interface WorkspaceSlice {
  currentWorkspace: ProjectWorkspaceContext
  setCurrentWorkspace: (workspace: ProjectWorkspaceContext | Record<string, unknown>) => void
  syncConversationWorkspace: (conversationId: string, workspace: ProjectWorkspaceContext | Record<string, unknown>) => void
}

export const createWorkspaceSlice: AppSlice<WorkspaceSlice> = (set) => ({
  currentWorkspace: createDefaultProjectWorkspaceContext(),
  setCurrentWorkspace: (workspace) => {
    set((state) => ({
      currentWorkspace: mergeProjectWorkspaceContext(state.currentWorkspace, workspace),
    }))
  },
  syncConversationWorkspace: (conversationId, workspace) => {
    set((state) => {
      const resolved = resolveConversationWorkspaceForSync({
        conversation: state.conversationsById[conversationId],
        conversationId,
        currentConversationId: state.currentConversationId,
        currentWorkspace: state.currentWorkspace,
        patch: workspace,
      })
      if (!resolved) return state

      return {
        currentWorkspace: resolved.currentWorkspace,
        conversationsById: {
          ...state.conversationsById,
          [conversationId]: {
            ...state.conversationsById[conversationId],
            workspace: resolved.conversationWorkspace,
            updatedAt: new Date(),
          },
        },
      }
    })
  },
})
