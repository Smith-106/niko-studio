import { describe, expect, it } from 'vitest'

import {
  PROJECT_WORKSPACE_SCHEMA_VERSION,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToMemoryScope,
  projectWorkspaceToWorkflowAuthority,
} from './workspace'

describe('workspace projections', () => {
  it('derives shared memory and workflow authority projections from the canonical workspace', () => {
    const workspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/atlas-project',
    })
    workspace.identity.projectId = 'atlas-project'
    workspace.identity.workspaceId = 'atlas-workspace'
    workspace.workflow.sessionId = null
    workspace.chat.conversationId = 'conversation-13'
    workspace.knowledge.focusEntityId = 'hero-13'

    expect(projectWorkspaceToMemoryScope(workspace)).toEqual({
      project_id: 'atlas-project',
      session_id: 'conversation-13',
      entity_id: 'hero-13',
    })
    expect(projectWorkspaceToWorkflowAuthority(workspace)).toEqual({
      sessionId: 'conversation-13',
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
    })
  })

  it('normalizes legacy payload fields through the canonical workspace contract', () => {
    const workspace = normalizeProjectWorkspaceContext({
      project_id: 'atlas-project',
      session_id: 'workflow-session-legacy',
      chapter_id: 'chapter-legacy',
      story_bible_draft_id: 'draft-legacy',
      workspace: {
        identity: {
          workspace_root: '/tmp/atlas-project',
        },
      },
      context: {
        chapterId: 'chapter-context',
      },
    })

    expect(workspace.schemaVersion).toBe(PROJECT_WORKSPACE_SCHEMA_VERSION)
    expect(workspace.identity.projectId).toBe('atlas-project')
    expect(workspace.workflow.sessionId).toBe('workflow-session-legacy')
    expect(workspace.manuscript.chapterId).toBe('chapter-legacy')
    expect(workspace.storyBible.draftId).toBe('draft-legacy')
    expect(workspace.storyBible.storage).toBe('local-draft')
    expect(workspace.compatibility.migratedLegacyFields).toEqual(
      expect.arrayContaining(['project_id', 'session_id', 'chapter_id', 'story_bible_draft_id']),
    )
  })
})
