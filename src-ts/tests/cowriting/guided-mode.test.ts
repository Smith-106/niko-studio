import { describe, expect, it } from 'vitest';

import { GuidedMode, createGuidedMode } from '../../cowriting/GuidedMode.js';
import {
  createCharacterProfile,
  createPlotThread,
  createTimelineEvent,
  createWorldRule,
  CharacterArchetype,
  PlotThreadStatus,
  TimelineEventType,
  WorldRuleCategory,
} from '../../knowledge/entities/story-bible-types.js';
import {
  CreativityPreset,
  resolveCreativityConfig,
} from '../../quality/types.js';

describe('cowriting/GuidedMode', () => {
  it('generates 3 scored guided options through the real placeholder pipeline', async () => {
    const guidedMode = new GuidedMode();
    const creativityConfig = resolveCreativityConfig(
      CreativityPreset.CREATIVE,
      'guided',
    );

    const result = await guidedMode.generate({
      manuscriptText: '她把钥匙按进锁孔，却迟迟没有转动。',
      chapterContext: {
        precedingText: '她把钥匙按进锁孔，却迟迟没有转动。',
        succeedingText: '走廊深处传来缓慢而空洞的回响。',
        chapterSummary: '主角试图进入被封锁的走廊。',
      },
      storyBible: {
        characters: [
          createCharacterProfile({
            id: 'char-1',
            name: '林岚',
            archetype: CharacterArchetype.PROTAGONIST,
            arcStage: 'rising',
            traits: [
              { trait: '谨慎', intensity: 0.8, evidence: '她先听门后的动静。' },
              { trait: '执拗', intensity: 0.9, evidence: '她拒绝后退。' },
            ],
            motivations: ['找到账册'],
            backstory:
              '她自幼在档案馆长大，火灾之后一直在寻找被抹去的家族记录。',
            speechPatterns: ['短句', '压低声音'],
          }),
        ],
        worldRules: [
          createWorldRule({
            id: 'rule-1',
            name: '封印门',
            category: WorldRuleCategory.MAGIC,
            description: '旧档案馆的门会记录最后一个触碰者的血脉气息。',
            constraints: ['必须由亲属开启'],
            exceptions: [],
            impactScope: 'regional',
            relatedEntities: ['char-1'],
          }),
        ],
        plotThreads: [
          createPlotThread({
            id: 'plot-1',
            name: '失踪账册',
            status: PlotThreadStatus.DEVELOPING,
            premise: '账册在火灾后下落不明。',
            goal: '找到账册',
            stakes: '决定审判会的结局。',
          }),
        ],
        timelineEvents: [
          createTimelineEvent({
            id: 'event-1',
            name: '火灾',
            eventType: TimelineEventType.INCIDENT,
            timestamp: 'Night 1',
            chapterRef: 'CH01',
            description: '大火焚毁了下层库房，也抹去了关键证词。',
            emotionalImpact: 'high',
          }),
        ],
      },
      sessionContext: {
        recentEdits: ['加重了走廊的压迫感。'],
        writingStyle: '近距离视角，句子短促，氛围压抑。',
        currentChapter: 'CH05',
        cursorPosition: 18,
      },
      creativityConfig,
    });

    expect(result.mode).toBe('guided');
    expect(result.options).toHaveLength(3);
    expect(result.options[0].overallScore).toBeGreaterThan(result.options[2].overallScore);
    expect(result.options[0].text).toContain('The door creaked open');
    expect(result.options[1].scores).toEqual({
      coherence: 85,
      creativity: 78,
      styleMatch: 82,
    });
    expect(result.metadata).toMatchObject({
      model: 'claude-sonnet-4-6',
      creativityLevel: creativityConfig.value,
    });
    expect(result.metadata.tokenCount).toBeGreaterThan(0);
  });

  it('exposes the factory helper', () => {
    expect(createGuidedMode()).toBeInstanceOf(GuidedMode);
  });
});
