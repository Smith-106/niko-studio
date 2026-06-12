import { afterEach, describe, expect, it } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';
import { cwGetCreativityPresetsEndpoint } from '../../cowriting/mcp/cowriting-endpoints.js';
import {
  CREATIVITY_PRESET_VALUES,
  CreativityPreset,
} from '../../quality/types.js';

function makeRequest(): HttpRequest {
  return {
    method: 'GET',
    url: '/cowriting/creativity-presets',
    headers: {},
    body: {},
    query: {},
    params: {},
  };
}

describe('cowriting/mcp/cowriting-endpoints additional coverage', () => {
  afterEach(() => {
    delete (CreativityPreset as Record<string, string>).SURPRISE;
    delete (CREATIVITY_PRESET_VALUES as Record<string, number>).surprise;
  });

  it('falls back to an unknown-preset description when enum values drift at runtime', async () => {
    (CreativityPreset as Record<string, string>).SURPRISE = 'surprise';
    (CREATIVITY_PRESET_VALUES as Record<string, number>).surprise = 0.42;

    const response = await cwGetCreativityPresetsEndpoint(makeRequest());
    const presets = (response.body as { presets: Array<Record<string, unknown>> }).presets;
    const surprise = presets.find((preset) => preset.id === 'surprise');

    expect(response.statusCode).toBe(200);
    expect(surprise).toMatchObject({
      id: 'surprise',
      value: 0.42,
      description: 'Unknown preset.',
    });
  });
});
