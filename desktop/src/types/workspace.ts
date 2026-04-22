import {
  PROJECT_WORKSPACE_SCHEMA_VERSION,
  PROJECT_WORKSPACE_MIGRATION_NOTES,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope as projectWorkspaceToMemoryScopeCanonical,
  projectWorkspaceToWorkflowAuthority,
  type ProjectWorkspaceContext,
} from '../../../src-ts/project/workspace-model.ts'

export {
  PROJECT_WORKSPACE_SCHEMA_VERSION,
  PROJECT_WORKSPACE_MIGRATION_NOTES,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToWorkflowAuthority,
}

export type {
  ProjectWorkspaceIdentity,
  ProjectWorkspaceManuscript,
  ProjectWorkspaceStoryBible,
  ProjectWorkspaceKnowledge,
  ProjectWorkspaceWorkflow,
  ProjectWorkspaceChat,
  ProjectWorkspaceCompatibility,
  ProjectWorkspaceContext,
  ProjectWorkspaceWorkflowAuthority,
} from '../../../src-ts/project/workspace-model.ts'

interface ProjectWorkspaceToMemoryScopeOptions {
  includeFocusEntity?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
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

export function projectWorkspaceToMemoryScope(
  workspace: ProjectWorkspaceContext,
  options: ProjectWorkspaceToMemoryScopeOptions = {},
): { project_id?: string; session_id?: string; entity_id?: string } {
  const scope = projectWorkspaceToMemoryScopeCanonical(workspace, {
    includeFocusEntity: options.includeFocusEntity,
  })
  return {
    project_id: scope.projectId,
    session_id: scope.sessionId,
    entity_id: scope.entityId,
  }
}

export function migrateLegacyProjectWorkspaceState(input: unknown): ProjectWorkspaceContext {
  return normalizeProjectWorkspaceContext(input)
}
