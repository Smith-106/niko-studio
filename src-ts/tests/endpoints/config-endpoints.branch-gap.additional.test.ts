import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';
import {
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

describe('config endpoints branch gap coverage', () => {
  it('treats omitted or null config fields as an empty update payload', async () => {
    setConfigAccess({
      getConfig: () => ({}),
      getConfigValue: vi.fn(),
      setConfigValue: vi.fn(),
      reloadConfig: vi.fn(),
    });

    await expect(updateConfig(makeRequest({}))).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'No fields provided for update' },
    });
    await expect(updateConfig(makeRequest({ fields: null }))).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'No fields provided for update' },
    });
  });

  it('treats omitted or null secret fields as an empty update payload', async () => {
    setConfigAccess({
      getConfig: () => ({}),
      getConfigValue: vi.fn(),
      setConfigValue: vi.fn(),
      reloadConfig: vi.fn(),
    });

    await expect(updateSecrets(makeRequest({}))).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'No secrets provided for update' },
    });
    await expect(updateSecrets(makeRequest({ secrets: null }))).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'No secrets provided for update' },
    });
  });
});
