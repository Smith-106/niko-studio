import { afterEach, describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import {
  clearFeedbackAggregateStore,
  clearReaderStores,
  getCustomPersonaStore,
  getFeedbackAggregateStore,
  rsCreateCustomPersonaEndpoint,
  rsFeedbackEndpoint,
} from '../../reader/mcp/reader-endpoints.js';

function mockRequest({
  method = 'POST',
  url = '/reader/feedback',
  body = {},
  query = {},
  params = {},
}: Partial<HttpRequest> = {}): HttpRequest {
  return {
    method,
    url,
    headers: {},
    body,
    query,
    params,
  };
}

function getBody(response: HttpResponse) {
  return response.body as any;
}

afterEach(() => {
  clearReaderStores();
  clearFeedbackAggregateStore();
});

describe('reader/mcp/reader-feedback-endpoint', () => {
  it('validates required fields', async () => {
    const missingNovelId = await rsFeedbackEndpoint(mockRequest({ body: {} }));
    expect(missingNovelId.statusCode).toBe(400);
    expect(getBody(missingNovelId).error).toBe('novelId is required and must be a string');

    const missingPersonaId = await rsFeedbackEndpoint(
      mockRequest({ body: { novelId: 'novel-1' } }),
    );
    expect(missingPersonaId.statusCode).toBe(400);
    expect(getBody(missingPersonaId).error).toBe('personaId is required and must be a string');

    const missingFeedbackId = await rsFeedbackEndpoint(
      mockRequest({ body: { novelId: 'novel-1', personaId: 'preset-general-reader' } }),
    );
    expect(missingFeedbackId.statusCode).toBe(400);
    expect(getBody(missingFeedbackId).error).toBe('feedbackId is required and must be a string');

    const missingAction = await rsFeedbackEndpoint(
      mockRequest({
        body: { novelId: 'novel-1', personaId: 'preset-general-reader', feedbackId: 'fb-1' },
      }),
    );
    expect(missingAction.statusCode).toBe(400);
    expect(getBody(missingAction).error).toBe("action must be 'helpful', 'not_helpful', or 'ignore'");

    const invalidAction = await rsFeedbackEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          personaId: 'preset-general-reader',
          feedbackId: 'fb-1',
          action: 'invalid',
        },
      }),
    );
    expect(invalidAction.statusCode).toBe(400);
    expect(getBody(invalidAction).error).toBe("action must be 'helpful', 'not_helpful', or 'ignore'");
  });

  it('rejects unknown personas', async () => {
    const response = await rsFeedbackEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          personaId: 'unknown-persona',
          feedbackId: 'fb-1',
          action: 'helpful',
        },
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(getBody(response).error).toBe('Persona not found: unknown-persona');
  });

  it('accepts feedback for preset personas and aggregates without weight change (below threshold)', async () => {
    const response = await rsFeedbackEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          personaId: 'general-reader',
          feedbackId: 'fb-1',
          action: 'helpful',
          dimension: 'plotCoherence',
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.novelId).toBe('novel-1');
    expect(body.personaId).toBe('general-reader');
    expect(body.feedbackId).toBe('fb-1');
    expect(body.action).toBe('helpful');
    expect(body.dimension).toBe('plotCoherence');
    expect(body.weightsChanged).toBe(false);
    expect(body.updatedWeights).toBeUndefined();

    // Verify aggregate store
    const store = getFeedbackAggregateStore();
    expect(store.has('general-reader')).toBe(true);
    const personaAggregates = store.get('general-reader')!;
    expect(personaAggregates.has('plotCoherence')).toBe(true);
    const aggregate = personaAggregates.get('plotCoherence')!;
    expect(aggregate.accept).toBe(1);
    expect(aggregate.reject).toBe(0);
    expect(aggregate.modify).toBe(0);
    expect(aggregate.lastUpdated).toBeDefined();
  });

  it('aggregates multiple feedback actions correctly', async () => {
    const actions: Array<'helpful' | 'not_helpful' | 'ignore'> = [
      'helpful',
      'helpful',
      'not_helpful',
      'ignore',
      'helpful',
    ];

    for (let i = 0; i < actions.length; i++) {
      await rsFeedbackEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-1',
            personaId: 'general-reader',
            feedbackId: `fb-${i}`,
            action: actions[i],
            dimension: 'characterConsistency',
          },
        }),
      );
    }

    const store = getFeedbackAggregateStore();
    const aggregate = store.get('general-reader')!.get('characterConsistency')!;
    expect(aggregate.accept).toBe(3);
    expect(aggregate.reject).toBe(1);
    expect(aggregate.modify).toBe(1);
  });

  it('triggers weight increase when accept > reject at threshold', async () => {
    // Create a custom persona with known initial weights
    const created = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        url: '/reader/personas/custom',
        body: {
          name: 'Test Reader',
          parameters: {
            plotWeight: 0.5,
            characterWeight: 0.5,
            styleWeight: 0.5,
            pacingWeight: 0.5,
            toleranceThreshold: 0.5,
          },
        },
      }),
    );
    expect(created.statusCode).toBe(201);
    const personaId = getBody(created).persona.id as string;

    // Submit 5 'helpful' feedbacks (threshold = 5, accept > reject)
    for (let i = 0; i < 5; i++) {
      const response = await rsFeedbackEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-1',
            personaId,
            feedbackId: `fb-${i}`,
            action: 'helpful',
            dimension: 'plotCoherence',
          },
        }),
      );

      // Only the 5th one triggers weight change
      if (i === 4) {
        expect(response.statusCode).toBe(200);
        const body = getBody(response);
        expect(body.weightsChanged).toBe(true);
        expect(body.updatedWeights).toBeDefined();
        expect(body.updatedWeights.plotWeight).toBe(0.55); // 0.5 + 0.05
      }
    }

    // Verify the custom persona was updated in store
    const customPersona = getCustomPersonaStore().get(personaId)!;
    expect(customPersona.parameters.plotWeight).toBe(0.55);
  });

  it('triggers weight decrease when reject > accept at threshold', async () => {
    const created = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        url: '/reader/personas/custom',
        body: {
          name: 'Test Reader',
          parameters: {
            plotWeight: 0.5,
            characterWeight: 0.5,
            styleWeight: 0.5,
            pacingWeight: 0.5,
            toleranceThreshold: 0.5,
          },
        },
      }),
    );
    const personaId = getBody(created).persona.id as string;

    // Submit 3 'not_helpful' and 2 'helpful' (reject > accept at threshold)
    const actions: Array<'helpful' | 'not_helpful'> = [
      'not_helpful',
      'not_helpful',
      'helpful',
      'not_helpful',
      'helpful',
    ];

    for (let i = 0; i < actions.length; i++) {
      const response = await rsFeedbackEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-1',
            personaId,
            feedbackId: `fb-${i}`,
            action: actions[i],
            dimension: 'styleConsistency',
          },
        }),
      );

      if (i === 4) {
        const body = getBody(response);
        expect(body.weightsChanged).toBe(true);
        expect(body.updatedWeights).toBeDefined();
        expect(body.updatedWeights.styleWeight).toBe(0.45); // 0.5 - 0.05
      }
    }
  });

  it('does not change weights when accept equals reject', async () => {
    const created = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        url: '/reader/personas/custom',
        body: {
          name: 'Test Reader',
          parameters: {
            plotWeight: 0.5,
            characterWeight: 0.5,
            styleWeight: 0.5,
            pacingWeight: 0.5,
            toleranceThreshold: 0.5,
          },
        },
      }),
    );
    const personaId = getBody(created).persona.id as string;

    // Submit 2 'helpful', 2 'not_helpful', 1 'ignore' (accept == reject)
    const actions: Array<'helpful' | 'not_helpful' | 'ignore'> = [
      'helpful',
      'not_helpful',
      'helpful',
      'not_helpful',
      'ignore',
    ];

    for (let i = 0; i < actions.length; i++) {
      const response = await rsFeedbackEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-1',
            personaId,
            feedbackId: `fb-${i}`,
            action: actions[i],
            dimension: 'pacingTension',
          },
        }),
      );

      if (i === 4) {
        const body = getBody(response);
        expect(body.weightsChanged).toBe(false);
        expect(body.updatedWeights).toBeDefined();
        expect(body.updatedWeights.pacingWeight).toBe(0.5); // unchanged
      }
    }
  });

  it('clamps weights to [0, 1] range', async () => {
    const created = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        url: '/reader/personas/custom',
        body: {
          name: 'Test Reader',
          parameters: {
            plotWeight: 0.98,
            characterWeight: 0.02,
            styleWeight: 0.5,
            pacingWeight: 0.5,
            toleranceThreshold: 0.5,
          },
        },
      }),
    );
    const personaId = getBody(created).persona.id as string;

    // 5 helpful feedbacks on plotCoherence with weight 0.98 -> should cap at 1.0
    for (let i = 0; i < 5; i++) {
      await rsFeedbackEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-1',
            personaId,
            feedbackId: `fb-plot-${i}`,
            action: 'helpful',
            dimension: 'plotCoherence',
          },
        }),
      );
    }

    const customPersona = getCustomPersonaStore().get(personaId)!;
    expect(customPersona.parameters.plotWeight).toBe(1.0); // clamped to max

    // 5 not_helpful feedbacks on characterConsistency with weight 0.02 -> should floor at 0.0
    for (let i = 0; i < 5; i++) {
      await rsFeedbackEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-1',
            personaId,
            feedbackId: `fb-char-${i}`,
            action: 'not_helpful',
            dimension: 'characterConsistency',
          },
        }),
      );
    }

    const updatedPersona = getCustomPersonaStore().get(personaId)!;
    expect(updatedPersona.parameters.characterWeight).toBe(0.0); // clamped to min
  });

  it('falls back to general dimension when dimension is not provided', async () => {
    const response = await rsFeedbackEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          personaId: 'general-reader',
          feedbackId: 'fb-1',
          action: 'helpful',
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.dimension).toBe('general');

    const store = getFeedbackAggregateStore();
    expect(store.get('general-reader')!.has('general')).toBe(true);
  });

  it('does not modify weights for unknown dimensions', async () => {
    const created = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        url: '/reader/personas/custom',
        body: {
          name: 'Test Reader',
          parameters: {
            plotWeight: 0.5,
            characterWeight: 0.5,
            styleWeight: 0.5,
            pacingWeight: 0.5,
            toleranceThreshold: 0.5,
          },
        },
      }),
    );
    const personaId = getBody(created).persona.id as string;

    for (let i = 0; i < 5; i++) {
      const response = await rsFeedbackEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-1',
            personaId,
            feedbackId: `fb-${i}`,
            action: 'helpful',
            dimension: 'unknownDimension',
          },
        }),
      );

      if (i === 4) {
        const body = getBody(response);
        expect(body.weightsChanged).toBe(false);
      }
    }
  });

  it('does not modify preset persona weights in store (only returns them)', async () => {
    // Submit 5 helpful feedbacks for a preset persona
    for (let i = 0; i < 5; i++) {
      const response = await rsFeedbackEndpoint(
        mockRequest({
          body: {
            novelId: 'novel-1',
            personaId: 'general-reader',
            feedbackId: `fb-${i}`,
            action: 'helpful',
            dimension: 'plotCoherence',
          },
        }),
      );

      if (i === 4) {
        const body = getBody(response);
        expect(body.weightsChanged).toBe(true);
        expect(body.updatedWeights.plotWeight).toBe(0.75); // 0.7 + 0.05 (General Reader default)
      }
    }

    // Preset persona store should not be modified
    expect(getCustomPersonaStore().has('general-reader')).toBe(false);
  });

  it('clears feedback aggregate store with clearReaderStores', async () => {
    await rsFeedbackEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          personaId: 'general-reader',
          feedbackId: 'fb-1',
          action: 'helpful',
        },
      }),
    );

    expect(getFeedbackAggregateStore().size).toBe(1);
    clearReaderStores();
    expect(getFeedbackAggregateStore().size).toBe(0);
  });
});
