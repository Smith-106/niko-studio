import type { WriterMetadata } from '@/api/client'
import {
  createDefaultProjectWorkspaceContext,
  mergeProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  type ProjectWorkspaceContext,
} from '@/types/workspace'

export function generateTitle(content: string): string {
  const cleaned = content.replace(/^\/\w+\s*/, '').trim()
  const firstLine = cleaned.split('\n')[0]
  if (firstLine.length <= 30) return firstLine
  return firstLine.slice(0, 30) + '...'
}

export interface MessageComparisonItem {
  model: string
  content: string
}

export interface MessageComparison {
  enabled: boolean
  primary: MessageComparisonItem
  control: MessageComparisonItem
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  skills?: string[]
  comparison?: MessageComparison
  writerMetadata?: WriterMetadata
  workspaceContext?: ProjectWorkspaceContext
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  workspace?: ProjectWorkspaceContext
}

export function resolveWorkspaceFromWriterMetadata(
  writerMetadata?: WriterMetadata,
): ProjectWorkspaceContext | null {
  const candidate = writerMetadata?.workspace_context
  return candidate ? normalizeProjectWorkspaceContext(candidate) : null
}

export function createSafeDefaultWorkspace(): ProjectWorkspaceContext {
  return createDefaultProjectWorkspaceContext()
}

export function createConversationWorkspaceSeed(
  workspace: ProjectWorkspaceContext,
): ProjectWorkspaceContext {
  const normalizedWorkspace = normalizeProjectWorkspaceContext(workspace)
  const defaultWorkspace = createSafeDefaultWorkspace()

  return mergeProjectWorkspaceContext(normalizedWorkspace, {
    workflow: defaultWorkspace.workflow,
    chat: defaultWorkspace.chat,
  })
}

export function resolveSelectedConversationWorkspace(
  conversation?: Conversation,
): ProjectWorkspaceContext {
  return conversation?.workspace
    ? normalizeProjectWorkspaceContext(conversation.workspace)
    : createSafeDefaultWorkspace()
}

export function mergeConversationWorkspace(
  baseWorkspace: ProjectWorkspaceContext,
  patch: ProjectWorkspaceContext | Record<string, unknown>,
): ProjectWorkspaceContext {
  return mergeProjectWorkspaceContext(baseWorkspace, patch)
}
