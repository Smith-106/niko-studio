import { describe, expect, it } from 'vitest';

import {
  ContradictionType,
  SceneCoherenceDetector,
  SceneSeverity,
} from '../../narrative/scene-coherence';

describe('SceneCoherenceDetector tail additional coverage', () => {
  it('flags explicit time-of-day regression between adjacent scenes', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'Late briefing',
      'The team wraps up at night.',
      1,
      { timeOfDay: 'evening' },
    );
    detector.createScene(
      'scene-2',
      'Too early',
      'Everyone is somehow back in the morning.',
      2,
      { timeOfDay: 'morning' },
    );

    const issues = detector.detectTimelineContradictions();

    expect(issues).toEqual([
      expect.objectContaining({
        type: ContradictionType.TIMELINE,
        severity: SceneSeverity.MAJOR,
        sceneA: 'scene-1',
        sceneB: 'scene-2',
        actualValue: 'evening -> morning',
      }),
    ]);
  });

  it('uses relativeTime as the fallback interval for location contradictions', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'Archive',
      'The search starts in the archive.',
      1,
      { timeOfDay: 'morning' },
      { name: 'Archive', type: 'room' },
    );
    detector.createScene(
      'scene-2',
      'Harbor',
      'They somehow reach the harbor almost instantly.',
      2,
      { timeOfDay: 'morning', relativeTime: '10 minutes' },
      { name: 'Harbor', type: 'dock' },
    );
    detector.setTravelTime('Archive', 'Harbor', '2 hours');

    const issues = detector.detectLocationContradictions();

    expect(issues).toEqual([
      expect.objectContaining({
        type: ContradictionType.LOCATION,
        severity: SceneSeverity.CRITICAL,
        actualValue: '10 minutes',
      }),
    ]);
  });

  it('evaluates non-transfer intermediate events before reporting missing object transfers', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'Owner one',
      'Lin holds the archive key.',
      1,
      { timeOfDay: 'morning' },
      { name: 'Archive', type: 'room' },
    );
    const middle = detector.createScene(
      'scene-2',
      'Busy hallway',
      'People move around but never hand over the item.',
      2,
      { timeOfDay: 'afternoon' },
      { name: 'Hallway', type: 'room' },
    );
    middle.events.push('moved through the corridor');
    detector.createScene(
      'scene-3',
      'Owner two',
      'Qiao now has the same key.',
      3,
      { timeOfDay: 'evening' },
      { name: 'Tower', type: 'room' },
    );

    detector.recordState('scene-1', 'obj-key', 'object', 'Key', {
      owner: 'Lin',
    });
    detector.recordState('scene-3', 'obj-key', 'object', 'Key', {
      owner: 'Qiao',
    });

    const issues = detector.validateObjectTracking('obj-key');

    expect(issues).toEqual([
      expect.objectContaining({
        type: ContradictionType.OBJECT_STATE,
        severity: SceneSeverity.MAJOR,
        sceneA: 'scene-1',
        sceneB: 'scene-3',
      }),
    ]);
  });

  it('detects revived characters after a recorded death state', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene('scene-1', 'Death', 'Lin dies here.', 1);
    detector.createScene('scene-2', 'Return', 'Lin is alive again.', 2);
    detector.recordState('scene-1', 'char-lin', 'character', 'Lin', {
      status: 'dead',
    });
    detector.recordState('scene-2', 'char-lin', 'character', 'Lin', {
      status: 'alive',
    });

    const report = detector.detectAll();

    expect(report.stateIssues).toEqual([
      expect.objectContaining({
        type: ContradictionType.CHARACTER_STATE,
        severity: SceneSeverity.CRITICAL,
        entityInvolved: 'Lin',
        expectedValue: 'dead',
        actualValue: 'alive',
      }),
    ]);
  });

  it('sorts scenes before deep analysis and forwards the prompt to the llm client', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({ ok: true }),
    };
    const detector = new SceneCoherenceDetector(llmClient as never);

    detector.createScene('scene-2', 'Second', 'Second body', 2);
    detector.createScene('scene-1', 'First', 'First body', 1);

    const result = await detector.deepAnalysis(['scene-2', 'scene-1']);

    expect(result).toEqual({ ok: true });
    expect(llmClient.generateJson).toHaveBeenCalledWith(
      expect.stringContaining('场景1: First'),
    );
    expect(llmClient.generateJson).toHaveBeenCalledWith(
      expect.not.stringContaining('场景2: Second\nSecond body\n\n---\n\n场景1: First'),
    );
  });
});
