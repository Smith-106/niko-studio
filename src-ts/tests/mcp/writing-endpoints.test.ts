import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';
import {
  writingHelperProcessEndpoint,
  writingStreamEndpoint,
} from '../../mcp/endpoints/writing';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/writing-helper/process',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

afterEach(() => {
  delete process.env.NIKO_LLM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.NIKO_LLM_BASE_URL;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.NIKO_LLM_MODEL;
  delete process.env.OPENAI_MODEL;
  vi.unstubAllGlobals();
});

describe('writing endpoints local fallback parity', () => {
  it('uses the local writing-helper service instead of placeholder text when no LLM config exists', async () => {
    const response = await writingHelperProcessEndpoint(makeRequest({
      content: '第一句。  第二句。 第二句。',
      mode: 'polish',
      instruction: '更自然',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      mode: 'polish',
      status: 'ok',
      provider: 'local',
    });
    const body = response.body as Record<string, unknown>;
    expect(String(body['processed_text'])).not.toContain('Placeholder');
    expect(String(body['processed_text']).length).toBeGreaterThan(0);
    expect(body['stats']).toBeTruthy();
  });

  it('returns outline data from the local helper and preserves processed_text compatibility', async () => {
    const response = await writingHelperProcessEndpoint(makeRequest({
      content: '第一段介绍人物。\n第二段建立冲突。\n第三段留下悬念。',
      mode: 'outline',
      max_items: 2,
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({
      mode: 'outline',
      status: 'ok',
      provider: 'local',
    });
    expect(Array.isArray(body['outline'])).toBe(true);
    expect((body['outline'] as unknown[]).length).toBeLessThanOrEqual(2);
    expect(typeof body['processed_text']).toBe('string');
    expect(String(body['processed_text']).length).toBeGreaterThan(0);
  });

  it('returns a clear error for generate mode when no LLM provider is configured', async () => {
    const response = await writingHelperProcessEndpoint(makeRequest({
      content: '请续写这一段。',
      mode: 'generate',
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'No LLM provider configured' });
  });

  it('keeps the streaming endpoint on explicit LLM-only behavior', async () => {
    const response = await writingStreamEndpoint(makeRequest({
      content: '请续写这一段。',
      mode: 'generate',
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'No LLM provider configured' });
  });
});
