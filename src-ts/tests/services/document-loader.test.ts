/**
 * DocumentLoader Tests
 *
 * Tests DocumentLoader file loading for txt, md, pdf, docx formats.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentLoadError, DocumentLoader } from '../../services/document-loader';

beforeEach(() => {
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
  vi.unmock('pdf-parse');
  vi.unmock('mammoth');
});

describe('DocumentLoader.loadFile', () => {
  it('loads txt files', () => {
    const buffer = Buffer.from('Plain text content', 'utf-8');
    const result = DocumentLoader.loadFile(buffer, 'test.txt');
    expect(result).toBe('Plain text content');
  });

  it('loads md files', () => {
    const buffer = Buffer.from('# Markdown content', 'utf-8');
    const result = DocumentLoader.loadFile(buffer, 'notes.md');
    expect(result).toBe('# Markdown content');
  });

  it('throws structured error for unsupported format', () => {
    const buffer = Buffer.from('data', 'utf-8');
    try {
      DocumentLoader.loadFile(buffer, 'image.png');
      expect.fail('expected loadFile to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentLoadError);
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_FILE_TYPE',
        fileType: 'png',
        mode: 'sync',
      });
    }
  });

  it('throws structured error for legacy .doc format', () => {
    const buffer = Buffer.from('data', 'utf-8');
    try {
      DocumentLoader.loadFile(buffer, 'old.doc');
      expect.fail('expected loadFile to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentLoadError);
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_LEGACY_DOC',
        fileType: 'doc',
        mode: 'sync',
      });
    }
  });

  it('throws explicit async-pipeline error for PDF in sync mode', () => {
    const buffer = Buffer.from('data', 'utf-8');
    try {
      DocumentLoader.loadFile(buffer, 'doc.pdf');
      expect.fail('expected loadFile to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentLoadError);
      expect(error).toMatchObject({
        code: 'ASYNC_PARSER_REQUIRED',
        fileType: 'pdf',
        mode: 'sync',
        parser: 'pdf-parse',
      });
    }
  });

  it('throws explicit async-pipeline error for DOCX in sync mode', () => {
    const buffer = Buffer.from('data', 'utf-8');
    try {
      DocumentLoader.loadFile(buffer, 'doc.docx');
      expect.fail('expected loadFile to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DocumentLoadError);
      expect(error).toMatchObject({
        code: 'ASYNC_PARSER_REQUIRED',
        fileType: 'docx',
        mode: 'sync',
        parser: 'mammoth',
      });
    }
  });

  it('handles UTF-8 text with special characters', () => {
    const text = 'Hello, world! 中文测试';
    const buffer = Buffer.from(text, 'utf-8');
    const result = DocumentLoader.loadFile(buffer, 'mixed.txt');
    expect(result).toBe(text);
  });
});

describe('DocumentLoader.loadFileAsync', () => {
  it('loads txt files asynchronously', async () => {
    const buffer = Buffer.from('Async text', 'utf-8');
    const result = await DocumentLoader.loadFileAsync(buffer, 'test.txt');
    expect(result).toBe('Async text');
  });

  it('loads md files asynchronously', async () => {
    const buffer = Buffer.from('# Async markdown', 'utf-8');
    const result = await DocumentLoader.loadFileAsync(buffer, 'readme.md');
    expect(result).toBe('# Async markdown');
  });

  it('throws structured error for unsupported format asynchronously', async () => {
    const buffer = Buffer.from('data', 'utf-8');
    await expect(DocumentLoader.loadFileAsync(buffer, 'file.xyz')).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
      fileType: 'xyz',
      mode: 'async',
    });
  });

  it('throws structured error for legacy .doc format asynchronously', async () => {
    const buffer = Buffer.from('data', 'utf-8');
    await expect(DocumentLoader.loadFileAsync(buffer, 'legacy.doc')).rejects.toMatchObject({
      code: 'UNSUPPORTED_LEGACY_DOC',
      fileType: 'doc',
      mode: 'async',
    });
  });

  it('throws structured prerequisite error when pdf-parse is not installed', async () => {
    vi.doMock('pdf-parse', () => {
      throw new Error('module not found');
    });
    const { DocumentLoader: MockedDocumentLoader } = await import('../../services/document-loader');

    const buffer = Buffer.from('PDF data', 'utf-8');
    await expect(MockedDocumentLoader.loadFileAsync(buffer, 'doc.pdf')).rejects.toMatchObject({
      code: 'PARSER_PREREQUISITE_MISSING',
      fileType: 'pdf',
      dependency: 'pdf-parse',
      mode: 'async',
    });
  });

  it('throws structured prerequisite error when mammoth is not installed', async () => {
    vi.doMock('mammoth', () => {
      throw new Error('module not found');
    });
    const { DocumentLoader: MockedDocumentLoader } = await import('../../services/document-loader');

    const buffer = Buffer.from('DOCX data', 'utf-8');
    await expect(MockedDocumentLoader.loadFileAsync(buffer, 'doc.docx')).rejects.toMatchObject({
      code: 'PARSER_PREREQUISITE_MISSING',
      fileType: 'docx',
      dependency: 'mammoth',
      mode: 'async',
    });
  });

  it('returns error message mentioning pdf-parse for PDF', async () => {
    vi.doMock('pdf-parse', () => {
      throw new Error('module not found');
    });
    const { DocumentLoader: MockedDocumentLoader } = await import('../../services/document-loader');

    const buffer = Buffer.from('PDF data', 'utf-8');
    await expect(MockedDocumentLoader.loadFileAsync(buffer, 'doc.pdf')).rejects.toThrow(
      'pdf-parse is required',
    );
  });

  it('returns error message mentioning mammoth for DOCX', async () => {
    vi.doMock('mammoth', () => {
      throw new Error('module not found');
    });
    const { DocumentLoader: MockedDocumentLoader } = await import('../../services/document-loader');

    const buffer = Buffer.from('DOCX data', 'utf-8');
    await expect(MockedDocumentLoader.loadFileAsync(buffer, 'doc.docx')).rejects.toThrow(
      'mammoth is required',
    );
  });
});
