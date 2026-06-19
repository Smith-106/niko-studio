import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const evaluateContentMock = vi.hoisted(() => vi.fn());
const getImprovementSuggestionsMock = vi.hoisted(() => vi.fn());
const characterAnalyzeMock = vi.hoisted(() => vi.fn());
const timelineAnalyzeMock = vi.hoisted(() => vi.fn());
const worldviewAnalyzeMock = vi.hoisted(() => vi.fn());
const addRuleMock = vi.hoisted(() => vi.fn());
const logInfoMock = vi.hoisted(() => vi.fn());
const logWarnMock = vi.hoisted(() => vi.fn());
const normalizeRecordSetIdMock = vi.hoisted(() => vi.fn());

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/critic',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function makeCharacterReport(conflicts: Array<Record<string, unknown>> = []) {
  return {
    coherenceScore: 90,
    summary: 'Character layer stable.',
    conflicts,
  };
}

function makeTimelineReport(conflicts: Array<Record<string, unknown>> = []) {
  return {
    consistencyScore: 60,
    summary: 'Timeline drift detected.',
    conflicts,
  };
}

function makeWorldviewReport(conflicts: Array<Record<string, unknown>> = []) {
  return {
    coherenceScore: 75,
    summary: 'Worldview mostly stable.',
    conflicts,
  };
}

async function loadCriticModule() {
  vi.resetModules();

  vi.doMock('../../mcp/services/critic.js', () => ({
    evaluateContent: evaluateContentMock,
    getImprovementSuggestions: getImprovementSuggestionsMock,
  }));

  vi.doMock('../../project/workspace-model.js', () => ({
    normalizeProjectWorkspaceContext: vi.fn((input: Record<string, any>, options?: Record<string, unknown>) => {
      const source = (input.workspace ?? input) as Record<string, any>;
      const identity = (source.identity ?? {}) as Record<string, any>;
      const storyBible = (source.storyBible ?? {}) as Record<string, any>;
      const manuscript = (source.manuscript ?? {}) as Record<string, any>;
      const authority = (source.authority ?? {}) as Record<string, any>;

      return {
        identity: {
          workspaceId: String(identity.workspaceId ?? 'workspace-default'),
          projectId: String(identity.projectId ?? options?.['fallbackProjectId'] ?? 'project-default'),
          workspaceRoot: String(identity.workspaceRoot ?? options?.['workspaceRoot'] ?? 'workspace-root'),
          projectName: identity.projectName ?? null,
        },
        storyBible: {
          draftId: storyBible.draftId ?? null,
          storage: storyBible.storage ?? (storyBible.draftId ? 'local-draft' : 'workspace'),
        },
        manuscript: {
          chapterTitle: manuscript.chapterTitle ?? null,
          chapterNumber: manuscript.chapterNumber ?? null,
        },
        authority: {
          recordSetId: authority.recordSetId ?? 'record-set',
          consistencyRunId: authority.consistencyRunId ?? null,
        },
      };
    }),
    projectWorkspaceToNarrativeAuthority: vi.fn((workspace: Record<string, any>) => ({
      workspaceId: workspace.identity.workspaceId,
      projectId: workspace.identity.projectId,
      recordSetId: workspace.authority.recordSetId,
      consistencyRunId: workspace.authority.consistencyRunId,
    })),
  }));

  vi.doMock('../../project/narrative-records.js', () => ({
    normalizeProjectNarrativeRecordSetId: normalizeRecordSetIdMock,
  }));

  vi.doMock('../../narrative/cross-chapter-character-tracker.js', () => ({
    CrossChapterCharacterTracker: vi.fn().mockImplementation(function CrossChapterCharacterTracker() {
      return {
        analyze: characterAnalyzeMock,
      };
    }),
  }));

  vi.doMock('../../narrative/timeline-consistency-checker.js', () => ({
    TimelineConsistencyChecker: vi.fn().mockImplementation(function TimelineConsistencyChecker() {
      return {
        analyze: timelineAnalyzeMock,
      };
    }),
  }));

  vi.doMock('../../narrative/worldview-coherence-validator.js', () => ({
    WorldviewCoherenceValidator: vi.fn().mockImplementation(function WorldviewCoherenceValidator() {
      return {
        addRule: addRuleMock,
        analyze: worldviewAnalyzeMock,
      };
    }),
  }));

  vi.doMock('../../logger/index.js', () => ({
    createLogger: () => ({
      info: logInfoMock,
      warn: logWarnMock,
    }),
  }));

  return import('../../mcp/endpoints/critic.js');
}

