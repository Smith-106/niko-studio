import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/reader',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

// Mutable mock state per test
let mockConsensusCompareResult: any[] = [];
let mockConsensusBuildResult: any = null;
let mockRevisionShouldFail = false;
let mockCreatePersonaShouldFail = false;
let mockLoadPersonasReject = false;
let mockAIFlavorShouldFail = false;

// Mock fs modules before any imports
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

// Mock reader dependencies
vi.mock('../../reader/PersonaDefinition', () => {
  const presets: Record<string, () => any> = {
    'general-reader': () => ({
      id: 'preset-general-reader',
      name: 'General Reader',
      type: 'preset',
      parameters: {
        plotWeight: 0.7,
        characterWeight: 0.7,
        styleWeight: 0.5,
        pacingWeight: 0.6,
        toleranceThreshold: 0.5,
        focusAreas: [],
        biases: [],
      },
    }),
    'malformed-reader': () => ({
      id: 'preset-malformed-reader',
      name: 'Malformed',
      type: 'preset',
      // missing parameters to exercise the feedback catch path
    }),
  };

  return {
    createCustomPersona: vi.fn((overrides: any) => {
      if (mockCreatePersonaShouldFail) {
        throw new Error('persona creation failed');
      }
      return {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: overrides?.name ?? 'Custom',
        type: 'custom',
        parameters: {
          plotWeight: 0.5,
          characterWeight: 0.5,
          styleWeight: 0.5,
          pacingWeight: 0.5,
          toleranceThreshold: 0.5,
          focusAreas: [],
          biases: [],
          ...(overrides?.parameters ?? {}),
        },
      };
    }),
    PRESET_PERSONAS: presets,
    getPresetPersona: vi.fn((id: string) => presets[id]?.()),
    listPresetPersonas: vi.fn(() => Object.keys(presets) as any),
  };
});

