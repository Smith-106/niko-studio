import { describe, expect, it } from 'vitest';

import {
  QCIntegration,
  createQCIntegration,
} from '../../cowriting/QCIntegration.js';
import { createDefaultCreativityConfig } from '../../quality/types.js';

describe('cowriting/QCIntegration', () => {
  it('blocks auto mode output when heuristic hard-constraint violations are detected', () => {
    const integration = new QCIntegration();
    const result = integration.enforce(
      {
        mode: 'auto',
        text: 'He saw her and she told him they should follow his signal. They moved because he insisted she obey him.',
        metadata: {
          model: 'auto-model',
          generatedAt: '2026-06-04T12:00:00.000Z',
          tokenCount: 32,
          confidence: 0.7,
          creativityLevel: 0.5,
        },
      },
      'auto',
      createDefaultCreativityConfig('auto'),
      ['Lin', 'Lan'],
    );

    expect(result.passed).toBe(false);
    expect(result.qcResult.allowed).toBe(false);
    expect(result.qcResult.mode).toBe('blocking');
    expect(result.qcResult.blocked).toHaveLength(1);
    expect(result.qcResult.blocked[0]?.message).toContain('High pronoun density');
    expect(result.blockedReasons[0]).toContain('plot-coherence');
  });

  it('allows directed mode output and converts violations into warnings', () => {
    const integration = createQCIntegration();
    const result = integration.enforce(
      {
        mode: 'auto',
        text: 'He saw her and she told him they should follow his signal. They moved because he insisted she obey him.',
        metadata: {
          model: 'directed-model',
          generatedAt: '2026-06-04T12:01:00.000Z',
          tokenCount: 32,
          confidence: 0.8,
          creativityLevel: 0.4,
        },
      },
      'directed',
      createDefaultCreativityConfig('directed'),
      ['Lin', 'Lan'],
    );

    expect(result.passed).toBe(true);
    expect(result.qcResult.allowed).toBe(true);
    expect(result.qcResult.mode).toBe('advisory');
    expect(result.qcResult.warnings).toHaveLength(1);
    expect(result.qcResult.blocked).toEqual([]);
    expect(result.blockedReasons).toEqual([]);
  });

  it('checks guided options by concatenating their text and passes clean output', () => {
    const integration = new QCIntegration();
    const result = integration.enforce(
      {
        mode: 'guided',
        options: [
          {
            text: 'Lin opened the ledger and read the first entry aloud.',
            scores: { coherence: 90, creativity: 70, styleMatch: 88 },
            overallScore: 83,
            index: 0,
          },
          {
            text: 'Lan traced the seal with one finger and listened to the room settle.',
            scores: { coherence: 88, creativity: 72, styleMatch: 84 },
            overallScore: 81,
            index: 1,
          },
          {
            text: 'The corridor stayed still while the frost along the hinge slowly faded.',
            scores: { coherence: 86, creativity: 68, styleMatch: 82 },
            overallScore: 79,
            index: 2,
          },
        ],
        metadata: {
          model: 'guided-model',
          generatedAt: '2026-06-04T12:02:00.000Z',
          tokenCount: 64,
          creativityLevel: 0.6,
        },
      },
      'guided',
      createDefaultCreativityConfig('guided'),
      ['Lin', 'Lan'],
    );

    expect(result.passed).toBe(true);
    expect(result.qcResult.allowed).toBe(true);
    expect(result.qcResult.blocked).toEqual([]);
    expect(result.qcResult.warnings).toEqual([]);
  });

  it('exposes the factory helper', () => {
    expect(createQCIntegration()).toBeInstanceOf(QCIntegration);
  });
});