describe('critic endpoints tail branches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T10:20:30.000Z'));
    evaluateContentMock.mockReset();
    getImprovementSuggestionsMock.mockReset();
    characterAnalyzeMock.mockReset();
    timelineAnalyzeMock.mockReset();
    worldviewAnalyzeMock.mockReset();
    addRuleMock.mockReset();
    logInfoMock.mockReset();
    logWarnMock.mockReset();
    normalizeRecordSetIdMock.mockReset();
    normalizeRecordSetIdMock.mockImplementation((_recordSetId: string, workspaceId: string) => (
      `${workspaceId}-normalized`
    ));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('node:fs');
    vi.doUnmock('../../mcp/services/critic.js');
    vi.doUnmock('../../project/workspace-model.js');
    vi.doUnmock('../../project/narrative-records.js');
    vi.doUnmock('../../narrative/cross-chapter-character-tracker.js');
    vi.doUnmock('../../narrative/timeline-consistency-checker.js');
    vi.doUnmock('../../narrative/worldview-coherence-validator.js');
    vi.doUnmock('../../logger/index.js');
  });

  it('falls back to qualityGoals and empty content in the evaluate endpoint', async () => {
    evaluateContentMock.mockResolvedValueOnce({ decision: 'APPROVED', total_score: 91 });

    const { criticEvaluateEndpoint } = await loadCriticModule();
    const response = await criticEvaluateEndpoint(makeRequest({
      qualityGoals: { clarity: 2 },
    }));

    expect(evaluateContentMock).toHaveBeenCalledWith('', undefined, undefined, { clarity: 2 });
    expect(response.body).toEqual({ decision: 'APPROVED', total_score: 91 });
  });

  it('defaults chapter metadata, rule constraints, and unknown severities when consistency inputs are sparse', async () => {
    characterAnalyzeMock.mockResolvedValueOnce(makeCharacterReport([
      {
        severity: 'mystery',
        type: 'unknown-signal',
        description: 'Unknown severity should sort last.',
        chaptersInvolved: [1],
      },
    ]));
    timelineAnalyzeMock.mockResolvedValueOnce(makeTimelineReport([
      {
        severity: 'major',
        type: 'calendar-slip',
        description: 'Known severities should sort first.',
        chaptersInvolved: [1],
        suggestedFix: 'Align the sequence.',
      },
    ]));
    worldviewAnalyzeMock.mockResolvedValueOnce(makeWorldviewReport());

    const { criticConsistencyEndpoint } = await loadCriticModule();
    const response = await criticConsistencyEndpoint(makeRequest({
      chapters: ['Only chapter'],
      chapterMeta: [{ chapterNumber: null, title: null }],
      worldRules: [
        {
          category: 'magic',
          name: 'No resurrection',
          description: 'The dead stay dead.',
        },
      ],
    }));

    expect(characterAnalyzeMock).toHaveBeenCalledWith(
      ['Only chapter'],
      [{ chapterNumber: 1, title: 'Chapter 1' }],
    );
    expect(timelineAnalyzeMock).toHaveBeenCalledWith(
      ['Only chapter'],
      [{ chapterNumber: 1, title: 'Chapter 1' }],
    );
    expect(addRuleMock).toHaveBeenCalledWith({
      id: `rule-${new Date('2026-06-08T10:20:30.000Z').valueOf()}`,
      category: 'magic',
      name: 'No resurrection',
      description: 'The dead stay dead.',
      constraints: [],
      establishedIn: 1,
    });
    expect((response.body as Record<string, any>).combined.conflicts.map((item: Record<string, unknown>) => item.severity)).toEqual([
      'major',
      'mystery',
    ]);
  });

  it('falls back to an empty workspace root when identity exists without workspaceRoot', async () => {
    const { consistencyCheckEndpoint } = await loadCriticModule();

    const response = await consistencyCheckEndpoint(makeRequest({
      workspace: {
        identity: {},
      },
    }));

    expect(response).toMatchObject({
      statusCode: 400,
      body: { error: 'No chapters provided and no workspace root specified for auto-scan' },
    });
  });

  it('scans from workspaceRoot and derives chapter numbers and fallback titles from filenames', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-critic-tail-scan-'));
    const draftsDir = join(workspaceRoot, 'drafts');
    await mkdir(draftsDir, { recursive: true });
    await writeFile(join(draftsDir, 'prologue.md'), 'Scanned prologue chapter.');
    await writeFile(join(draftsDir, '03_.txt'), 'Scanned numbered chapter.');

    characterAnalyzeMock.mockResolvedValueOnce(makeCharacterReport());
    timelineAnalyzeMock.mockResolvedValueOnce(makeTimelineReport());
    worldviewAnalyzeMock.mockResolvedValueOnce(makeWorldviewReport());

    const {
      buildConsistencyInputFromWorkspace,
      consistencyCheckEndpoint,
    } = await loadCriticModule();

    try {
      const scanned = await buildConsistencyInputFromWorkspace(workspaceRoot);
      expect(scanned).toEqual({
        chapters: ['Scanned numbered chapter.', 'Scanned prologue chapter.'],
        chapterMeta: [
          { chapterNumber: 3, title: 'Chapter 3' },
          { chapterNumber: 2, title: 'prologue' },
        ],
        worldRules: [],
      });

      const response = await consistencyCheckEndpoint(makeRequest({
        workspaceRoot,
      }));

      expect(response.statusCode).toBe(200);
      expect(characterAnalyzeMock).toHaveBeenCalledWith(
        ['Scanned numbered chapter.', 'Scanned prologue chapter.'],
        [
          { chapterNumber: 3, title: 'Chapter 3' },
          { chapterNumber: 2, title: 'prologue' },
        ],
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('falls back to stdin payloads and default JSON stdout when workspace scanning is unavailable', async () => {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn((target: number | string, encoding?: BufferEncoding) => {
          if (target === 0) {
            return '{}';
          }
          return actual.readFileSync(target as never, encoding as never);
        }),
      };
    });

    characterAnalyzeMock.mockResolvedValue(makeCharacterReport());
    timelineAnalyzeMock.mockResolvedValue(makeTimelineReport());
    worldviewAnalyzeMock.mockResolvedValue(makeWorldviewReport());

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const {
      mainConsistencyCheckCli,
      runConsistencyCheckCli,
    } = await loadCriticModule();

    const result = await runConsistencyCheckCli({});
    expect(characterAnalyzeMock).toHaveBeenCalledWith([], []);
    expect(logWarnMock).toHaveBeenCalledWith(
      'Workspace root does not exist or is not a directory',
      expect.any(Object),
    );
    expect(result.workspace.identity.workspaceRoot).toBe(process.cwd());

    await mainConsistencyCheckCli([]);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('"runId"'));
  });

  it('writes default JSON output files and formats chapter labels with suggestions', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-critic-tail-json-'));
    const manuscriptDir = join(workspaceRoot, 'manuscript');
    const outputPath = join(workspaceRoot, 'report.json');
    await mkdir(manuscriptDir, { recursive: true });
    await writeFile(join(manuscriptDir, '01_intro.md'), 'Intro chapter');

    characterAnalyzeMock.mockResolvedValueOnce(makeCharacterReport([
      {
        severity: 'minor',
        type: 'hint-gap',
        description: 'A reminder is missing.',
        chaptersInvolved: [1, 2],
        suggestion: 'Add one reminder scene.',
      },
    ]));
    timelineAnalyzeMock.mockResolvedValueOnce(makeTimelineReport());
    worldviewAnalyzeMock.mockResolvedValueOnce(makeWorldviewReport());

    const {
      formatConsistencyCheckText,
      runConsistencyCheckCli,
    } = await loadCriticModule();

    try {
      const formatted = formatConsistencyCheckText({
        runId: 'consistency-demo-20260608102030',
        analyzedAt: '2026-06-08T10:20:30.000Z',
        workspace: {
          identity: {
            workspaceId: 'demo-workspace',
            projectId: 'demo-project',
          },
        },
        combined: {
          totalConflicts: 1,
          criticalCount: 0,
          majorCount: 0,
          minorCount: 1,
          infoCount: 0,
          overallScore: 81,
          summary: 'One minor note.',
          conflicts: [
            {
              severity: 'minor',
              source: 'character',
              type: 'hint-gap',
              chaptersInvolved: [1, 2],
              description: 'A reminder is missing.',
              suggestion: 'Add one reminder scene.',
            },
          ],
        },
        character: {} as never,
        timeline: {} as never,
        worldview: {} as never,
        narrativeAuthority: {} as never,
      });
      expect(formatted).toContain('[chapters: 1, 2]');
      expect(formatted).toContain('Suggestion: Add one reminder scene.');

      await runConsistencyCheckCli({
        workspaceRoot,
        output: outputPath,
      });

      expect(await import('node:fs/promises').then((fs) => fs.readFile(outputPath, 'utf8'))).toContain('"runId"');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
