import { describe, expect, it } from 'vitest';

import {
  PROJECT_WORKSPACE_MIGRATION_NOTES,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope,
  projectWorkspaceToNarrativeAuthority,
  projectWorkspaceToWorkflowAuthority,
} from './workspace-model.js';

describe('project workspace model', () => {
  it('creates a canonical workspace context from legacy and nested inputs', () => {
    const workspace = normalizeProjectWorkspaceContext({
      project_id: 'atlas-project',
      session_id: 'session-2',
      record_set_id: 'record-set-2',
      active_scene_id: 'scene-2',
      active_event_id: 'event-2',
      active_timeline_id: 'timeline-2',
      consistency_run_id: 'consistency-2',
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
      authority: {
        recordSetId: 'record-set-2',
        activeSceneId: 'scene-2',
        activeEventId: 'event-2',
        activeTimelineId: 'timeline-2',
        consistencyRunId: 'consistency-2',
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
      expect.arrayContaining([
        'project_id',
        'session_id',
        'context.chapterId',
        'record_set_id',
        'active_scene_id',
        'active_event_id',
        'active_timeline_id',
        'consistency_run_id',
      ]),
    );
    expect(workspace.compatibility.notes).toEqual(PROJECT_WORKSPACE_MIGRATION_NOTES);
  });

  it('derives legacy chat, memory, workflow, and narrative authority projections from the authoritative model', () => {
    const workspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/atlas-project',
    });
    workspace.identity.projectId = 'atlas-project';
    workspace.manuscript.chapterId = 'chapter-7';
    workspace.workflow.sessionId = 'workflow-session-7';
    workspace.chat.conversationId = 'conversation-7';
    workspace.knowledge.focusEntityId = 'hero-7';
    workspace.authority.recordSetId = 'record-set-7';
    workspace.authority.activeSceneId = 'scene-7';
    workspace.authority.activeEventId = 'event-7';
    workspace.authority.activeTimelineId = 'timeline-7';
    workspace.authority.consistencyRunId = 'consistency-7';

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
    expect(projectWorkspaceToNarrativeAuthority(workspace)).toEqual({
      sessionId: 'workflow-session-7',
      workspaceId: 'atlas-project',
      projectId: 'atlas-project',
      recordSetId: 'record-set-7',
      sceneId: 'scene-7',
      eventId: 'event-7',
      timelineId: 'timeline-7',
      consistencyRunId: 'consistency-7',
    });
  });
});
