import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';
import {
  getConfig,
  getSecrets,
  reloadConfig,
  setConfigAccess,
  updateConfig,
  updateSecrets,
} from '../../mcp/endpoints/config.js';

function makeRequest(body: unknown): HttpRequest {
  return {
    method: 'POST',
    url: '/config',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function clearConfigAccess(): void {
  setConfigAccess(null as unknown as Parameters<typeof setConfigAccess>[0]);
}

afterEach(() => {
  clearConfigAccess();
  vi.restoreAllMocks();
});

describe('config endpoints additional coverage', () => {
  it('returns initialization errors when config access is unavailable', async () => {
    clearConfigAccess();

    expect((await getConfig(makeRequest({}))).statusCode).toBe(500);
    expect((await updateConfig(makeRequest({ fields: { 'agent.default_model': 'gpt-5' } }))).statusCode).toBe(500);
    expect((await getSecrets(makeRequest({}))).statusCode).toBe(500);
    expect((await updateSecrets(makeRequest({ secrets: { 'agent.openai_api_key': 'x' } }))).statusCode).toBe(500);
    expect((await reloadConfig(makeRequest({}))).statusCode).toBe(500);
  });

  it('surfaces read and reload failures through structured 500 responses', async () => {
    const boom = new Error('boom');
    setConfigAccess({
      getConfig: () => {
        throw boom;
      },
      getConfigValue: () => {
        throw boom;
      },
      setConfigValue: vi.fn(),
      reloadConfig: () => {
        throw boom;
      },
    });

    expect((await getConfig(makeRequest({}))).body).toEqual({
      error: 'Failed to get configuration: Error: boom',
    });
    expect((await getSecrets(makeRequest({}))).body).toEqual({
      error: 'Failed to get secrets: Error: boom',
    });
    expect((await reloadConfig(makeRequest({}))).body).toEqual({
      error: 'Failed to reload configuration: Error: boom',
    });
  });

  it('validates config field payloads and reports partial update failures', async () => {
    const setConfigValueMock = vi.fn((key: string) => {
      if (key === 'agent.default_model') {
        throw new Error('setter failed');
      }
    });

    setConfigAccess({
      getConfig: () => ({}),
      getConfigValue: vi.fn(),
      setConfigValue: setConfigValueMock,
      reloadConfig: vi.fn(),
    });

    const empty = await updateConfig(makeRequest({ fields: {} }));
    expect(empty.statusCode).toBe(400);
    expect(empty.body).toEqual({ error: 'No fields provided for update' });

    const partial = await updateConfig(makeRequest({
      fields: {
        'agent.default_model': 'gpt-5',
        'agent.max_tokens_per_request': 4096,
        'not.allowed': true,
      },
    }));

    expect(partial.statusCode).toBe(400);
    expect(partial.body).toEqual({
      status: 'ok',
      updated: ['agent.max_tokens_per_request'],
      errors: [
        { field: 'agent.default_model', error: 'Error: setter failed' },
        { field: 'not.allowed', error: "Field 'not.allowed' is not modifiable via API" },
      ],
    });
  });

  it('handles malformed config update requests at the top-level catch', async () => {
    setConfigAccess({
      getConfig: () => ({}),
      getConfigValue: vi.fn(),
      setConfigValue: vi.fn(),
      reloadConfig: vi.fn(),
    });

    const request = { ...makeRequest({}) };
    Object.defineProperty(request, 'body', {
      get() {
        throw new Error('body exploded');
      },
    });

    const response = await updateConfig(request);
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'Failed to update configuration: Error: body exploded',
    });
  });

  it('validates secret payloads, reports setter failures, and catches malformed bodies', async () => {
    const setConfigValueMock = vi.fn((key: string) => {
      if (key === 'agent.openai_api_key') {
        throw new Error('secret setter failed');
      }
    });

    setConfigAccess({
      getConfig: () => ({}),
      getConfigValue: vi.fn(),
      setConfigValue: setConfigValueMock,
      reloadConfig: vi.fn(),
    });

    const empty = await updateSecrets(makeRequest({ secrets: {} }));
    expect(empty.statusCode).toBe(400);
    expect(empty.body).toEqual({ error: 'No secrets provided for update' });

    const partial = await updateSecrets(makeRequest({
      secrets: {
        'agent.openai_api_key': 'secret',
        'backup.s3_secret_access_key': 's3-secret',
        'not.a.secret': 'bad',
      },
    }));

    expect(partial.statusCode).toBe(400);
    expect(partial.body).toEqual({
      status: 'ok',
      updated: ['backup.s3_secret_access_key'],
      errors: [
        { field: 'agent.openai_api_key', error: 'Error: secret setter failed' },
        { field: 'not.a.secret', error: "Field 'not.a.secret' is not a secret field" },
      ],
    });

    const request = { ...makeRequest({}) };
    Object.defineProperty(request, 'body', {
      get() {
        throw new Error('secret body exploded');
      },
    });

    const malformed = await updateSecrets(request);
    expect(malformed.statusCode).toBe(500);
    expect(malformed.body).toEqual({
      error: 'Failed to update secrets: Error: secret body exploded',
    });
  });
});
