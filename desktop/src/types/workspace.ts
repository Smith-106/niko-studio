export const PROJECT_WORKSPACE_SCHEMA_VERSION = '2026-04-08'

export const PROJECT_WORKSPACE_MIGRATION_NOTES = [
  'The canonical workspace payload is additive and preserves legacy request fields.',
  'Legacy project_id/session_id/chapterId fields are normalized into the authoritative workspace model.',
  'Desktop local Story Bible drafts can be represented without forcing an immediate storage rewrite.',
] as const

export interface ProjectWorkspaceIdentity {
  workspaceId: string
  projectId: string
  projectName: string | null
  workspaceRoot: string | null
}

export interface ProjectWorkspaceManuscript {
  manuscriptId: string | null
  title: string | null
  chapterId: string | null
  chapterTitle: string | null
  chapterNumber: number | null
}

export interface ProjectWorkspaceStoryBible {
  storyBibleId: string | null
  draftId: string | null
  version: string | null
  storage: 'local-draft' | 'workspace' | 'graph' | 'memory'
}

export interface ProjectWorkspaceKnowledge {
  focusEntityId: string | null
  graphEntityIds: string[]
  memoryEntryIds: string[]
}

export interface ProjectWorkspaceWorkflow {
  sessionId: string | null
  planId: string | null
  level: string | null
}

export interface ProjectWorkspaceChat {
  conversationId: string | null
  comparisonEnabled: boolean | null
}

export interface ProjectWorkspaceCompatibility {
  additiveContract: true
  migratedLegacyFields: string[]
  notes: readonly string[]
}

export interface ProjectWorkspaceContext {
  schemaVersion: string
  identity: ProjectWorkspaceIdentity
  manuscript: ProjectWorkspaceManuscript
  storyBible: ProjectWorkspaceStoryBible
  knowledge: ProjectWorkspaceKnowledge
  workflow: ProjectWorkspaceWorkflow
  chat: ProjectWorkspaceChat
  compatibility: ProjectWorkspaceCompatibility
}

interface NormalizeWorkspaceOptions {
  workspaceRoot?: string | null
  fallbackProjectId?: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry)))]
}

function basenameOrNull(value: string | null | undefined): string | null {
  const raw = readString(value)
  if (!raw) return null
  const parts = raw.split(/[\\/]/).filter(Boolean)
  return parts.length > 0 ? readString(parts[parts.length - 1]) : null
}

function sanitizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'workspace'
}

function readStoryBibleStorage(value: unknown): ProjectWorkspaceStoryBible['storage'] | null {
  if (value === 'local-draft' || value === 'workspace' || value === 'graph' || value === 'memory') {
    return value
  }
  return null
}

export function createDefaultProjectWorkspaceContext(
  options: NormalizeWorkspaceOptions = {},
): ProjectWorkspaceContext {
  const fallbackId = readString(options.fallbackProjectId)
    ?? basenameOrNull(options.workspaceRoot)
    ?? 'default-project'
  const projectId = sanitizeIdentifier(fallbackId)
  const workspaceId = sanitizeIdentifier(basenameOrNull(options.workspaceRoot) ?? projectId)

  return {
    schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION,
    identity: {
      workspaceId,
      projectId,
      projectName: projectId,
      workspaceRoot: readString(options.workspaceRoot),
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: null,
      chapterTitle: null,
      chapterNumber: null,
    },
    storyBible: {
      storyBibleId: null,
      draftId: null,
      version: null,
      storage: 'workspace',
    },
    knowledge: {
      focusEntityId: null,
      graphEntityIds: [],
      memoryEntryIds: [],
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
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: PROJECT_WORKSPACE_MIGRATION_NOTES,
    },
  }
}

