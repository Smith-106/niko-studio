import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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

const ORIGINAL_TEXT =
  '林岚站在走廊尽头，手里攥着一封匿名信。老陈问她还要不要查下去，她说再看看。';
const REVISED_TEXT =
  '林岚把匿名信攥得发皱。老陈压低声音问她还敢不敢查下去，她没有回答。';

describe('workflow revision branch-gap coverage', () => {
  let workspaceRoot = '';
  let originalCwd = '';

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-revision-branch-gap-'));
    originalCwd = process.cwd();
  });

  afterEach(async () => {
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    process.chdir(originalCwd);
    if (workspaceRoot && existsSync(workspaceRoot)) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('falls back to process cwd when workspace and env are omitted, and treats undefined content as blank', async () => {
    const cwdWorkspaceRoot = await mkdtemp(join(tmpdir(), 'niko-revision-cwd-'));

    try {
      process.chdir(cwdWorkspaceRoot);

      const started = await workflowRevisionStartSession({
        chapterId: 'chapter-cwd',
        content: ORIGINAL_TEXT,
      });
      const sessionId = String(started['session_id']);
      expect(sessionId).toContain('revision-session-');
      expect(existsSync(join(cwdWorkspaceRoot, '.writing', 'revision-sessions', `${sessionId}.json`))).toBe(
        true,
      );

      await expect(
        workflowRevisionStartSession({
          chapterId: 'chapter-cwd-missing',
          content: undefined as unknown as string,
        }),
      ).resolves.toEqual({ error: 'content is required' });
    } finally {
      process.chdir(originalCwd);
      await rm(cwdWorkspaceRoot, { recursive: true, force: true });
    }
  });

  it('supports omitted workspace across suggestion, compare, and revised flows via env root fallback', async () => {
    const envWorkspaceRoot = await mkdtemp(join(tmpdir(), 'niko-revision-env-branch-gap-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = envWorkspaceRoot;
    process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';

    try {
      const started = await workflowRevisionStartSession({
        chapterId: 'chapter-env',
        content: ORIGINAL_TEXT,
      });
      const sessionId = String(started['session_id']);

      const analyzed = await workflowRevisionAnalyzeWeakPoints({ sessionId });
      expect(analyzed['status']).toBe('ANALYZED');

      const suggested = await workflowRevisionGenerateSuggestions({ sessionId });
      expect(suggested['status']).toBe('SUGGESTED');

      const compared = await workflowRevisionCompare({ sessionId });
      expect(compared['status']).toBe('COMPARED');
      expect(compared['comparison']).toBeTruthy();

      const analyzedAgain = await workflowRevisionAnalyzeWeakPoints({ sessionId });
      expect(analyzedAgain['iteration_number']).toBe(2);

      const revised = await workflowRevisionMarkRevised({
        sessionId,
        revisedText: REVISED_TEXT,
      });
      expect(revised['status']).toBe('REVISED');
    } finally {
      await rm(envWorkspaceRoot, { recursive: true, force: true });
    }
  });

  it('ignores non-json files and directories when listing revision history', async () => {
    const workspace = buildWorkspace(workspaceRoot);
    const started = await workflowRevisionStartSession({
      chapterId: 'chapter-history',
      content: ORIGINAL_TEXT,
      workspace,
    });
    expect(started['status']).toBe('IDLE');

    const sessionDir = join(workspaceRoot, '.writing', 'revision-sessions');
    await mkdir(join(sessionDir, 'nested-dir'), { recursive: true });
    await writeFile(join(sessionDir, 'ignore.txt'), '{}', 'utf-8');

    const history = await workflowRevisionHistory({
      chapterId: 'chapter-history',
      workspace,
    });

    expect(history['total']).toBe(1);
    expect((history['sessions'] as Array<Record<string, unknown>>)[0]?.['id']).toBe(
      started['session_id'],
    );
  });
});
