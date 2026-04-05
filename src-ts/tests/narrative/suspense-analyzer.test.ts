import { describe, expect, it, vi } from 'vitest';

import {
  computeSuspenseResult,
  SuspenseAnalyzer,
  SuspensePillar,
} from '../../narrative/suspense-analyzer';

describe('SuspenseAnalyzer', () => {
  it('computes weighted suspense score and level from the three pillars', () => {
    const result = computeSuspenseResult(
      {
        pillar: SuspensePillar.STORY_QUESTION,
        score: 8,
        elements: [],
        issues: [],
        suggestions: [],
      },
      {
        pillar: SuspensePillar.THREAT_SITUATION,
        score: 7,
        elements: [],
        issues: [],
        suggestions: [],
      },
      {
        pillar: SuspensePillar.LIT_FUSE,
        score: 6,
        elements: [],
        issues: [],
        suggestions: [],
      },
    );

    expect(result.overallScore).toBe(70);
    expect(result.suspenseLevel).toBe('HIGH');
    expect(result.suspenseCurve).toEqual([]);
  });

  it('uses deterministic mock results without an llm client and suggests the weakest pillar improvements', async () => {
    const analyzer = new SuspenseAnalyzer();

    const result = await analyzer.analyzeFull(
      '她听见门外有脚步声，却不知道来的人是谁，也不知道自己还能撑多久。',
      { protagonist: '林岚' },
    );

    expect(result.storyQuestions.pillar).toBe(SuspensePillar.STORY_QUESTION);
    expect(result.storyQuestions.elements).toHaveLength(1);
    expect(result.threatSituations.issues).toContain('威胁不够具体');
    expect(result.litFuses.suggestions).toContain('考虑增加deadline元素');
    expect(result.overallScore).toBe(60);
    expect(result.suspenseLevel).toBe('MODERATE');

    const suggestions = analyzer.suggestSuspenseEnhancement(result);

    expect(suggestions).toContain('缺少时限压力，考虑增加导火索元素');
    expect(suggestions).toContain('考虑增加deadline元素');
  });

  it('maps llm json responses into public suspense structures', async () => {
    const llmClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce({
          questions: [
            {
              question: '门外的人是谁？',
              location: '开篇',
              intensity: 8,
            },
          ],
          score: 8,
          issues: ['悬念还可以更早出现'],
          suggestions: ['在第一页埋下更具体的谜团'],
        })
        .mockResolvedValueOnce({
          threats: [
            {
              threat_type: 'physical',
              description: '门锁正在被撬开',
              target_character: '林岚',
              intensity: 9,
            },
          ],
          score: 9,
          issues: [],
          suggestions: ['保持威胁逐步升级'],
        })
        .mockResolvedValueOnce({
          fuses: [
            {
              crisis: '警报即将响起',
              deadline: '三分钟内',
              consequence: '敌人会发现藏身处',
              intensity: 7,
            },
          ],
          score: 7,
          issues: [],
          suggestions: ['在倒计时中加入一次误判'],
        }),
    };
    const analyzer = new SuspenseAnalyzer(llmClient as never);

    const result = await analyzer.analyzeFull(
      '林岚躲在屋里，门外传来撬锁声，警报也快要启动。',
      { protagonist: '林岚' },
    );

    expect(llmClient.generateJson).toHaveBeenCalledTimes(3);
    expect(result.storyQuestions.elements[0]).toMatchObject({
      question: '门外的人是谁？',
      isAnswered: false,
      answerLocation: null,
    });
    expect(result.threatSituations.elements[0]).toMatchObject({
      threatType: 'physical',
      targetCharacter: '林岚',
      isResolved: false,
    });
    expect(result.litFuses.elements[0]).toMatchObject({
      crisis: '警报即将响起',
      deadline: '三分钟内',
      isDefused: false,
    });
    expect(result.overallScore).toBe(81);
    expect(result.suspenseLevel).toBe('HIGH');
  });

  it('falls back to mock scoring when llm analysis fails', async () => {
    const llmClient = {
      generateJson: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    };
    const analyzer = new SuspenseAnalyzer(llmClient as never);

    const result = await analyzer.analyzeFull(
      '她知道时间不多了，但威胁从何而来仍未揭晓。',
      { protagonist: '林岚' },
    );

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(result.storyQuestions.pillar).toBe(SuspensePillar.STORY_QUESTION);
    expect(result.storyQuestions.elements).toHaveLength(1);
    expect(result.litFuses.issues).toContain('缺少时限压力');
    expect(result.suspenseLevel).toBe('MODERATE');
  });

  it('builds suspense curves with scene and intensity fallbacks', () => {
    const analyzer = new SuspenseAnalyzer();

    const curve = analyzer.calculateSuspenseCurve([
      { scene_id: 'scene-1', suspense_intensity: 3.5 },
      {},
      { scene_id: 'scene-3' },
    ]);

    expect(curve).toEqual([
      ['scene-1', 3.5],
      ['unknown', 5],
      ['scene-3', 5],
    ]);
  });
});
