import { describe, expect, it } from 'vitest';

import type { QualityReport } from '../../services/narrative-analyzer.js';
import { QualityGateLoop } from '../../services/quality-gate-loop.js';

function makeReport(overall: number): QualityReport {
  return {
    overall,
    dimensions: {
      hook: overall,
      suspense: overall,
      emotion_craft: overall,
    },
    criticalIssues: [],
    suggestions: [],
  };
}

describe('services/quality-gate-loop additional coverage', () => {
  it('blocks strict mode results that stay below the strict warning line', async () => {
    const analyzer = {
      generateQualityReport: () => makeReport(79),
    };
    const gate = new QualityGateLoop(analyzer as never);

    await expect(gate.evaluate('placeholder text', 'strict')).resolves.toMatchObject({
      result: 'BLOCK',
      score: 79,
      revisionCount: 0,
    });
  });

  it('returns PASS from the revision loop once a revision clears the pass threshold', async () => {
    const scores = [50, 78];
    let index = 0;
    const analyzer = {
      generateQualityReport: () => makeReport(scores[Math.min(index++, scores.length - 1)] ?? 78),
    };
    const gate = new QualityGateLoop(analyzer as never);

    const outcome = await gate.revisionLoop('seed', 'standard', async (text) => `${text} revised`);

    expect(outcome).toMatchObject({
      result: 'PASS',
      score: 78,
      revisionCount: 1,
    });
    expect(outcome.history.map((entry) => entry.score)).toEqual([50, 78]);
  });

  it('resets stagnation after a meaningful improvement before finishing the loop', async () => {
    const scores = [50, 51, 55, 56, 57];
    let index = 0;
    const analyzer = {
      generateQualityReport: () => makeReport(scores[Math.min(index++, scores.length - 1)] ?? 57),
    };
    const reviseFn = async (text: string) => `${text} revised`;
    const gate = new QualityGateLoop(analyzer as never);

    const outcome = await gate.revisionLoop('seed', 'standard', reviseFn);

    expect(outcome.result).toBe('FAIL');
    expect(outcome.revisionCount).toBe(3);
    expect(outcome.history.map((entry) => entry.score)).toEqual([50, 51, 55, 56]);
  });

  it('returns WARN from the final score and quick scan when the score lands in the middle band', async () => {
    const scores = [50, 53, 56, 58, 62];
    let index = 0;
    const analyzer = {
      generateQualityReport: () => makeReport(scores[Math.min(index++, scores.length - 1)] ?? 62),
    };
    const gate = new QualityGateLoop(analyzer as never);

    const revisionOutcome = await gate.revisionLoop('seed', 'standard', async (text) => `${text} revised`);
    const quickOutcome = gate.quickScan('quick scan');

    expect(revisionOutcome).toMatchObject({
      result: 'WARN',
      score: 62,
      revisionCount: 3,
    });
    expect(quickOutcome).toMatchObject({
      result: 'PASS',
      score: 62,
      revisionCount: 0,
    });
  });

  it('returns PASS from the final score when the post-loop report clears the threshold', async () => {
    const scores = [50, 53, 56, 58, 80];
    let index = 0;
    const analyzer = {
      generateQualityReport: () => makeReport(scores[Math.min(index++, scores.length - 1)] ?? 80),
    };
    const gate = new QualityGateLoop(analyzer as never);

    const outcome = await gate.revisionLoop('seed', 'standard', async (text) => `${text} revised`);

    expect(outcome).toMatchObject({
      result: 'PASS',
      score: 80,
      revisionCount: 3,
    });
    expect(outcome.history.map((entry) => entry.score)).toEqual([50, 53, 56, 58]);
  });

  it('returns WARN from quickScan when the score stays between 40 and 59', () => {
    const analyzer = {
      generateQualityReport: () => makeReport(50),
    };
    const gate = new QualityGateLoop(analyzer as never);

    expect(gate.quickScan('warn-scan')).toMatchObject({
      result: 'WARN',
      score: 50,
      revisionCount: 0,
    });
  });

  it('returns FAIL from quickScan when the score stays below 40', () => {
    const analyzer = {
      generateQualityReport: () => makeReport(30),
    };
    const gate = new QualityGateLoop(analyzer as never);

    expect(gate.quickScan('fail-scan')).toMatchObject({
      result: 'FAIL',
      score: 30,
      revisionCount: 0,
    });
  });
});
