import { describe, expect, it } from 'vitest';

import {
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope,
  projectWorkspaceToNarrativeAuthority,
  projectWorkspaceToWorkflowAuthority,
  summarizeProjectWorkspaceContext,
} from './workspace-model.js';

describe('project workspace model additional coverage', () => {
  it('sanitizes fallback identifiers for default workspace creation', () => {
    const fromWorkspaceRoot = createDefaultProjectWorkspaceContext({
      workspaceRoot: 'C:\\Writing Space\\My Novel!!',
      fallbackProjectId: '   ',
    });
    const fromInvalidFallback = createDefaultProjectWorkspaceContext({
      fallbackProjectId: '###',
    });

    expect(fromWorkspaceRoot.identity).toMatchObject({
      workspaceId: 'my-novel',
      projectId: 'my-novel',
      projectName: 'my-novel',
      workspaceRoot: 'C:\\Writing Space\\My Novel!!',
    });
    expect(fromInvalidFallback.identity).toMatchObject({
      workspaceId: 'workspace',
      projectId: 'workspace',
      projectName: 'workspace',
    });
  });

  it('falls back cleanly for non-record input and normalizes mixed legacy fields', () => {
    const fallback = normalizeProjectWorkspaceContext([], {
      fallbackProjectId: 'Atlas Project',
      workspaceRoot: '/tmp/Atlas Project',
    });

    expect(fallback.identity).toMatchObject({
      workspaceId: 'atlas-project',
      projectId: 'atlas-project',
      projectName: 'atlas-project',
      workspaceRoot: '/tmp/Atlas Project',
    });

    const normalized = normalizeProjectWorkspaceContext({
      projectId: 'legacy-project',
      currentConversationId: 'conversation-legacy',
      storyBibleDraftId: 'draft-local',
      workspaceRoot: 'D:\\Writer\\Atlas Space',
      manuscriptTitle: 'Atlas',
      chapterTitle: 'Arrival',
      chapterNumber: '7',
      workflowLevel: 'L4',
      schedulerTaskId: 'task-1',
      schedulerRunId: 'run-1',
      schedulerTrigger: 'manual_run_now',
      comparison: { enabled: false },
      entityId: 'focus-1',
      graphEntityIds: ['hero-1', '', 'hero-1', 'villain-1'],
      memory_entry_ids: ['memory-1', ' ', 'memory-2'],
      workspace: {
        identity: {
          workspace_id: 'Custom Space',
          project_id: 'workspace-project',
          projectName: 'Atlas Prime',
        },
        storyBible: {
          storage: 'invalid-storage',
        },
      },
    });

    expect(normalized.identity).toMatchObject({
      workspaceId: 'custom-space',
      projectId: 'workspace-project',
      projectName: 'Atlas Prime',
      workspaceRoot: 'D:\\Writer\\Atlas Space',
    });
    expect(normalized.manuscript).toMatchObject({
      title: 'Atlas',
      chapterTitle: 'Arrival',
      chapterNumber: 7,
    });
    expect(normalized.storyBible).toMatchObject({
      draftId: 'draft-local',
      storage: 'local-draft',
    });
    expect(normalized.knowledge).toEqual({
      focusEntityId: 'focus-1',
      graphEntityIds: ['hero-1', 'villain-1'],
      memoryEntryIds: ['memory-1', 'memory-2'],
    });
    expect(normalized.workflow).toMatchObject({
      sessionId: null,
      level: 'L4',
      schedulerTaskId: 'task-1',
      schedulerRunId: 'run-1',
      schedulerTrigger: 'manual_run_now',
    });
    expect(normalized.chat).toEqual({
      conversationId: 'conversation-legacy',
      comparisonEnabled: false,
    });
    expect(normalized.compatibility.migratedLegacyFields).toEqual(
      expect.arrayContaining([
        'projectId',
        'currentConversationId',
        'storyBibleDraftId',
      ]),
    );
  });

  it('projects fallback session authority and summarizes the canonical workspace', () => {
    const workspace = createDefaultProjectWorkspaceContext({
      fallbackProjectId: '###',
    });

    workspace.identity.projectId = '';
    workspace.identity.workspaceId = '';
    workspace.chat.conversationId = 'conversation-9';
    workspace.workflow.sessionId = '';
    workspace.knowledge.focusEntityId = 'hero-9';
    workspace.authority.recordSetId = 'record-9';
    workspace.authority.activeSceneId = 'scene-9';
    workspace.authority.activeEventId = 'event-9';
    workspace.authority.activeTimelineId = 'timeline-9';
    workspace.authority.consistencyRunId = 'consistency-9';
    workspace.compatibility.migratedLegacyFields = ['conversationId'];

    expect(projectWorkspaceToLegacyChatContext(workspace)).toEqual({
      projectId: undefined,
      chapterId: undefined,
    });
    expect(projectWorkspaceToMemoryScope(workspace, { includeFocusEntity: false })).toEqual({
      projectId: undefined,
      sessionId: 'conversation-9',
      entityId: undefined,
    });
    expect(projectWorkspaceToWorkflowAuthority(workspace)).toEqual({
      sessionId: 'conversation-9',
      workspaceId: undefined,
      projectId: undefined,
    });
    expect(projectWorkspaceToNarrativeAuthority(workspace)).toEqual({
      sessionId: 'conversation-9',
      workspaceId: undefined,
      projectId: undefined,
      recordSetId: 'record-9',
      sceneId: 'scene-9',
      eventId: 'event-9',
      timelineId: 'timeline-9',
      consistencyRunId: 'consistency-9',
    });
    expect(summarizeProjectWorkspaceContext(workspace)).toEqual({
      schemaVersion: workspace.schemaVersion,
      workspaceId: '',
      projectId: '',
      chapterId: null,
      storyBibleDraftId: null,
      focusEntityId: 'hero-9',
      recordSetId: 'record-9',
      activeSceneId: 'scene-9',
      activeEventId: 'event-9',
      activeTimelineId: 'timeline-9',
      consistencyRunId: 'consistency-9',
      workflowSessionId: '',
      conversationId: 'conversation-9',
      migratedLegacyFields: ['conversationId'],
    });
  });

  it('normalizes slash-only workspace roots and camelCase legacy authority fields', () => {
    const slashOnlyRoot = createDefaultProjectWorkspaceContext({
      workspaceRoot: '///',
      fallbackProjectId: 'Atlas Draft',
    });

    expect(slashOnlyRoot.identity).toMatchObject({
      workspaceId: 'atlas-draft',
      projectId: 'atlas-draft',
      projectName: 'atlas-draft',
    });

    const normalized = normalizeProjectWorkspaceContext({
      chapterId: 'chapter-camel',
      sessionId: 'session-camel',
      conversationId: 'conversation-camel',
      recordSetId: 'record-camel',
      activeSceneId: 'scene-camel',
      activeEventId: 'event-camel',
      activeTimelineId: 'timeline-camel',
      consistencyRunId: 'consistency-camel',
      story_bible_draft_id: 'draft-snake',
    });

    expect(normalized.manuscript.chapterId).toBe('chapter-camel');
    expect(normalized.workflow.sessionId).toBe('session-camel');
    expect(normalized.chat.conversationId).toBe('conversation-camel');
    expect(normalized.authority).toMatchObject({
      recordSetId: 'record-camel',
      activeSceneId: 'scene-camel',
      activeEventId: 'event-camel',
      activeTimelineId: 'timeline-camel',
      consistencyRunId: 'consistency-camel',
    });
    expect(normalized.storyBible).toMatchObject({
      draftId: 'draft-snake',
      storage: 'local-draft',
    });
    expect(normalized.compatibility.migratedLegacyFields).toEqual(
      expect.arrayContaining([
        'chapterId',
        'sessionId',
        'conversationId',
        'recordSetId',
        'activeSceneId',
        'activeEventId',
        'activeTimelineId',
        'consistencyRunId',
        'story_bible_draft_id',
      ]),
    );
  });

  it('returns an empty memory scope session when neither workflow nor chat session is available', () => {
    const workspace = createDefaultProjectWorkspaceContext({
      fallbackProjectId: 'Memory Scope',
    });

    workspace.identity.projectId = '';
    workspace.workflow.sessionId = null;
    workspace.chat.conversationId = null;
    workspace.knowledge.focusEntityId = null;

    expect(projectWorkspaceToMemoryScope(workspace)).toEqual({
      projectId: undefined,
      sessionId: undefined,
      entityId: undefined,
    });
  });
});
