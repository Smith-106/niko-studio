import { describe, expect, it } from 'vitest';
import { buildNarrativeVisualizationBundle } from '../../narrative/narrative-visualization.js';

describe('buildNarrativeVisualizationBundle', () => {
  it('builds empty-friendly visualization data', () => {
    const result = buildNarrativeVisualizationBundle({ chapters: [] });

    expect(result.timeline.empty).toBe(true);
    expect(result.tension.empty).toBe(true);
    expect(result.characterGraph.empty).toBe(true);
    expect(result.meta.hasData).toBe(false);
  });

  it('maps chapters, timeline conflicts, and relationships into view DTOs', () => {
    const result = buildNarrativeVisualizationBundle({
      chapters: [
        { content: '第一章冲突爆发。', chapterIndex: 0, chapterNumber: 1, title: '开场' },
        { content: '第二章情绪回落。', chapterIndex: 1, chapterNumber: 2, title: '回落' },
      ],
      timelineReport: {
        totalConflicts: 1,
        criticalCount: 0,
        majorCount: 1,
        minorCount: 0,
        infoCount: 0,
        conflicts: [
          {
            id: 'timeline-1',
            type: 'event_order',
            severity: 'major',
            chaptersInvolved: [2],
            description: '事件顺序冲突',
            evidence: ['第二章先于第一章事件'],
            suggestedFix: '调整顺序',
          },
        ],
        chapterProfiles: [],
        globalTimeline: [],
        consistencyScore: 80,
        summary: 'summary',
        analyzedAt: new Date().toISOString(),
      },
      relationshipGraph: {
        nodes: [
          { id: 'Alice', name: 'Alice', role: 'protagonist' },
          { id: 'Bob', name: 'Bob', role: 'character' },
        ],
        edges: [
          { source: 'Alice', target: 'Bob', type: 'ally', trust: 0.8 },
        ],
      },
    });

    expect(result.timeline.chapters).toHaveLength(2);
    expect(result.timeline.events).toHaveLength(1);
    expect(result.timeline.events[0]?.severity).toBe('major');
    expect(result.tension.points).toHaveLength(2);
    expect(result.characterGraph.nodes).toHaveLength(2);
    expect(result.characterGraph.edges[0]?.weight).toBe(0.8);
    expect(result.meta.hasData).toBe(true);
  });
});
