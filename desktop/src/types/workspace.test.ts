import { describe, expect, it } from 'vitest'

import {
  createDefaultProjectWorkspaceContext,
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
})
