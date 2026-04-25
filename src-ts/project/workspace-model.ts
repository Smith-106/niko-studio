export const PROJECT_WORKSPACE_SCHEMA_VERSION = '2026-04-08';

export const PROJECT_WORKSPACE_MIGRATION_NOTES = [
  'The canonical workspace payload is additive and preserves legacy request fields.',
  'Legacy project_id/session_id/chapterId fields are normalized into the authoritative workspace model.',
  'Desktop local Story Bible drafts can be represented without forcing an immediate storage rewrite.',
] as const;

export interface ProjectWorkspaceIdentity {
  workspaceId: string;
  projectId: string;
  projectName: string | null;
  workspaceRoot: string | null;
}

export interface ProjectWorkspaceManuscript {
  manuscriptId: string | null;
  title: string | null;
  chapterId: string | null;
  chapterTitle: string | null;
  chapterNumber: number | null;
}

export interface ProjectWorkspaceStoryBible {
  storyBibleId: string | null;
  draftId: string | null;
  version: string | null;
  storage: 'local-draft' | 'workspace' | 'graph' | 'memory';
}

export interface ProjectWorkspaceKnowledge {
  focusEntityId: string | null;
  graphEntityIds: string[];
  memoryEntryIds: string[];
}

export interface ProjectWorkspaceWorkflow {
  sessionId: string | null;
  planId: string | null;
  level: string | null;
  schedulerTaskId?: string | null;
  schedulerRunId?: string | null;
  schedulerTrigger?: 'cron' | 'event' | 'manual_run_now' | null;
}

export interface ProjectWorkspaceChat {
  conversationId: string | null;
  comparisonEnabled: boolean | null;
}

export interface ProjectWorkspaceAuthority {
  recordSetId: string | null;
  activeSceneId: string | null;
  activeEventId: string | null;
  activeTimelineId: string | null;
  consistencyRunId: string | null;
}

export interface ProjectWorkspaceCompatibility {
  additiveContract: true;
  migratedLegacyFields: string[];
  notes: readonly string[];
}

export interface ProjectWorkspaceContext {
  schemaVersion: string;
  identity: ProjectWorkspaceIdentity;
  manuscript: ProjectWorkspaceManuscript;
  storyBible: ProjectWorkspaceStoryBible;
  knowledge: ProjectWorkspaceKnowledge;
  authority: ProjectWorkspaceAuthority;
  workflow: ProjectWorkspaceWorkflow;
  chat: ProjectWorkspaceChat;
  compatibility: ProjectWorkspaceCompatibility;
}

export interface ProjectWorkspaceWorkflowAuthority {
  sessionId?: string;
  workspaceId?: string;
  projectId?: string;
}

export interface ProjectWorkspaceNarrativeAuthority {
  sessionId?: string;
  workspaceId?: string;
  projectId?: string;
  recordSetId?: string;
  sceneId?: string;
  eventId?: string;
  timelineId?: string;
  consistencyRunId?: string;
}

interface NormalizeWorkspaceOptions {
  workspaceRoot?: string | null;
  fallbackProjectId?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry)))];
}

function basenameOrNull(value: string | null | undefined): string | null {
  const raw = readString(value);
  if (!raw) return null;
  const parts = raw.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? readString(parts[parts.length - 1]) : null;
}

function sanitizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'workspace';
}

function readStoryBibleStorage(value: unknown): ProjectWorkspaceStoryBible['storage'] | null {
  if (value === 'local-draft' || value === 'workspace' || value === 'graph' || value === 'memory') {
    return value;
  }
  return null;
}

function readSchedulerTrigger(value: unknown): ProjectWorkspaceWorkflow['schedulerTrigger'] | null {
  if (value === 'cron' || value === 'event' || value === 'manual_run_now') {
    return value;
  }
  return null;
}

