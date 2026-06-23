// 已批准桥接模式：本文件桥接 src-ts/ 类型/值到前端，是已批准的前端-后端边界模式（23+ 消费者通过 @/types/workspace 导入）。
// grep 验收 from.*src-ts 时本文件作为已知例外排除。M27 Phase 2 L-004 决策保留现状；未来重构见 ISS-20260622-012。
import {
  PROJECT_WORKSPACE_SCHEMA_VERSION,
  PROJECT_WORKSPACE_MIGRATION_NOTES,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope as projectWorkspaceToMemoryScopeCanonical,
  projectWorkspaceToNarrativeAuthority as projectWorkspaceToNarrativeAuthorityCanonical,
  projectWorkspaceToWorkflowAuthority,
  type ProjectWorkspaceContext,
  type ProjectWorkspaceNarrativeAuthority,
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
  ProjectWorkspaceAuthority,
  ProjectWorkspaceWorkflow,
  ProjectWorkspaceChat,
  ProjectWorkspaceCompatibility,
  ProjectWorkspaceContext,
  ProjectWorkspaceWorkflowAuthority,
  ProjectWorkspaceNarrativeAuthority,
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
        authority: {
          ...base.authority,
          ...(asRecord(patchRecord.authority) ?? {}),
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

export function projectWorkspaceToNarrativeAuthority(
  workspace: ProjectWorkspaceContext,
): ProjectWorkspaceNarrativeAuthority {
  return projectWorkspaceToNarrativeAuthorityCanonical(workspace)
}

export function migrateLegacyProjectWorkspaceState(input: unknown): ProjectWorkspaceContext {
  return normalizeProjectWorkspaceContext(input)
}
