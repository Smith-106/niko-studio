import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import { AutoMode } from '../../cowriting/AutoMode.js';
import { GuidedMode } from '../../cowriting/GuidedMode.js';
import {
  cwGenerateAutoEndpoint,
  cwGenerateGuidedEndpoint,
  cwGetCreativityPresetsEndpoint,
  cwGetModesEndpoint,
  resetModeInstances,
} from '../../cowriting/mcp/cowriting-endpoints.js';
import { CreativityPreset } from '../../quality/types.js';

function mockRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/cowriting',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function mockGetRequest(url: string): HttpRequest {
  return {
    method: 'GET',
    url,
    headers: {},
    body: {},
    query: {},
    params: {},
  };
}

function getBody(response: HttpResponse) {
  return response.body as any;
}

afterEach(() => {
  resetModeInstances();
  vi.restoreAllMocks();
});

describe('cowriting/mcp/cowriting-endpoints', () => {
  it('validates generate requests for both novel and chapter ids plus preset values', async () => {
    const missingNovelId = await cwGenerateAutoEndpoint(
      mockRequest({ chapterId: 'ch-1' }),
    );
    expect(missingNovelId.statusCode).toBe(400);
    expect(getBody(missingNovelId).error).toBe('novelId is required and must be a string');

    const missingChapterId = await cwGenerateGuidedEndpoint(
      mockRequest({ novelId: 'novel-1' }),
    );
    expect(missingChapterId.statusCode).toBe(400);
    expect(getBody(missingChapterId).error).toBe('chapterId is required and must be a string');

    const invalidPreset = await cwGenerateAutoEndpoint(
      mockRequest({
        novelId: 'novel-1',
        chapterId: 'ch-1',
        creativityPreset: 'wildcard',
      }),
    );
    expect(invalidPreset.statusCode).toBe(400);
    expect(getBody(invalidPreset).error).toContain('Invalid creativityPreset: wildcard');
  });

  it('runs auto generation through the real placeholder pipeline', async () => {
    const response = await cwGenerateAutoEndpoint(
      mockRequest({
        novelId: 'novel-1',
        chapterId: 'chapter-7',
        creativityPreset: CreativityPreset.CONSERVATIVE,
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).result).toMatchObject({
      mode: 'auto',
      metadata: {
        creativityLevel: 0.2,
      },
    });
    expect(getBody(response).result.text).toContain('the narrative continues');
    expect(getBody(response).result.metadata.model).toBeTruthy();
    expect(getBody(response).result.metadata.tokenCount).toBeGreaterThan(0);
  });

  it('returns auto generation failures as 500 responses', async () => {
    vi.spyOn(AutoMode.prototype, 'generate').mockRejectedValueOnce(new Error('auto failed'));

    const response = await cwGenerateAutoEndpoint(
      mockRequest({
        novelId: 'novel-1',
        chapterId: 'chapter-7',
      }),
    );

    expect(response.statusCode).toBe(500);
    expect(getBody(response).error).toBe('auto failed');
  });

  it('runs guided generation through the real placeholder pipeline', async () => {
    const response = await cwGenerateGuidedEndpoint(
      mockRequest({
        novelId: 'novel-2',
        chapterId: 'chapter-3',
        creativityPreset: CreativityPreset.EXPERIMENTAL,
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).result.mode).toBe('guided');
    expect(getBody(response).result.options).toHaveLength(3);
    expect(getBody(response).result.options[0].text).toContain('The door creaked open');
    expect(getBody(response).result.metadata).toMatchObject({
      creativityLevel: 0.9,
    });
    expect(getBody(response).result.metadata.tokenCount).toBeGreaterThan(0);
  });

  it('returns guided generation failures as 500 responses', async () => {
    vi.spyOn(GuidedMode.prototype, 'generate').mockRejectedValueOnce(new Error('guided failed'));

    const response = await cwGenerateGuidedEndpoint(
      mockRequest({
        novelId: 'novel-2',
        chapterId: 'chapter-3',
      }),
    );

    expect(response.statusCode).toBe(500);
    expect(getBody(response).error).toBe('guided failed');
  });

  it('lists co-writing modes with their enforcement defaults', async () => {
    const response = await cwGetModesEndpoint(mockGetRequest('/cowriting/modes'));

    expect(response.statusCode).toBe(200);
    expect(getBody(response).modes).toEqual([
      {
        id: 'auto',
        name: 'Auto Mode',
        description: 'Full auto-continuation pipeline. Generates a single continuation text automatically.',
        defaultCreativityPreset: 'balanced',
        defaultCreativityValue: 0.5,
        enforcementMode: 'blocking',
      },
      {
        id: 'guided',
        name: 'Guided Mode',
        description: 'Generates 3 scored continuation options for user selection.',
        defaultCreativityPreset: 'balanced',
        defaultCreativityValue: 0.6,
        enforcementMode: 'blocking',
      },
      {
        id: 'directed',
        name: 'Directed Mode',
        description: 'User-directed writing with advisory quality feedback. (Not yet implemented.)',
        defaultCreativityPreset: 'balanced',
        defaultCreativityValue: 0.4,
        enforcementMode: 'advisory',
      },
    ]);
  });

  it('lists all creativity presets with resolved mode defaults and descriptions', async () => {
    const response = await cwGetCreativityPresetsEndpoint(
      mockGetRequest('/cowriting/creativity-presets'),
    );

    expect(response.statusCode).toBe(200);
    const presets = getBody(response).presets as Array<any>;
    expect(presets).toHaveLength(4);
    expect(presets.map((preset) => preset.id)).toEqual([
      'conservative',
      'balanced',
      'creative',
      'experimental',
    ]);
    expect(presets[0]).toMatchObject({
      id: 'conservative',
      value: 0.2,
      label: 'Conservative',
      description: 'Low creativity, high coherence. Stays close to established patterns and vocabulary.',
      modeDefaults: {
        auto: 0.2,
        guided: 0.2,
        directed: 0.2,
      },
    });
    expect(presets[1]).toMatchObject({
      id: 'balanced',
      modeDefaults: {
        auto: 0.5,
        guided: 0.6,
        directed: 0.4,
      },
    });
    expect(presets[2].constraints.maxSentenceLength).toBeGreaterThan(0);
    expect(presets[3]).toMatchObject({
      id: 'experimental',
      description: 'Maximum creativity. Allows nonlinear structures, unreliable narration, and high metaphor density.',
    });
  });

  it('resets endpoint mode singletons without breaking later requests', async () => {
    const first = await cwGenerateAutoEndpoint(
      mockRequest({
        novelId: 'novel-3',
        chapterId: 'chapter-1',
      }),
    );
    expect(first.statusCode).toBe(200);

    resetModeInstances();

    const second = await cwGenerateGuidedEndpoint(
      mockRequest({
        novelId: 'novel-3',
        chapterId: 'chapter-1',
      }),
    );
    expect(second.statusCode).toBe(200);
    expect(getBody(second).result.options).toHaveLength(3);
  });
});
