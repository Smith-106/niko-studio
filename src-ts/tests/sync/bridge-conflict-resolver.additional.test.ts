import { describe, expect, it } from 'vitest';

import {
  BridgeConflictResolver,
  type ConflictItem,
} from '../../services/sync/bridge-conflict-resolver.js';

function makeConflict(overrides: Partial<ConflictItem> = {}): ConflictItem {
  return {
    type: 'relation_type',
    localId: 'local-1',
    remoteId: 'remote-1',
    localValue: 'mentor',
    remoteValue: 'rival',
    description: 'relation type mismatch',
    ...overrides,
  };
}

describe('BridgeConflictResolver additional coverage', () => {
  it('enqueues relation conflicts and resolves valid manual items only', () => {
    const resolver = new BridgeConflictResolver();

    expect(resolver.resolve(makeConflict({ localId: 'a' }))).toBe('manual');
    resolver.enqueue(makeConflict({ localId: 'b' }));

    const queue = resolver.getPendingConflicts();
    expect(queue.map((item) => item.localId)).toEqual(['a', 'b']);

    resolver.resolveManual(-1, 'local_wins');
    resolver.resolveManual(99, 'remote_wins');
    expect(queue.map((item) => item.localId)).toEqual(['a', 'b']);

    resolver.resolveManual(0, 'local_wins');
    expect(queue.map((item) => item.localId)).toEqual(['b']);
  });

  it('keeps automatic entity and memory resolutions out of the manual queue', () => {
    const resolver = new BridgeConflictResolver();

    expect(resolver.resolve(makeConflict({ type: 'entity_type' }))).toBe('local_wins');
    expect(resolver.resolve(makeConflict({ type: 'memory_content' }))).toBe('remote_wins');
    expect(resolver.getPendingConflicts()).toEqual([]);
  });
});
