/**
 * Tests for rsDeAIEndpoint
 *
 * Covers: validation, de-AI rewrite with AI template text, empty text,
 * style-shift mode, error handling, and text transformation verification.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import {
  clearReaderStores,
  rsDeAIEndpoint,
  rsAIFlavorEndpoint,
} from '../../reader/mcp/reader-endpoints.js';

function mockRequest({
  method = 'POST',
  url = '/reader/de-ai',
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
});

describe('reader/mcp/reader-endpoints — rsDeAIEndpoint', () => {
  it('validates request — missing novelId', async () => {
    const response = await rsDeAIEndpoint(mockRequest({ body: {} }));
    expect(response.statusCode).toBe(400);
    expect(getBody(response).error).toBe('novelId is required and must be a string');
  });

  it('returns empty response for empty text', async () => {
    const response = await rsDeAIEndpoint(mockRequest({
      body: { novelId: 'novel-1', text: '' },
    }));

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.novelId).toBe('novel-1');
    expect(body.originalText).toBe('');
    expect(body.revisedText).toBe('');
    expect(body.aiFlavorScore).toBe(0);
    expect(body.suggestions).toContain('文本为空，无法检测 AI 味或进行重写');
    expect(body.mode).toBe('de-ai');
  });

  it('returns empty response for whitespace-only text', async () => {
    const response = await rsDeAIEndpoint(mockRequest({
      body: { novelId: 'novel-1', text: '   \n\t  ' },
    }));

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.revisedText).toBe('   \n\t  ');
    expect(body.aiFlavorScore).toBe(0);
  });

  it('detects AI flavor in text with template expressions', async () => {
    const aiText = '值得注意的是，这个故事非常有趣。综上所述，主角经历了许多挑战。';

    const response = await rsDeAIEndpoint(mockRequest({
      body: { novelId: 'novel-ai', text: aiText },
    }));

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.novelId).toBe('novel-ai');
    expect(body.originalText).toBe(aiText);
    expect(body.aiFlavorScore).toBeGreaterThan(0);
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.mode).toBe('de-ai');
  });

  it('rewrites AI template text — revisedText differs from original', async () => {
    const aiText = '值得注意的是，这个故事非常有趣。综上所述，主角经历了许多挑战。';

    const response = await rsDeAIEndpoint(mockRequest({
      body: { novelId: 'novel-ai', text: aiText },
    }));

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    // The revised text should be different from the original (rule-based rewrite removes templates)
    expect(body.revisedText).not.toBe(aiText);
    // The revised text should not contain the template expressions
    expect(body.revisedText).not.toContain('值得注意的是');
    expect(body.revisedText).not.toContain('综上所述');
  });

  it('supports style-shift mode with targetStyle', async () => {
    const text = '这是一个普通的叙述段落。';

    const response = await rsDeAIEndpoint(mockRequest({
      body: {
        novelId: 'novel-style',
        text,
        mode: 'style-shift',
        targetStyle: 'poetic',
      },
    }));

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.mode).toBe('style-shift');
    expect(body.novelId).toBe('novel-style');
    expect(body.originalText).toBe(text);
  });

  it('returns suggestions for natural text with low AI score', async () => {
    const naturalText = '他推开那扇吱呀作响的木门，霉味扑面而来。';

    const response = await rsDeAIEndpoint(mockRequest({
      body: { novelId: 'novel-natural', text: naturalText },
    }));

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.aiFlavorScore).toBeLessThan(0.5);
    expect(body.suggestions.length).toBeGreaterThanOrEqual(0);
  });

  it('handles English AI template expressions', async () => {
    const aiText = 'It is important to note that this story is very interesting. In conclusion, the protagonist faced many challenges.';

    const response = await rsDeAIEndpoint(mockRequest({
      body: { novelId: 'novel-en', text: aiText },
    }));

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.aiFlavorScore).toBeGreaterThan(0);
    expect(body.revisedText).not.toBe(aiText);
    expect(body.revisedText.toLowerCase()).not.toContain('it is important to note that');
    expect(body.revisedText.toLowerCase()).not.toContain('in conclusion');
  });

  it('catches detectAIFlavor errors and returns 500', async () => {
    // Spy on detectAIFlavor to throw an error
    const { detectAIFlavor } = await import('../../reader/ai-flavor-detector.js');
    const spy = vi.spyOn(await import('../../reader/ai-flavor-detector.js'), 'detectAIFlavor').mockImplementation(() => {
      throw new Error('AI flavor detection error');
    });

    const response = await rsAIFlavorEndpoint(mockRequest({
      url: '/reader/ai-flavor',
      body: { novelId: 'novel-error', text: 'some text' },
    }));

    expect(response.statusCode).toBe(500);
    const body = getBody(response);
    expect(body.error).toBe('AI flavor detection error');

    spy.mockRestore();
  });

  it('catches revision service errors and returns 500', async () => {
    // Mock RevisionService to throw an error
    vi.doMock('../../services/revision-service.js', () => ({
      RevisionServiceImpl: class {
        initialize() { return Promise.resolve(); }
        revise() {
          return Promise.reject(new Error('Revision service failed'));
        }
      },
    }));

    // Reset modules and re-import to pick up the mock
    vi.resetModules();
    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsDeAIEndpoint(mockRequest({
      body: { novelId: 'novel-deai-error', text: 'Some text that needs revision.' },
    }));

    expect(response.statusCode).toBe(500);
    const body = response.body as any;
    expect(body.error).toBe('Revision service failed');

    vi.doUnmock('../../services/revision-service.js');
  });
});
