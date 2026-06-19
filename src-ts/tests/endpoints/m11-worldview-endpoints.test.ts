import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const quickExtractMock = vi.hoisted(() => vi.fn());
const extractorCtorMock = vi.hoisted(() => vi.fn());
const logInfoMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());

function makeRequest(
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
): HttpRequest {
  return {
    method: 'POST',
    url: '/worldview',
    headers: {},
    body,
    query: {},
    params,
  };
}

async function loadWorldviewModule() {
  vi.resetModules();

  vi.doMock('../../narrative/worldview-extractor.js', () => ({
    WorldviewExtractor: vi.fn().mockImplementation(function WorldviewExtractor() {
      extractorCtorMock();
      return {
        quickExtract: quickExtractMock,
      };
    }),
  }));

  vi.doMock('../../logger/index.js', () => ({
    createLogger: () => ({
      info: logInfoMock,
      error: logErrorMock,
    }),
  }));

  return import('../../mcp/endpoints/m11-worldview.js');
}

describe('m11 worldview endpoints', () => {
  beforeEach(() => {
    quickExtractMock.mockReset();
    extractorCtorMock.mockReset();
    logInfoMock.mockReset();
    logErrorMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../narrative/worldview-extractor.js');
    vi.doUnmock('../../logger/index.js');
  });

  it('rejects extraction requests without chapters', async () => {
    const { worldviewExtractEndpoint } = await loadWorldviewModule();

    const response = await worldviewExtractEndpoint(makeRequest({ chapters: [] }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'chapters array is required' });
    expect(quickExtractMock).not.toHaveBeenCalled();
  });

  it('extracts worldview settings and reports their count', async () => {
    quickExtractMock.mockReturnValueOnce([
      { id: 'rule-1', name: 'No resurrection' },
      { id: 'rule-2', name: 'Magic has a cost' },
    ]);

    const { worldviewExtractEndpoint } = await loadWorldviewModule();
    const response = await worldviewExtractEndpoint(makeRequest({
      chapters: [
        { title: 'Opening', content: 'The mage pays a price.' },
        { title: 'Climax', content: 'The dead remain dead.' },
      ],
    }));

    expect(extractorCtorMock).toHaveBeenCalledTimes(1);
    expect(quickExtractMock).toHaveBeenCalledWith([
      { title: 'Opening', content: 'The mage pays a price.' },
      { title: 'Climax', content: 'The dead remain dead.' },
    ]);
    expect(response.body).toEqual({
      settings: [
        { id: 'rule-1', name: 'No resurrection' },
        { id: 'rule-2', name: 'Magic has a cost' },
      ],
      count: 2,
    });
    expect(logInfoMock).toHaveBeenCalledWith('Worldview extraction: 2 chapters');
    expect(logInfoMock).toHaveBeenCalledWith('Worldview extraction complete: 2 settings found');
  });

  it('returns an unknown error message for non-Error failures', async () => {
    quickExtractMock.mockImplementationOnce(() => {
      throw 'boom';
    });

    const { worldviewExtractEndpoint } = await loadWorldviewModule();
    const response = await worldviewExtractEndpoint(makeRequest({
      chapters: [{ title: 'Only', content: 'Broken extraction.' }],
    }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Unknown error' });
    expect(logErrorMock).toHaveBeenCalledWith('Worldview extraction failed: Unknown error');
  });

  it('treats missing chapters as empty and surfaces Error messages verbatim', async () => {
    const { worldviewExtractEndpoint } = await loadWorldviewModule();

    const missing = await worldviewExtractEndpoint(makeRequest({}));
    expect(missing.statusCode).toBe(400);
    expect(missing.body).toEqual({ error: 'chapters array is required' });

    quickExtractMock.mockImplementationOnce(() => {
      throw new Error('extract failed');
    });

    const failed = await worldviewExtractEndpoint(makeRequest({
      chapters: [{ title: 'Only', content: 'Broken extraction.' }],
    }));
    expect(failed.statusCode).toBe(500);
    expect(failed.body).toEqual({ error: 'extract failed' });
    expect(logErrorMock).toHaveBeenCalledWith('Worldview extraction failed: extract failed');
  });

  it('requires project id for lookup and returns an empty cache payload otherwise', async () => {
    const { worldviewGetEndpoint } = await loadWorldviewModule();

    const missing = await worldviewGetEndpoint(makeRequest({}, {}));
    expect(missing.statusCode).toBe(400);
    expect(missing.body).toEqual({ error: 'projectId is required' });

    const found = await worldviewGetEndpoint(makeRequest({}, { projectId: 'project-42' }));
    expect(found.statusCode).toBe(200);
    expect(found.body).toEqual({ settings: [], projectId: 'project-42' });
    expect(logInfoMock).toHaveBeenCalledWith('Worldview lookup: project=project-42');
  });
});
