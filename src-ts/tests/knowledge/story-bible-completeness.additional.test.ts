import { describe, expect, it } from 'vitest';

import {
  StoryBibleCompleteness,
  createStoryBibleCompleteness,
} from '../../knowledge/StoryBibleCompleteness';
import {
  CharacterArchetype,
  PlotThreadStatus,
  WorldRuleCategory,
  createCharacterProfile,
  createPlotThread,
  createTimelineEvent,
  createWorldRule,
} from '../../knowledge/entities/story-bible-types';

function longText(seed: string): string {
  return `${seed} `.repeat(12).trim();
}

function createValidCharacter(id: string, archetype = CharacterArchetype.SUPPORTING) {
  return createCharacterProfile({
    id,
    novelId: 'novel-1',
    name: `Character ${id}`,
    archetype,
    traits: [
      { trait: 'brave', intensity: 0.8, evidence: 'chapter 1' },
      { trait: 'patient', intensity: 0.6, evidence: 'chapter 2' },
    ],
    motivations: ['Protect the village'],
    backstory: longText(`Backstory for ${id}`),
    relationships: [{ targetId: 'ally-1', type: 'ally', description: 'Trusted ally' }],
    speechPatterns: ['We keep going.'],
  });
}

describe('StoryBibleCompleteness additional coverage', () => {
  it('throws for unknown entity types and exposes the factory helper', () => {
    const completeness = createStoryBibleCompleteness();

    expect(completeness).toBeInstanceOf(StoryBibleCompleteness);
    expect(() =>
      completeness.scoreEntity({
        id: 'unknown-1',
        type: 'mystery-entity',
      } as never),
    ).toThrow('Unknown entity type: mystery-entity');
  });

  it('emits critical and incomplete recommendations with ellipsis for multiple critical entities', () => {
    const completeness = new StoryBibleCompleteness();
    const entities = [
      createCharacterProfile({
        id: 'char-critical',
        novelId: 'novel-1',
        name: '',
        archetype: 'invalid' as never,
        traits: [],
        motivations: [],
        backstory: '',
        relationships: [],
        speechPatterns: [],
      }),
      createWorldRule({
        id: 'rule-critical',
        novelId: 'novel-1',
        name: '',
        category: 'invalid' as never,
        description: 'short',
        constraints: [],
        exceptions: undefined as never,
        impactScope: 'planetary' as never,
      }),
      createPlotThread({
        id: 'plot-critical',
        novelId: 'novel-1',
        name: '',
        premise: '',
        goal: '',
        stakes: '',
        involvedCharacters: [],
        status: 'invalid' as never,
      }),
      createTimelineEvent({
        id: 'event-critical',
        novelId: 'novel-1',
        name: '',
        description: 'short',
        timestamp: '',
        chapterRef: '',
        participants: [],
        eventType: 'invalid' as never,
        emotionalImpact: 'none' as never,
      }),
      createPlotThread({
        id: 'plot-incomplete',
        novelId: 'novel-1',
        name: 'Recover the archive',
        premise: longText('The archive must be recovered.'),
        goal: '',
        stakes: '',
        involvedCharacters: [],
        status: PlotThreadStatus.DEVELOPING,
      }),
    ];

    const report = completeness.calculateOverallScore(entities);

    expect(report.level).toBe('critical');
    expect(report.recommendations[0]).toContain('CRITICAL: 4 entities');
    expect(report.recommendations[0]).toContain('...');
    expect(report.recommendations).toContain(
      'INCOMPLETE: 1 entities need improvement for optimal co-writing quality.',
    );
    expect(report.recommendations.some((item) => item.startsWith('Consider adding '))).toBe(true);
  });

  it('maps readiness and quality multipliers across completeness levels', () => {
    const completeness = new StoryBibleCompleteness();
    const protagonist = createValidCharacter('hero-1', CharacterArchetype.PROTAGONIST);
    const supporting = createValidCharacter('ally-1');
    const incomplete = createPlotThread({
      id: 'plot-adequate',
      novelId: 'novel-1',
      name: 'Break the siege',
      premise: longText('The siege must be broken before winter arrives.'),
      goal: 'Reach the capital',
      stakes: 'The city will fall',
      involvedCharacters: ['hero-1'],
      status: PlotThreadStatus.DEVELOPING,
    });

    const adequateReport = completeness.calculateOverallScore([protagonist, supporting, incomplete]);
    const criticalReport = completeness.calculateOverallScore([
      createWorldRule({
        id: 'rule-bad',
        novelId: 'novel-1',
        name: '',
        category: 'invalid' as never,
        description: 'tiny',
        constraints: [],
        exceptions: undefined as never,
        impactScope: 'planetary' as never,
      }),
    ]);

    expect(adequateReport.level).toBe('comprehensive');
    expect(completeness.isReadyForCowriting(adequateReport)).toBe(true);
    expect(completeness.isReadyForCowriting(criticalReport)).toBe(false);

    expect(completeness.getQualityMultiplier('critical')).toBe(0.3);
    expect(completeness.getQualityMultiplier('incomplete')).toBe(0.6);
    expect(completeness.getQualityMultiplier('adequate')).toBe(0.85);
    expect(completeness.getQualityMultiplier('comprehensive')).toBe(1);
  });

  it('maps mid-range scores into the incomplete level', () => {
    const completeness = new StoryBibleCompleteness();
    const incomplete = createPlotThread({
      id: 'plot-incomplete-level',
      novelId: 'novel-1',
      name: 'Recover the archive',
      premise: longText('The archive must be recovered before the rival faction arrives.'),
      goal: '',
      stakes: '',
      involvedCharacters: [],
      status: 'invalid' as never,
    });

    const report = completeness.calculateOverallScore([incomplete]);

    expect(report.overallScore).toBeGreaterThanOrEqual(0.3);
    expect(report.overallScore).toBeLessThan(0.6);
    expect(report.level).toBe('incomplete');
    expect(completeness.isReadyForCowriting(report)).toBe(true);
    expect(completeness.getQualityMultiplier(report.level)).toBe(0.6);
  });
});
