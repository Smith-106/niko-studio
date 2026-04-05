import { describe, expect, it } from 'vitest';

import { scoreToLevel, severityOrder } from '../../narrative/types';

describe('narrative/types', () => {
  it('maps numeric scores into the documented level buckets', () => {
    expect(scoreToLevel(95)).toBe('excellent');
    expect(scoreToLevel(90)).toBe('excellent');
    expect(scoreToLevel(89)).toBe('good');
    expect(scoreToLevel(75)).toBe('good');
    expect(scoreToLevel(60)).toBe('fair');
    expect(scoreToLevel(40)).toBe('poor');
    expect(scoreToLevel(39)).toBe('critical');
  });

  it('orders severities from most severe to least severe with a stable fallback', () => {
    expect(severityOrder('critical')).toBe(0);
    expect(severityOrder('major')).toBe(1);
    expect(severityOrder('minor')).toBe(2);
    expect(severityOrder('info')).toBe(3);
    expect(severityOrder('unknown')).toBe(3);
  });
});
