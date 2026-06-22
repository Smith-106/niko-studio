import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const memorySearchMock = vi.fn();
const memoryAddMock = vi.fn();
const memoryGetTemporalMock = vi.fn();
const normalizeProjectWorkspaceContextMock = vi.fn((body: Record<string, unknown>) => body);
const projectWorkspaceToMemoryScopeMock = vi.fn(() => ({
  entityId: 'scope-entity',
  projectId: 'scope-project',
  sessionId: 'scope-session',
}));
const loadFileAsyncMock = vi.fn();
const recursiveCharacterSplitMock = vi.fn();

class MockDocumentLoadError extends Error {
  toResponseBody(fileName: string) {
    return { error: `mock-document-error:${fileName}` };
  }
}

vi.mock('../../mcp/services/memory', () => ({
  memorySearch: memorySearchMock,
  memoryAdd: memoryAddMock,
  memoryGetTemporal: memoryGetTemporalMock,
}));

vi.mock('../../project/workspace-model.js', () => ({
  normalizeProjectWorkspaceContext: normalizeProjectWorkspaceContextMock,
  projectWorkspaceToMemoryScope: projectWorkspaceToMemoryScopeMock,
}));

vi.mock('../../services/document-loader', () => ({
  DocumentLoadError: MockDocumentLoadError,
  DocumentLoader: {
    loadFileAsync: loadFileAsyncMock,
  },
}));

vi.mock('../../ui/file-utils', () => ({
  recursiveCharacterSplit: recursiveCharacterSplitMock,
}));

function makeRequest(body: Record<string, unknown>, url = '/memory/upload'): HttpRequest {
  return {
    method: 'POST',
    url,
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('memory endpoints branch gap coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
  });

  it('defaults empty search and add payload strings to generic fallbacks', async () => {
    memorySearchMock.mockResolvedValueOnce({ hits: [] });
    memoryAddMock.mockResolvedValueOnce({ id: 'mem-generic', status: 'created' });

    const { memorySearchEndpoint, memoryAddEndpoint } = await import('../../mcp/endpoints/memory.js');

    await memorySearchEndpoint(makeRequest({
      query: undefined,
      user_id: '   ',
      project_id: '   ',
      session_id: '   ',
      entity_id: '   ',
    }, '/memory/search'));

    expect(memorySearchMock).toHaveBeenCalledWith({
      query: '',
      layer: undefined,
      dimensions: undefined,
      entityId: 'scope-entity',
      userId: undefined,
      projectId: 'scope-project',
      sessionId: 'scope-session',
      atTime: undefined,
      limit: 10,
    });

    await memoryAddEndpoint(makeRequest({
      content: undefined,
      layer: undefined,
      source: '   ',
      project_id: '   ',
      session_id: '   ',
      entity_id: '   ',
    }, '/memory/add'));

    expect(memoryAddMock).toHaveBeenCalledWith({
      content: '',
      layer: 'session',
      dimension: undefined,
      entityId: 'scope-entity',
      validFrom: undefined,
      validUntil: undefined,
      userId: undefined,
      projectId: 'scope-project',
      sessionId: 'scope-session',
      importance: 0.5,
      tags: [],
      source: undefined,
      confidence: undefined,
    });
  });

  it('normalizes negative chunk settings, falls back to uploaded_file, and skips blank chunks', async () => {
    memoryAddMock.mockResolvedValueOnce({ id: 'mem-uploaded-file' });
    loadFileAsyncMock.mockResolvedValueOnce('Chunk payload');
    recursiveCharacterSplitMock.mockReturnValueOnce(['   ', 'Useful chunk']);

    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');
    const response = await memoryUploadEndpoint(makeRequest({
      file_name: '!!!',
      file_content_base64: Buffer.from('payload').toString('base64'),
      session_id: 'sess-branch-gap',
      chunk_size: 0,
      chunk_overlap: -5,
    }));

    expect(recursiveCharacterSplitMock).toHaveBeenCalledWith('Chunk payload', 1000, 0);
    expect(memoryAddMock).toHaveBeenCalledTimes(1);
    expect(memoryAddMock).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Useful chunk',
      entityId: 'sess-branch-gap',
      tags: expect.arrayContaining([
        'uploaded_material',
        'filename:uploaded_file',
        'session:sess-branch-gap',
        'chunk:1',
        'chunk_id:sess-branch-gap_uploaded_file_part_1',
      ]),
    }));
    expect(response).toMatchObject({
      statusCode: 200,
      body: {
        status: 'created',
        file_name: '!!!',
        session_id: 'sess-branch-gap',
        chunks: 1,
        memory_ids: ['mem-uploaded-file'],
      },
    });
  });

  it('falls back to an empty temporal entity id when the caller only provides whitespace', async () => {
    memoryGetTemporalMock.mockResolvedValueOnce({ events: [] });

    const { memoryTemporalEndpoint } = await import('../../mcp/endpoints/memory.js');
    const response = await memoryTemporalEndpoint(makeRequest({
      entity_id: '   ',
      project_id: '   ',
      session_id: '   ',
      user_id: '   ',
    }, '/memory/temporal'));

    expect(memoryGetTemporalMock).toHaveBeenCalledWith('', undefined, {
      userId: undefined,
      projectId: 'scope-project',
      sessionId: 'scope-session',
    });
    expect(response).toMatchObject({
      statusCode: 200,
      body: { events: [] },
    });
  });
});
