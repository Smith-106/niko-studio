import { describe, expect, it } from 'vitest';

import {
  PROJECT_NARRATIVE_AUTHORITY_CONTRACT,
  PROJECT_NARRATIVE_SCHEMA_VERSION,
  createProjectNarrativeEventRecord,
  createProjectNarrativeProjectionBoundary,
  createProjectNarrativeRecordAuthority,
  createProjectNarrativeRecordId,
  createProjectNarrativeSceneRecord,
  createProjectNarrativeTimelineRecord,
  normalizeProjectNarrativeRecordSetId,
} from './narrative-records.js';

describe('project narrative record helpers', () => {
  it('creates canonical scene and event records aligned to workspace/wiki authority vocabulary', () => {
    const scene = createProjectNarrativeSceneRecord({
      workspaceId: 'Atlas Project',
      recordSetId: 'Atlas Draft Records',
      sourcePageId: 'wpg_scene-7',
      promotedFrom: 'story-bible',
      title: 'Arrival at the observatory',
      chapterId: 'chapter-7',
      sceneOrder: 3,
      eventIds: ['event-7'],
      relatedEntityIds: ['hero-7', 'observatory'],
      projections: {
        graphEntityIds: ['scene-7', 'event-7'],
        memoryEntryIds: ['memory-7'],
        wikiPageIds: ['wpg_scene-7'],
      },
      storyTime: {
        order: 7,
        label: 'Day 7 / evening',
      },
      narrativeTime: {
        chapterId: 'chapter-7',
        sceneOrder: 3,
        label: 'Chapter 7, scene 3',
      },
    });

    const event = createProjectNarrativeEventRecord({
      workspaceId: 'Atlas Project',
      recordSetId: 'Atlas Draft Records',
      sourcePageId: 'wpg_event-7',
      promotedFrom: 'manual',
      title: 'Hero sees the signal',
      sceneId: scene.id,
      participantIds: ['hero-7'],
      causeEventIds: ['event-6'],
      consequenceEventIds: ['event-8'],
      projections: {
        graphEntityIds: ['event-7'],
        memoryEntryIds: ['memory-8'],
      },
      storyTime: {
        order: 8,
        anchorEventId: 'event-6',
      },
      narrativeTime: {
        chapterId: 'chapter-7',
        sceneOrder: 3,
      },
    });

    expect(scene.schemaVersion).toBe(PROJECT_NARRATIVE_SCHEMA_VERSION);
    expect(scene.authority).toMatchObject({
      workspaceId: 'atlas-project',
      recordSetId: 'atlas-draft-records',
      sourcePageId: 'wpg_scene-7',
      scopeAuthority: 'workspace',
      canonAuthority: 'canon-page',
      projectionAuthority: 'derived',
      promotionMode: 'manual',
      promotedFrom: 'story-bible',
      status: 'curated',
    });
    expect(event.authority.recordSetId).toBe('atlas-draft-records');
    expect(event.sceneId).toBe(scene.id);
    expect(event.storyTime.order).toBe(8);
    expect(event.narrativeTime.sceneOrder).toBe(3);
  });

  it('creates timeline records and projection boundaries from canonical narrative records', () => {
    const timeline = createProjectNarrativeTimelineRecord({
      workspaceId: 'Atlas Project',
      title: 'Atlas story timeline',
      mode: 'story',
      sourcePageId: 'wpg_timeline-7',
      entries: [
        {
          order: 1,
          recordId: 'scene-7',
          recordKind: 'scene',
          label: 'Scene 7',
        },
        {
          order: 2,
          recordId: 'event-8',
          recordKind: 'event',
          label: 'Event 8',
        },
      ],
      projections: {
        graphEntityIds: ['scene-7', 'event-8'],
        memoryEntryIds: ['memory-7'],
        wikiPageIds: ['wpg_timeline-7', 'wpg_scene-7'],
      },
    });

    const boundary = createProjectNarrativeProjectionBoundary(timeline);

    expect(timeline.mode).toBe('story');
    expect(timeline.entries).toHaveLength(2);
    expect(boundary).toEqual({
      authority: timeline.authority,
      canonPageId: 'wpg_timeline-7',
      graphEntityIds: ['scene-7', 'event-8'],
      memoryEntryIds: ['memory-7'],
      wikiPageIds: ['wpg_timeline-7', 'wpg_scene-7'],
    });
  });

  it('normalizes narrative authority helpers deterministically', () => {
    expect(PROJECT_NARRATIVE_AUTHORITY_CONTRACT).toEqual({
      scopeAuthority: 'workspace',
      canonAuthority: 'canon-page',
      projectionAuthority: 'derived',
      promotionMode: 'manual',
      automaticCanonSync: false,
      automaticProjectionSync: false,
    });
    expect(normalizeProjectNarrativeRecordSetId(' Atlas Draft Records ', 'Atlas Project')).toBe('atlas-draft-records');
    expect(
      createProjectNarrativeRecordAuthority({
        workspaceId: 'Atlas Project',
        promotedFrom: 'research',
        status: 'draft',
      }),
    ).toEqual({
      workspaceId: 'atlas-project',
      recordSetId: 'atlas-project',
      sourcePageId: null,
      scopeAuthority: 'workspace',
      canonAuthority: 'canon-page',
      projectionAuthority: 'derived',
      promotionMode: 'manual',
      status: 'draft',
      promotedFrom: 'research',
    });
  });

  it('applies fallback defaults when narrative scene inputs are blank or invalid', () => {
    const scene = createProjectNarrativeSceneRecord({
      workspaceId: 'Atlas Project',
      recordSetId: '---',
      sourcePageId: '   ',
      promotedFrom: 'invalid' as never,
      status: 'invalid' as never,
      id: '   ',
      idSeed: '   ',
      title: '   ',
      summary: '   ',
      tags: [' hero ', 'hero', ' ', 42 as never],
      relatedEntityIds: [' ally ', 'ally', '', null as never],
      projections: {
        graphEntityIds: [' scene-1 ', 'scene-1', ' '],
        memoryEntryIds: 'invalid' as never,
        wikiPageIds: undefined,
      },
      sceneOrder: Number.POSITIVE_INFINITY,
      locationId: '   ',
      eventIds: [' event-1 ', 'event-1', ' '],
      storyTime: {
        order: '3' as never,
        label: '   ',
        anchorEventId: '   ',
      },
      narrativeTime: {
        chapterId: '   ',
        sceneOrder: '   ' as never,
        label: '   ',
      },
    });

    expect(scene.id).toBe(createProjectNarrativeRecordId('scene', 'scene:scene-record'));
    expect(scene.title).toBe('scene-record');
    expect(scene.summary).toBe('');
    expect(scene.authority).toMatchObject({
      workspaceId: 'atlas-project',
      recordSetId: 'workspace-records',
      sourcePageId: null,
      status: 'curated',
      promotedFrom: 'manual',
    });
    expect(scene.tags).toEqual(['hero']);
    expect(scene.relatedEntityIds).toEqual(['ally']);
    expect(scene.projections).toEqual({
      graphEntityIds: ['scene-1'],
      memoryEntryIds: [],
      wikiPageIds: [],
    });
    expect(scene.sceneOrder).toBeNull();
    expect(scene.locationId).toBeNull();
    expect(scene.eventIds).toEqual(['event-1']);
    expect(scene.storyTime).toEqual({
      order: 3,
      label: null,
      anchorEventId: null,
    });
    expect(scene.narrativeTime).toEqual({
      chapterId: null,
      sceneOrder: null,
      label: null,
    });
    expect(Date.parse(scene.createdAt)).not.toBeNaN();
    expect(Date.parse(scene.updatedAt)).not.toBeNaN();
  });

  it('falls back for normalized ids when record set or seed input collapses to empty', () => {
    expect(normalizeProjectNarrativeRecordSetId(undefined, '   ')).toBe('workspace-records');
    expect(normalizeProjectNarrativeRecordSetId('---', 'Atlas Project')).toBe('workspace-records');
    expect(createProjectNarrativeRecordId('event', '   ')).toBe(createProjectNarrativeRecordId('event', 'event'));
  });

  it('sanitizes timeline entries and projection boundaries for invalid optional inputs', () => {
    const timeline = createProjectNarrativeTimelineRecord({
      workspaceId: 'Atlas Project',
      title: 'Atlas projection timeline',
      mode: 'outline' as never,
      sourcePageId: '   ',
      anchorSceneId: '   ',
      anchorEventId: '   ',
      entries: [
        {
          order: 'oops' as never,
          recordId: '   ',
          recordKind: 'chapter' as never,
          label: 'Dropped entry',
        },
        {
          order: '2' as never,
          recordId: ' event-1 ',
          recordKind: 'chapter' as never,
          label: '   ',
        },
      ] as never,
      projections: {
        wikiPageIds: ['wiki-1', 'wiki-1', ' '],
      },
    });

    const narrativeTimeline = createProjectNarrativeTimelineRecord({
      workspaceId: 'Atlas Project',
      title: 'Narrative order view',
      mode: 'narrative',
      entries: null,
    });

    const boundary = createProjectNarrativeProjectionBoundary(timeline);

    expect(timeline.mode).toBe('story');
    expect(timeline.anchorSceneId).toBeNull();
    expect(timeline.anchorEventId).toBeNull();
    expect(timeline.entries).toEqual([
      {
        order: 2,
        recordId: 'event-1',
        recordKind: 'event',
        label: null,
      },
    ]);
    expect(narrativeTimeline.mode).toBe('narrative');
    expect(narrativeTimeline.entries).toEqual([]);
    expect(boundary).toEqual({
      authority: timeline.authority,
      canonPageId: null,
      graphEntityIds: [],
      memoryEntryIds: [],
      wikiPageIds: ['wiki-1'],
    });
  });
});
