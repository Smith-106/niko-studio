import { create, type StateCreator } from 'zustand'
import type { ProjectWorkspaceContext } from '@/types/workspace'

import { createBackendSlice, type BackendSlice } from './app/backendSlice'
import { createConversationSlice, type ConversationSlice } from './app/conversationSlice'
import { createLoadingSlice, type LoadingSlice } from './app/loadingSlice'
import { createSkillsSlice, type SkillsSlice } from './app/skillsSlice'
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
}))
