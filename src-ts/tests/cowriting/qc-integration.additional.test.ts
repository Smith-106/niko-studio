import { describe, expect, it } from 'vitest';

import { QCIntegration } from '../../cowriting/QCIntegration.js';
import { createDefaultCreativityConfig } from '../../quality/types.js';

describe('cowriting/QCIntegration additional coverage', () => {
  it('blocks low-severity style monotony in blocking mode because all violations are treated as blocking', () => {
    const integration = new QCIntegration();
    const result = integration.enforce(
      {
        mode: 'auto',
        text: [
          'Lin keeps calm today.',
          'Lan stays sharp nearby.',
          'Mara walks past slowly.',
          'Jon waits beside windows.',
          'Iris counts each footstep.',
          'Niko tracks faint echoes.',
        ].join(' '),
        metadata: {
          model: 'auto-style',
          generatedAt: '2026-06-05T00:00:00.000Z',
          tokenCount: 36,
          confidence: 0.8,
          creativityLevel: 0.5,
        },
      },
      'auto',
      createDefaultCreativityConfig('auto'),
      ['Lin', 'Lan'],
    );

    expect(result.passed).toBe(false);
    expect(result.qcResult.mode).toBe('blocking');
    expect(result.qcResult.blocked).toHaveLength(1);
    expect(result.qcResult.blocked[0]?.message).toContain('monotonous rhythm');
    expect(result.blockedReasons[0]).toContain('style-consistency');
  });

  it('keeps directed mode advisory while surfacing style and pacing warnings together', () => {
    const integration = new QCIntegration();
    const longSentence = Array.from(
      { length: 170 },
      (_, index) => `detail${index}`,
    ).join(' ');
    const result = integration.enforce(
      {
        mode: 'auto',
        text: `Short.\n\n${longSentence}.`,
        metadata: {
          model: 'directed-style-pacing',
          generatedAt: '2026-06-05T00:01:00.000Z',
          tokenCount: 190,
          confidence: 0.7,
          creativityLevel: 0.4,
        },
      },
      'directed',
      createDefaultCreativityConfig('directed'),
      [],
    );

    expect(result.passed).toBe(true);
    expect(result.qcResult.allowed).toBe(true);
    expect(result.qcResult.mode).toBe('advisory');
    expect(result.qcResult.blocked).toEqual([]);
    expect(result.qcResult.warnings.map(warning => warning.message)).toEqual(
      expect.arrayContaining([
        'High sentence length variance detected',
        'Overly long paragraphs may slow pacing',
      ]),
    );
  });

  it('blocks rushed pacing when most paragraphs are too short', () => {
    const integration = new QCIntegration();
    const result = integration.enforce(
      {
        mode: 'auto',
        text: [
          'Lin waits.',
          'Lan listens.',
          'Mara nods.',
          'Jon turns.',
          'Iris breathes.',
        ].join('\n\n'),
        metadata: {
          model: 'auto-pacing',
          generatedAt: '2026-06-05T00:02:00.000Z',
          tokenCount: 15,
          confidence: 0.6,
          creativityLevel: 0.5,
        },
      },
      'auto',
      createDefaultCreativityConfig('auto'),
      [],
    );

    expect(result.passed).toBe(false);
    expect(result.qcResult.blocked).toHaveLength(1);
    expect(result.qcResult.blocked[0]?.message).toContain('rushed pacing');
    expect(result.blockedReasons[0]).toContain('pacing-tension');
  });

  it('falls back to empty text for unknown output modes and passes clean blocking checks', () => {
    const integration = new QCIntegration();
    const result = integration.enforce(
      {
        mode: 'mystery',
      } as any,
      'auto',
      createDefaultCreativityConfig('auto'),
      [],
    );

    expect(result.passed).toBe(true);
    expect(result.qcResult.allowed).toBe(true);
    expect(result.qcResult.blocked).toEqual([]);
    expect(result.qcResult.warnings).toEqual([]);
    expect(result.blockedReasons).toEqual([]);
  });
});
