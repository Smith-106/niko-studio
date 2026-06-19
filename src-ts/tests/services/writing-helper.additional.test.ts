import { describe, expect, it } from 'vitest';

import { processWritingHelper } from '../../services/writing-helper';

describe('processWritingHelper - additional coverage', () => {
  it('returns empty text when expand input has no sentences after normalization', () => {
    const result = processWritingHelper({
      content: ' \n\t\r\n ',
      mode: 'expand',
    });

    expect(result.processed_text).toBe('');
    expect(result.stats).toMatchObject({
      output_chars: 0,
    });
  });

  it('coerces non-string instructions to an empty string before polishing', () => {
    const result = processWritingHelper({
      content: 'Actually, this still works.',
      mode: 'polish',
      instruction: null as unknown as string,
    });

    expect(result.mode).toBe('polish');
    expect(result.processed_text).toContain('Actually');
  });
});
