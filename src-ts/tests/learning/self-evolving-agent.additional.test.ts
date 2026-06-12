import { describe, expect, it, vi } from 'vitest';

import * as extractionUtils from '../../learning/extraction-utils';
import { SelfEvolvingAgent } from '../../learning/self-evolving-agent';
import { PipelineStatus } from '../../learning/learning-types';
import { PreferenceTracker } from '../../learning/preference-tracker';
import { RuleEvolver } from '../../learning/rule-evolver';

describe('SelfEvolvingAgent additional coverage', () => {
  it('records feedback, evolves rules, and emits drift insights', async () => {
    const tracker = new PreferenceTracker();
    const evolver = new RuleEvolver({
      evidenceThreshold: 2,
      driftThreshold: 0.2,
    });
    const agent = new SelfEvolvingAgent({
      ruleEvolver: evolver,
      preferenceTracker: tracker,
    });
    const styleSpy = vi
      .spyOn(extractionUtils, 'calculateStyleFeatures')
      .mockReturnValue({
        dimensions: {
          vocabulary_richness: 0.2,
        },
        summary: 'style summary',
        confidence: 0.9,
      });

    const result = await agent.execute({
      content: 'draft content',
      metadata: {
        feedback: [
          {
            dimension: 'vocabulary_richness',
            action: 'accept',
            value: 0.8,
            timestamp: '2026-06-04T00:00:00.000Z',
            source: 'review-1',
          },
          {
            dimension: 'vocabulary_richness',
            action: 'accept',
            value: 0.9,
            timestamp: '2026-06-04T00:01:00.000Z',
            source: 'review-2',
          },
        ],
      },
    });

    expect(tracker.getSignalCount()).toBe(2);
    expect(evolver.getEvidenceCount()).toBe(2);
    expect(evolver.getActiveRules()).toHaveLength(1);
    expect(evolver.getActiveRules()[0]?.dimensions.vocabulary_richness).toBeCloseTo(
      0.85,
      2,
    );

    expect(result).toMatchObject({
      entities: [],
      worldviewElements: [],
      styleFeatures: {
        summary: 'style summary',
        confidence: 0.9,
      },
      metadata: {
        activeRuleCount: 1,
        evidenceCount: 2,
      },
    });
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.insights[0]).toMatchObject({
      source: 'self-evolving',
      tags: expect.arrayContaining(['style-drift', 'high']),
      confidence: 0.7,
    });
    expect((result.metadata.driftReport as { severity: string }).severity).toBe(
      'high',
    );
    expect(agent.getDriftReport()).toMatchObject({
      severity: 'high',
    });
    expect(agent.getStatus()).toMatchObject({
      status: PipelineStatus.COMPLETED,
      itemsProcessed: 1,
      enabled: true,
      error: undefined,
    });
    expect(agent.getStatus().lastRun).toEqual(expect.any(String));

    styleSpy.mockRestore();
  });

  it('returns an empty drift result when no feedback rules exist', async () => {
    const agent = new SelfEvolvingAgent({
      ruleEvolver: new RuleEvolver(),
      preferenceTracker: new PreferenceTracker(),
    });
    const styleSpy = vi
      .spyOn(extractionUtils, 'calculateStyleFeatures')
      .mockReturnValue({
        dimensions: {
          dialogue_ratio: 0.5,
        },
        summary: 'neutral style',
        confidence: 0.6,
      });

    const result = await agent.execute({
      content: 'plain content',
    });

    expect(result.insights).toEqual([]);
    expect(result.metadata).toMatchObject({
      activeRuleCount: 0,
      evidenceCount: 0,
    });
    expect(
      (result.metadata.driftReport as { overallDrift: number; severity: string })
        .overallDrift,
    ).toBe(0);
    expect(
      (result.metadata.driftReport as { overallDrift: number; severity: string })
        .severity,
    ).toBe('none');
    expect(agent.getDriftReport()).toMatchObject({
      overallDrift: 0,
      severity: 'none',
    });

    styleSpy.mockRestore();
  });

  it('rejects execution while disabled without mutating runtime status', async () => {
    const agent = new SelfEvolvingAgent({
      ruleEvolver: new RuleEvolver(),
      preferenceTracker: new PreferenceTracker(),
    });

    agent.disable();

    await expect(
      agent.execute({
        content: 'blocked content',
      }),
    ).rejects.toThrow('Self-evolving pipeline is disabled');

    expect(agent.getDriftReport()).toBeNull();
    expect(agent.getStatus()).toMatchObject({
      status: PipelineStatus.IDLE,
      itemsProcessed: 0,
      enabled: false,
      error: undefined,
    });
  });

  it('can be re-enabled after being disabled', async () => {
    const agent = new SelfEvolvingAgent({
      ruleEvolver: new RuleEvolver(),
      preferenceTracker: new PreferenceTracker(),
    });
    const styleSpy = vi
      .spyOn(extractionUtils, 'calculateStyleFeatures')
      .mockReturnValue({
        dimensions: {},
        summary: 'enabled again',
        confidence: 1,
      });

    agent.disable();
    agent.enable();

    await expect(agent.execute({ content: 'enabled content' })).resolves.toMatchObject({
      styleFeatures: {
        summary: 'enabled again',
      },
    });
    expect(agent.getStatus()).toMatchObject({
      enabled: true,
      status: PipelineStatus.COMPLETED,
    });

    styleSpy.mockRestore();
  });

  it('records failed status when style calculation throws', async () => {
    const agent = new SelfEvolvingAgent({
      ruleEvolver: new RuleEvolver(),
      preferenceTracker: new PreferenceTracker(),
    });
    const styleSpy = vi
      .spyOn(extractionUtils, 'calculateStyleFeatures')
      .mockImplementation(() => {
        throw new Error('style calc failed');
      });

    await expect(
      agent.execute({
        content: 'broken content',
      }),
    ).rejects.toThrow('style calc failed');

    expect(agent.getDriftReport()).toBeNull();
    expect(agent.getStatus()).toMatchObject({
      status: PipelineStatus.FAILED,
      itemsProcessed: 0,
      enabled: true,
      error: 'style calc failed',
    });

    styleSpy.mockRestore();
  });

  it('stores stringified non-Error failures in runtime status', async () => {
    const agent = new SelfEvolvingAgent({
      ruleEvolver: new RuleEvolver(),
      preferenceTracker: new PreferenceTracker(),
    });
    const styleSpy = vi
      .spyOn(extractionUtils, 'calculateStyleFeatures')
      .mockImplementation(() => {
        throw 'style calc failed as string';
      });

    await expect(
      agent.execute({
        content: 'broken content',
      }),
    ).rejects.toBe('style calc failed as string');

    expect(agent.getStatus()).toMatchObject({
      status: PipelineStatus.FAILED,
      error: 'style calc failed as string',
    });

    styleSpy.mockRestore();
  });
});
