import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  workflowRevisionAnalyzeWeakPoints,
  workflowRevisionCompare,
  workflowRevisionGenerateSuggestions,
  workflowRevisionHistory,
  workflowRevisionMarkRevised,
  workflowRevisionStartSession,
} from '../../mcp/services/workflow-revision.js';

function buildWorkspace(workspaceRoot: string, sessionId = 'workflow-session-a') {
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      projectName: 'Atlas Project',
      workspaceRoot,
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: 'chapter-1',
      chapterTitle: null,
      chapterNumber: 1,
    },
    storyBible: {
      storyBibleId: null,
      draftId: 'draft-1',
      version: null,
      storage: 'local-draft',
    },
    knowledge: {
      focusEntityId: 'hero-1',
      graphEntityIds: ['hero-1'],
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
      sessionId,
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId: sessionId,
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  };
}

const ORIGINAL_TEXT = `林岚站在走廊尽头，手里攥着一封匿名信。她看了一眼门外的雨，决定先把案卷放回去。老陈问她要不要继续查，她说再看看。`;
const REVISED_TEXT = `林岚站在忽明忽暗的走廊尽头，匿名信被她攥得发皱。门外的雨声像倒计时一样逼近，老陈压低声音问她还敢不敢查下去。她没有回答，只把案卷塞回抽屉，因为信上那行“今晚你会知道真相”的字迹正刺得她指节发白。`;

describe('workflow revision session service', () => {
  let workspaceRoot = '';

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-revision-session-'));
  });

  afterEach(async () => {
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('creates, analyzes, suggests, marks revised, compares, and lists revision sessions', async () => {
    const workspace = buildWorkspace(workspaceRoot);
    const started = await workflowRevisionStartSession({
      chapterId: 'chapter-1',
      content: ORIGINAL_TEXT,
      workspace,
    });

    expect(started['error']).toBeUndefined();
    expect(started['status']).toBe('IDLE');
    const sessionId = String(started['session_id']);
    expect(sessionId).toContain('revision-session-');

    const analyzed = await workflowRevisionAnalyzeWeakPoints({
      sessionId,
      workspace,
    });
    expect(analyzed['status']).toBe('ANALYZED');
    const weakPoints = analyzed['weak_points'] as Array<Record<string, unknown>>;
    expect(Array.isArray(weakPoints)).toBe(true);
    expect(weakPoints.length).toBeGreaterThan(0);
    expect(weakPoints[0]?.['catalogReference']).toBeTruthy();

    const suggested = await workflowRevisionGenerateSuggestions({
      sessionId,
      workspace,
    });
    expect(suggested['status']).toBe('SUGGESTED');
    const suggestions = suggested['suggestions'] as Array<Record<string, unknown>>;
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.['catalogReference']).toContain('catalog:');

    const marked = await workflowRevisionMarkRevised({
      sessionId,
      revisedText: REVISED_TEXT,
      workspace,
    });
    expect(marked['status']).toBe('REVISED');

    const compared = await workflowRevisionCompare({
      sessionId,
      workspace,
    });
    expect(compared['status']).toBe('COMPARED');
    const comparison = compared['comparison'] as Record<string, unknown>;
    expect(comparison['summary']).toBeTruthy();
    expect(comparison['resultScores']).toBeTruthy();
    expect(Array.isArray(comparison['improvedDimensions'])).toBe(true);

    const history = await workflowRevisionHistory({
      chapterId: 'chapter-1',
      workspace,
    });
    expect(history['total']).toBe(1);
    expect((history['sessions'] as Array<Record<string, unknown>>)[0]?.['id']).toBe(sessionId);
  });

  it('rejects access from a different workflow authority', async () => {
    const workspaceA = buildWorkspace(workspaceRoot, 'workflow-session-a');
    const workspaceB = buildWorkspace(workspaceRoot, 'workflow-session-b');

    const started = await workflowRevisionStartSession({
      chapterId: 'chapter-1',
      content: ORIGINAL_TEXT,
      workspace: workspaceA,
    });

    const sessionId = String(started['session_id']);
    const analyzed = await workflowRevisionAnalyzeWeakPoints({
      sessionId,
      workspace: workspaceB,
    });

    expect(String(analyzed['error'] ?? '')).toContain("workflow session 'workflow-session-a'");
  });
});
