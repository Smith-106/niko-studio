import { describe, expect, it } from 'vitest';

import {
  analyzeWritingSessionIntelligenceCore,
  type WritingSessionTelemetry,
} from '../../analysis/writing-session-intelligence-core.js';

function buildTelemetry(overrides: Partial<WritingSessionTelemetry> = {}): WritingSessionTelemetry {
  return {
    sessionId: 'session-1',
    chapterId: 'chapter-1',
    startedAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:30:00.000Z',
    eventCount: 10,
    activeMinutes: 10,
    saveCount: 2,
    historyPanelOpenCount: 1,
    rewriteCount: 0,
    jumpEditCount: 0,
    recentActions: ['edit', 'save'],
    characterFocus: ['Alice'],
    keywordFocus: ['artifact'],
    ...overrides,
  };
}

describe('analysis/writing-session-intelligence-core', () => {
  it('reports steady progress when no risk signal is present', () => {
    const telemetry = buildTelemetry();

    const result = analyzeWritingSessionIntelligenceCore(telemetry);

    expect(result.telemetry).toBe(telemetry);
    expect(result.clusterName).toBeNull();
    expect(result.insights).toEqual([
      expect.objectContaining({
        pattern: 'steady_progress',
        confidence: 0.78,
      }),
    ]);
  });

  it('detects rewrite loop, stalling, jump editing, and fatigue risk in one session', () => {
    const result = analyzeWritingSessionIntelligenceCore(
      buildTelemetry({
        eventCount: 6,
        activeMinutes: 50,
        saveCount: 0,
        rewriteCount: 7,
        jumpEditCount: 4,
      }),
    );

    expect(result.insights.map((item) => item.pattern)).toEqual([
      'rewrite_loop',
      'stalling',
      'jump_editing',
      'fatigue_risk',
    ]);
    expect(result.insights[0]).toMatchObject({
      pattern: 'rewrite_loop',
      confidence: 1,
    });
    expect(result.insights[1]).toMatchObject({
      pattern: 'stalling',
      confidence: 0.72,
    });
    expect(result.insights[2]).toMatchObject({
      pattern: 'jump_editing',
      confidence: 0.67,
    });
    expect(result.insights[3]).toMatchObject({
      pattern: 'fatigue_risk',
      confidence: 0.68,
    });
  });
});
