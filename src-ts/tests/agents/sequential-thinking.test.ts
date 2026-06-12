import { describe, expect, it } from 'vitest';

import {
  thoughtDataFromDict,
  thoughtDataFromDictProper,
  thoughtDataToDict,
  SequentialThinking,
  ThoughtStatus,
  ThoughtType,
} from '../../agents/sequential-thinking';

describe('SequentialThinking', () => {
  it('roundtrips thought serialization in value form', () => {
    const thought = {
      id: 'thought-1',
      content: '分析问题',
      thoughtType: ThoughtType.ANALYSIS,
      status: ThoughtStatus.ACTIVE,
      parentId: null,
      branchId: 'main',
      depth: 0,
      confidence: 0.8,
      metadata: { step: 1 },
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      revisedBy: null,
    };

    const roundtrip = thoughtDataFromDict(thoughtDataToDict(thought));

    expect(roundtrip).toMatchObject({
      id: 'thought-1',
      content: '分析问题',
      thoughtType: ThoughtType.ANALYSIS,
      status: ThoughtStatus.ACTIVE,
      branchId: 'main',
      depth: 0,
      confidence: 0.8,
    });
  });

  it('falls back to active status and analysis type for unknown serialized values', () => {
    const parsed = thoughtDataFromDictProper({
      id: 'thought-unknown',
      content: 'fallback',
      thought_type: 'not-a-real-type',
      status: 'not-a-real-status',
      created_at: '2026-04-04T00:00:00.000Z',
    });

    expect(parsed.thoughtType).toBe(ThoughtType.ANALYSIS);
    expect(parsed.status).toBe(ThoughtStatus.ACTIVE);
  });

  it('builds thoughts on the main branch and exposes active thought chains', () => {
    const thinking = new SequentialThinking();

    const initial = thinking.think('先建立问题边界', ThoughtType.INITIAL);
    const analysis = thinking.think('再分析约束条件', ThoughtType.ANALYSIS, 0.9);

    expect(initial.branchId).toBe('main');
    expect(analysis.parentId).toBe(initial.id);
    expect(analysis.depth).toBe(1);
    expect(thinking.getThoughtChain().map((item) => item.id)).toEqual([
      initial.id,
      analysis.id,
    ]);
    expect(thinking.getActiveThoughts().map((item) => item.id)).toContain(analysis.id);
  });

  it('creates branches, switches between them, and supports revision or backtrack flows', () => {
    const thinking = new SequentialThinking();

    const initial = thinking.think('建立主线思路', ThoughtType.INITIAL);
    const branch = thinking.branch('Alternative', '探索备选方案', 2);
    thinking.switchBranch(branch.id);
    const branchThought = thinking.think('尝试另一种假设', ThoughtType.BRANCH);
    const revised = thinking.revise(branchThought.id, '修正后的假设', '补充证据');

    expect(branch.parentBranchId).toBe('main');
    expect(branch.forkPointId).toBe(initial.id);
    expect(revised.thoughtType).toBe(ThoughtType.REVISION);
    expect(revised.metadata).toMatchObject({
      revises: branchThought.id,
      reason: '补充证据',
    });

    thinking.backtrack(branchThought.id);

    expect(thinking.getThoughtChain(branch.id).map((item) => item.id)).toContain(branchThought.id);
    expect(thinking.getActiveThoughts().some((item) => item.thoughtType === ThoughtType.BACKTRACK)).toBe(
      true,
    );
  });

  it('exports state to markdown and resets back to a clean main branch', () => {
    const thinking = new SequentialThinking();
    thinking.think('梳理现状', ThoughtType.INITIAL);
    thinking.think('提出假设', ThoughtType.HYPOTHESIS, 0.6);

    const markdown = thinking.toMarkdown();

    expect(markdown).toContain('# Sequential Thinking Chain');
    expect(markdown).toContain('[Initial]');
    expect(markdown).toContain('(60%)');

    thinking.reset();

    expect(thinking.getThoughtChain()).toEqual([]);
    expect(thinking.getActiveThoughts()).toEqual([]);
  });

  it('falls back to the main branch when no active branches remain', () => {
    const thinking = new SequentialThinking() as SequentialThinking & {
      _branches: Map<string, { status: ThoughtStatus }>;
    };

    for (const branch of thinking._branches.values()) {
      branch.status = ThoughtStatus.COMPLETED;
    }

    expect(thinking.getBestBranch().id).toBe('main');
  });
});
