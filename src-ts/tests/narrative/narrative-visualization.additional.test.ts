import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analyzeEmotionalArcMock = vi.hoisted(() => vi.fn());
const analyzeReaderImmersionMock = vi.hoisted(() => vi.fn());

vi.mock('../../narrative/emotional-arc.js', () => ({
  analyzeEmotionalArc: analyzeEmotionalArcMock,
}));

vi.mock('../../narrative/reader-immersion-engine.js', () => ({
  analyzeReaderImmersion: analyzeReaderImmersionMock,
}));

describe('buildNarrativeVisualizationBundle additional coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T10:00:00.000Z'));
    analyzeEmotionalArcMock.mockReset();
    analyzeReaderImmersionMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('treats omitted chapters as an empty visualization request', async () => {
    analyzeEmotionalArcMock.mockReturnValue({
      timeline: [],
      tensionDeserts: [],
      overallArcScore: 0,
    });
    analyzeReaderImmersionMock.mockReturnValue({
      chapterStates: [],
    });

    const { buildNarrativeVisualizationBundle } = await import('../../narrative/narrative-visualization.js');
    const result = buildNarrativeVisualizationBundle({
      chapters: undefined as never,
    } as never);

    expect(result.timeline.empty).toBe(true);
    expect(result.tension.empty).toBe(true);
    expect(result.characterGraph.empty).toBe(true);
    expect(result.meta).toMatchObject({
      chapterCount: 0,
      hasData: false,
      generatedAt: '2026-06-07T10:00:00.000Z',
    });
  });

  it('fills timeline, tension, and relationship fallbacks for sparse visualization data', async () => {
    analyzeEmotionalArcMock.mockReturnValue({
      timeline: [
        {
          chapterIndex: 0,
          emotionalIntensity: 0.7,
          emotionScore: 8,
          dominantEmotion: '   ',
        },
        {
          chapterIndex: 5,
          emotionalIntensity: 0.2,
          emotionScore: 4,
          dominantEmotion: '',
        },
      ],
      tensionDeserts: ['chapter-6'],
      overallArcScore: 42,
    });
    analyzeReaderImmersionMock.mockReturnValue({
      chapterStates: [],
    });

    const { buildNarrativeVisualizationBundle } = await import('../../narrative/narrative-visualization.js');
    const result = buildNarrativeVisualizationBundle({
      chapters: [
        {
          content: 'Opening beat',
          chapterIndex: 0,
          title: '   ',
        },
      ],
      timelineReport: {
        totalConflicts: 1,
        criticalCount: 0,
        majorCount: 0,
        minorCount: 1,
        infoCount: 0,
        conflicts: [
          {
            id: '',
            type: 'timeline-gap',
            severity: 'minor',
            chaptersInvolved: [],
            description: 'A warning-level gap',
          },
        ],
        chapterProfiles: [],
        globalTimeline: [],
        consistencyScore: 100,
        summary: '',
        analyzedAt: '2026-06-07T10:00:00.000Z',
      },
      characterReport: {
        characterTimelines: new Map(),
      },
      relationshipGraph: {
        nodes: [{ id: 'Hero', name: 'Hero' }],
        edges: [{ source: 'Hero', target: 'Guide' }],
      },
    } as never);

    expect(result.timeline.chapters).toEqual([
      expect.objectContaining({
        chapterId: 'chapter-1',
        chapterNumber: 1,
        title: 'Chapter 1',
        tension: 0.7,
        eventCount: 0,
      }),
    ]);
    expect(result.timeline.events).toEqual([
      expect.objectContaining({
        id: 'timeline-conflict-1',
        chapterIndex: 0,
        chapterNumber: 1,
        type: 'warning',
      }),
    ]);
    expect(result.tension.summary).toContain('Dominant opening emotion: neutral.');
    expect(result.tension.points).toEqual([
      expect.objectContaining({
        chapterId: 'chapter-1',
        title: 'Chapter 1',
      }),
      expect.objectContaining({
        chapterId: 'chapter-6',
        chapterIndex: 5,
        chapterNumber: 6,
        title: 'Chapter 6',
      }),
    ]);
    expect(result.tension.points[0]).not.toHaveProperty('readerState');
    expect(result.characterGraph.nodes).toEqual([
      expect.objectContaining({
        id: 'Hero',
        role: 'character',
        importance: 1,
        chapterCount: 0,
      }),
    ]);
    expect(result.characterGraph.edges).toEqual([
      expect.objectContaining({
        source: 'Hero',
        target: 'Guide',
        type: 'related',
        weight: 0.5,
      }),
    ]);
  });

  it('uses chapter fallbacks when timeline and character reports are omitted', async () => {
    analyzeEmotionalArcMock.mockReturnValue({
      timeline: [],
      tensionDeserts: [],
      overallArcScore: 0,
    });
    analyzeReaderImmersionMock.mockReturnValue({
      chapterStates: [],
    });

    const { buildNarrativeVisualizationBundle } = await import('../../narrative/narrative-visualization.js');
    const result = buildNarrativeVisualizationBundle({
      chapters: [
        {
          content: 'Only chapter',
          chapterIndex: 0,
          title: '   ',
        },
      ],
    });

    expect(result.timeline.empty).toBe(false);
    expect(result.timeline.summary).toBe(
      'Timeline covers 1 chapters with no detected conflicts.',
    );
    expect(result.timeline.chapters).toEqual([
      expect.objectContaining({
        chapterId: 'chapter-1',
        chapterNumber: 1,
        title: 'Chapter 1',
        eventCount: 0,
        tension: 0,
      }),
    ]);
    expect(result.characterGraph.empty).toBe(true);
    expect(result.characterGraph.summary).toBe('No character relationship data available.');
    expect(result.characterGraph.nodes).toEqual([]);
    expect(result.characterGraph.edges).toEqual([]);
  });

  it('aggregates character chapter counts when emotion points are missing', async () => {
    analyzeEmotionalArcMock.mockReturnValue({
      timeline: [],
      tensionDeserts: [],
      overallArcScore: 7,
    });
    analyzeReaderImmersionMock.mockReturnValue({
      chapterStates: [],
    });

    const { buildNarrativeVisualizationBundle } = await import('../../narrative/narrative-visualization.js');
    const result = buildNarrativeVisualizationBundle({
      chapters: [
        {
          content: 'Hero and guide regroup',
          chapterIndex: 2,
        },
      ],
      timelineReport: {
        totalConflicts: 0,
        criticalCount: 0,
        majorCount: 0,
        minorCount: 0,
        infoCount: 0,
        conflicts: [],
        chapterProfiles: [],
        globalTimeline: [],
        consistencyScore: 100,
        summary: '',
        analyzedAt: '2026-06-07T10:00:00.000Z',
      },
      characterReport: {
        characterTimelines: new Map([
          ['hero', [{ characterName: 'Hero', present: true }]],
          ['guide', [{ characterName: 'Guide', present: false }]],
        ]),
      },
      relationshipGraph: {
        nodes: [
          { id: 'Hero', name: 'Hero', role: 'protagonist' },
          { id: 'Guide', name: 'Guide' },
        ],
        edges: [],
      },
    } as never);

    expect(result.timeline.summary).toBe(
      'Timeline covers 1 chapters with no detected conflicts.',
    );
    expect(result.timeline.chapters).toEqual([
      expect.objectContaining({
        chapterId: 'chapter-3',
        chapterIndex: 2,
        chapterNumber: 3,
        title: 'Chapter 3',
        tension: 0,
        eventCount: 0,
      }),
    ]);
    expect(result.characterGraph.nodes).toEqual([
      expect.objectContaining({
        id: 'Hero',
        role: 'protagonist',
        importance: 1,
        chapterCount: 1,
      }),
      expect.objectContaining({
        id: 'Guide',
        role: 'character',
        importance: 0,
        chapterCount: 0,
      }),
    ]);
  });
});
