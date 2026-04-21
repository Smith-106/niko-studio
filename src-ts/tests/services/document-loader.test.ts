/**
 * DocumentLoader Tests
 *
 * Tests DocumentLoader file loading for txt, md, pdf, docx formats.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentLoader } from '../../services/document-loader';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

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
});

// ---------------------------------------------------------------------------
// loadFile (sync)
// ---------------------------------------------------------------------------

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

  it('throws for unsupported format', () => {
    const buffer = Buffer.from('data', 'utf-8');
    expect(() => DocumentLoader.loadFile(buffer, 'image.png')).toThrow(
      'Unsupported file format: png',
    );
  });

  it('throws for legacy .doc format', () => {
    const buffer = Buffer.from('data', 'utf-8');
    expect(() => DocumentLoader.loadFile(buffer, 'old.doc')).toThrow(
      'Legacy .doc format is not supported',
    );
  });

  it('throws for PDF in sync mode (not available)', () => {
    const buffer = Buffer.from('data', 'utf-8');
    expect(() => DocumentLoader.loadFile(buffer, 'doc.pdf')).toThrow(
      'PDF parsing is not available',
    );
  });

  it('throws for DOCX in sync mode (not available)', () => {
    const buffer = Buffer.from('data', 'utf-8');
    expect(() => DocumentLoader.loadFile(buffer, 'doc.docx')).toThrow(
      'DOCX parsing is not available',
    );
  });

  it('handles UTF-8 text with special characters', () => {
    const text = 'Hello, world! \u4e2d\u6587\u6d4b\u8bd5';
    const buffer = Buffer.from(text, 'utf-8');
    const result = DocumentLoader.loadFile(buffer, 'mixed.txt');
    expect(result).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// loadFileAsync
// ---------------------------------------------------------------------------

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

  it('throws for unsupported format asynchronously', async () => {
    const buffer = Buffer.from('data', 'utf-8');
    await expect(DocumentLoader.loadFileAsync(buffer, 'file.xyz')).rejects.toThrow(
      'Unsupported file format: xyz',
    );
  });

  it('throws for legacy .doc format asynchronously', async () => {
    const buffer = Buffer.from('data', 'utf-8');
    await expect(DocumentLoader.loadFileAsync(buffer, 'legacy.doc')).rejects.toThrow(
      'Legacy .doc format is not supported',
    );
  });

  it('throws error when pdf-parse is not installed', async () => {
    const buffer = Buffer.from('PDF data', 'utf-8');
    await expect(DocumentLoader.loadFileAsync(buffer, 'doc.pdf')).rejects.toThrow();
  });

  it('throws error when mammoth is not installed', async () => {
    const buffer = Buffer.from('DOCX data', 'utf-8');
    await expect(DocumentLoader.loadFileAsync(buffer, 'doc.docx')).rejects.toThrow();
  });

  it('returns error message mentioning pdf-parse for PDF', async () => {
    const buffer = Buffer.from('PDF data', 'utf-8');
    await expect(DocumentLoader.loadFileAsync(buffer, 'doc.pdf')).rejects.toThrow(
      'pdf-parse is required',
    );
  });

  it('returns error message mentioning mammoth for DOCX', async () => {
    const buffer = Buffer.from('DOCX data', 'utf-8');
    await expect(DocumentLoader.loadFileAsync(buffer, 'doc.docx')).rejects.toThrow(
      'mammoth is required',
    );
  });
});
