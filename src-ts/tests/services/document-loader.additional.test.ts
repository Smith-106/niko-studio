import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentLoadError } from '../../services/document-loader';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock('pdf-parse');
  vi.doUnmock('mammoth');
});

describe('DocumentLoadError additional coverage', () => {
  it('serializes nullable fields in response bodies', () => {
    const error = new DocumentLoadError('Failed to parse PDF file.', {
      code: 'PARSE_FAILED',
      fileType: 'pdf',
      mode: 'async',
      detail: 'parser failed',
    });

    expect(error.toResponseBody('draft.pdf')).toEqual({
      error: 'Failed to parse PDF file.',
      error_code: 'PARSE_FAILED',
      file_name: 'draft.pdf',
      file_type: 'pdf',
      mode: 'async',
      parser: null,
      dependency: null,
      install_command: null,
      detail: 'parser failed',
      action: null,
    });
  });
});

describe('DocumentLoader async parser branches', () => {
  it('treats invalid pdf-parse exports as missing prerequisites', async () => {
    vi.doMock('pdf-parse', () => ({
      PDFParse: 42,
    }));

    const { DocumentLoader } = await import('../../services/document-loader');

    await expect(
      DocumentLoader.loadFileAsync(Buffer.from('pdf'), 'draft.pdf'),
    ).rejects.toMatchObject({
      code: 'PARSER_PREREQUISITE_MISSING',
      fileType: 'pdf',
      dependency: 'pdf-parse',
      mode: 'async',
    });
  });

  it('returns empty text and destroys the PDF parser when no text is extracted', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const getText = vi.fn().mockResolvedValue({});
    const PDFParse = vi.fn().mockImplementation(() => ({
      getText,
      destroy,
    }));

    vi.doMock('pdf-parse', () => ({
      PDFParse,
    }));

    const { DocumentLoader } = await import('../../services/document-loader');

    await expect(
      DocumentLoader.loadFileAsync(Buffer.from('pdf'), 'draft.pdf'),
    ).resolves.toBe('');
    expect(PDFParse).toHaveBeenCalledWith({ data: expect.any(Buffer) });
    expect(getText).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('wraps PDF parser failures and still destroys the parser', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    const getText = vi.fn().mockRejectedValue(new Error('pdf exploded'));
    const PDFParse = vi.fn().mockImplementation(() => ({
      getText,
      destroy,
    }));

    vi.doMock('pdf-parse', () => ({
      PDFParse,
    }));

    const { DocumentLoader } = await import('../../services/document-loader');

    await expect(
      DocumentLoader.loadFileAsync(Buffer.from('pdf'), 'draft.pdf'),
    ).rejects.toMatchObject({
      code: 'PARSE_FAILED',
      fileType: 'pdf',
      dependency: 'pdf-parse',
      detail: 'pdf exploded',
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('uses the mammoth parser and falls back to an empty string', async () => {
    const extractRawText = vi.fn().mockResolvedValue({});

    vi.doMock('mammoth', () => ({
      extractRawText,
    }));

    const { DocumentLoader } = await import('../../services/document-loader');

    await expect(
      DocumentLoader.loadFileAsync(Buffer.from('docx'), 'draft.docx'),
    ).resolves.toBe('');
    expect(extractRawText).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
  });

  it('treats invalid mammoth exports as missing prerequisites', async () => {
    vi.doMock('mammoth', () => ({
      default: {},
    }));

    const { DocumentLoader } = await import('../../services/document-loader');

    await expect(
      DocumentLoader.loadFileAsync(Buffer.from('docx'), 'draft.docx'),
    ).rejects.toMatchObject({
      code: 'PARSER_PREREQUISITE_MISSING',
      fileType: 'docx',
      dependency: 'mammoth',
      mode: 'async',
    });
  });

  it('treats undefined mammoth exports as missing prerequisites after a successful import', async () => {
    vi.doMock('mammoth', () => ({
      extractRawText: undefined,
      default: undefined,
    }));

    const { DocumentLoader } = await import('../../services/document-loader');

    await expect(
      DocumentLoader.loadFileAsync(Buffer.from('docx'), 'draft.docx'),
    ).rejects.toMatchObject({
      code: 'PARSER_PREREQUISITE_MISSING',
      fileType: 'docx',
      dependency: 'mammoth',
      mode: 'async',
    });
  });

  it('wraps DOCX parser failures with the fallback detail for non-Error throws', async () => {
    const extractRawText = vi.fn().mockRejectedValue(undefined);

    vi.doMock('mammoth', () => ({
      extractRawText,
    }));

    const { DocumentLoader } = await import('../../services/document-loader');

    await expect(
      DocumentLoader.loadFileAsync(Buffer.from('docx'), 'draft.docx'),
    ).rejects.toMatchObject({
      code: 'PARSE_FAILED',
      fileType: 'docx',
      dependency: 'mammoth',
      detail: 'The DOCX parser reported an unknown failure.',
    });
  });
});