function readLegacyProjectId(root: Record<string, unknown>, context: Record<string, unknown> | null): string | null {
  return readString(root.project_id)
    ?? readString(root.projectId)
    ?? readString(context?.projectId);
}

function readLegacyChapterId(root: Record<string, unknown>, context: Record<string, unknown> | null): string | null {
  return readString(root.chapter_id)
    ?? readString(root.chapterId)
    ?? readString(context?.chapterId);
}

function readLegacySessionId(root: Record<string, unknown>): string | null {
  return readString(root.session_id) ?? readString(root.sessionId);
}

function readLegacyConversationId(root: Record<string, unknown>): string | null {
  return readString(root.conversation_id)
    ?? readString(root.conversationId)
    ?? readString(root.currentConversationId);
}

export function createDefaultProjectWorkspaceContext(
  options: NormalizeWorkspaceOptions = {},
): ProjectWorkspaceContext {
  const fallbackId = readString(options.fallbackProjectId)
    ?? basenameOrNull(options.workspaceRoot)
    ?? 'default-project';
  const projectId = sanitizeIdentifier(fallbackId);
  const workspaceId = sanitizeIdentifier(basenameOrNull(options.workspaceRoot) ?? projectId);

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
    authority: {
      recordSetId: null,
      activeSceneId: null,
      activeEventId: null,
      activeTimelineId: null,
      consistencyRunId: null,
    },
    workflow: {
      sessionId: null,
      planId: null,
      level: null,
      schedulerTaskId: null,
      schedulerRunId: null,
      schedulerTrigger: null,
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
  };
}

