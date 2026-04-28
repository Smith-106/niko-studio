import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const memoryAddMock = vi.fn();
const mammothExtractRawTextMock = vi.fn();
const pdfParseMock = vi.fn();
const pdfDestroyMock = vi.fn();

vi.mock('../../mcp/services/memory', () => ({
  memoryAdd: memoryAddMock,
  memorySearch: vi.fn(),
  memoryGetTemporal: vi.fn(),
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/memory',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('memory endpoints', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unmock('mammoth');
    vi.unmock('pdf-parse');
  });

  it('maps snake_case add payload fields into memory service parameters', async () => {
    memoryAddMock.mockResolvedValueOnce({ id: 'mem-endpoint', status: 'created' });

    const { memoryAddEndpoint } = await import('../../mcp/endpoints/memory.js');

    const response = await memoryAddEndpoint(
      makeRequest({
        content: 'endpoint memory',
        layer: 'project',
        dimension: 'character',
        entity_id: 'hero-endpoint',
        valid_from: '2026-04-01T00:00:00Z',
        valid_until: '2026-08-01T00:00:00Z',
        user_id: 'user-endpoint',
        project_id: 'project-endpoint',
        session_id: 'session-endpoint',
        importance: 0.77,
        confidence: 0.66,
        source: 'endpoint-import',
        tags: ['phase4', 'endpoint'],
      }),
    );

    expect(memoryAddMock).toHaveBeenCalledWith({
      content: 'endpoint memory',
      layer: 'project',
      dimension: 'character',
      entityId: 'hero-endpoint',
      validFrom: '2026-04-01T00:00:00Z',
      validUntil: '2026-08-01T00:00:00Z',
      userId: 'user-endpoint',
      projectId: 'project-endpoint',
      sessionId: 'session-endpoint',
      importance: 0.77,
      confidence: 0.66,
      source: 'endpoint-import',
      tags: ['phase4', 'endpoint'],
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 'mem-endpoint', status: 'created' });
  });

  it('returns validation error for invalid upload base64 payload', async () => {
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');

    const response = await memoryUploadEndpoint(
      makeRequest({
        file_name: 'notes.txt',
        file_content_base64: 'not_base64@@@',
        session_id: 'sess-upload',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'invalid file_content_base64' });
  });

  it('returns structured parser prerequisite metadata for unsupported async document parser', async () => {
    vi.doMock('mammoth', () => {
      throw new Error('module not found');
    });
    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');

    const response = await memoryUploadEndpoint(
      makeRequest({
        file_name: 'upload.docx',
        file_content_base64: Buffer.from('fake-docx-binary').toString('base64'),
        session_id: 'sess-docx',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({
      error_code: 'PARSER_PREREQUISITE_MISSING',
      file_name: 'upload.docx',
      file_type: 'docx',
      mode: 'async',
      parser: 'mammoth',
      dependency: 'mammoth',
    });
  });

  it('uploads txt content, chunks it, and injects memory records', async () => {
    memoryAddMock.mockImplementation(async () => ({
      id: `mem-upload-${memoryAddMock.mock.calls.length}`,
      status: 'created',
    }));

    const longText = [
      'Paragraph one for upload coverage.',
      '',
      'Paragraph two keeps content long enough to produce another chunk when chunk_size is small.',
    ].join('\n');
    const payload = Buffer.from(longText, 'utf-8').toString('base64');

    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');
    const response = await memoryUploadEndpoint(
      makeRequest({
        file_name: 'upload.md',
        file_content_base64: payload,
        session_id: 'sess-upload',
        chunk_size: 40,
        chunk_overlap: 5,
        source: 'imported',
        confidence: 0.85,
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'created',
      file_name: 'upload.md',
      session_id: 'sess-upload',
    });
    expect(Array.isArray((response.body as Record<string, unknown>).memory_ids)).toBe(true);
    expect((response.body as Record<string, unknown>).chunks).toBeGreaterThan(0);

    expect(memoryAddMock).toHaveBeenCalledTimes((response.body as Record<string, unknown>).chunks as number);
    expect(memoryAddMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        layer: 'session',
        dimension: 'context',
        entityId: 'sess-upload',
        source: 'imported',
        confidence: 0.85,
        importance: 0.6,
      }),
    );
  });

  it('uploads docx content through mammoth extraction and injects memory records', async () => {
    memoryAddMock.mockImplementation(async () => ({
      id: `mem-docx-${memoryAddMock.mock.calls.length}`,
      status: 'created',
    }));
    mammothExtractRawTextMock.mockResolvedValue({
      value: 'DOCX paragraph one.\n\nDOCX paragraph two.',
    });
    vi.doMock('mammoth', () => ({
      extractRawText: mammothExtractRawTextMock,
    }));

    const payload = Buffer.from('fake-docx-binary').toString('base64');

    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');
    const response = await memoryUploadEndpoint(
      makeRequest({
        file_name: 'upload.docx',
        file_content_base64: payload,
        session_id: 'sess-docx',
        chunk_size: 32,
        chunk_overlap: 4,
      }),
    );

    expect(mammothExtractRawTextMock).toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'created',
      file_name: 'upload.docx',
      session_id: 'sess-docx',
    });
    expect((response.body as Record<string, unknown>).chunks).toBeGreaterThan(0);
    expect(memoryAddMock).toHaveBeenCalled();
  });

  it('uploads pdf content through pdf-parse extraction and injects memory records', async () => {
    memoryAddMock.mockImplementation(async () => ({
      id: `mem-pdf-${memoryAddMock.mock.calls.length}`,
      status: 'created',
    }));
    pdfParseMock.mockResolvedValue({
      text: 'PDF paragraph one.\n\nPDF paragraph two.',
    });
    vi.doMock('pdf-parse', () => ({
      PDFParse: vi.fn().mockImplementation(() => ({
        getText: pdfParseMock,
        destroy: pdfDestroyMock,
      })),
    }));

    const payload = Buffer.from('fake-pdf-binary').toString('base64');

    const { memoryUploadEndpoint } = await import('../../mcp/endpoints/memory.js');
    const response = await memoryUploadEndpoint(
      makeRequest({
        file_name: 'upload.pdf',
        file_content_base64: payload,
        session_id: 'sess-pdf',
        chunk_size: 32,
        chunk_overlap: 4,
      }),
    );

    expect(pdfParseMock).toHaveBeenCalled();
    expect(pdfDestroyMock).toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'created',
      file_name: 'upload.pdf',
      session_id: 'sess-pdf',
    });
    expect((response.body as Record<string, unknown>).chunks).toBeGreaterThan(0);
    expect(memoryAddMock).toHaveBeenCalled();
  });
});
