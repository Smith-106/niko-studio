import { describe, expect, it } from 'vitest';

import {
  PROJECT_WORKSPACE_MIGRATION_NOTES,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope,
  projectWorkspaceToWorkflowAuthority,
} from './workspace-model.js';

describe('project workspace model', () => {
  it('creates a canonical workspace context from legacy and nested inputs', () => {
    const workspace = normalizeProjectWorkspaceContext({
      project_id: 'atlas-project',
      session_id: 'session-2',
      context: {
        chapterId: 'chapter-2',
      },
      workspace: {
        storyBible: {
          draftId: 'draft-2',
          storage: 'local-draft',
        },
        knowledge: {
          focusEntityId: 'hero-2',
          graphEntityIds: ['hero-2', 'hero-2'],
          memoryEntryIds: ['memory-1'],
        },
        chat: {
          conversationId: 'conversation-2',
          comparisonEnabled: true,
        },
      },
    }, {
      workspaceRoot: '/tmp/atlas-project',
    });

    expect(workspace).toMatchObject({
      identity: {
        workspaceId: 'atlas-project',
        projectId: 'atlas-project',
      },
      manuscript: {
        chapterId: 'chapter-2',
      },
      storyBible: {
        draftId: 'draft-2',
        storage: 'local-draft',
      },
      knowledge: {
        focusEntityId: 'hero-2',
        graphEntityIds: ['hero-2'],
        memoryEntryIds: ['memory-1'],
      },
      workflow: {
        sessionId: 'session-2',
      },
      chat: {
        conversationId: 'conversation-2',
        comparisonEnabled: true,
      },
    });
    expect(workspace.compatibility.migratedLegacyFields).toEqual(
      expect.arrayContaining(['project_id', 'session_id', 'context.chapterId']),
    );
    expect(workspace.compatibility.notes).toEqual(PROJECT_WORKSPACE_MIGRATION_NOTES);
  });

  it('derives legacy chat and memory compatibility fields from the authoritative model', () => {
    const workspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/atlas-project',
    });
    workspace.identity.projectId = 'atlas-project';
    workspace.manuscript.chapterId = 'chapter-7';
    workspace.workflow.sessionId = 'workflow-session-7';
    workspace.chat.conversationId = 'conversation-7';
    workspace.knowledge.focusEntityId = 'hero-7';

    expect(projectWorkspaceToLegacyChatContext(workspace)).toEqual({
      projectId: 'atlas-project',
      chapterId: 'chapter-7',
    });
    expect(projectWorkspaceToMemoryScope(workspace)).toEqual({
      projectId: 'atlas-project',
      sessionId: 'workflow-session-7',
      entityId: 'hero-7',
    });
    expect(projectWorkspaceToWorkflowAuthority(workspace)).toEqual({
      sessionId: 'workflow-session-7',
      workspaceId: 'atlas-project',
      projectId: 'atlas-project',
    });
  });
});
