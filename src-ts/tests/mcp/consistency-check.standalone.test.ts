import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  formatConsistencyCheckText,
  runConsistencyCheckCli,
} from '../../mcp/endpoints/critic';

describe('standalone consistency check runner', () => {
  it('runs a workspace consistency scan from a JSON payload file and writes a report', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-consistency-'));
    const inputPath = join(workspaceRoot, 'consistency-input.json');
    const outputPath = join(workspaceRoot, 'consistency-output.json');

    try {
      await writeFile(inputPath, JSON.stringify({
        chapters: [
          '盛夏的阳光照在战场上，夏日的炎热让人窒息。林明在战斗中受了重伤。最终，林明死亡，永远闭上了眼睛。老王的好友林明离世了。',
          '春天来了，春暖花开，三月的风轻轻吹过。林明不在了，老王独自坐在院子里。',
          '林明走了过来，笑着和大家打招呼。老王看到林明走了过来。',
        ],
        chapterMeta: [
          { chapterNumber: 1, title: 'Death' },
          { chapterNumber: 2, title: 'Season Shift' },
          { chapterNumber: 3, title: 'Return' },
        ],
      }, null, 2), 'utf8');

      const result = await runConsistencyCheckCli({
        chaptersFile: inputPath,
        output: outputPath,
        workspaceRoot,
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        projectName: 'Atlas',
        draftId: 'draft-9',
        chapterTitle: 'Return',
        chapterNumber: 2,
        format: 'json',
      });

      expect(result.runId).toContain('consistency-atlas-workspace-');
      expect(result.workspace.identity.workspaceRoot).toBe(workspaceRoot);
      expect(result.workspace.storyBible.draftId).toBe('draft-9');
      expect(result.workspace.storyBible.storage).toBe('local-draft');
      expect(result.combined.totalConflicts).toBeGreaterThanOrEqual(1);

      const saved = JSON.parse(await readFile(outputPath, 'utf8')) as typeof result;
      expect(saved.runId).toBe(result.runId);
      expect(saved.workspace.identity.projectId).toBe('atlas-project');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('formats a readable text report', () => {
    const output = formatConsistencyCheckText({
      runId: 'consistency-atlas-20260429010101',
      analyzedAt: '2026-04-29T01:01:01.000Z',
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
      combined: {
        totalConflicts: 1,
        criticalCount: 1,
        majorCount: 0,
        minorCount: 0,
        infoCount: 0,
        overallScore: 66.7,
        summary: 'Detected one critical conflict.',
        conflicts: [
          {
            severity: 'critical',
            source: 'character',
            type: 'post_mortem_appearance',
            chaptersInvolved: [1, 2],
            description: 'Character appears after death.',
            suggestion: 'Remove the contradiction.',
          },
        ],
      },
      character: {} as never,
      timeline: {} as never,
      worldview: {} as never,
      narrativeAuthority: {} as never,
    });

    expect(output).toContain('Consistency Run: consistency-atlas-20260429010101');
    expect(output).toContain('Conflicts: 1 total (1 critical, 0 major, 0 minor, 0 info)');
    expect(output).toContain('CRITICAL | character | post_mortem_appearance');
    expect(output).toContain('Suggestion: Remove the contradiction.');
  });
});
