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

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/memory/upload',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('memory endpoints additional coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
  });

  it('routes memory search through workspace scope and focus-entity fallbacks', async () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = 'C:/workspace-root';
    process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';
    memorySearchMock.mockResolvedValueOnce({ hits: ['match-1'] });

    const { memorySearchEndpoint } = await import('../../mcp/endpoints/memory.js');
    const response = await memorySearchEndpoint({
      ...makeRequest({
        query: 'hero memory',
        dimensions: ['character'],
        use_focus_entity: true,
        user_id: ' user-1 ',
        at_time: ' 2026-06-06T00:00:00Z ',
        limit: 3,
      }),
      url: '/memory/search',
    });

    expect(normalizeProjectWorkspaceContextMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'hero memory' }),
      expect.objectContaining({ workspaceRoot: expect.stringContaining('workspace-root') }),
    );
    expect(projectWorkspaceToMemoryScopeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ includeFocusEntity: true }),
    );
    expect(memorySearchMock).toHaveBeenCalledWith({
      query: 'hero memory',
      layer: undefined,
      dimensions: ['character'],
      entityId: 'scope-entity',
      userId: 'user-1',
      projectId: 'scope-project',
      sessionId: 'scope-session',
      atTime: '2026-06-06T00:00:00Z',
      limit: 3,
    });
    expect(response).toMatchObject({
      statusCode: 200,
      body: { hits: ['match-1'] },
    });
  });

  it('prefers explicit search and temporal ids over derived workspace scope', async () => {
    memorySearchMock.mockResolvedValueOnce({ hits: ['explicit-hit'] });
    memoryGetTemporalMock.mockResolvedValueOnce({ events: ['t-1'] });

    const { memorySearchEndpoint, memoryTemporalEndpoint } = await import('../../mcp/endpoints/memory.js');

    const searchResponse = await memorySearchEndpoint({
      ...makeRequest({
        query: 'explicit memory',
        entity_id: ' explicit-entity ',
        project_id: ' explicit-project ',
        session_id: ' explicit-session ',
        use_focus_entity: true,
      }),
      url: '/memory/search',
    });
    expect(projectWorkspaceToMemoryScopeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ includeFocusEntity: false }),
    );
    expect(memorySearchMock).toHaveBeenCalledWith({
      query: 'explicit memory',
      layer: undefined,
      dimensions: undefined,
      entityId: 'explicit-entity',
      userId: undefined,
      projectId: 'explicit-project',
      sessionId: 'explicit-session',
      atTime: undefined,
      limit: 10,
    });
    expect(searchResponse.statusCode).toBe(200);

    const temporalResponse = await memoryTemporalEndpoint({
      ...makeRequest({
        entity_id: ' temporal-entity ',
        project_id: ' project-temporal ',
        session_id: ' session-temporal ',
        user_id: ' user-temporal ',
        at_time: ' 2026-06-06T01:02:03Z ',
      }),
      url: '/memory/temporal',
    });

    expect(memoryGetTemporalMock).toHaveBeenCalledWith(
      'temporal-entity',
      '2026-06-06T01:02:03Z',
      {
        userId: 'user-temporal',
        projectId: 'project-temporal',
        sessionId: 'session-temporal',
      },
    );
    expect(temporalResponse).toMatchObject({
      statusCode: 200,
      body: { events: ['t-1'] },
    });
  });

  it('validates missing upload fields before parsing files', async () => {
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');

    await expect(memoryUploadEndpoint(makeRequest({
      file_content_base64: Buffer.from('x').toString('base64'),
      session_id: 'sess-1',
    }))).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'file_name is required' },
    });

    await expect(memoryUploadEndpoint(makeRequest({
      file_name: 'notes.txt',
      session_id: 'sess-1',
    }))).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'file_content_base64 is required' },
    });

    projectWorkspaceToMemoryScopeMock.mockReturnValueOnce({
      entityId: 'scope-entity',
      projectId: 'scope-project',
      sessionId: undefined,
    });

    await expect(memoryUploadEndpoint(makeRequest({
      file_name: 'notes.txt',
      file_content_base64: Buffer.from('x').toString('base64'),
    }))).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'session_id is required' },
    });
  });

  it('handles parsed files with no readable text and generic parser failures', async () => {
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');

    loadFileAsyncMock.mockResolvedValueOnce('   ');
    const emptyResponse = await memoryUploadEndpoint(makeRequest({
      file_name: 'data:text/plain',
      file_content_base64: `data:text/plain;base64,${Buffer.from('ignored').toString('base64')}`,
      session_id: 'sess-empty',
    }));
    expect(emptyResponse).toMatchObject({
      statusCode: 400,
      body: { error: 'file contains no readable text' },
    });

    loadFileAsyncMock.mockRejectedValueOnce(new Error('boom'));
    const failedResponse = await memoryUploadEndpoint(makeRequest({
      file_name: 'broken.txt',
      file_content_base64: Buffer.from('ignored').toString('base64'),
      session_id: 'sess-fail',
    }));
    expect(failedResponse).toMatchObject({
      statusCode: 400,
      body: { error: 'failed to parse file: Error: boom' },
    });
  });

  it('normalizes chunk overlap and rejects files that produce no chunks', async () => {
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');

    loadFileAsyncMock.mockResolvedValueOnce('Alpha paragraph');
    recursiveCharacterSplitMock.mockReturnValueOnce([]);

    const response = await memoryUploadEndpoint(makeRequest({
      file_name: 'alpha.txt',
      file_content_base64: Buffer.from('ignored').toString('base64'),
      session_id: 'sess-chunks',
      chunk_size: 10,
      chunk_overlap: 10,
    }));

    expect(recursiveCharacterSplitMock).toHaveBeenCalledWith('Alpha paragraph', 10, 2);
    expect(response).toMatchObject({
      statusCode: 400,
      body: { error: 'file contains no indexable chunks' },
    });
  });

  it('returns 500 when chunk injection completes without producing any memory ids', async () => {
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');

    loadFileAsyncMock.mockResolvedValueOnce('Chunk one\n\nChunk two');
    recursiveCharacterSplitMock.mockReturnValueOnce(['Chunk one', 'Chunk two']);
    memoryAddMock.mockResolvedValue({ status: 'created' });

    const response = await memoryUploadEndpoint(makeRequest({
      file_name: 'batch.txt',
      file_content_base64: Buffer.from('ignored').toString('base64'),
      session_id: 'sess-no-ids',
    }));

    expect(memoryAddMock).toHaveBeenCalledTimes(2);
    expect(response).toMatchObject({
      statusCode: 500,
      body: { error: 'failed to inject any file chunks' },
    });
  });

  it('rejects decoded uploads when the first base64 decode produces an empty buffer', async () => {
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');
    const originalFrom = Buffer.from.bind(Buffer);
    const decodeSpy = vi.spyOn(Buffer, 'from');
    decodeSpy.mockImplementation((((...args: unknown[]) => {
      const [value, encoding] = args as [string, BufferEncoding | undefined];
      if (value === 'QQ==' && encoding === 'base64') {
        return Buffer.alloc(0);
      }
      return args.length >= 2
        ? originalFrom(value as never, encoding as never)
        : originalFrom(value as never);
    }) as unknown) as typeof Buffer.from);
    const response = await memoryUploadEndpoint(makeRequest({
      file_name: 'empty.bin',
      file_content_base64: 'QQ==',
      session_id: 'sess-empty-buffer',
    }));

    expect(response).toMatchObject({
      statusCode: 400,
      body: { error: 'invalid file_content_base64' },
    });
  });

  it('rejects decoded uploads when the round-trip base64 validation changes the buffer length', async () => {
    const originalFrom = Buffer.from.bind(Buffer);
    const decodeSpy = vi.spyOn(Buffer, 'from');
    let matchingDecodeCount = 0;
    decodeSpy.mockImplementation((((...args: unknown[]) => {
      const [value, encoding] = args as [string, BufferEncoding | undefined];
      if (value === 'QQ==' && encoding === 'base64') {
        matchingDecodeCount += 1;
        return matchingDecodeCount === 1
          ? originalFrom.call(Buffer, 'A')
          : originalFrom.call(Buffer, 'AA');
      }
      return args.length >= 2
        ? originalFrom.call(Buffer, value as never, encoding as never)
        : originalFrom.call(Buffer, value as never);
    }) as unknown) as typeof Buffer.from);
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');
    const response = await memoryUploadEndpoint(makeRequest({
      file_name: 'mismatch.bin',
      file_content_base64: 'QQ==',
      session_id: 'sess-roundtrip',
    }));

    expect(matchingDecodeCount).toBeGreaterThanOrEqual(2);
    expect(response).toMatchObject({
      statusCode: 400,
      body: { error: 'invalid file_content_base64' },
    });
  });

  it('maps unexpected base64 decoding failures through the generic catch branch', async () => {
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');
    const originalFrom = Buffer.from.bind(Buffer);
    const decodeSpy = vi.spyOn(Buffer, 'from');
    decodeSpy.mockImplementation(((value: string, encoding?: BufferEncoding) => {
      if (encoding === 'base64' && value === 'QQ==') {
        throw new Error('decoder exploded');
      }
      return originalFrom(value as never, encoding as never);
    }) as typeof Buffer.from);
    const response = await memoryUploadEndpoint(makeRequest({
      file_name: 'boom.bin',
      file_content_base64: 'QQ==',
      session_id: 'sess-throw',
    }));

    expect(response).toMatchObject({
      statusCode: 400,
      body: { error: 'invalid file_content_base64' },
    });
  });
});