export function normalizeProjectWorkspaceContext(
  input: unknown,
  options: NormalizeWorkspaceOptions = {},
): ProjectWorkspaceContext {
  const fallback = createDefaultProjectWorkspaceContext(options)
  const root = asRecord(input) ?? {}
  const nestedWorkspace = asRecord(root.workspace)
  const workspaceRecord = nestedWorkspace ?? root
  const contextRecord = asRecord(root.context)
  const identityRecord = asRecord(workspaceRecord.identity)
  const manuscriptRecord = asRecord(workspaceRecord.manuscript)
  const storyBibleRecord = asRecord(workspaceRecord.storyBible)
  const knowledgeRecord = asRecord(workspaceRecord.knowledge)
  const workflowRecord = asRecord(workspaceRecord.workflow)
  const chatRecord = asRecord(workspaceRecord.chat)
  const migratedLegacyFields = new Set<string>()

  const legacyProjectId = readString(root.project_id)
    ?? readString(root.projectId)
    ?? readString(contextRecord?.projectId)
  if (legacyProjectId) {
    if (readString(root.project_id)) migratedLegacyFields.add('project_id')
    if (readString(root.projectId)) migratedLegacyFields.add('projectId')
    if (readString(contextRecord?.projectId)) migratedLegacyFields.add('context.projectId')
  }

  const legacyChapterId = readString(root.chapter_id)
    ?? readString(root.chapterId)
    ?? readString(contextRecord?.chapterId)
  if (legacyChapterId) {
    if (readString(root.chapter_id)) migratedLegacyFields.add('chapter_id')
    if (readString(root.chapterId)) migratedLegacyFields.add('chapterId')
    if (readString(contextRecord?.chapterId)) migratedLegacyFields.add('context.chapterId')
  }

  const legacySessionId = readString(root.session_id) ?? readString(root.sessionId)
  if (legacySessionId) {
    if (readString(root.session_id)) migratedLegacyFields.add('session_id')
    if (readString(root.sessionId)) migratedLegacyFields.add('sessionId')
  }

  const legacyConversationId = readString(root.conversation_id)
    ?? readString(root.conversationId)
    ?? readString(root.currentConversationId)
  if (legacyConversationId) {
    if (readString(root.conversation_id)) migratedLegacyFields.add('conversation_id')
    if (readString(root.conversationId)) migratedLegacyFields.add('conversationId')
    if (readString(root.currentConversationId)) migratedLegacyFields.add('currentConversationId')
  }

  const projectId = readString(identityRecord?.projectId)
    ?? readString(identityRecord?.project_id)
    ?? legacyProjectId
    ?? fallback.identity.projectId

  const workspaceRoot = readString(identityRecord?.workspaceRoot)
    ?? readString(identityRecord?.workspace_root)
    ?? readString(root.workspaceRoot)
    ?? readString(root.workspace_root)
    ?? fallback.identity.workspaceRoot

  const workspaceId = sanitizeIdentifier(
    readString(identityRecord?.workspaceId)
      ?? readString(identityRecord?.workspace_id)
      ?? readString(root.workspaceId)
      ?? readString(root.workspace_id)
      ?? basenameOrNull(workspaceRoot)
      ?? projectId
      ?? fallback.identity.workspaceId,
  )

  const draftId = readString(storyBibleRecord?.draftId)
    ?? readString(storyBibleRecord?.draft_id)
    ?? readString(root.story_bible_draft_id)
    ?? readString(root.storyBibleDraftId)
  if (draftId) {
    if (readString(root.story_bible_draft_id)) migratedLegacyFields.add('story_bible_draft_id')
    if (readString(root.storyBibleDraftId)) migratedLegacyFields.add('storyBibleDraftId')
  }

  return {
    schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION,
    identity: {
      workspaceId,
      projectId,
      projectName: readString(identityRecord?.projectName)
        ?? readString(identityRecord?.project_name)
        ?? readString(root.projectName)
        ?? readString(root.project_name)
        ?? projectId
        ?? fallback.identity.projectName,
      workspaceRoot,
    },
    manuscript: {
      manuscriptId: readString(manuscriptRecord?.manuscriptId)
        ?? readString(manuscriptRecord?.manuscript_id)
        ?? readString(root.manuscript_id)
        ?? readString(root.manuscriptId),
      title: readString(manuscriptRecord?.title)
        ?? readString(root.manuscript_title)
        ?? readString(root.manuscriptTitle),
      chapterId: readString(manuscriptRecord?.chapterId)
        ?? readString(manuscriptRecord?.chapter_id)
        ?? legacyChapterId,
      chapterTitle: readString(manuscriptRecord?.chapterTitle)
        ?? readString(manuscriptRecord?.chapter_title)
        ?? readString(root.chapter_title)
        ?? readString(root.chapterTitle),
      chapterNumber: readNumber(manuscriptRecord?.chapterNumber)
        ?? readNumber(manuscriptRecord?.chapter_number)
        ?? readNumber(root.chapter_number)
        ?? readNumber(root.chapterNumber),
    },
    storyBible: {
      storyBibleId: readString(storyBibleRecord?.storyBibleId)
        ?? readString(storyBibleRecord?.story_bible_id)
        ?? readString(root.story_bible_id)
        ?? readString(root.storyBibleId),
      draftId,
      version: readString(storyBibleRecord?.version)
        ?? readString(root.story_bible_version)
        ?? readString(root.storyBibleVersion),
      storage: readStoryBibleStorage(storyBibleRecord?.storage)
        ?? readStoryBibleStorage(root.story_bible_storage)
        ?? readStoryBibleStorage(root.storyBibleStorage)
        ?? (draftId ? 'local-draft' : fallback.storyBible.storage),
    },
    knowledge: {
      focusEntityId: readString(knowledgeRecord?.focusEntityId)
        ?? readString(knowledgeRecord?.focus_entity_id)
        ?? readString(root.entity_id)
        ?? readString(root.entityId),
      graphEntityIds: [
        ...new Set([
          ...readStringArray(knowledgeRecord?.graphEntityIds),
          ...readStringArray(knowledgeRecord?.graph_entity_ids),
          ...readStringArray(root.graphEntityIds),
          ...readStringArray(root.graph_entity_ids),
        ]),
      ],
      memoryEntryIds: [
        ...new Set([
          ...readStringArray(knowledgeRecord?.memoryEntryIds),
          ...readStringArray(knowledgeRecord?.memory_entry_ids),
          ...readStringArray(root.memoryEntryIds),
          ...readStringArray(root.memory_entry_ids),
        ]),
      ],
    },
    workflow: {
      sessionId: readString(workflowRecord?.sessionId)
        ?? readString(workflowRecord?.session_id)
        ?? legacySessionId,
      planId: readString(workflowRecord?.planId)
        ?? readString(workflowRecord?.plan_id)
        ?? readString(root.plan_id)
        ?? readString(root.planId),
      level: readString(workflowRecord?.level)
        ?? readString(root.workflowLevel)
        ?? readString(root.workflow_level)
        ?? readString(root.level),
    },
    chat: {
      conversationId: readString(chatRecord?.conversationId)
        ?? readString(chatRecord?.conversation_id)
        ?? legacyConversationId,
      comparisonEnabled: readBoolean(chatRecord?.comparisonEnabled)
        ?? readBoolean(chatRecord?.comparison_enabled)
        ?? readBoolean(asRecord(root.comparison)?.enabled),
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [...migratedLegacyFields],
      notes: PROJECT_WORKSPACE_MIGRATION_NOTES,
    },
  }
}

