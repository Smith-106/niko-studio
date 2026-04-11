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

export function resolveConversationWorkspaceForSync(params: {
  conversation?: Conversation
  conversationId: string
  currentConversationId: string | null
  currentWorkspace: ProjectWorkspaceContext
  patch: ProjectWorkspaceContext | Record<string, unknown>
}): {
  conversationWorkspace: ProjectWorkspaceContext
  currentWorkspace: ProjectWorkspaceContext
} | null {
  const { conversation, conversationId, currentConversationId, currentWorkspace, patch } = params
  if (!conversation) return null

  const baseWorkspace = conversation.workspace
    ? conversation.workspace
    : currentConversationId === conversationId
      ? currentWorkspace
      : createSafeDefaultWorkspace()
  const nextWorkspace = mergeConversationWorkspace(baseWorkspace, patch)

  return {
    conversationWorkspace: nextWorkspace,
    currentWorkspace: currentConversationId === conversationId ? nextWorkspace : currentWorkspace,
  }
}

export function createConversationRecord(params: {
  id: string
  workspace: ProjectWorkspaceContext
  title?: string
}): Conversation {
  return {
    id: params.id,
    title: params.title ?? '新对话',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace: params.workspace,
  }
}

export function buildConversationMessage(params: {
  role: 'user' | 'assistant'
  content: string
  skills?: string[]
  comparison?: MessageComparison
  writerMetadata?: WriterMetadata
}): {
  message: Message
  messageWorkspace: ProjectWorkspaceContext | null
} {
  const messageWorkspace = resolveWorkspaceFromWriterMetadata(params.writerMetadata)
  return {
    messageWorkspace,
    message: {
      id: Date.now().toString(),
      role: params.role,
      content: params.content,
      timestamp: new Date(),
      skills: params.skills,
      comparison: params.comparison,
      writerMetadata: params.writerMetadata,
      workspaceContext: messageWorkspace ?? undefined,
    },
  }
}

export function resolveConversationStateForMessage(params: {
  conversation: Conversation
  currentWorkspace: ProjectWorkspaceContext
  role: 'user' | 'assistant'
  content: string
  skills?: string[]
  comparison?: MessageComparison
  writerMetadata?: WriterMetadata
}): {
  nextWorkspace: ProjectWorkspaceContext
  nextConversation: Conversation
} {
  const { message, messageWorkspace } = buildConversationMessage(params)
  const nextWorkspace = messageWorkspace
    ? mergeConversationWorkspace(params.currentWorkspace, messageWorkspace)
    : params.currentWorkspace

  return {
    nextWorkspace,
    nextConversation: {
      ...params.conversation,
      workspace: nextWorkspace,
      messages: [...params.conversation.messages, message],
      updatedAt: new Date(),
      title: params.conversation.messages.length === 0 && params.role === 'user'
        ? generateTitle(params.content)
        : params.conversation.title,
    },
  }
}

export function updateConversationMessages(
  conversation: Conversation,
  updater: (messages: Message[]) => Message[],
): Conversation {
  return {
    ...conversation,
    messages: updater(conversation.messages),
    updatedAt: new Date(),
  }
}
