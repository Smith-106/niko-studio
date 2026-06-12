import { describe, expect, it } from 'vitest';

import {
  SequentialThinking,
  ThoughtStatus,
  ThoughtType,
  thoughtDataFromDictProper,
} from '../../agents/sequential-thinking';

type SequentialThinkingInternals = SequentialThinking & {
  _branches: Map<string, {
    id: string;
    name: string;
    description: string;
    parentBranchId: string | null;
    forkPointId: string | null;
    status: ThoughtStatus;
    priority: number;
    thoughts: string[];
  }>;
  _thoughts: Map<string, {
    id: string;
    content: string;
    thoughtType: ThoughtType | string;
    status: ThoughtStatus | string;
    parentId: string | null;
    branchId: string | null;
    depth: number;
    confidence: number;
    metadata: Record<string, unknown>;
    createdAt: Date;
    revisedBy: string | null;
  }>;
  _pruneLowestPriorityBranch(): void;
};

describe('SequentialThinking branch gap coverage', () => {
  it('defaults missing serialized status to active', () => {
    const parsed = thoughtDataFromDictProper({
      id: 'missing-status',
      content: 'fallback status',
      thought_type: 'analysis',
    });

    expect(parsed.status).toBe(ThoughtStatus.ACTIVE);
  });

  it('returns early when pruning has no active non-main branches', () => {
    const thinking = new SequentialThinking() as SequentialThinkingInternals;

    thinking._pruneLowestPriorityBranch();

    expect(thinking.branchCount).toBe(1);
    expect(thinking.getBestBranch().id).toBe('main');
  });

  it('replaces the current lowest branch when a later branch has lower priority', () => {
    const thinking = new SequentialThinking(10, 5, true) as SequentialThinkingInternals;
    thinking.think('root');

    const high = thinking.branch('High', 'higher priority', 5);
    const low = thinking.branch('Low', 'lower priority', -2);

    thinking._pruneLowestPriorityBranch();

    expect(thinking._branches.get(high.id)?.status).toBe(ThoughtStatus.ACTIVE);
    expect(thinking._branches.get(low.id)?.status).toBe(ThoughtStatus.ABANDONED);
  });

  it('returns an empty chain for a missing branch id', () => {
    const thinking = new SequentialThinking();

    expect(thinking.getThoughtChain('missing-branch')).toEqual([]);
  });

  it('includes completed conclusions in conclusion queries', () => {
    const thinking = new SequentialThinking() as SequentialThinkingInternals;
    const conclusion = thinking.conclude('done', 1);

    thinking._thoughts.get(conclusion.id)!.status = ThoughtStatus.COMPLETED;

    expect(thinking.getConclusions().map((thought) => thought.id)).toEqual([conclusion.id]);
  });

  it('scores an active branch with no thoughts using zero average confidence', () => {
    const thinking = new SequentialThinking();

    expect(thinking.getBestBranch().id).toBe('main');
  });

  it('skips missing thoughts and falls back for unknown markdown labels and icons', () => {
    const thinking = new SequentialThinking() as SequentialThinkingInternals;
    const thought = thinking.think('odd formatting', ThoughtType.ANALYSIS, 1);
    const main = thinking._branches.get('main')!;

    main.thoughts.push('missing-thought-id');
    thinking._thoughts.get(thought.id)!.status = 'mystery-status';
    thinking._thoughts.get(thought.id)!.thoughtType = 'mystery-type';

    const markdown = thinking.toMarkdown();

    expect(markdown).toContain('[?]  odd formatting');
    expect(markdown).not.toContain('missing-thought-id');
  });
});