export function mergeProjectWorkspaceContext(
  base: ProjectWorkspaceContext,
  patch: unknown,
): ProjectWorkspaceContext {
  const patchRecord = asRecord(patch) ?? {}
  return normalizeProjectWorkspaceContext(
    {
      workspace: {
        ...base,
        ...patchRecord,
        identity: {
          ...base.identity,
          ...(asRecord(patchRecord.identity) ?? {}),
        },
        manuscript: {
          ...base.manuscript,
          ...(asRecord(patchRecord.manuscript) ?? {}),
        },
        storyBible: {
          ...base.storyBible,
          ...(asRecord(patchRecord.storyBible) ?? {}),
        },
        knowledge: {
          ...base.knowledge,
          ...(asRecord(patchRecord.knowledge) ?? {}),
        },
        workflow: {
          ...base.workflow,
          ...(asRecord(patchRecord.workflow) ?? {}),
        },
        chat: {
          ...base.chat,
          ...(asRecord(patchRecord.chat) ?? {}),
        },
        compatibility: {
          ...base.compatibility,
          ...(asRecord(patchRecord.compatibility) ?? {}),
        },
      },
    },
    {
      workspaceRoot: base.identity.workspaceRoot,
      fallbackProjectId: base.identity.projectId,
    },
  )
}

export function projectWorkspaceToLegacyChatContext(
  workspace: ProjectWorkspaceContext,
): { projectId?: string; chapterId?: string } {
  return {
    projectId: workspace.identity.projectId || undefined,
    chapterId: workspace.manuscript.chapterId || undefined,
  }
}

export function projectWorkspaceToMemoryScope(
  workspace: ProjectWorkspaceContext,
): { project_id?: string; session_id?: string; entity_id?: string } {
  return {
    project_id: workspace.identity.projectId || undefined,
    session_id: workspace.workflow.sessionId || workspace.chat.conversationId || undefined,
    entity_id: workspace.knowledge.focusEntityId || undefined,
  }
}

export function migrateLegacyProjectWorkspaceState(input: unknown): ProjectWorkspaceContext {
  return normalizeProjectWorkspaceContext(input)
}
