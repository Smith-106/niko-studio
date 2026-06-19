import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import {
  clearValidationCache,
  qcGetCreativityConfigEndpoint,
  qcValidateOutputEndpoint,
} from '../../knowledge/mcp/qc-endpoints.js';
import {
  CreativityPreset,
  QCEforcementMode,
  createDefaultCreativityConfig,
  resolveCreativityConfig,
} from '../../quality/types.js';

function mockRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/qc',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function getBody(response: HttpResponse) {
  return response.body as any;
}

afterEach(() => {
  clearValidationCache();
  vi.restoreAllMocks();
});

describe('knowledge/mcp/qc-endpoints', () => {
  it('validates required QC payload fields', async () => {
    const missingText = await qcValidateOutputEndpoint(
      mockRequest({ mode: 'auto' }),
    );
    expect(missingText.statusCode).toBe(400);
    expect(getBody(missingText).error).toBe('text is required and must be a non-empty string');

    const missingMode = await qcValidateOutputEndpoint(
      mockRequest({ text: 'valid text' }),
    );
    expect(missingMode.statusCode).toBe(400);
    expect(getBody(missingMode).error).toBe('mode is required and must be a string');

    const blankText = await qcValidateOutputEndpoint(
      mockRequest({ text: '   ', mode: 'guided' }),
    );
    expect(blankText.statusCode).toBe(400);
    expect(getBody(blankText).error).toBe('text is required and must be a non-empty string');
  });

  it('runs validation in advisory mode and reuses cached results', async () => {
    const longSentence = `${'A'.repeat(90)}。`;

    const first = await qcValidateOutputEndpoint(
      mockRequest({ text: longSentence, mode: 'directed' }),
    );
    expect(first.statusCode).toBe(200);
    expect(getBody(first).cached).toBeUndefined();
    expect(getBody(first).result).toMatchObject({
      mode: QCEforcementMode.ADVISORY,
      allowed: true,
      blocked: [],
    });
    expect(getBody(first).result.warnings).toHaveLength(1);
    expect(getBody(first).result.warnings[0]).toMatchObject({
      message: 'Sentences are too long, may affect readability',
      evidence: 'Average sentence length: 91 characters',
    });
    expect(getBody(first).result.creativityConfig).toEqual(
      createDefaultCreativityConfig('directed'),
    );

    const second = await qcValidateOutputEndpoint(
      mockRequest({ text: longSentence, mode: 'directed' }),
    );
    expect(second.statusCode).toBe(200);
    expect(getBody(second).cached).toBe(true);
    expect(getBody(second).result).toEqual(getBody(first).result);
  });

  it('accepts caller-supplied creativity config and defaults unknown modes to blocking', async () => {
    const customConfig = resolveCreativityConfig(
      CreativityPreset.EXPERIMENTAL,
      'auto',
      0.91,
    );

    const response = await qcValidateOutputEndpoint(
      mockRequest({
        text: 'Short coherent text.',
        mode: 'mystery',
        creativityConfig: customConfig,
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).result).toMatchObject({
      mode: QCEforcementMode.BLOCKING,
      allowed: true,
      blocked: [],
      warnings: [],
      creativityConfig: customConfig,
    });
  });

  it('clears the validation cache explicitly', async () => {
    const body = {
      text: 'First run should populate cache.',
      mode: 'auto',
    };

    const first = await qcValidateOutputEndpoint(mockRequest(body));
    expect(first.statusCode).toBe(200);

    const cached = await qcValidateOutputEndpoint(mockRequest(body));
    expect(getBody(cached).cached).toBe(true);

    clearValidationCache();

    const afterClear = await qcValidateOutputEndpoint(mockRequest(body));
    expect(afterClear.statusCode).toBe(200);
    expect(getBody(afterClear).cached).toBeUndefined();
  });

  it('prunes oldest cache entries once the cache grows past capacity', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => 1_000);

    for (let index = 0; index <= 100; index += 1) {
      const response = await qcValidateOutputEndpoint(
        mockRequest({
          text: `cache-entry-${index}`,
          mode: 'auto',
        }),
      );
      expect(response.statusCode).toBe(200);
    }

    const firstAgain = await qcValidateOutputEndpoint(
      mockRequest({
        text: 'cache-entry-0',
        mode: 'auto',
      }),
    );
    expect(firstAgain.statusCode).toBe(200);
    expect(getBody(firstAgain).cached).toBeUndefined();

    nowSpy.mockRestore();
  });

  it('drops expired cache entries during pruning when they exceed TTL', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    for (let index = 0; index < 100; index += 1) {
      const response = await qcValidateOutputEndpoint(
        mockRequest({
          text: `expired-entry-${index}`,
          mode: 'guided',
        }),
      );
      expect(response.statusCode).toBe(200);
    }

    now = 31_000;

    const trigger = await qcValidateOutputEndpoint(
      mockRequest({
        text: 'fresh-entry-trigger',
        mode: 'guided',
      }),
    );
    expect(trigger.statusCode).toBe(200);

    const firstExpiredAgain = await qcValidateOutputEndpoint(
      mockRequest({
        text: 'expired-entry-0',
        mode: 'guided',
      }),
    );
    expect(firstExpiredAgain.statusCode).toBe(200);
    expect(getBody(firstExpiredAgain).cached).toBeUndefined();
  });

  it('validates creativity config requests and resolves presets with custom values', async () => {
    const missingMode = await qcGetCreativityConfigEndpoint(mockRequest({}));
    expect(missingMode.statusCode).toBe(400);
    expect(getBody(missingMode).error).toBe('mode is required and must be a string');

    const explicitPreset = await qcGetCreativityConfigEndpoint(
      mockRequest({
        mode: 'guided',
        preset: CreativityPreset.CREATIVE,
        customValue: 0.42,
      }),
    );
    expect(explicitPreset.statusCode).toBe(200);
    expect(getBody(explicitPreset).config).toEqual(
      resolveCreativityConfig(CreativityPreset.CREATIVE, 'guided', 0.42),
    );

    const fallbackDefault = await qcGetCreativityConfigEndpoint(
      mockRequest({
        mode: 'directed',
        preset: 'not-a-preset',
      }),
    );
    expect(fallbackDefault.statusCode).toBe(200);
    expect(getBody(fallbackDefault).config).toEqual(
      createDefaultCreativityConfig('directed'),
    );
  });
});
