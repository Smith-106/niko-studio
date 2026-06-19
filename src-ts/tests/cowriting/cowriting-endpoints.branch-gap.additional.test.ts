import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';
import { AutoMode } from '../../cowriting/AutoMode.js';
import { GuidedMode } from '../../cowriting/GuidedMode.js';
import {
  cwGenerateAutoEndpoint,
  cwGenerateGuidedEndpoint,
  cwGetCreativityPresetsEndpoint,
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

function getBody(response: { body: unknown }) {
  return response.body as Record<string, unknown>;
}

afterEach(() => {
  resetModeInstances();
  vi.restoreAllMocks();
});

describe('cowriting/mcp/cowriting-endpoints branch gap coverage', () => {
  it('stringifies non-Error auto mode failures', async () => {
    vi.spyOn(AutoMode.prototype, 'generate').mockRejectedValueOnce('auto primitive failure');

    const response = await cwGenerateAutoEndpoint(
      mockRequest({
        novelId: 'novel-auto',
        chapterId: 'chapter-auto',
      }),
    );

    expect(response.statusCode).toBe(500);
    expect(getBody(response).error).toBe('auto primitive failure');
  });

  it('stringifies non-Error guided mode failures', async () => {
    vi.spyOn(GuidedMode.prototype, 'generate').mockRejectedValueOnce({ message: 'guided primitive failure' });

    const response = await cwGenerateGuidedEndpoint(
      mockRequest({
        novelId: 'novel-guided',
        chapterId: 'chapter-guided',
      }),
    );

    expect(response.statusCode).toBe(500);
    expect(getBody(response).error).toBe('[object Object]');
  });

  it('covers the unknown creativity preset description fallback branch', async () => {
    const originalValues = Object.values;
    vi.spyOn(Object, 'values').mockImplementation(((target: object) => {
      if (target === CreativityPreset) {
        return [...originalValues(target), 'unknown'];
      }
      return originalValues(target);
    }) as typeof Object.values);

    const response = await cwGetCreativityPresetsEndpoint({
      method: 'GET',
      url: '/cowriting/creativity-presets',
      headers: {},
      body: {},
      query: {},
      params: {},
    });

    expect(response.statusCode).toBe(200);
    expect(getBody(response).presets.at(-1)).toMatchObject({
      id: 'unknown',
      description: 'Unknown preset.',
    });
  });
});
