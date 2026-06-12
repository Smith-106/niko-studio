import { describe, expect, it } from 'vitest';

import { parseJsonSafe } from '../../utils/json.js';

describe('utils/json', () => {
  it('parses JSON with a UTF-8 BOM prefix', () => {
    expect(parseJsonSafe('\uFEFF{"title":"Atlas"}')).toEqual({ title: 'Atlas' });
  });

  it('parses normal JSON unchanged', () => {
    expect(parseJsonSafe('{"count":2}')).toEqual({ count: 2 });
  });
});
