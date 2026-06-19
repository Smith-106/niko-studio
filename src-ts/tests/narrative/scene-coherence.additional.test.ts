import { describe, expect, it, vi } from 'vitest';

import {
  ContradictionType,
  SceneCoherenceDetector,
  SceneSeverity,
} from '../../narrative/scene-coherence';

describe('SceneCoherenceDetector additional coverage', () => {
  it('tracks scenes, ordering, defaults, and recorded entity states', () => {
    const detector = new SceneCoherenceDetector();

    const second = detector.createScene('scene-2', 'Second', 'Second scene', 2);
    const first = detector.createScene(
      'scene-1',
      'First',
      'Morning scene',
      1,
      { timeOfDay: 'morning', duration: '10 minutes' },
      { name: 'Archive', type: 'room' },
      ['char-1'],
      ['obj-1'],
    );

    const snapshot = detector.recordState(
      'scene-1',
      'char-1',
      'character',
      'Lin',
      { status: 'alive' },
    );

    expect(second.timeMarker).toBeNull();
    expect(second.locationMarker).toBeNull();
    expect(second.characters).toEqual([]);
    expect(second.objects).toEqual([]);

    expect(detector.getScene('scene-1')).toMatchObject(first);
    expect(detector.getOrderedScenes().map((scene) => scene.id)).toEqual([
      'scene-1',
      'scene-2',
    ]);
    expect(detector.getEntityStates('char-1')).toEqual([snapshot]);
    expect(detector.getEntityStates('missing')).toEqual([]);
    expect(detector.getScene('scene-1')?.stateSnapshots).toEqual([snapshot]);
  });

  it('returns a clean report when there are no scenes', () => {
    const detector = new SceneCoherenceDetector();

    const report = detector.detectAll();

    expect(report.totalScenes).toBe(0);
    expect(report.totalContradictions).toBe(0);
    expect(report.coherenceScore).toBe(100);
    expect(report.summary).toContain('未检测到矛盾');
  });

  it('reports content-based timeline contradictions without a day-change indicator', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene('scene-1', 'Late night', '深夜的雨还在下。', 1);
    detector.createScene('scene-2', 'Too early', '清晨的钟声忽然响起，却没有任何跨天说明。', 2);

    const report = detector.detectAll();

    expect(
      report.timelineIssues.some(
        (issue) =>
          issue.type === ContradictionType.TIMELINE &&
          issue.severity === SceneSeverity.MINOR,
      ),
    ).toBe(true);
  });

  it('flags sudden character reappearance after multiple missing scenes', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'Start',
      'Lin appears in the archive.',
      1,
      { timeOfDay: 'morning' },
      { name: 'Archive', type: 'room' },
      ['char-lin'],
    );
    detector.createScene(
      'scene-2',
      'Middle one',
      'Other people search the station.',
      2,
      { timeOfDay: 'afternoon' },
      { name: 'Station', type: 'room' },
      [],
    );
    detector.createScene(
      'scene-3',
      'Middle two',
      'No sign of Lin here either.',
      3,
      { timeOfDay: 'evening' },
      { name: 'Street', type: 'road' },
      [],
    );
    detector.createScene(
      'scene-4',
      'Middle three',
      'The team keeps moving without Lin.',
      4,
      { timeOfDay: 'night' },
      { name: 'Harbor', type: 'dock' },
      [],
    );
    detector.createScene(
      'scene-5',
      'Return',
      'Lin suddenly returns in another district.',
      5,
      { timeOfDay: 'morning' },
      { name: 'Tower', type: 'building' },
      ['char-lin'],
    );

    detector.recordState('scene-1', 'char-lin', 'character', 'Lin', {
      status: 'alive',
    });
    detector.recordState('scene-5', 'char-lin', 'character', 'Lin', {
      status: 'alive',
    });

    const issues = detector.validateCharacterPresence('char-lin');

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: ContradictionType.CHARACTER_STATE,
      severity: SceneSeverity.MINOR,
      sceneA: 'scene-1',
      sceneB: 'scene-5',
      entityInvolved: 'Lin',
    });
  });

  it('flags object ownership changes without transfer scenes and ignores explicit transfers', () => {
    const withoutTransfer = new SceneCoherenceDetector();

    withoutTransfer.createScene(
      'scene-1',
      'Key owner one',
      'The key starts with Lin.',
      1,
      { timeOfDay: 'morning' },
      { name: 'Archive', type: 'room' },
    );
    withoutTransfer.createScene(
      'scene-2',
      'Nothing happens',
      'No transfer is described here.',
      2,
      { timeOfDay: 'afternoon' },
      { name: 'Hall', type: 'room' },
    );
    withoutTransfer.createScene(
      'scene-3',
      'Key owner two',
      'Now Qiao has the key.',
      3,
      { timeOfDay: 'evening' },
      { name: 'Tower', type: 'room' },
    );
    withoutTransfer.recordState('scene-1', 'obj-key', 'object', 'Key', {
      owner: 'Lin',
    });
    withoutTransfer.recordState('scene-3', 'obj-key', 'object', 'Key', {
      owner: 'Qiao',
    });

    const missingTransferIssues = withoutTransfer.validateObjectTracking('obj-key');

    expect(missingTransferIssues).toHaveLength(1);
    expect(missingTransferIssues[0]).toMatchObject({
      type: ContradictionType.OBJECT_STATE,
      severity: SceneSeverity.MAJOR,
      expectedValue: '所有权转移事件',
      actualValue: '无转移记录',
    });

    const withTransfer = new SceneCoherenceDetector();

    withTransfer.createScene(
      'scene-1',
      'Key owner one',
      'The key starts with Lin.',
      1,
      { timeOfDay: 'morning' },
      { name: 'Archive', type: 'room' },
    );
    const transferScene = withTransfer.createScene(
      'scene-2',
      'Transfer',
      'Lin gives the key away.',
      2,
      { timeOfDay: 'afternoon' },
      { name: 'Hall', type: 'room' },
    );
    transferScene.events.push('交给 Qiao');
    withTransfer.createScene(
      'scene-3',
      'Key owner two',
      'Now Qiao has the key.',
      3,
      { timeOfDay: 'evening' },
      { name: 'Tower', type: 'room' },
    );
    withTransfer.recordState('scene-1', 'obj-key', 'object', 'Key', {
      owner: 'Lin',
    });
    withTransfer.recordState('scene-3', 'obj-key', 'object', 'Key', {
      owner: 'Qiao',
    });

    expect(withTransfer.validateObjectTracking('obj-key')).toEqual([]);
  });

  it('returns an error when deepAnalysis has no matching scenes for the llm path', async () => {
    const llmClient = {
      generateJson: vi.fn(),
    };
    const detector = new SceneCoherenceDetector(llmClient as never);

    const result = await detector.deepAnalysis(['missing-scene']);

    expect(result).toEqual({ error: 'No scenes to analyze' });
    expect(llmClient.generateJson).not.toHaveBeenCalled();
  });

  it('detects causality contradictions and exports analysis data', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'Death',
      '阿明死亡在雨巷里。',
      1,
      { timeOfDay: 'night' },
      { name: 'Rain Alley', type: 'street' },
      ['阿明'],
    );
    detector.createScene(
      'scene-2',
      'Impossible return',
      '阿明说道自己还要继续行动。',
      2,
      { timeOfDay: 'morning' },
      { name: 'Clock Tower', type: 'building', travelTimeFromPrev: '5 minutes' },
      ['阿明'],
    );
    detector.createScene(
      'scene-3',
      'Reversed event order',
      '他离开码头后才到达码头。',
      3,
      { timeOfDay: 'afternoon' },
      { name: 'Harbor', type: 'dock' },
    );

    detector.setTravelTime('Rain Alley', 'Clock Tower', '2 hours');
    detector.recordState('scene-1', 'obj-relic', 'object', 'Relic', {
      destroyed: true,
    });
    detector.recordState('scene-2', 'obj-relic', 'object', 'Relic', {
      exists: true,
    });

    const report = detector.detectAll();
    const exported = detector.exportData();

    expect(
      report.contradictions.some(
        (issue) =>
          issue.type === ContradictionType.CAUSALITY &&
          issue.severity === SceneSeverity.CRITICAL,
      ),
    ).toBe(true);
    expect(
      report.contradictions.some(
        (issue) =>
          issue.type === ContradictionType.CAUSALITY &&
          issue.severity === SceneSeverity.MAJOR,
      ),
    ).toBe(true);
    expect(
      report.stateIssues.some(
        (issue) => issue.type === ContradictionType.OBJECT_STATE,
      ),
    ).toBe(true);
    expect(
      report.locationIssues.some(
        (issue) => issue.type === ContradictionType.LOCATION,
      ),
    ).toBe(true);
    expect(report.summary.length).toBeGreaterThan(0);

    expect(exported).toMatchObject({
      scenes: expect.objectContaining({
        'scene-1': expect.objectContaining({ title: 'Death' }),
      }),
      stateRegistry: expect.objectContaining({
        'obj-relic': expect.any(Array),
      }),
      locationGraph: expect.objectContaining({
        'Rain Alley': expect.objectContaining({
          'Clock Tower': '2 hours',
        }),
      }),
      contradictions: expect.any(Array),
      exportedAt: expect.any(String),
    });
  });
});
