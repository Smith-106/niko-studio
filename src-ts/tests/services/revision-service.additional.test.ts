import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../mcp/services/critic', () => ({
  evaluateContent: vi.fn(),
}));

vi.mock('../../workflow/revision-loop', () => ({
  RevisionDecision: {
    APPROVED: 'APPROVED',
    REVISE: 'REVISE',
    REWRITE: 'REWRITE',
    HUMAN_REVIEW: 'HUMAN_REVIEW',
  },
  DEFAULT_REVISION_CONFIG: {
    max_revisions: 5,
    pass_score: 8,
  },
  runRevisionLoop: vi.fn(),
}));

import { evaluateContent } from '../../mcp/services/critic';
import { RevisionServiceImpl } from '../../services/revision-service';
import { RevisionDecision, runRevisionLoop } from '../../workflow/revision-loop';

describe('RevisionServiceImpl additional coverage', () => {
  const originalWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evaluateContent).mockResolvedValue({
      decision: 'APPROVED',
      total_score: 8.5,
      logic_score: 8,
      actionable_feedback: 'Looks good',
    } as never);
    vi.mocked(runRevisionLoop).mockResolvedValue({
      final_draft: 'Improved text content',
      final_score: 8.5,
      final_decision: 'APPROVED',
      history: [
        { score: 6.5, feedback: 'revise once' },
      ],
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWorkspace == null) {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    } else {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = originalWorkspace;
    }
  });

  it('executes critic and writer closures and falls back for malformed loop output', async () => {
    const service = new RevisionServiceImpl();
    let capturedCritic: Record<string, unknown> | undefined;
    let capturedWriter: string | undefined;
    let capturedConfig: Record<string, unknown> | undefined;

    vi.mocked(evaluateContent).mockResolvedValueOnce({
      decision: 'REVISE',
      total_score: 4.2,
      logic_score: 5,
      actionable_feedback: 'needs work',
    } as never);

    vi.mocked(runRevisionLoop).mockImplementationOnce(async (input: any) => {
      capturedCritic = await input.criticFn('draft body', {});
      capturedWriter = await input.writerFn('draft body', { reason: 'noop' });
      capturedConfig = input.config;
      return {
        final_draft: { invalid: true },
        final_score: 'bad',
        final_decision: 'UNKNOWN',
        history: 'not-an-array',
      } as never;
    });

    const result = await service.revise('Original text', { max_revisions: 2 });

    expect(capturedCritic).toMatchObject({
      decision: 'REVISE',
      total_score: 4.2,
      actionable_feedback: 'needs work',
      lock_analysis: { C: { score: 5 } },
      revision_instructions: [],
    });
    expect(capturedWriter).toBe('draft body');
    expect(capturedConfig).toMatchObject({
      max_revisions: 2,
      pass_score: 8,
    });
    expect(result.finalDraft).toBe('Original text');
    expect(result.finalScore).toBe(0);
    expect(result.finalDecision).toBe(RevisionDecision.REVISE);
    expect(result.totalIterations).toBe(0);
    expect(result.comparison).toBeUndefined();
  });

  it('normalizes loop decisions and builds comparison only when the draft changed', async () => {
    const service = new RevisionServiceImpl();

    vi.mocked(runRevisionLoop).mockResolvedValueOnce({
      final_draft: 'Rewritten text',
      final_score: 9.1,
      final_decision: 'REWRITE',
      history: [{ score: 7.1 }],
    } as never);

    const rewritten = await service.revise('Base draft');
    expect(rewritten.finalDecision).toBe(RevisionDecision.REWRITE);
    expect(rewritten.comparison).toBeDefined();

    vi.mocked(runRevisionLoop).mockResolvedValueOnce({
      final_draft: 'Human review draft',
      final_score: 6.3,
      final_decision: 'HUMAN_REVIEW',
      history: [{ score: 5.4 }],
    } as never);

    const humanReview = await service.revise('Another base draft');
    expect(humanReview.finalDecision).toBe(RevisionDecision.HUMAN_REVIEW);
  });

  it('reports improving, declining, and stable learning trends with deduped evidence', () => {
    const service = new RevisionServiceImpl();
    const serviceAny = service as any;

    serviceAny._accumulateDimension('improving-dim', 6, 0.5, ['a', 'a', 'b', 'c', 'd']);
    serviceAny._accumulateDimension('declining-dim', 8, -0.6, ['e']);
    serviceAny._accumulateDimension('stable-dim', 7, 0.1, ['f']);
    serviceAny._accumulateDimensionDelta('delta-only', 0.7);
    serviceAny.learningAccumulator.set('empty-entry', {
      baselines: [],
      deltas: [],
      evidence: ['x', 'x', 'y', 'z', 'w'],
      occurrences: 2,
    });

    const insights = service.getLearningInsights();
    const byId = new Map(insights.map(insight => [insight.dimensionId, insight]));

    expect(byId.get('improving-dim')).toMatchObject({
      averageBaselineScore: 6,
      averageDelta: 0.5,
      occurrences: 1,
      trend: 'improving',
    });
    expect(byId.get('improving-dim')?.evidence).toEqual(['a', 'b', 'c', 'd']);
    expect(byId.get('declining-dim')?.trend).toBe('declining');
    expect(byId.get('stable-dim')?.trend).toBe('stable');
    expect(byId.get('delta-only')).toMatchObject({
      averageBaselineScore: 0,
      averageDelta: 0.7,
      trend: 'improving',
    });
    expect(byId.get('empty-entry')).toMatchObject({
      averageBaselineScore: 0,
      averageDelta: 0,
      occurrences: 2,
      trend: 'stable',
    });
  });

  it('loads matching revision sessions, skips malformed files, and sorts newest first', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'revision-history-'));
    const sessionDir = join(workspaceRoot, 'revision-store');
    const service = new RevisionServiceImpl({ sessionStoreDir: 'revision-store' });
    process.env['NIKO_WORKFLOW_WORKSPACE'] = workspaceRoot;

    await mkdir(sessionDir, { recursive: true });
    await mkdir(join(sessionDir, 'nested-dir'));
    await writeFile(join(sessionDir, 'notes.txt'), 'ignore me', 'utf8');
    await writeFile(join(sessionDir, 'broken.json'), '{bad json', 'utf8');
    await writeFile(join(sessionDir, 'other.json'), JSON.stringify({
      sessionId: 'other',
      chapterId: 'chapter-2',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }), 'utf8');
    await writeFile(join(sessionDir, 'old.json'), JSON.stringify({
      sessionId: 'old-session',
      chapterId: 'chapter-1',
      updatedAt: '2026-06-01T00:00:00.000Z',
    }), 'utf8');
    await writeFile(join(sessionDir, 'new.json'), JSON.stringify({
      sessionId: 'new-session',
      chapterId: 'chapter-1',
      updatedAt: '2026-06-02T00:00:00.000Z',
    }), 'utf8');

    const sessions = await service.getSessionHistory('chapter-1');

    expect(sessions.map(session => session.sessionId)).toEqual([
      'new-session',
      'old-session',
    ]);
  });

  it('returns empty history when the store is missing or readdir throws', async () => {
    const missingRoot = await mkdtemp(join(tmpdir(), 'revision-missing-'));
    const missingService = new RevisionServiceImpl({ sessionStoreDir: 'missing-store' });
    process.env['NIKO_WORKFLOW_WORKSPACE'] = missingRoot;

    await expect(missingService.getSessionHistory('chapter-1')).resolves.toEqual([]);

    const throwingRoot = await mkdtemp(join(tmpdir(), 'revision-not-dir-'));
    const throwingPath = join(throwingRoot, 'existing-store');
    const throwingService = new RevisionServiceImpl({ sessionStoreDir: 'existing-store' });
    process.env['NIKO_WORKFLOW_WORKSPACE'] = throwingRoot;
    await writeFile(throwingPath, 'not a directory', 'utf8');

    await expect(throwingService.getSessionHistory('chapter-1')).resolves.toEqual([]);
  });
});
