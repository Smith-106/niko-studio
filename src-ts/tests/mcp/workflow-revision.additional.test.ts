import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

function buildWorkspace(
  workspaceRoot: string,
  overrides: {
    sessionId?: string | null;
    workspaceId?: string | null;
    projectId?: string | null;
  } = {},
) {
  const sessionId = overrides.sessionId ?? 'workflow-session-a';
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: overrides.workspaceId ?? 'atlas-workspace',
      projectId: overrides.projectId ?? 'atlas-project',
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
  '林岚把匿名信攥得发皱。走廊尽头的灯忽明忽暗，老陈压低声音问她还敢不敢查下去，她没有回答。';

async function readSessionFile(workspaceRoot: string, sessionId: string) {
  const filePath = join(workspaceRoot, '.writing', 'revision-sessions', `${sessionId}.json`);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

describe('workflow revision additional coverage', () => {
  let workspaceRoot = '';

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-revision-extra-'));
  });

  afterEach(async () => {
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    if (workspaceRoot && existsSync(workspaceRoot)) {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('validates required parameters and reports missing sessions', async () => {
    const workspace = buildWorkspace(workspaceRoot);

    await expect(
      workflowRevisionStartSession({ chapterId: '   ', content: ORIGINAL_TEXT, workspace }),
    ).resolves.toEqual({ error: 'chapter_id is required' });
    await expect(
      workflowRevisionStartSession({ chapterId: 'chapter-1', content: '   ', workspace }),
    ).resolves.toEqual({ error: 'content is required' });

    await expect(
      workflowRevisionAnalyzeWeakPoints({ sessionId: '   ', workspace }),
    ).resolves.toEqual({ error: 'session_id is required' });
    await expect(
      workflowRevisionAnalyzeWeakPoints({ sessionId: 'missing-session', workspace }),
    ).resolves.toEqual({ error: "Revision session 'missing-session' not found" });

    await expect(
      workflowRevisionGenerateSuggestions({ sessionId: '   ', workspace }),
    ).resolves.toEqual({ error: 'session_id is required' });
    await expect(
      workflowRevisionGenerateSuggestions({ sessionId: 'missing-session', workspace }),
    ).resolves.toEqual({ error: "Revision session 'missing-session' not found" });

    await expect(
      workflowRevisionMarkRevised({ sessionId: '   ', revisedText: REVISED_TEXT, workspace }),
    ).resolves.toEqual({ error: 'session_id is required' });
    await expect(
      workflowRevisionMarkRevised({ sessionId: 'missing-session', revisedText: REVISED_TEXT, workspace }),
    ).resolves.toEqual({ error: "Revision session 'missing-session' not found" });
    await expect(
      workflowRevisionMarkRevised({ sessionId: 'session-a', revisedText: '   ', workspace }),
    ).resolves.toEqual({ error: 'revised_text is required' });

    await expect(
      workflowRevisionCompare({ sessionId: '   ', workspace }),
    ).resolves.toEqual({ error: 'session_id is required' });
    await expect(
      workflowRevisionCompare({ sessionId: 'missing-session', workspace }),
    ).resolves.toEqual({ error: "Revision session 'missing-session' not found" });

    await expect(
      workflowRevisionHistory({ chapterId: '   ', workspace }),
    ).resolves.toEqual({ error: 'chapter_id is required' });
  });

  it('reuses the active iteration, starts a new iteration after compare, and filters selected weak points', async () => {
    const workspace = buildWorkspace(workspaceRoot);

    const started = await workflowRevisionStartSession({
      chapterId: 'chapter-1',
      content: ORIGINAL_TEXT,
      workspace,
    });
    const sessionId = String(started['session_id']);

    const firstAnalyze = await workflowRevisionAnalyzeWeakPoints({
      sessionId,
      content: REVISED_TEXT,
      workspace,
    });
    expect(firstAnalyze['iteration_number']).toBe(1);

    const firstSuggestions = await workflowRevisionGenerateSuggestions({
      sessionId,
      weakPointIds: ['not-a-real-weak-point', '', '   '],
      workspace,
    });
    expect(firstSuggestions['status']).toBe('SUGGESTED');
    expect(firstSuggestions['suggestions']).toEqual([]);

    const secondAnalyze = await workflowRevisionAnalyzeWeakPoints({
      sessionId,
      workspace,
    });
    expect(secondAnalyze['iteration_number']).toBe(1);

    const marked = await workflowRevisionMarkRevised({
      sessionId,
      revisedText: REVISED_TEXT,
      workspace,
    });
    expect(marked['status']).toBe('REVISED');

    const compared = await workflowRevisionCompare({
      sessionId,
      revisedText: REVISED_TEXT,
      workspace,
    });
    expect(compared['status']).toBe('COMPARED');

    const thirdAnalyze = await workflowRevisionAnalyzeWeakPoints({
      sessionId,
      workspace,
    });
    expect(thirdAnalyze['iteration_number']).toBe(2);

    const session = await readSessionFile(workspaceRoot, sessionId);
    const iterations = session['iterations'] as Array<Record<string, unknown>>;
    expect(iterations).toHaveLength(2);
    expect(iterations[0]?.['comparison']).toBeTruthy();
    expect(iterations[1]?.['comparison']).toBeUndefined();
    expect(session['currentText']).toBe(REVISED_TEXT);
  });

  it('reports no analyzed weak points and no active iteration states', async () => {
    const workspace = buildWorkspace(workspaceRoot);
    const started = await workflowRevisionStartSession({
      chapterId: 'chapter-1',
      content: ORIGINAL_TEXT,
      workspace,
    });
    const sessionId = String(started['session_id']);

    await expect(
      workflowRevisionGenerateSuggestions({ sessionId, workspace }),
    ).resolves.toEqual({
      error: `Revision session '${sessionId}' has no analyzed weak points`,
    });

    await expect(
      workflowRevisionMarkRevised({ sessionId, revisedText: REVISED_TEXT, workspace }),
    ).resolves.toEqual({
      error: `Revision session '${sessionId}' has no active iteration`,
    });

    await expect(
      workflowRevisionCompare({ sessionId, workspace }),
    ).resolves.toEqual({
      error: `Revision session '${sessionId}' has no active iteration`,
    });
  });

  it('reports compare failures when there is still no revised text to compare', async () => {
    const workspace = buildWorkspace(workspaceRoot);
    const started = await workflowRevisionStartSession({
      chapterId: 'chapter-1',
      content: ORIGINAL_TEXT,
      workspace,
    });
    const sessionId = String(started['session_id']);

    await workflowRevisionAnalyzeWeakPoints({ sessionId, workspace });

    const sessionPath = join(
      workspaceRoot,
      '.writing',
      'revision-sessions',
      `${sessionId}.json`,
    );
    const stored = JSON.parse(await readFile(sessionPath, 'utf-8')) as Record<string, unknown>;
    stored['currentText'] = '   ';
    stored['iterations'] = [
      {
        iterationNumber: 1,
        analyzedAt: '2026-06-05T00:00:00.000Z',
        weakPoints: [{ id: 'weak-1' }],
        suggestions: [],
        revisedText: '   ',
      },
    ];
    await writeFile(sessionPath, `${JSON.stringify(stored, null, 2)}\n`, 'utf-8');

    await expect(
      workflowRevisionCompare({ sessionId, workspace }),
    ).resolves.toEqual({
      error: `Revision session '${sessionId}' has no revised text to compare`,
    });
  });

  it('filters history by workflow authority and ignores malformed historical files', async () => {
    const workspaceA = buildWorkspace(workspaceRoot, {
      sessionId: 'workflow-session-a',
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
    });
    const workspaceB = buildWorkspace(workspaceRoot, {
      sessionId: 'workflow-session-b',
      workspaceId: 'atlas-workspace-b',
      projectId: 'atlas-project-b',
    });

    const sessionDir = join(workspaceRoot, '.writing', 'revision-sessions');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, 'broken.json'), '{broken json', 'utf-8');

    const startedA = await workflowRevisionStartSession({
      chapterId: 'chapter-1',
      content: ORIGINAL_TEXT,
      workspace: workspaceA,
    });
    const startedB = await workflowRevisionStartSession({
      chapterId: 'chapter-1',
      content: REVISED_TEXT,
      workspace: workspaceB,
    });

    const historyA = await workflowRevisionHistory({
      chapterId: 'chapter-1',
      workspace: workspaceA,
    });
    expect(historyA['total']).toBe(1);
    expect((historyA['sessions'] as Array<Record<string, unknown>>)[0]?.['id']).toBe(
      startedA['session_id'],
    );

    const historyB = await workflowRevisionHistory({
      chapterId: 'chapter-1',
      workspace: workspaceB,
    });
    expect(historyB['total']).toBe(1);
    expect((historyB['sessions'] as Array<Record<string, unknown>>)[0]?.['id']).toBe(
      startedB['session_id'],
    );
  });

  it('falls back to env workspace root and enforces workspace and project authority mismatches', async () => {
    const envWorkspaceRoot = await mkdtemp(join(tmpdir(), 'niko-revision-env-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = envWorkspaceRoot;

    try {
      const started = await workflowRevisionStartSession({
        chapterId: 'chapter-1',
        content: ORIGINAL_TEXT,
        workspace: buildWorkspace(join(envWorkspaceRoot, 'missing-root'), {
          sessionId: 'workflow-session-a',
          workspaceId: 'env-workspace',
          projectId: 'env-project',
        }),
      });
      const sessionId = String(started['session_id']);

      const workspaceMismatch = await workflowRevisionAnalyzeWeakPoints({
        sessionId,
        workspace: buildWorkspace(envWorkspaceRoot, {
          sessionId: 'workflow-session-a',
          workspaceId: 'other-workspace',
          projectId: 'env-project',
        }),
      });
      expect(String(workspaceMismatch['error'] ?? '')).toContain("workspace 'env-workspace'");

      const projectMismatch = await workflowRevisionAnalyzeWeakPoints({
        sessionId,
        workspace: buildWorkspace(envWorkspaceRoot, {
          sessionId: 'workflow-session-a',
          workspaceId: 'env-workspace',
          projectId: 'other-project',
        }),
      });
      expect(String(projectMismatch['error'] ?? '')).toContain("project 'env-project'");
    } finally {
      await rm(envWorkspaceRoot, { recursive: true, force: true });
    }
  });

  it('supports authority-less sessions and omitted workspace requests via env-root fallback', async () => {
    const unscopedWorkspace = buildWorkspace(workspaceRoot, {
      sessionId: '',
      workspaceId: '',
      projectId: '',
    });

    const started = await workflowRevisionStartSession({
      chapterId: 'chapter-open',
      content: ORIGINAL_TEXT,
      workspace: unscopedWorkspace,
    });
    const sessionId = String(started['session_id']);
    const stored = await readSessionFile(workspaceRoot, sessionId);
    expect(stored['authority']).toBeNull();

    const analyzed = await workflowRevisionAnalyzeWeakPoints({
      sessionId,
      workspace: unscopedWorkspace,
    });
    expect(analyzed['status']).toBe('ANALYZED');

    const suggested = await workflowRevisionGenerateSuggestions({
      sessionId,
      workspace: unscopedWorkspace,
    });
    expect(suggested['status']).toBe('SUGGESTED');

    const revised = await workflowRevisionMarkRevised({
      sessionId,
      revisedText: REVISED_TEXT,
      workspace: unscopedWorkspace,
    });
    expect(revised['status']).toBe('REVISED');

    const compared = await workflowRevisionCompare({
      sessionId,
      revisedText: REVISED_TEXT,
      workspace: unscopedWorkspace,
    });
    expect(compared['status']).toBe('COMPARED');

    const envWorkspaceRoot = await mkdtemp(join(tmpdir(), 'niko-revision-env-fallback-'));
    process.env['NIKO_WORKFLOW_WORKSPACE'] = envWorkspaceRoot;

    try {
      const envStarted = await workflowRevisionStartSession({
        chapterId: 'chapter-env-open',
        content: ORIGINAL_TEXT,
      });
      const envSessionId = String(envStarted['session_id']);

      const envAnalyzed = await workflowRevisionAnalyzeWeakPoints({
        sessionId: envSessionId,
      });
      expect(envAnalyzed['status']).toBe('ANALYZED');

      const envHistory = await workflowRevisionHistory({
        chapterId: 'chapter-env-open',
      });
      expect(envHistory['total']).toBe(1);
      expect((envHistory['sessions'] as Array<Record<string, unknown>>)[0]?.['id']).toBe(
        envSessionId,
      );
    } finally {
      await rm(envWorkspaceRoot, { recursive: true, force: true });
    }
  });

  it('rejects authority mismatches for suggestions, mark-revised, and compare flows', async () => {
    const workspace = buildWorkspace(workspaceRoot, {
      sessionId: 'workflow-session-a',
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
    });
    const started = await workflowRevisionStartSession({
      chapterId: 'chapter-authority',
      content: ORIGINAL_TEXT,
      workspace,
    });
    const sessionId = String(started['session_id']);

    await workflowRevisionAnalyzeWeakPoints({ sessionId, workspace });

    const suggestionMismatch = await workflowRevisionGenerateSuggestions({
      sessionId,
      workspace: buildWorkspace(workspaceRoot, {
        sessionId: 'workflow-session-a',
        workspaceId: 'other-workspace',
        projectId: 'atlas-project',
      }),
    });
    expect(String(suggestionMismatch['error'] ?? '')).toContain("workspace 'atlas-workspace'");

    const revisedMismatch = await workflowRevisionMarkRevised({
      sessionId,
      revisedText: REVISED_TEXT,
      workspace: buildWorkspace(workspaceRoot, {
        sessionId: 'workflow-session-a',
        workspaceId: 'atlas-workspace',
        projectId: 'other-project',
      }),
    });
    expect(String(revisedMismatch['error'] ?? '')).toContain("project 'atlas-project'");

    const compareMismatch = await workflowRevisionCompare({
      sessionId,
      workspace: buildWorkspace(workspaceRoot, {
        sessionId: 'workflow-session-b',
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
      }),
    });
    expect(String(compareMismatch['error'] ?? '')).toContain(
      "workflow session 'workflow-session-a'",
    );
  });
});