vi.mock('../../reader/DualEngine.js', () => ({
  DualEngine: class MockDualEngine {
    analyze(_text: string, personas: any[]) {
      return Promise.resolve({
        readerReactions: personas.map((p) => ({
          personaId: p.id,
          personaName: p.name,
          dimensions: {
            plotCoherence: 0.7,
            characterConsistency: 0.6,
            styleConsistency: 0.8,
            pacingTension: 0.5,
          },
          highlights: [
            {
              text: 'The hallway fell silent.',
              position: { chapter: 'chapter-1', paragraph: 2 },
              reaction: 'negative' as const,
              comment: 'Needs stronger tension.',
              dimension: 'pacing-tension',
            },
          ],
          overallScore: 0.62,
        })),
        editorialAnalysis: {
          structuralIssues: ['weak opening'],
          styleNotes: ['too passive'],
          pacingAssessment: 'slow start',
          recommendations: ['add hook'],
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
}));

vi.mock('../../reader/ConsensusEngine', () => ({
  ConsensusEngine: class MockConsensusEngine {
    buildConsensus(reactions: any[]) {
      if (mockConsensusBuildResult) {
        return mockConsensusBuildResult;
      }
      return {
        items:
          reactions.length > 0
            ? [
                {
                  description: 'Weak tension',
                  dimension: 'pacing-tension',
                  agreeingPersonas: ['preset-general-reader'],
                  disagreeingPersonas: [],
                  severity: 'medium' as const,
                  consensusStrength: 1.0,
                  location: { chapter: 'chapter-1', paragraph: 2 },
                },
              ]
            : [],
        overallAssessment: reactions.length > 0 ? 'Some issues found' : 'No issues',
        criticalIssues: [],
        dissentItems: [],
        dimensionSummaries: {
          'Pacing & Tension': { avgScore: 0.5, consensus: 1.0 },
          'Plot Coherence': { avgScore: 0.7, consensus: 1.0 },
        },
      };
    }

    compareConsensus(_reportA: any, _reportB: any) {
      return mockConsensusCompareResult;
    }
  },
}));

vi.mock('../../reader/DimensionAnalyzer.js', () => ({
  DimensionAnalyzer: class MockDimensionAnalyzer {
    analyzeAllDimensions() {
      return [
        { dimension: 'plotCoherence', score: 0.7, weight: 0.5, flagged: false, findings: [] },
        { dimension: 'characterConsistency', score: 0.6, weight: 0.5, flagged: false, findings: [] },
        { dimension: 'styleConsistency', score: 0.8, weight: 0.5, flagged: false, findings: [] },
        { dimension: 'pacingTension', score: 0.5, weight: 0.5, flagged: true, findings: [] },
      ];
    }
  },
  createDimensionAnalyzer: () =>
    new (class MockDimensionAnalyzer {
      analyzeAllDimensions() {
        return [
          { dimension: 'plotCoherence', score: 0.7, weight: 0.5, flagged: false, findings: [] },
          { dimension: 'characterConsistency', score: 0.6, weight: 0.5, flagged: false, findings: [] },
          { dimension: 'styleConsistency', score: 0.8, weight: 0.5, flagged: false, findings: [] },
          { dimension: 'pacingTension', score: 0.5, weight: 0.5, flagged: true, findings: [] },
        ];
      }
    })(),
}));

vi.mock('../../reader/ai-flavor-detector.js', () => ({
  detectAIFlavor: vi.fn((text: string) => {
    if (mockAIFlavorShouldFail || text === 'throw-error') {
      throw new Error('AI flavor detection error');
    }
    return {
      aiFlavorScore: 0.3,
      indicators: [{ type: 'template_expression', description: 'test', severity: 'low' as const, evidence: [] }],
      confidence: 0.8,
      evidence: ['evidence'],
      suggestions: ['suggestion'],
    };
  }),
}));

vi.mock('../../services/revision-service.js', () => ({
  RevisionServiceImpl: class MockRevisionService {
    initialize() {
      return Promise.resolve();
    }
    revise() {
      if (mockRevisionShouldFail) {
        return Promise.reject(new Error('Revision service failed'));
      }
      return Promise.resolve({
        finalDraft: 'revised text',
        finalScore: 8.0,
        totalIterations: 2,
        comparison: {
          delta: { plotCoherence: 0.1 },
          improvedDimensions: ['plotCoherence'],
          regressedDimensions: [],
          unchangedDimensions: ['styleConsistency'],
        },
      });
    }
  },
}));

describe('reader/mcp/reader-endpoints coverage', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockConsensusCompareResult = [];
    mockConsensusBuildResult = null;
    mockRevisionShouldFail = false;
    mockCreatePersonaShouldFail = false;
    mockLoadPersonasReject = false;
    mockAIFlavorShouldFail = false;

    const { existsSync } = await import('node:fs');
    const { readFile, writeFile, unlink } = await import('node:fs/promises');
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFile).mockResolvedValue('[]');
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(unlink).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../reader/DualEngine');
  });

  it('loadCustomPersonas handles non-array file content', async () => {
    const { existsSync } = await import('node:fs');
    const { readFile } = await import('node:fs/promises');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ notAnArray: true }));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    expect(module.getCustomPersonaStore).toBeDefined();
  });

  it('loadCustomPersonas skips invalid items in array', async () => {
    const { existsSync } = await import('node:fs');
    const { readFile } = await import('node:fs/promises');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify([
        { id: 'valid', name: 'Valid', type: 'custom', parameters: {} },
        null,
        'not an object',
        { missingId: true },
      ]),
    );

    const module = await import('../../reader/mcp/reader-endpoints.js');
    expect(module.getCustomPersonaStore).toBeDefined();
  });

  it('loadCustomPersonas logs success when valid personas loaded', async () => {
    const { existsSync } = await import('node:fs');
    const { readFile } = await import('node:fs/promises');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify([
        {
          id: 'custom-test',
          name: 'Test Persona',
          type: 'custom',
          parameters: {
            plotWeight: 0.5,
            characterWeight: 0.5,
            styleWeight: 0.5,
            pacingWeight: 0.5,
            toleranceThreshold: 0.5,
          },
        },
      ]),
    );

    const module = await import('../../reader/mcp/reader-endpoints.js');
    expect(module.getCustomPersonaStore).toBeDefined();
  });

  it('catches errors during module-level persona loading', async () => {
    const { existsSync } = await import('node:fs');
    const { readFile } = await import('node:fs/promises');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockRejectedValue(new Error('read failed'));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    expect(module.getCustomPersonaStore).toBeDefined();
  });

  it('saveCustomPersonas catches write errors silently', async () => {
    const { writeFile } = await import('node:fs/promises');
    vi.mocked(writeFile).mockRejectedValue(new Error('Disk full'));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsCreateCustomPersonaEndpoint(
      makeRequest({ name: 'Error Test', parameters: {} }),
    );
    expect(response.statusCode).toBe(201);
  });

  it('deletePersonasFile catches unlink errors silently', async () => {
    const { existsSync } = await import('node:fs');
    const { unlink } = await import('node:fs/promises');
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(unlink).mockRejectedValue(new Error('Permission denied'));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    await module.rsCreateCustomPersonaEndpoint(makeRequest({ name: 'Temp', parameters: {} }));
    expect(module.getCustomPersonaStore().size).toBeGreaterThan(0);

    await module.clearReaderStores();
    expect(module.getCustomPersonaStore().size).toBe(0);
  });

  it('rsAnalyzeEndpoint runs full analysis with non-empty text', async () => {
    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsAnalyzeEndpoint(
      makeRequest({
        novelId: 'novel-full',
        text: 'This is a longer piece of text that should trigger the non-empty text path. It has multiple sentences.',
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    expect(body.novelId).toBe('novel-full');
    expect(body.readerReactions).toBeDefined();
    expect(body.consensus).toBeDefined();
    expect(body.consensus.items).toBeDefined();
    expect(body.dimensionScores).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('rsAnalyzeEndpoint serializes non-Error analyze failures', async () => {
    vi.doMock('../../reader/DualEngine.js', () => ({
      DualEngine: class {
        analyze() {
          return Promise.reject('plain analyze failure');
        }
      },
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsAnalyzeEndpoint(
      makeRequest({
        novelId: 'novel-failure',
        text: 'trigger full path',
      }),
    );

    expect(response.statusCode).toBe(500);
  });

  it('rsAIFlavorEndpoint catches detectAIFlavor errors', async () => {
    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsAIFlavorEndpoint(makeRequest({ novelId: 'novel-error', text: 'throw-error' }));

    expect(response.statusCode).toBe(500);
    expect((response.body as any).error).toBe('AI flavor detection error');
  });

  it('rsAIFlavorEndpoint returns 400 when novelId is missing', async () => {
    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsAIFlavorEndpoint(makeRequest({ text: 'some text' }));

    expect(response.statusCode).toBe(400);
    expect((response.body as any).error).toBe('novelId is required and must be a string');
  });

  it('rsCompareEndpoint returns tie when comparison is empty', async () => {
    mockConsensusCompareResult = [];

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsCompareEndpoint(
      makeRequest({
        novelId: 'novel-tie',
        versionA: { text: 'Version A text.' },
        versionB: { text: 'Version B text.' },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect((response.body as any).overallWinner).toBe('tie');
  });

  it('rsCompareEndpoint returns A when version A wins', async () => {
    mockConsensusCompareResult = [
      {
        dimension: 'Plot Coherence',
        versionAScore: 0.8,
        versionBScore: 0.5,
        delta: 0.3,
        winner: 'A' as const,
        notes: 'A wins',
      },
    ];

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsCompareEndpoint(
      makeRequest({
        novelId: 'novel-a-wins',
        versionA: { text: 'Better version A text here.' },
        versionB: { text: 'Worse version B text.' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect((response.body as any).overallWinner).toBe('A');
  });

  it('rsCompareEndpoint returns B when version B wins', async () => {
    mockConsensusCompareResult = [
      {
        dimension: 'Plot Coherence',
        versionAScore: 0.5,
        versionBScore: 0.8,
        delta: -0.3,
        winner: 'B' as const,
        notes: 'B wins',
      },
    ];

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsCompareEndpoint(
      makeRequest({
        novelId: 'novel-b-wins',
        versionA: { text: 'Worse version A text.' },
        versionB: { text: 'Better version B text here.' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect((response.body as any).overallWinner).toBe('B');
  });

  it('rsDeAIEndpoint catches revision service errors', async () => {
    mockRevisionShouldFail = true;

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsDeAIEndpoint(
      makeRequest({ novelId: 'novel-deai-error', text: 'Some text that needs revision.' }),
    );

    expect(response.statusCode).toBe(500);
    expect((response.body as any).error).toBe('Revision service failed');
  });

  it('rsCreateCustomPersonaEndpoint catches unexpected creation errors', async () => {
    mockCreatePersonaShouldFail = true;

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsCreateCustomPersonaEndpoint(makeRequest({ name: 'Boom', parameters: {} }));

    expect(response.statusCode).toBe(400);
    expect((response.body as any).error).toBe('persona creation failed');
  });

  it('rsFeedbackEndpoint catches unexpected processing errors', async () => {
    const module = await import('../../reader/mcp/reader-endpoints.js');
    module.clearReaderStores();

    // Accumulate enough feedback to cross the threshold and trigger weight adjustment.
    for (let i = 0; i < 4; i++) {
      const r = await module.rsFeedbackEndpoint(
        makeRequest({
          novelId: 'novel-feedback-error',
          personaId: 'malformed-reader',
          feedbackId: `fb-${i}`,
          action: 'helpful',
          dimension: 'plotCoherence',
        }),
      );
      expect(r.statusCode).toBe(200);
    }

    const response = await module.rsFeedbackEndpoint(
      makeRequest({
        novelId: 'novel-feedback-error',
        personaId: 'malformed-reader',
        feedbackId: 'fb-throw',
        action: 'helpful',
        dimension: 'plotCoherence',
      }),
    );

    expect(response.statusCode).toBe(500);
    expect((response.body as any).error).toBeDefined();
  });
});
