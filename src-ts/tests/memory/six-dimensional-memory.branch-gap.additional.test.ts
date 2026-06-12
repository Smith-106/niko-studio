import { describe, expect, it } from 'vitest';

import {
  BaseDimensionProcessor,
  CharacterProcessor,
  DimensionType,
} from '../../memory/six-dimensional-memory';

describe('six-dimensional-memory branch gap coverage', () => {
  it('caps generated tags at five matches even when more keywords are present', () => {
    const processor = new BaseDimensionProcessor(DimensionType.CONTEXT, [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
    ]);

    const result = processor.process('alpha beta gamma delta epsilon zeta');

    expect(result.tags).toEqual(['alpha', 'beta', 'gamma', 'delta', 'epsilon']);
  });

  it('extracts speaker names from the second name-pattern capture group', () => {
    const processor = new CharacterProcessor();

    const entities = processor.extractEntities('Near the fire Alice said nothing while Bob asked a question.');

    expect(entities).toEqual(expect.arrayContaining(['Alice', 'Bob']));
  });
});
