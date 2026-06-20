/**
 * Branch-gap tests for reader-endpoints.ts
 *
 * Targets uncovered branches:
 *   Lines 809-810: rsFeedbackEndpoint catch block — non-Error exception path
 *                  where `exc instanceof Error` is false, hitting String(exc)
 *   Line 841: adjustPersonaWeights `?? 0.5` fallback when paramKey exists
 *             but persona.parameters[paramKey] is undefined
 *   Line 1010: rsDeAIEndpoint `text ?? ''` fallback when text is not
 *              provided in the request body
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('reader/mcp/reader-endpoints branch-gap additional coverage', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../reader/DualEngine');
    vi.doUnmock('../../reader/PersonaDefinition');
    vi.doUnmock('../../reader/ConsensusEngine');
    vi.doUnmock('../../services/revision-service');
    vi.doUnmock('../../reader/DimensionAnalyzer');
  });

  it('adjustPersonaWeights uses ?? 0.5 fallback when persona parameter is undefined (line 841)', async () => {
    // Mock PersonaDefinition to include a persona with undefined plotWeight
    vi.doMock('../../reader/PersonaDefinition', () => {
      const presets: Record<string, () => any> = {
        'missing-params-reader': () => ({
          id: 'preset-missing-params-reader',
          name: 'Missing Params',
          type: 'preset',
          parameters: {
            // plotWeight is deliberately undefined to trigger ?? 0.5 on line 841
            characterWeight: 0.7,
            styleWeight: 0.5,
            pacingWeight: 0.6,
            toleranceThreshold: 0.5,
            focusAreas: [],
            biases: [],
          },
        }),
      };

      return {
        createCustomPersona: vi.fn((overrides: any) => ({
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
        })),
        PRESET_PERSONAS: presets,
        getPresetPersona: vi.fn((id: string) => presets[id]?.()),
        listPresetPersonas: vi.fn(() => Object.keys(presets) as any),
      };
    });

    vi.doMock('../../reader/DualEngine', () => ({
      DualEngine: class {
        analyze() {
          return Promise.resolve({
            readerReactions: [],
            editorialAnalysis: { structuralIssues: [], styleNotes: [], pacingAssessment: '', recommendations: [] },
            timestamp: new Date().toISOString(),
          });
        }
      },
    }));

    vi.doMock('../../reader/ConsensusEngine', () => ({
      ConsensusEngine: class {
        buildConsensus() { return { items: [], overallAssessment: '', criticalIssues: [], dissentItems: [], dimensionSummaries: {} }; }
        compareConsensus() { return []; }
      },
    }));

    vi.doMock('../../reader/DimensionAnalyzer', () => ({
      DimensionAnalyzer: class {
        analyzeAllDimensions() { return []; }
      },
      createDimensionAnalyzer: vi.fn(() => new (class { analyzeAllDimensions() { return []; } })()),
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');

    // Submit feedback for the 'missing-params-reader' persona whose plotWeight is undefined.
    // When threshold is reached, adjustPersonaWeights will find plotCoherence -> plotWeight,
    // but persona.parameters.plotWeight is undefined, triggering ?? 0.5 on line 841.
    for (let i = 0; i < 4; i++) {
      await module.rsFeedbackEndpoint(makeRequest({
        novelId: 'novel-undefined-param',
        personaId: 'missing-params-reader',
        feedbackId: `fb-${i}`,
        action: 'helpful',
        dimension: 'plotCoherence',
      }));
    }

    // 5th feedback triggers weight adjustment
    const response = await module.rsFeedbackEndpoint(makeRequest({
      novelId: 'novel-undefined-param',
      personaId: 'missing-params-reader',
      feedbackId: 'fb-4',
      action: 'helpful',
      dimension: 'plotCoherence',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    // Since plotWeight was undefined, ?? 0.5 gives currentWeight = 0.5
    // With accept > reject, newWeight = 0.5 + 0.05 = 0.55
    expect(body.weightsChanged).toBe(true);
    expect(body.updatedWeights.plotWeight).toBe(0.55);

    // Clean up
    module.clearReaderStores();
  });

  it('rsDeAIEndpoint uses text ?? "" fallback when text is not provided (line 1010)', async () => {
    // Mock RevisionService to avoid actual LLM/rule-based rewrite
    vi.doMock('../../services/revision-service', () => ({
      RevisionServiceImpl: class {
        initialize() { return Promise.resolve(); }
        revise(text: string) {
          return Promise.resolve({
            sessionId: `revision-${Date.now()}`,
            finalDraft: text,
            finalDecision: 'APPROVED',
            finalScore: 9,
            totalIterations: 0,
            iterations: [],
            learningInsights: [],
          });
        }
      },
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');

    // Call rsDeAIEndpoint without providing text — should use empty string
    const response = await module.rsDeAIEndpoint(makeRequest({
      novelId: 'novel-no-text',
      // text is deliberately omitted to trigger text ?? '' on line 1010
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    expect(body.novelId).toBe('novel-no-text');
    // With empty text, the endpoint returns the empty-text response
    expect(body.originalText).toBe('');
    expect(body.revisedText).toBe('');
    expect(body.aiFlavorScore).toBe(0);
    expect(body.suggestions).toContain('文本为空，无法检测 AI 味或进行重写');

    module.clearReaderStores();
  });

  it('rsDeAIEndpoint uses text ?? "" when text is null (line 1010)', async () => {
    vi.doMock('../../services/revision-service', () => ({
      RevisionServiceImpl: class {
        initialize() { return Promise.resolve(); }
        revise(text: string) {
          return Promise.resolve({
            sessionId: `revision-${Date.now()}`,
            finalDraft: text,
            finalDecision: 'APPROVED',
            finalScore: 9,
            totalIterations: 0,
            iterations: [],
            learningInsights: [],
          });
        }
      },
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');

    // Call with text explicitly set to null — null ?? '' returns ''
    const response = await module.rsDeAIEndpoint(makeRequest({
      novelId: 'novel-null-text',
      text: null,
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    // With null text, the ?? '' fires producing empty string
    expect(body.originalText).toBe('');
    expect(body.revisedText).toBe('');

    module.clearReaderStores();
  });

  it('rsFeedbackEndpoint catch block serializes non-Error values via String() (lines 809-810)', async () => {
    // To trigger the catch block with a non-Error value, we need something
    // inside the try block (lines 733-808) to throw a non-Error.
    // Strategy: Use a persona with a parameters proxy that throws when accessed.
    vi.doMock('../../reader/PersonaDefinition', () => {
      const presets: Record<string, () => any> = {
        'throwing-reader': () => ({
          id: 'preset-throwing-reader',
          name: 'Throwing',
          type: 'preset',
          parameters: new Proxy({ plotWeight: 0.5 } as Record<string, unknown>, {
            get(target, prop) {
              if (prop === 'plotWeight') {
                throw 'string-error-from-proxy'; // non-Error throw
              }
              return (target as any)[prop];
            },
          }),
        }),
      };

      return {
        createCustomPersona: vi.fn((overrides: any) => ({
          id: `custom-${Date.now()}`,
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
          },
        })),
        PRESET_PERSONAS: presets,
        getPresetPersona: vi.fn((id: string) => presets[id]?.()),
        listPresetPersonas: vi.fn(() => Object.keys(presets) as any),
      };
    });

    vi.doMock('../../reader/DualEngine', () => ({
      DualEngine: class {
        analyze() {
          return Promise.resolve({
            readerReactions: [],
            editorialAnalysis: { structuralIssues: [], styleNotes: [], pacingAssessment: '', recommendations: [] },
            timestamp: new Date().toISOString(),
          });
        }
      },
    }));

    vi.doMock('../../reader/ConsensusEngine', () => ({
      ConsensusEngine: class {
        buildConsensus() { return { items: [], overallAssessment: '', criticalIssues: [], dissentItems: [], dimensionSummaries: {} }; }
        compareConsensus() { return []; }
      },
    }));

    vi.doMock('../../reader/DimensionAnalyzer', () => ({
      DimensionAnalyzer: class {
        analyzeAllDimensions() { return []; }
      },
      createDimensionAnalyzer: vi.fn(() => new (class { analyzeAllDimensions() { return []; } })()),
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');

    // Submit 5 feedbacks to hit threshold and trigger adjustPersonaWeights
    // which accesses persona.parameters.plotWeight — this will throw
    for (let i = 0; i < 4; i++) {
      const r = await module.rsFeedbackEndpoint(makeRequest({
        novelId: 'novel-non-error',
        personaId: 'throwing-reader',
        feedbackId: `fb-${i}`,
        action: 'helpful',
        dimension: 'plotCoherence',
      }));
      // First 4 should succeed (before threshold)
      expect(r.statusCode).toBe(200);
    }

    // 5th feedback crosses threshold -> adjustPersonaWeights accesses plotWeight
    // -> proxy throws 'string-error-from-proxy' -> catch block on line 809
    const response = await module.rsFeedbackEndpoint(makeRequest({
      novelId: 'novel-non-error',
      personaId: 'throwing-reader',
      feedbackId: 'fb-4',
      action: 'helpful',
      dimension: 'plotCoherence',
    }));

    // Should return 500 with String(exc) = 'string-error-from-proxy'
    expect(response.statusCode).toBe(500);
    const body = response.body as any;
    expect(body.error).toBe('string-error-from-proxy');

    module.clearReaderStores();
  });
});
