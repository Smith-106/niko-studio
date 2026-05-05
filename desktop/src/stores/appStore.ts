import { create, type StateCreator } from 'zustand'
import type { ProjectWorkspaceContext } from '@/types/workspace'

import { createBackendSlice, type BackendSlice } from './app/backendSlice'
import { createConversationSlice, type ConversationSlice } from './app/conversationSlice'
import { createIntelligenceSlice, type IntelligenceSlice } from './app/intelligenceSlice'
import { createLoadingSlice, type LoadingSlice } from './app/loadingSlice'
import { createProjectSlice, type ProjectSlice } from './app/projectSlice'
import { createSkillsSlice, type SkillsSlice } from './app/skillsSlice'
import { createTemplateSlice, type TemplateSlice } from './app/templateSlice'
import { createWorkflowSlice, type WorkflowSlice } from './app/workflowSlice'
import {
  type Conversation,
  type MessageComparison,
  type MessageComparisonItem,
} from './app/shared'
import { createWorkspaceSlice, type WorkspaceSlice } from './app/workspaceSlice'
import { createUiSlice, type UiSlice } from './uiSlice'

export type {
  Conversation,
  Message,
  MessageComparison,
  MessageComparisonItem,
} from './app/shared'

export type AppState =
  & BackendSlice
  & WorkspaceSlice
  & ConversationSlice
  & SkillsSlice
  & LoadingSlice
  & UiSlice
  & ProjectSlice
  & IntelligenceSlice
  & TemplateSlice
  & WorkflowSlice

export type AppSlice<T> = StateCreator<AppState, [], [], T>

export type AppStoreConversation = Conversation
export type AppStoreMessageComparison = MessageComparison
export type AppStoreMessageComparisonItem = MessageComparisonItem
export type AppStoreWorkspace = ProjectWorkspaceContext

export const useAppStore = create<AppState>()((...args) => ({
  ...createBackendSlice(...args),
  ...createWorkspaceSlice(...args),
  ...createConversationSlice(...args),
  ...createSkillsSlice(...args),
  ...createLoadingSlice(...args),
  ...createUiSlice(...args),
  ...createProjectSlice(...args),
  ...createIntelligenceSlice(...args),
  ...createTemplateSlice(...args),
  ...createWorkflowSlice(...args),
}))
