import { describe, expect, it, vi } from 'vitest';

import {
  formatMetadataBadge,
  isHighConfidence,
  tagOutput,
} from '../../cowriting/OutputMetadata.js';
import {
  ConstraintSeverity,
  QualityDimension,
} from '../../quality/types.js';

describe('cowriting/OutputMetadata', () => {
  const highViolation = {
    dimension: QualityDimension.PLOT_COHERENCE,
    severity: ConstraintSeverity.HIGH,
    message: 'Plot drift',
    location: { chapterId: 'CH-2' },
    evidence: 'The timeline no longer aligns.',
    suggestedFix: 'Reconnect the clue chain.',
  };

  const criticalViolation = {
    ...highViolation,
    severity: ConstraintSeverity.CRITICAL,
    message: 'Canon break',
  };

  it('tags auto mode output with confidence and violation tags', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T12:00:00.000Z'));

    const metadata = tagOutput(
      {
        text: 'The vault door opened with a hiss.',
        mode: 'auto',
        metadata: {
          model: 'gpt-4.1',
          generatedAt: '2026-06-04T12:00:00.000Z',
          tokenCount: 128,
          confidence: 0.93,
          creativityLevel: 0.6,
        },
      },
      [highViolation],
    );

    expect(metadata).toMatchObject({
      mode: 'auto',
      model: 'gpt-4.1',
      confidence: 0.93,
      tokenCount: 128,
      creativityLevel: 0.6,
      violations: [highViolation],
    });
    expect(metadata.id).toMatch(/^gen-[a-z0-9]+-[a-z0-9]+$/);
    expect(metadata.tags).toEqual([
      'auto',
      'high-confidence',
      'has-violations',
      'violation-high',
    ]);

    vi.useRealTimers();
  });

  it('defaults guided mode confidence to 0.8 and derives medium-confidence tags', () => {
    const metadata = tagOutput({
      options: [],
      mode: 'guided',
      metadata: {
        model: 'claude-sonnet-4-6',
        generatedAt: '2026-06-04T12:05:00.000Z',
        tokenCount: 256,
        creativityLevel: 0.4,
      },
    });

    expect(metadata.confidence).toBe(0.8);
    expect(metadata.tags).toEqual(['guided', 'medium-confidence']);
  });

  it('formats badge text with singular and plural violation suffixes', () => {
    expect(
      formatMetadataBadge({
        id: 'gen-1',
        mode: 'auto',
        model: 'gpt-4.1',
        confidence: 0.85,
        generatedAt: '2026-06-04T12:05:00.000Z',
        tokenCount: 64,
        creativityLevel: 0.5,
        violations: [highViolation],
        tags: [],
      }),
    ).toBe('[Auto | 0.85 confidence | gpt-4.1 | 1 violation]');

    expect(
      formatMetadataBadge({
        id: 'gen-2',
        mode: 'guided',
        model: 'claude-sonnet-4-6',
        confidence: 0.72,
        generatedAt: '2026-06-04T12:06:00.000Z',
        tokenCount: 80,
        creativityLevel: 0.4,
        violations: [highViolation, criticalViolation],
        tags: [],
      }),
    ).toBe('[Guided | 0.72 confidence | claude-sonnet-4-6 | 2 violations]');
  });

  it('treats only non-critical outputs at 0.7+ confidence as high confidence', () => {
    expect(
      isHighConfidence({
        id: 'gen-3',
        mode: 'auto',
        model: 'gpt-4.1',
        confidence: 0.7,
        generatedAt: '2026-06-04T12:07:00.000Z',
        tokenCount: 90,
        creativityLevel: 0.5,
        violations: [highViolation],
        tags: [],
      }),
    ).toBe(true);

    expect(
      isHighConfidence({
        id: 'gen-4',
        mode: 'auto',
        model: 'gpt-4.1',
        confidence: 0.95,
        generatedAt: '2026-06-04T12:08:00.000Z',
        tokenCount: 90,
        creativityLevel: 0.5,
        violations: [criticalViolation],
        tags: [],
      }),
    ).toBe(false);

    expect(
      isHighConfidence({
        id: 'gen-5',
        mode: 'guided',
        model: 'claude-sonnet-4-6',
        confidence: 0.69,
        generatedAt: '2026-06-04T12:09:00.000Z',
        tokenCount: 90,
        creativityLevel: 0.5,
        violations: [],
        tags: [],
      }),
    ).toBe(false);
  });

  it('tags low-confidence outputs and omits violation suffixes when none exist', () => {
    const metadata = tagOutput({
      text: 'A tentative continuation.',
      mode: 'auto',
      metadata: {
        model: 'gpt-4.1',
        generatedAt: '2026-06-04T12:10:00.000Z',
        tokenCount: 42,
        confidence: 0.42,
        creativityLevel: 0.2,
      },
    });

    expect(metadata.tags).toEqual(['auto', 'low-confidence']);
    expect(
      formatMetadataBadge({
        ...metadata,
        id: 'gen-6',
      }),
    ).toBe('[Auto | 0.42 confidence | gpt-4.1]');
  });
});
