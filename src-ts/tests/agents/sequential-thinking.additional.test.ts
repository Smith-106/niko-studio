import { describe, expect, it } from 'vitest';

import {
  SequentialThinking,
  ThoughtStatus,
  ThoughtType,
  thoughtDataFromDict,
  thoughtDataFromDictProper,
} from '../../agents/sequential-thinking';

describe('SequentialThinking additional coverage', () => {
  it('covers serialization parser defaults and value parsing', () => {
    const legacy = thoughtDataFromDict({
      id: 'legacy-1',
      content: 'legacy thought',
      thought_type: 'HYPOTHESIS',
      status: 'INITIAL',
    });

    expect(legacy).toMatchObject({
      id: 'legacy-1',
      content: 'legacy thought',
      thoughtType: ThoughtType.HYPOTHESIS,
      status: ThoughtStatus.ACTIVE,
      parentId: null,
      branchId: null,
      depth: 0,
      confidence: 1,
      metadata: {},
      revisedBy: null,
    });
    expect(legacy.createdAt).toBeInstanceOf(Date);

    const parsed = thoughtDataFromDictProper({
      id: 'proper-1',
      content: 'proper thought',
      thought_type: 'verification',
      status: 'completed',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(parsed.thoughtType).toBe(ThoughtType.VERIFICATION);
    expect(parsed.status).toBe(ThoughtStatus.COMPLETED);
    expect(parsed.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    const fallback = thoughtDataFromDictProper({
      id: 'fallback-1',
      content: 'fallback thought',
      thought_type: 'unknown',
      status: 123,
    });
    expect(fallback.thoughtType).toBe(ThoughtType.ANALYSIS);
    expect(fallback.status).toBe(ThoughtStatus.ACTIVE);
  });

  it('enforces depth and branch limits', () => {
    const depthLimited = new SequentialThinking(1);
    depthLimited.think('root');
    expect(() => depthLimited.think('too deep')).toThrow('Maximum thought depth');

    const branchLimited = new SequentialThinking(10, 1, false);
    expect(() => branchLimited.branch('Blocked', 'no capacity')).toThrow('Maximum branches');
  });

  it('auto-prunes the lowest-priority branch and skips it in markdown', () => {
    const thinking = new SequentialThinking(10, 3, true);
    thinking.think('main root');

    const low = thinking.branch('Low Priority', 'will be pruned', -10);
    thinking.switchBranch(low.id);
    const lowThought = thinking.think('low branch thought');

    thinking.switchBranch('main');
    thinking.branch('High Priority', 'kept branch', 5);
    thinking.branch('Trigger Prune', 'forces pruning', 1);

    expect(() => thinking.switchBranch(low.id)).toThrow('Cannot switch to abandoned branch');
    expect(thinking.getActiveThoughts().map((thought) => thought.id)).not.toContain(lowThought.id);
    expect(thinking.toMarkdown()).not.toContain('Branch: Low Priority');
  });

  it('invokes callbacks and exports accessors through toDict', () => {
    const thinking = new SequentialThinking();
    const addedThoughts: string[] = [];
    const createdBranches: string[] = [];

    thinking.onThoughtAdded((thought) => addedThoughts.push(thought.id));
    thinking.onBranchCreated((branch) => createdBranches.push(branch.id));

    const thought = thinking.think('callback thought', ThoughtType.INITIAL, 0.75, { source: 'test' });
    const branch = thinking.branch('Callback Branch', 'callback branch', 3);
    const exported = thinking.toDict() as {
      thoughts: Record<string, Record<string, unknown>>;
      branches: Record<string, Record<string, unknown>>;
      current_branch_id: string;
      current_thought_id: string;
    };

    expect(addedThoughts).toEqual([thought.id]);
    expect(createdBranches).toEqual([branch.id]);
    expect(thinking.thoughtCount).toBe(1);
    expect(thinking.branchCount).toBe(2);
    expect(thinking.currentBranchId).toBe('main');
    expect(thinking.currentThoughtId).toBe(thought.id);
    expect(exported.current_branch_id).toBe('main');
    expect(exported.current_thought_id).toBe(thought.id);
    expect(exported.thoughts[thought.id]).toMatchObject({
      thought_type: ThoughtType.INITIAL,
      metadata: { source: 'test' },
    });
    expect(exported.branches[branch.id]).toMatchObject({
      parent_branch_id: 'main',
      fork_point_id: thought.id,
      priority: 3,
    });
  });

  it('covers invalid operations and restores populated branch state', () => {
    const thinking = new SequentialThinking();
    const root = thinking.think('root');
    const branch = thinking.branch('Populated', 'has thoughts');

    expect(() => thinking.switchBranch('missing')).toThrow('Branch missing not found');
    expect(() => thinking.revise('missing', 'new content', 'reason')).toThrow('Thought missing not found');
    expect(() => thinking.backtrack('missing')).toThrow('Thought missing not found');

    thinking.switchBranch(branch.id);
    const first = thinking.think('branch first');
    const second = thinking.think('branch second');

    thinking.switchBranch('main');
    expect(thinking.currentThoughtId).toBe(root.id);

    thinking.switchBranch(branch.id);
    expect(thinking.currentThoughtId).toBe(second.id);
    expect(thinking.getThoughtChain(branch.id).map((thought) => thought.id)).toEqual([first.id, second.id]);
  });

  it('reports conclusions, best branches, and markdown status/type variants', () => {
    const thinking = new SequentialThinking();
    thinking.think('verify candidate', ThoughtType.VERIFICATION, 0.75);

    const branch = thinking.branch('Exploration', 'branch with revision', 2);
    thinking.switchBranch(branch.id);
    const branchThought = thinking.think('branch candidate', ThoughtType.BRANCH, 0.8);
    thinking.revise(branchThought.id, 'revised branch candidate', 'new evidence');
    thinking.backtrack(branchThought.id);
    const conclusion = thinking.conclude('final answer', 1);

    expect(thinking.getConclusions().map((thought) => thought.id)).toEqual([conclusion.id]);
    expect(thinking.getBestBranch().id).toBe(branch.id);

    const markdown = thinking.toMarkdown();
    expect(markdown).toContain('[Verify]');
    expect(markdown).toContain('[Branch]');
    expect(markdown).toContain('[REVISED]');
    expect(markdown).toContain('[ABANDONED]');
    expect(markdown).toContain('[Revision]');
    expect(markdown).toContain('[Backtrack]');
    expect(markdown).toContain('[Conclusion]');
    expect(markdown).toContain('(75%)');
    expect(markdown).not.toContain('(100%)');
  });
});
