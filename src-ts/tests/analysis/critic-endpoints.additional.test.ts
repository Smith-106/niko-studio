import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
          projectId: String(identity.projectId ?? options?.fallbackProjectId ?? 'project-default'),
          workspaceRoot: String(identity.workspaceRoot ?? options?.workspaceRoot ?? 'workspace-root'),
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

describe('critic endpoints additional coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T10:20:30.000Z'));
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
    vi.doUnmock('../../mcp/services/critic.js');
    vi.doUnmock('../../project/workspace-model.js');
    vi.doUnmock('../../project/narrative-records.js');
    vi.doUnmock('../../narrative/cross-chapter-character-tracker.js');
    vi.doUnmock('../../narrative/timeline-consistency-checker.js');
    vi.doUnmock('../../narrative/worldview-coherence-validator.js');
    vi.doUnmock('../../logger/index.js');
  });

  it('forwards evaluate and suggestion parameters with expected defaults', async () => {
    evaluateContentMock.mockResolvedValueOnce({ decision: 'APPROVED', total_score: 91 });
    getImprovementSuggestionsMock
      .mockResolvedValueOnce([{ summary: 'Tighten the pacing.' }])
      .mockResolvedValueOnce([{ summary: 'Default suggestion count.' }]);

    const {
      criticEvaluateEndpoint,
      criticSuggestionsEndpoint,
    } = await loadCriticModule();

    const evaluateResponse = await criticEvaluateEndpoint(makeRequest({
      content: 'Draft content',
      scene_card: { id: 'scene-1' },
      dimensions: ['logic', 'style'],
      qualityGoals: { clarity: 2 },
      quality_goals: { clarity: 5 },
    }));
    expect(evaluateContentMock).toHaveBeenCalledWith(
      'Draft content',
      { id: 'scene-1' },
      ['logic', 'style'],
      { clarity: 5 },
    );
    expect(evaluateResponse.body).toEqual({ decision: 'APPROVED', total_score: 91 });

    const explicitSuggestions = await criticSuggestionsEndpoint(makeRequest({
      content: 'Scene draft',
      issues: ['pacing'],
      max_suggestions: 2,
    }));
    expect(getImprovementSuggestionsMock).toHaveBeenNthCalledWith(1, 'Scene draft', ['pacing'], 2);
    expect(explicitSuggestions.body).toEqual([{ summary: 'Tighten the pacing.' }]);

    const defaultSuggestions = await criticSuggestionsEndpoint(makeRequest({}));
    expect(getImprovementSuggestionsMock).toHaveBeenNthCalledWith(2, '', undefined, 5);
    expect(defaultSuggestions.body).toEqual([{ summary: 'Default suggestion count.' }]);
  });

  it('aggregates worldview conflicts, sorts severities, and normalizes workspace authority', async () => {
    characterAnalyzeMock.mockResolvedValueOnce(makeCharacterReport([
      {
        severity: 'minor',
        type: 'motivation-gap',
        description: 'Motivation drifts.',
        chaptersInvolved: [2],
        suggestion: 'Clarify the motive.',
      },
      {
        severity: 'critical',
        type: 'post-mortem-return',
        description: 'The hero returns after death.',
        chaptersInvolved: [1, 3],
        suggestion: 'Remove the contradiction.',
      },
    ]));
    timelineAnalyzeMock.mockResolvedValueOnce(makeTimelineReport([
      {
        severity: 'major',
        type: 'calendar-slip',
        description: 'The dates do not line up.',
        chaptersInvolved: [2],
        suggestedFix: 'Align the timeline.',
      },
    ]));
    worldviewAnalyzeMock.mockResolvedValueOnce(makeWorldviewReport([
      {
        severity: 'info',
        type: 'lore-note',
        description: 'A lore term is introduced once.',
        chaptersInvolved: [],
        suggestion: 'Optionally expand the lore.',
      },
    ]));

    const { criticConsistencyEndpoint } = await loadCriticModule();
    const response = await criticConsistencyEndpoint(makeRequest({
      chapters: ['Chapter one', 'Chapter two'],
      chapterMeta: [
        { chapterNumber: 10, title: 'Arrival' },
        { title: 'Unnamed Follow-up' },
      ],
      worldRules: [
        {
          category: 'magic',
          name: 'No resurrection',
          description: 'The dead stay dead.',
          constraints: ['No revival'],
          establishedIn: 2,
        },
      ],
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          workspaceRoot: '/tmp/atlas',
        },
        authority: {
          recordSetId: 'raw-record-set',
        },
      },
    }));

    expect(characterAnalyzeMock).toHaveBeenCalledWith(
      ['Chapter one', 'Chapter two'],
      [
        { chapterNumber: 10, title: 'Arrival' },
        { chapterNumber: 2, title: 'Unnamed Follow-up' },
      ],
    );
    expect(timelineAnalyzeMock).toHaveBeenCalledWith(
      ['Chapter one', 'Chapter two'],
      [
        { chapterNumber: 10, title: 'Arrival' },
        { chapterNumber: 2, title: 'Unnamed Follow-up' },
      ],
    );
    expect(addRuleMock).toHaveBeenCalledWith({
      id: `rule-${new Date('2026-06-04T10:20:30.000Z').valueOf()}`,
      category: 'magic',
      name: 'No resurrection',
      description: 'The dead stay dead.',
      constraints: ['No revival'],
      establishedIn: 2,
    });
    expect(normalizeRecordSetIdMock).toHaveBeenCalledWith('raw-record-set', 'atlas-workspace');

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      analyzedAt: '2026-06-04T10:20:30.000Z',
      runId: 'consistency-atlas-workspace-20260604102030',
      combined: {
        totalConflicts: 4,
        criticalCount: 1,
        majorCount: 1,
        minorCount: 1,
        infoCount: 1,
        overallScore: 75,
        summary: 'Character layer stable. Timeline drift detected. Worldview mostly stable.',
      },
      workspace: {
        authority: {
          recordSetId: 'atlas-workspace-normalized',
          consistencyRunId: 'consistency-atlas-workspace-20260604102030',
        },
      },
      narrativeAuthority: {
        workspaceId: 'atlas-workspace',
        recordSetId: 'atlas-workspace-normalized',
        consistencyRunId: 'consistency-atlas-workspace-20260604102030',
      },
    });

    const body = response.body as Record<string, any>;
    expect(body.combined.conflicts.map((conflict: Record<string, unknown>) => conflict.severity)).toEqual([
      'critical',
      'major',
      'minor',
      'info',
    ]);
  });

  it('uses scanned chapters while preserving explicit chapter metadata and world rules', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-critic-scan-'));
    const draftsDir = join(workspaceRoot, 'drafts');
    await mkdir(draftsDir, { recursive: true });
    await writeFile(join(draftsDir, '01_opening.md'), 'Scanned opening chapter.');
    await writeFile(join(draftsDir, '02_twist.txt'), 'Scanned second chapter.');

    characterAnalyzeMock.mockResolvedValueOnce(makeCharacterReport());
    timelineAnalyzeMock.mockResolvedValueOnce(makeTimelineReport());
    worldviewAnalyzeMock.mockResolvedValueOnce(makeWorldviewReport());

    const { consistencyCheckEndpoint } = await loadCriticModule();

    try {
      const response = await consistencyCheckEndpoint(makeRequest({
        workspace: {
          identity: {
            workspaceRoot,
          },
        },
        chapterMeta: [
          { chapterNumber: 99, title: 'Manual Title' },
        ],
        worldRules: [
          {
            id: 'rule-explicit',
            category: 'law',
            name: 'Explicit rule',
            description: 'Keep explicit rules.',
            constraints: ['No override'],
            establishedIn: 3,
          },
        ],
      }));

      expect(response.statusCode).toBe(200);
      expect(characterAnalyzeMock).toHaveBeenCalledWith(
        ['Scanned opening chapter.', 'Scanned second chapter.'],
        [{ chapterNumber: 99, title: 'Manual Title' }],
      );
      expect(addRuleMock).toHaveBeenCalledWith({
        id: 'rule-explicit',
        category: 'law',
        name: 'Explicit rule',
        description: 'Keep explicit rules.',
        constraints: ['No override'],
        establishedIn: 3,
      });
      expect(logInfoMock).toHaveBeenCalledWith(
        'Workspace scan completed',
        expect.objectContaining({ chapterCount: 2 }),
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('formats reports without empty chapter labels or suggestion lines', async () => {
    const { formatConsistencyCheckText } = await loadCriticModule();

    const text = formatConsistencyCheckText({
      runId: 'consistency-demo-20260604102030',
      analyzedAt: '2026-06-04T10:20:30.000Z',
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
        minorCount: 0,
        infoCount: 1,
        overallScore: 88,
        summary: 'One informational note.',
        conflicts: [
          {
            severity: 'info',
            source: 'worldview',
            type: 'lore-note',
            chaptersInvolved: [],
            description: 'A lore term appears once.',
          },
        ],
      },
      character: {} as never,
      timeline: {} as never,
      worldview: {} as never,
      narrativeAuthority: {} as never,
    });

    expect(text).toContain('Conflict Details:');
    expect(text).toContain('- INFO | worldview | lore-note');
    expect(text).not.toContain('[chapters:');
    expect(text).not.toContain('Suggestion:');
  });

  it('infers chapter metadata and writes a text report from a chapters file', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-critic-cli-file-'));
    const inputPath = join(workspaceRoot, 'chapters.json');
    const outputPath = join(workspaceRoot, 'report.txt');

    await writeFile(inputPath, JSON.stringify({
      chapters: ['Alpha scene', 'Beta scene'],
    }, null, 2), 'utf8');

    characterAnalyzeMock.mockResolvedValueOnce(makeCharacterReport());
    timelineAnalyzeMock.mockResolvedValueOnce(makeTimelineReport());
    worldviewAnalyzeMock.mockResolvedValueOnce(makeWorldviewReport());

    const { runConsistencyCheckCli } = await loadCriticModule();

    try {
      const result = await runConsistencyCheckCli({
        chaptersFile: inputPath,
        output: outputPath,
        format: 'text',
        workspaceRoot,
        workspaceId: 'cli-ws',
        projectId: 'cli-project',
        draftId: 'draft-9',
        chapterTitle: 'Pilot',
      });

      expect(characterAnalyzeMock).toHaveBeenCalledWith(
        ['Alpha scene', 'Beta scene'],
        [
          { chapterNumber: 1, title: 'Pilot' },
          { chapterNumber: 2, title: 'Chapter 2' },
        ],
      );
      expect(result.workspace.storyBible.storage).toBe('local-draft');
      expect(await readFile(outputPath, 'utf8')).toContain('Consistency Run:');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('scans the workspace when no input file is provided', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-critic-cli-scan-'));
    const manuscriptDir = join(workspaceRoot, 'manuscript');
    await mkdir(manuscriptDir, { recursive: true });
    await writeFile(join(manuscriptDir, '01_intro.md'), 'Intro chapter');
    await writeFile(join(manuscriptDir, '02_twist.md'), 'Twist chapter');

    characterAnalyzeMock.mockResolvedValueOnce(makeCharacterReport());
    timelineAnalyzeMock.mockResolvedValueOnce(makeTimelineReport());
    worldviewAnalyzeMock.mockResolvedValueOnce(makeWorldviewReport());

    const { runConsistencyCheckCli } = await loadCriticModule();

    try {
      await runConsistencyCheckCli({ workspaceRoot });

      expect(characterAnalyzeMock).toHaveBeenCalledWith(
        ['Intro chapter', 'Twist chapter'],
        [
          { chapterNumber: 1, title: 'intro' },
          { chapterNumber: 2, title: 'twist' },
        ],
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('parses CLI arguments and writes text output to stdout', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-critic-main-'));
    const inputPath = join(workspaceRoot, 'chapters.json');
    const outputPath = join(workspaceRoot, 'main-report.txt');
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await writeFile(inputPath, JSON.stringify({
      chapters: ['Gamma chapter'],
      chapterMeta: [{ chapterNumber: 7, title: 'Hook' }],
    }, null, 2), 'utf8');

    characterAnalyzeMock.mockResolvedValueOnce(makeCharacterReport());
    timelineAnalyzeMock.mockResolvedValueOnce(makeTimelineReport());
    worldviewAnalyzeMock.mockResolvedValueOnce(makeWorldviewReport());

    const { mainConsistencyCheckCli } = await loadCriticModule();

    try {
      await mainConsistencyCheckCli([
        '--input', inputPath,
        '--output', outputPath,
        '--workspace', workspaceRoot,
        '--workspace-id', 'main-ws',
        '--project-id', 'main-project',
        '--project-name', 'Main Project',
        '--draft-id', 'draft-7',
        '--chapter-title', 'Hook',
        '--chapter-number', '7',
        '--format', 'text',
      ]);

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Consistency Run:'));
      expect(await readFile(outputPath, 'utf8')).toContain('Consistency Run:');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
