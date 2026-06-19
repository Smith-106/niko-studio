import { describe, expect, it } from 'vitest';

import {
  buildDecisionTree,
  buildTrajectoryData,
  buildWorkflowProgress,
  formatAgentTimeline,
  getAgentColor,
  getNodeStatus,
  getStepIcon,
  truncateDraftContent,
} from '../../ui/components/trajectory-viewer.js';

describe('ui/components/trajectory-viewer', () => {
  it('builds trajectory data and step icons with sensible fallbacks', () => {
    const steps = [
      { node: 'plan', action: 'outline', status: 'completed' as const },
      { node: 'draft', action: 'write', status: 'running' as const },
    ];

    expect(buildTrajectoryData(steps)).toEqual({
      title: 'Reasoning Trajectory',
      steps,
    });
    expect(buildTrajectoryData(steps, 'Custom Path').title).toBe('Custom Path');

    expect(getStepIcon('completed')).toBe('check');
    expect(getStepIcon('running')).toBe('loading');
    expect(getStepIcon('failed')).toBe('error');
    expect(getStepIcon('skipped')).toBe('skip');
    expect(getStepIcon('mystery' as never)).toBe('pin');
  });

  it('truncates long draft content and preserves short content', () => {
    expect(truncateDraftContent('short text', 50)).toBe('short text');
    expect(truncateDraftContent('abcdef', 3)).toBe('abc...');
  });

  it('builds workflow progress and node status markers', () => {
    expect(buildWorkflowProgress('draft', ['plan', 'draft', 'review'], ['plan'])).toEqual({
      currentNode: 'draft',
      nodes: ['plan', 'draft', 'review'],
      completedNodes: ['plan'],
      progressRatio: 1 / 3,
    });
    expect(buildWorkflowProgress('idle', [], [])).toEqual({
      currentNode: 'idle',
      nodes: [],
      completedNodes: [],
      progressRatio: 0,
    });

    expect(getNodeStatus('plan', 'draft', ['plan'])).toBe('completed');
    expect(getNodeStatus('draft', 'draft', ['plan'])).toBe('active');
    expect(getNodeStatus('review', 'draft', ['plan'])).toBe('pending');
  });

  it('formats agent timelines, agent colors, and decision trees', () => {
    const events = Array.from({ length: 12 }, (_, index) => ({
      agent: `Agent-${index}`,
      action: `action-${index}`,
    }));

    expect(formatAgentTimeline(events)).toHaveLength(10);
    expect(formatAgentTimeline(events, 3).map((event) => event.action)).toEqual([
      'action-11',
      'action-10',
      'action-9',
    ]);

    expect(getAgentColor('Architect')).toBe('blue');
    expect(getAgentColor('Writer')).toBe('green');
    expect(getAgentColor('Critic')).toBe('red');
    expect(getAgentColor('Commander')).toBe('purple');
    expect(getAgentColor('Human')).toBe('yellow');
    expect(getAgentColor('Unknown')).toBe('gray');

    expect(
      buildDecisionTree({
        question: 'Choose a path',
        options: ['A', 'B'],
        selected: 'B',
        reason: 'higher confidence',
      }),
    ).toEqual({
      question: 'Choose a path',
      options: [
        { label: 'A', isSelected: false },
        { label: 'B', isSelected: true },
      ],
      reason: 'higher confidence',
    });
    expect(
      buildDecisionTree({
        question: 'Fallback?',
        options: ['yes'],
        selected: 'yes',
      }).reason,
    ).toBeNull();
  });
});
