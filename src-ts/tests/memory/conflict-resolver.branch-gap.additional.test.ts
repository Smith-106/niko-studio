import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConflictInfo,
  ConflictResolver,
  ConflictType,
  resetConflictResolver,
  type ConflictDbConnection,
  type ConflictEmbedder,
} from '../../memory/conflict-resolver';

function createDbWithRows(rows: unknown[][]): ConflictDbConnection {
  return {
    execute: vi.fn().mockReturnValue({
      fetchAll: () => rows,
    }),
  };
}

function createThrowingEmbedder(): ConflictEmbedder {
  return {
    embed: vi.fn(() => {
      throw new Error('embedding exploded');
    }),
    similarity: vi.fn(() => 0),
  };
}

afterEach(() => {
  resetConflictResolver();
  vi.restoreAllMocks();
});

describe('ConflictResolver branch gap coverage', () => {
  it('defaults missing importance to 0.5 when database rows omit it', async () => {
    const resolver = new ConflictResolver(createDbWithRows([
      ['mem-null-importance', 'The hero is alive', null, null, null],
    ]));

    const conflicts = await resolver.check('The hero is dead', 'entity-1');

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      id: 'mem-null-importance',
      importance: 0.5,
      conflictType: ConflictType.CONTRADICTION,
    });
  });

  it('returns false when subject extraction collapses to empty keyword sets', () => {
    const resolver = new ConflictResolver();
    const shareSubject = (resolver as unknown as {
      _shareSubject: (contentA: string, contentB: string) => boolean;
    })._shareSubject.bind(resolver);

    expect(shareSubject('the and or', 'is was were')).toBe(false);
    expect(shareSubject('1234 !!!', '??? ###')).toBe(false);
  });

  it('falls back from embedding similarity to lexical similarity and handles empty lexical input', () => {
    const resolver = new ConflictResolver();
    resolver.setEmbedder(createThrowingEmbedder());

    const calculateSimilarity = (resolver as unknown as {
      _calculateSimilarity: (contentA: string, contentB: string) => number;
    })._calculateSimilarity.bind(resolver);

    expect(calculateSimilarity('alpha beta', 'alpha gamma')).toBeCloseTo(1 / 3, 5);
    expect(calculateSimilarity('', 'alpha')).toBe(0);
  });

  it('keeps the first highest-importance conflict when merge candidates get less important later', async () => {
    const resolver = new ConflictResolver();
    const conflicts = [
      new ConflictInfo({ id: 'mem-primary', content: 'old content A', importance: 0.9 }),
      new ConflictInfo({ id: 'mem-secondary', content: 'old content B', importance: 0.3 }),
    ];

    const result = await resolver.resolve('new content', conflicts, 'merge' as never);

    expect(result.action).toBe('merge');
    expect(result.mergedContent).toContain('old content A');
    expect(result.mergedContent).not.toContain('old content B\n\n[Updated]');
  });

  it('uses empty-string fallback for missing content during pair scanning', () => {
    const resolver = new ConflictResolver();

    const conflicts = resolver.detectAllConflicts([
      { id: 'm1', content: 'hero is alive' },
      { id: 'm2', content: undefined },
    ]);

    expect(conflicts).toEqual([]);
  });

  it('uses empty-string fallbacks for missing ids when a conflicting pair is emitted', () => {
    const resolver = new ConflictResolver();

    const conflicts = resolver.detectAllConflicts([
      { id: undefined, content: 'The hero is alive' },
      { id: undefined, content: 'The hero is dead' },
    ]);

    expect(conflicts).toEqual([
      ['', '', ConflictType.CONTRADICTION],
    ]);
  });
});
