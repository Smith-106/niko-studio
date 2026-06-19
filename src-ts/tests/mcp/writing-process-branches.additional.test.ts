import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: unknown, url = '/writing-helper/process'): HttpRequest {
  return {
    method: 'POST',
    url,
    headers: {},
    body,
    query: {},
    params: {},
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.doUnmock('../../services/writing-helper.js');
  vi.doUnmock('../../mcp/http-types.js');
  vi.doUnmock('../../mcp/services/skills.js');
});

describe('writing process endpoint additional branches', () => {
  it('maps snake_case and camelCase limits into the local helper call', async () => {
    const processWritingHelper = vi.fn()
      .mockReturnValueOnce({ mode: 'summarize', processed_text: 'one' })
      .mockReturnValueOnce({ mode: 'outline', outline: ['beat'] });

    vi.doMock('../../services/writing-helper.js', () => ({
      processWritingHelper,
    }));

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    const snakeCaseResponse = await writingHelperProcessEndpoint(
      makeRequest({
        content: 'First draft.',
        mode: 'summarize',
        max_sentences: 3,
      }),
    );
    expect(snakeCaseResponse.statusCode).toBe(200);

    const camelCaseResponse = await writingHelperProcessEndpoint(
      makeRequest({
        content: 'Second draft.',
        mode: 'outline',
        maxSentences: 2,
        maxItems: 4,
      }),
    );
    expect(camelCaseResponse.statusCode).toBe(200);

    expect(processWritingHelper).toHaveBeenNthCalledWith(1, {
      content: 'First draft.',
      mode: 'summarize',
      instruction: '',
      maxSentences: 3,
      maxItems: undefined,
    });
    expect(processWritingHelper).toHaveBeenNthCalledWith(2, {
      content: 'Second draft.',
      mode: 'outline',
      instruction: '',
      maxSentences: 2,
      maxItems: 4,
    });
  });

  it('returns non-outline remote LLM results as processed text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: 'Polished result.',
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingHelperProcessEndpoint(
      makeRequest({
        content: 'Original text.',
        mode: 'polish',
        api_key: 'sk-test-12345678901234567890',
        base_url: 'https://example.invalid/v1',
        model: 'gpt-4o-mini',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      mode: 'polish',
      processed_text: 'Polished result.',
      status: 'ok',
      skills_used: [],
    });
  });

  it('falls back to an empty body when parseBody throws in the stream endpoint', async () => {
    vi.doMock('../../mcp/http-types.js', async () => {
      const actual = await vi.importActual<typeof import('../../mcp/http-types.js')>(
        '../../mcp/http-types.js',
      );

      return {
        ...actual,
        parseBody: vi.fn(() => {
          throw new Error('bad body');
        }),
      };
    });

    const { writingStreamEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingStreamEndpoint(
      makeRequest({
        content: 'ignored',
        api_key: 'sk-test',
      }, '/writing-helper/stream'),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'content is required' });
  });

  it.each([
    ['rewrite', 'Rewrite result.'],
    ['expand', 'Expanded result.'],
    ['summarize', 'Summary result.'],
    ['custom-mode', 'Fallback result.'],
  ])('builds remote prompts for %s mode and ignores invalid skill id arrays', async (mode, content) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const skillsLoad = vi.fn();
    vi.doMock('../../mcp/services/skills.js', () => ({
      skillsLoad,
    }));

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingHelperProcessEndpoint(
      makeRequest({
        content: 'Original text.',
        mode,
        skill_ids: [42, '   ', null],
        api_key: 'sk-test-12345678901234567890',
        base_url: 'https://example.invalid/v1',
        model: 'gpt-4o-mini',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      mode,
      processed_text: content,
      status: 'ok',
      skills_used: [],
    });
    expect(skillsLoad).not.toHaveBeenCalled();
  });

  it('falls back to empty bodies when parseBody throws for quality and process endpoints', async () => {
    vi.doMock('../../mcp/http-types.js', async () => {
      const actual = await vi.importActual<typeof import('../../mcp/http-types.js')>(
        '../../mcp/http-types.js',
      );

      return {
        ...actual,
        parseBody: vi.fn(() => {
          throw new Error('bad body');
        }),
      };
    });

    const { novelQualityCheckEndpoint, writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    const qualityResponse = await novelQualityCheckEndpoint(
      makeRequest({ content: 'ignored' }, '/novel-quality-check'),
    );
    expect(qualityResponse.statusCode).toBe(400);
    expect(qualityResponse.body).toEqual({ error: 'content is required' });

    const processResponse = await writingHelperProcessEndpoint(
      makeRequest({ content: 'ignored' }),
    );
    expect(processResponse.statusCode).toBe(400);
    expect(processResponse.body).toEqual({ error: 'content is required' });
  });
});
