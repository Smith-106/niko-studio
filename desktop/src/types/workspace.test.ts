import { describe, expect, it } from 'vitest'

import {
  PROJECT_WORKSPACE_SCHEMA_VERSION,
  createDefaultProjectWorkspaceContext,
  mergeProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToMemoryScope,
  projectWorkspaceToNarrativeAuthority,
  projectWorkspaceToWorkflowAuthority,
} from './workspace'

describe('workspace projections', () => {
  it('derives shared memory, workflow, and narrative authority projections from the canonical workspace', () => {
    const workspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/atlas-project',
    })
    workspace.identity.projectId = 'atlas-project'
    workspace.identity.workspaceId = 'atlas-workspace'
    workspace.workflow.sessionId = null
    workspace.chat.conversationId = 'conversation-13'
    workspace.knowledge.focusEntityId = 'hero-13'
    workspace.authority.recordSetId = 'record-set-13'
    workspace.authority.activeSceneId = 'scene-13'
    workspace.authority.activeEventId = 'event-13'
    workspace.authority.activeTimelineId = 'timeline-13'
    workspace.authority.consistencyRunId = 'consistency-13'

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
    expect(projectWorkspaceToNarrativeAuthority(workspace)).toEqual({
      sessionId: 'conversation-13',
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      recordSetId: 'record-set-13',
      sceneId: 'scene-13',
      eventId: 'event-13',
      timelineId: 'timeline-13',
      consistencyRunId: 'consistency-13',
    })
  })

  it('normalizes legacy payload fields through the canonical workspace contract', () => {
    const workspace = normalizeProjectWorkspaceContext({
      project_id: 'atlas-project',
      session_id: 'workflow-session-legacy',
      chapter_id: 'chapter-legacy',
      story_bible_draft_id: 'draft-legacy',
      record_set_id: 'record-set-legacy',
      active_scene_id: 'scene-legacy',
      active_event_id: 'event-legacy',
      active_timeline_id: 'timeline-legacy',
      consistency_run_id: 'consistency-legacy',
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
    expect(workspace.authority).toEqual({
      recordSetId: 'record-set-legacy',
      activeSceneId: 'scene-legacy',
      activeEventId: 'event-legacy',
      activeTimelineId: 'timeline-legacy',
      consistencyRunId: 'consistency-legacy',
    })
    expect(workspace.compatibility.migratedLegacyFields).toEqual(
      expect.arrayContaining([
        'project_id',
        'session_id',
        'chapter_id',
        'story_bible_draft_id',
        'record_set_id',
        'active_scene_id',
        'active_event_id',
        'active_timeline_id',
        'consistency_run_id',
      ]),
    )
  })

  it('merges authority patches without dropping existing authority state', () => {
    const workspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/atlas-project',
    })
    workspace.identity.projectId = 'atlas-project'
    workspace.identity.workspaceId = 'atlas-workspace'
    workspace.authority.recordSetId = 'record-set-1'
    workspace.authority.activeSceneId = 'scene-1'

    const merged = mergeProjectWorkspaceContext(workspace, {
      authority: {
        activeEventId: 'event-2',
        activeTimelineId: 'timeline-2',
      },
    })

    expect(merged.authority).toEqual({
      recordSetId: 'record-set-1',
      activeSceneId: 'scene-1',
      activeEventId: 'event-2',
      activeTimelineId: 'timeline-2',
      consistencyRunId: null,
    })
  })
})
