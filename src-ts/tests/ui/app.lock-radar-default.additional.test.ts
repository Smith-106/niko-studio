import { describe, expect, it } from 'vitest';

import { LockRadar } from '../../ui/app.js';

describe('ui/app LockRadar defaults', () => {
  it('falls back to zeroed LOCK scores when no scores are provided', () => {
    const radar = new LockRadar();

    expect(radar.getPoints()).toEqual([
      { label: 'Lead', value: 0, maxValue: 10, angle: 0, color: '#3b82f6' },
      { label: 'Objective', value: 0, maxValue: 10, angle: 90, color: '#8b5cf6' },
      { label: 'Confrontation', value: 0, maxValue: 10, angle: 180, color: '#ef4444' },
      { label: 'Knockout', value: 0, maxValue: 10, angle: 270, color: '#f59e0b' },
    ]);
    expect(radar.getOverallScore()).toBe(0);
    expect(radar.getMaxScore()).toBe(40);
    expect(radar.getGrade()).toBe('F');
  });
});
