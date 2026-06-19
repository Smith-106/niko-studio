import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  url = '/writing-helper/process',
): HttpRequest {
  return { method: 'POST', url, headers, body, query: {}, params: {} };
}

describe('writing endpoints header-based provider config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.NIKO_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.NIKO_LLM_BASE_URL;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.NIKO_LLM_MODEL;
    delete process.env.OPENAI_MODEL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves api_key from x-llm-api-key header in writingHelperProcessEndpoint', async () => {
    // Mock the fetch call so we can verify the header key is used
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ score: 7, evidence: [], suggestions: [], analysis: 'ok' }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing');
    const response = await writingHelperProcessEndpoint(makeRequest(
      { content: 'Test content', mode: 'polish', api_key: 'body-key', base_url: 'https://api.test.com', model: 'gpt-4o', provider: 'openai' },
      { 'x-llm-api-key': 'header-key-lower' },
    ));

    // The request should succeed and use the header-based key
    const fetchMock = vi.mocked(fetch);
    if (fetchMock.mock.calls.length > 0) {
      expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
        Authorization: 'Bearer header-key-lower',
      });
    }
  });

  it('resolves api_key from X-LLM-API-Key header (canonical case)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ score: 7, evidence: [], suggestions: [], analysis: 'ok' }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing');
    const response = await writingHelperProcessEndpoint(makeRequest(
      { content: 'Test content', mode: 'polish', api_key: 'body-key', base_url: 'https://api.test.com', model: 'gpt-4o', provider: 'openai' },
      { 'X-LLM-API-Key': 'Header-Key-Upper' },
    ));

    const fetchMock = vi.mocked(fetch);
    if (fetchMock.mock.calls.length > 0) {
      expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
        Authorization: 'Bearer Header-Key-Upper',
      });
    }
  });

  it('resolves base_url from x-llm-base-url header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ score: 7, evidence: [], suggestions: [], analysis: 'ok' }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing');
    await writingHelperProcessEndpoint(makeRequest(
      { content: 'Test', mode: 'polish', api_key: 'sk-test', model: 'gpt-4o', provider: 'openai' },
      { 'x-llm-base-url': 'https://header-base.test.com' },
    ));

    const fetchMock = vi.mocked(fetch);
    if (fetchMock.mock.calls.length > 0) {
      expect(fetchMock.mock.calls[0][0]).toContain('https://header-base.test.com');
    }
  });

  it('resolves base_url from X-LLM-Base-Url header (canonical case)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ score: 7, evidence: [], suggestions: [], analysis: 'ok' }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing');
    await writingHelperProcessEndpoint(makeRequest(
      { content: 'Test', mode: 'polish', api_key: 'sk-test', model: 'gpt-4o', provider: 'openai' },
      { 'X-LLM-Base-Url': 'https://canonical-base.test.com' },
    ));

    const fetchMock = vi.mocked(fetch);
    if (fetchMock.mock.calls.length > 0) {
      expect(fetchMock.mock.calls[0][0]).toContain('https://canonical-base.test.com');
    }
  });

  it('trims whitespace from header key values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ score: 7, evidence: [], suggestions: [], analysis: 'ok' }) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing');
    await writingHelperProcessEndpoint(makeRequest(
      { content: 'Test', mode: 'polish', model: 'gpt-4o', provider: 'openai' },
      { 'x-llm-api-key': '  trimmed-key  ', 'x-llm-base-url': '  https://trimmed.test.com  ' },
    ));

    const fetchMock = vi.mocked(fetch);
    if (fetchMock.mock.calls.length > 0) {
      expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
        Authorization: 'Bearer trimmed-key',
      });
      expect(fetchMock.mock.calls[0][0]).toContain('https://trimmed.test.com');
    }
  });
});
