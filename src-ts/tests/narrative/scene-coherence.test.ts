import { describe, expect, it, vi } from 'vitest';

import {
  ContradictionType,
  SceneCoherenceDetector,
  SceneSeverity,
} from '../../narrative/scene-coherence';

describe('SceneCoherenceDetector', () => {
  it('detects timeline contradictions from reversed time-of-day progression', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'Night watch',
      '深夜的钟声刚响，林岚仍在档案室翻找线索。',
      1,
      { timeOfDay: 'night' },
      { name: '档案室', type: 'room' },
      ['林岚'],
    );
    detector.createScene(
      'scene-2',
      'Unexpected morning',
      '清晨的阳光已经照进窗台，但文中没有任何跨天说明。',
      2,
      { timeOfDay: 'morning' },
      { name: '档案室', type: 'room' },
      ['林岚'],
    );

    const report = detector.detectAll();

    expect(report.totalContradictions).toBeGreaterThan(0);
    expect(report.timelineIssues.some(issue => issue.type === ContradictionType.TIMELINE)).toBe(true);
  });

  it('detects impossible location transitions when travel time is insufficient', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'City center',
      '下午她还在城中心调查。',
      1,
      { timeOfDay: 'afternoon' },
      { name: '城中心', type: 'district' },
      ['林岚'],
    );
    detector.createScene(
      'scene-2',
      'Distant harbor',
      '几分钟后她已经站在遥远的港口。',
      2,
      { timeOfDay: 'afternoon' },
      { name: '远港', type: 'district', travelTimeFromPrev: '5分钟' },
      ['林岚'],
    );

    detector.setTravelTime('城中心', '远港', '2小时');
    const report = detector.detectAll();

    expect(report.locationIssues.some(issue => issue.type === ContradictionType.LOCATION)).toBe(true);
    expect(report.locationIssues[0]?.severity).toBe(SceneSeverity.CRITICAL);
  });

  it('detects contradictory entity state transitions and reports summary metrics', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'Last stand',
      '林岚的助手阿澈在爆炸中死亡。',
      1,
      { timeOfDay: 'evening' },
      { name: '废弃工厂', type: 'facility' },
      ['阿澈'],
    );
    detector.createScene(
      'scene-2',
      'Alive again',
      '几小时后阿澈却若无其事地说话并走向门口。',
      2,
      { timeOfDay: 'night' },
      { name: '废弃工厂', type: 'facility' },
      ['阿澈'],
    );

    detector.recordState('scene-1', 'char-ache', 'character', '阿澈', { status: 'dead' });
    detector.recordState('scene-2', 'char-ache', 'character', '阿澈', { status: 'alive' });

    const report = detector.detectAll();

    expect(report.stateIssues.some(issue => issue.type === ContradictionType.CHARACTER_STATE)).toBe(true);
    expect(report.criticalCount).toBeGreaterThanOrEqual(1);
    expect(report.coherenceScore).toBeLessThan(100);
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it('returns the mock deep-analysis envelope when llm is unavailable', async () => {
    const detector = new SceneCoherenceDetector();

    const result = await detector.deepAnalysis();

    expect(result).toMatchObject({
      contradictions_found: 2,
      timeline_issues: expect.any(Array),
      location_issues: expect.any(Array),
      state_issues: expect.any(Array),
      suggestions: expect.any(Array),
    });
  });

  it('delegates deep-analysis to llm when a client is configured', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        contradictions_found: 1,
        timeline_issues: ['scene-2 jumps from night to morning without transition'],
        suggestions: ['insert a transition scene'],
      }),
    };
    const detector = new SceneCoherenceDetector(llmClient as never);

    detector.createScene(
      'scene-1',
      'Night watch',
      '深夜的钟声刚响，林岚仍在档案室翻找线索。',
      1,
      { timeOfDay: 'night' },
      { name: '档案室', type: 'room' },
      ['林岚'],
    );

    const result = await detector.deepAnalysis(['scene-1']);

    expect(llmClient.generateJson).toHaveBeenCalledTimes(1);
    expect(llmClient.generateJson.mock.calls[0]?.[0]).toContain('场景1: Night watch');
    expect(result).toMatchObject({
      contradictions_found: 1,
      timeline_issues: ['scene-2 jumps from night to morning without transition'],
      suggestions: ['insert a transition scene'],
    });
  });
});