export function normalizeProjectWorkspaceContext(
  input: unknown,
  options: NormalizeWorkspaceOptions = {},
): ProjectWorkspaceContext {
  const fallback = createDefaultProjectWorkspaceContext(options);
  const root = asRecord(input) ?? {};
  const nestedWorkspace = asRecord(root.workspace);
  const workspaceRecord = nestedWorkspace ?? root;
  const contextRecord = asRecord(root.context);
  const identityRecord = asRecord(workspaceRecord.identity);
  const manuscriptRecord = asRecord(workspaceRecord.manuscript);
  const storyBibleRecord = asRecord(workspaceRecord.storyBible);
  const knowledgeRecord = asRecord(workspaceRecord.knowledge);
  const authorityRecord = asRecord(workspaceRecord.authority);
  const workflowRecord = asRecord(workspaceRecord.workflow);
  const chatRecord = asRecord(workspaceRecord.chat);

  const migratedLegacyFields = new Set<string>();

  const legacyProjectId = readLegacyProjectId(root, contextRecord);
  if (legacyProjectId) {
    if (readString(root.project_id)) migratedLegacyFields.add('project_id');
    if (readString(root.projectId)) migratedLegacyFields.add('projectId');
    if (readString(contextRecord?.projectId)) migratedLegacyFields.add('context.projectId');
  }

  const legacyChapterId = readLegacyChapterId(root, contextRecord);
  if (legacyChapterId) {
    if (readString(root.chapter_id)) migratedLegacyFields.add('chapter_id');
    if (readString(root.chapterId)) migratedLegacyFields.add('chapterId');
    if (readString(contextRecord?.chapterId)) migratedLegacyFields.add('context.chapterId');
  }

  const legacySessionId = readLegacySessionId(root);
  if (legacySessionId) {
    if (readString(root.session_id)) migratedLegacyFields.add('session_id');
    if (readString(root.sessionId)) migratedLegacyFields.add('sessionId');
  }

  const legacyConversationId = readLegacyConversationId(root);
  if (legacyConversationId) {
    if (readString(root.conversation_id)) migratedLegacyFields.add('conversation_id');
    if (readString(root.conversationId)) migratedLegacyFields.add('conversationId');
    if (readString(root.currentConversationId)) migratedLegacyFields.add('currentConversationId');
  }

  const legacyRecordSetId = readString(root.record_set_id) ?? readString(root.recordSetId);
  if (legacyRecordSetId) {
    if (readString(root.record_set_id)) migratedLegacyFields.add('record_set_id');
    if (readString(root.recordSetId)) migratedLegacyFields.add('recordSetId');
  }

  const legacySceneId = readString(root.active_scene_id) ?? readString(root.activeSceneId);
  if (legacySceneId) {
    if (readString(root.active_scene_id)) migratedLegacyFields.add('active_scene_id');
    if (readString(root.activeSceneId)) migratedLegacyFields.add('activeSceneId');
  }

  const legacyEventId = readString(root.active_event_id) ?? readString(root.activeEventId);
  if (legacyEventId) {
    if (readString(root.active_event_id)) migratedLegacyFields.add('active_event_id');
    if (readString(root.activeEventId)) migratedLegacyFields.add('activeEventId');
  }

  const legacyTimelineId = readString(root.active_timeline_id) ?? readString(root.activeTimelineId);
  if (legacyTimelineId) {
    if (readString(root.active_timeline_id)) migratedLegacyFields.add('active_timeline_id');
    if (readString(root.activeTimelineId)) migratedLegacyFields.add('activeTimelineId');
  }

  const legacyConsistencyRunId = readString(root.consistency_run_id) ?? readString(root.consistencyRunId);
  if (legacyConsistencyRunId) {
    if (readString(root.consistency_run_id)) migratedLegacyFields.add('consistency_run_id');
    if (readString(root.consistencyRunId)) migratedLegacyFields.add('consistencyRunId');
  }

  const projectId = readString(identityRecord?.projectId)
    ?? readString(identityRecord?.project_id)
    ?? legacyProjectId
    ?? fallback.identity.projectId;

  const workspaceRoot = readString(identityRecord?.workspaceRoot)
    ?? readString(identityRecord?.workspace_root)
    ?? readString(root.workspaceRoot)
    ?? readString(root.workspace_root)
    ?? fallback.identity.workspaceRoot;

  const workspaceId = sanitizeIdentifier(
    readString(identityRecord?.workspaceId)
      ?? readString(identityRecord?.workspace_id)
      ?? readString(root.workspaceId)
      ?? readString(root.workspace_id)
      ?? basenameOrNull(workspaceRoot)
      ?? projectId
      ?? fallback.identity.workspaceId,
  );

  const projectName = readString(identityRecord?.projectName)
    ?? readString(identityRecord?.project_name)
    ?? readString(root.projectName)
    ?? readString(root.project_name)
    ?? projectId
    ?? fallback.identity.projectName;

  const draftId = readString(storyBibleRecord?.draftId)
    ?? readString(storyBibleRecord?.draft_id)
    ?? readString(root.story_bible_draft_id)
    ?? readString(root.storyBibleDraftId);
  if (draftId) {
    if (readString(root.story_bible_draft_id)) migratedLegacyFields.add('story_bible_draft_id');
    if (readString(root.storyBibleDraftId)) migratedLegacyFields.add('storyBibleDraftId');
  }

  return {
    schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION,
    identity: {
      workspaceId,
      projectId: projectId ?? fallback.identity.projectId,
      projectName,
      workspaceRoot,
    },
    manuscript: {
      manuscriptId: readString(manuscriptRecord?.manuscriptId)
        ?? readString(manuscriptRecord?.manuscript_id)
        ?? readString(root.manuscript_id)
        ?? readString(root.manuscriptId)
        ?? fallback.manuscript.manuscriptId,
      title: readString(manuscriptRecord?.title)
        ?? readString(root.manuscript_title)
        ?? readString(root.manuscriptTitle)
        ?? fallback.manuscript.title,
      chapterId: readString(manuscriptRecord?.chapterId)
        ?? readString(manuscriptRecord?.chapter_id)
        ?? legacyChapterId
        ?? fallback.manuscript.chapterId,
      chapterTitle: readString(manuscriptRecord?.chapterTitle)
        ?? readString(manuscriptRecord?.chapter_title)
        ?? readString(root.chapter_title)
        ?? readString(root.chapterTitle)
        ?? fallback.manuscript.chapterTitle,
      chapterNumber: readNumber(manuscriptRecord?.chapterNumber)
        ?? readNumber(manuscriptRecord?.chapter_number)
        ?? readNumber(root.chapter_number)
        ?? readNumber(root.chapterNumber)
        ?? fallback.manuscript.chapterNumber,
    },
    storyBible: {
      storyBibleId: readString(storyBibleRecord?.storyBibleId)
        ?? readString(storyBibleRecord?.story_bible_id)
        ?? readString(root.story_bible_id)
        ?? readString(root.storyBibleId)
        ?? fallback.storyBible.storyBibleId,
      draftId,
      version: readString(storyBibleRecord?.version)
        ?? readString(root.story_bible_version)
        ?? readString(root.storyBibleVersion)
        ?? fallback.storyBible.version,
      storage: readStoryBibleStorage(storyBibleRecord?.storage)
        ?? readStoryBibleStorage(root.story_bible_storage)
        ?? readStoryBibleStorage(root.storyBibleStorage)
        ?? (draftId ? 'local-draft' : fallback.storyBible.storage),
    },
    knowledge: {
      focusEntityId: readString(knowledgeRecord?.focusEntityId)
        ?? readString(knowledgeRecord?.focus_entity_id)
        ?? readString(root.entity_id)
        ?? readString(root.entityId)
        ?? fallback.knowledge.focusEntityId,
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
    authority: {
      recordSetId: readString(authorityRecord?.recordSetId)
        ?? readString(authorityRecord?.record_set_id)
        ?? legacyRecordSetId
        ?? fallback.authority.recordSetId,
      activeSceneId: readString(authorityRecord?.activeSceneId)
        ?? readString(authorityRecord?.active_scene_id)
        ?? legacySceneId
        ?? fallback.authority.activeSceneId,
      activeEventId: readString(authorityRecord?.activeEventId)
        ?? readString(authorityRecord?.active_event_id)
        ?? legacyEventId
        ?? fallback.authority.activeEventId,
      activeTimelineId: readString(authorityRecord?.activeTimelineId)
        ?? readString(authorityRecord?.active_timeline_id)
        ?? legacyTimelineId
        ?? fallback.authority.activeTimelineId,
      consistencyRunId: readString(authorityRecord?.consistencyRunId)
        ?? readString(authorityRecord?.consistency_run_id)
        ?? legacyConsistencyRunId
        ?? fallback.authority.consistencyRunId,
    },
    workflow: {
      sessionId: readString(workflowRecord?.sessionId)
        ?? readString(workflowRecord?.session_id)
        ?? legacySessionId
        ?? fallback.workflow.sessionId,
      planId: readString(workflowRecord?.planId)
        ?? readString(workflowRecord?.plan_id)
        ?? readString(root.plan_id)
        ?? readString(root.planId)
        ?? fallback.workflow.planId,
      level: readString(workflowRecord?.level)
        ?? readString(root.workflowLevel)
        ?? readString(root.workflow_level)
        ?? readString(root.level)
        ?? fallback.workflow.level,
      schedulerTaskId: readString(workflowRecord?.schedulerTaskId)
        ?? readString(workflowRecord?.scheduler_task_id)
        ?? readString(root.scheduler_task_id)
        ?? readString(root.schedulerTaskId)
        ?? fallback.workflow.schedulerTaskId,
      schedulerRunId: readString(workflowRecord?.schedulerRunId)
        ?? readString(workflowRecord?.scheduler_run_id)
        ?? readString(root.scheduler_run_id)
        ?? readString(root.schedulerRunId)
        ?? fallback.workflow.schedulerRunId,
      schedulerTrigger: readSchedulerTrigger(workflowRecord?.schedulerTrigger)
        ?? readSchedulerTrigger(workflowRecord?.scheduler_trigger)
        ?? readSchedulerTrigger(root.scheduler_trigger)
        ?? readSchedulerTrigger(root.schedulerTrigger)
        ?? fallback.workflow.schedulerTrigger,
    },
    chat: {
      conversationId: readString(chatRecord?.conversationId)
        ?? readString(chatRecord?.conversation_id)
        ?? legacyConversationId
        ?? fallback.chat.conversationId,
      comparisonEnabled: readBoolean(chatRecord?.comparisonEnabled)
        ?? readBoolean(chatRecord?.comparison_enabled)
        ?? readBoolean(asRecord(root.comparison)?.enabled)
        ?? fallback.chat.comparisonEnabled,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [...migratedLegacyFields],
      notes: PROJECT_WORKSPACE_MIGRATION_NOTES,
    },
  };
}

export function projectWorkspaceToLegacyChatContext(
  workspace: ProjectWorkspaceContext,
): { projectId?: string; chapterId?: string } {
  return {
    projectId: workspace.identity.projectId || undefined,
    chapterId: workspace.manuscript.chapterId || undefined,
  };
}

interface ProjectWorkspaceToMemoryScopeOptions {
  includeFocusEntity?: boolean;
}

export function projectWorkspaceToMemoryScope(
  workspace: ProjectWorkspaceContext,
  options: ProjectWorkspaceToMemoryScopeOptions = {},
): { projectId?: string; sessionId?: string; entityId?: string } {
  const includeFocusEntity = options.includeFocusEntity ?? true;
  return {
    projectId: workspace.identity.projectId || undefined,
    sessionId: workspace.workflow.sessionId || workspace.chat.conversationId || undefined,
    entityId: includeFocusEntity ? workspace.knowledge.focusEntityId || undefined : undefined,
  };
}

export function projectWorkspaceToWorkflowAuthority(
  workspace: ProjectWorkspaceContext,
): ProjectWorkspaceWorkflowAuthority {
  return {
    sessionId: workspace.workflow.sessionId || workspace.chat.conversationId || undefined,
    workspaceId: workspace.identity.workspaceId || undefined,
    projectId: workspace.identity.projectId || undefined,
  };
}

export function projectWorkspaceToNarrativeAuthority(
  workspace: ProjectWorkspaceContext,
): ProjectWorkspaceNarrativeAuthority {
  return {
    sessionId: workspace.workflow.sessionId || workspace.chat.conversationId || undefined,
    workspaceId: workspace.identity.workspaceId || undefined,
    projectId: workspace.identity.projectId || undefined,
    recordSetId: workspace.authority.recordSetId || undefined,
    sceneId: workspace.authority.activeSceneId || undefined,
    eventId: workspace.authority.activeEventId || undefined,
    timelineId: workspace.authority.activeTimelineId || undefined,
    consistencyRunId: workspace.authority.consistencyRunId || undefined,
  };
}

export function summarizeProjectWorkspaceContext(
  workspace: ProjectWorkspaceContext,
): Record<string, unknown> {
  return {
    schemaVersion: workspace.schemaVersion,
    workspaceId: workspace.identity.workspaceId,
    projectId: workspace.identity.projectId,
    chapterId: workspace.manuscript.chapterId,
    storyBibleDraftId: workspace.storyBible.draftId,
    focusEntityId: workspace.knowledge.focusEntityId,
    recordSetId: workspace.authority.recordSetId,
    activeSceneId: workspace.authority.activeSceneId,
    activeEventId: workspace.authority.activeEventId,
    activeTimelineId: workspace.authority.activeTimelineId,
    consistencyRunId: workspace.authority.consistencyRunId,
    workflowSessionId: workspace.workflow.sessionId,
    conversationId: workspace.chat.conversationId,
    migratedLegacyFields: workspace.compatibility.migratedLegacyFields,
  };
}
