/**
 * StoreManager Tests
 *
 * Tests index save failure throwing, document read, and PDF load behavior
 * for the store-manager module. Uses temp directories for isolation.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Document,
  DocumentFilter,
  DocumentFormat,
  StoreManager,
  documentFormatExtension,
  documentFormatFromExtension,
  isBinaryFormat,
  validateArtifact,
} from '../store-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBasePath(): string {
  return mkdtempSync(join(tmpdir(), 'niko-store-mgr-'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StoreManager - index persistence', () => {
  it('throws when _saveIndex fails (e.g. indexPath is a directory)', () => {
    const basePath = createBasePath();
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      // Override indexPath to point to a directory so writeFileSync will fail
      const dirAsFile = join(basePath, 'store', 'dir-as-index');
      mkdirSync(dirAsFile, { recursive: true });
      manager.indexPath = dirAsFile;

      expect(() => manager.addDocument('fail.md', 'This should throw')).toThrow();
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('loads from corrupted index JSON gracefully', () => {
    const basePath = createBasePath();
    const storeRoot = join(basePath, 'store');
    mkdirSync(storeRoot, { recursive: true });
    writeFileSync(join(storeRoot, '.index.json'), '{invalid-json', 'utf-8');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      expect(manager.documentCount).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load index'),
      );
    } finally {
      errorSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('loads from index with invalid document entries gracefully', () => {
    const basePath = createBasePath();
    const storeRoot = join(basePath, 'store');
    mkdirSync(storeRoot, { recursive: true });
    // Valid JSON but document missing required fields
    writeFileSync(
      join(storeRoot, '.index.json'),
      JSON.stringify({ documents: [{ id: 'broken' }] }),
      'utf-8',
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      expect(manager.documentCount).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load document'),
      );
    } finally {
      warnSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});

describe('StoreManager - document read', () => {
  it('reads document content from source file on getDocument', () => {
    const basePath = createBasePath();
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      const docId = manager.addDocument('read-test.md', 'Original content', {}, 'read-doc');
      const doc = manager.getDocument(docId);
      expect(doc).not.toBeNull();
      expect(doc!.content).toContain('Original content');
      expect(doc!.id).toBe('read-doc');
      expect(doc!.format).toBe(DocumentFormat.MARKDOWN);
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('returns null for non-existent document', () => {
    const basePath = createBasePath();
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      expect(manager.getDocument('non-existent')).toBeNull();
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('reflects updated content after updateDocument', () => {
    const basePath = createBasePath();
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      const docId = manager.addDocument('update.md', 'Initial', {}, 'update-doc');
      manager.updateDocument(docId, 'Updated content');
      const doc = manager.getDocument(docId);
      expect(doc!.content).toContain('Updated content');
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('deletes document and returns null on subsequent get', () => {
    const basePath = createBasePath();
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      const docId = manager.addDocument('delete.md', 'To delete', {}, 'delete-doc');
      expect(manager.deleteDocument(docId)).toBe(true);
      expect(manager.getDocument(docId)).toBeNull();
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('getNormalizedContent returns null for deleted document', () => {
    const basePath = createBasePath();
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      const docId = manager.addDocument('norm.md', 'Some text', {}, 'norm-doc');
      manager.deleteDocument(docId);
      expect(manager.getNormalizedContent(docId)).toBeNull();
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});

describe('StoreManager - PDF load', () => {
  it('loadFileContent throws for PDF without pdf-parse', async () => {
    const basePath = createBasePath();
    const pdfPath = join(basePath, 'test.pdf');
    writeFileSync(pdfPath, 'fake pdf', 'utf-8');
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      await expect(manager.loadFileContent(pdfPath)).rejects.toThrow(
        'pdf-parse is required for PDF support',
      );
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('loadFileContent throws for DOCX without mammoth', async () => {
    const basePath = createBasePath();
    const docxPath = join(basePath, 'test.docx');
    writeFileSync(docxPath, 'fake docx', 'utf-8');
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      await expect(manager.loadFileContent(docxPath)).rejects.toThrow(
        'mammoth is required for DOCX support',
      );
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('importBinaryFile throws for missing file', async () => {
    const basePath = createBasePath();
    try {
      const manager = new StoreManager({ basePath, autoChunk: false });
      await expect(manager.importBinaryFile(join(basePath, 'missing.pdf'))).rejects.toThrow(
        'File not found',
      );
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});

describe('StoreManager - artifact validation', () => {
  it('validateArtifact rejects missing id', () => {
    const result = validateArtifact({ content: 'text', format: 'markdown' });
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('id');
  });

  it('validateArtifact rejects empty content', () => {
    const result = validateArtifact({ id: 'doc-1', content: '  ', format: 'markdown' });
    expect(result.valid).toBe(false);
  });

  it('validateArtifact accepts valid artifact', () => {
    const result = validateArtifact({ id: 'doc-1', content: 'hello', format: 'markdown' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validateArtifact rejects unknown format', () => {
    const result = validateArtifact({ id: 'doc-1', content: 'hello', format: 'unknown_fmt' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unknown document format'))).toBe(true);
  });
});

describe('Document helpers', () => {
  it('documentFormatFromExtension normalizes dot and case', () => {
    expect(documentFormatFromExtension('.MD')).toBe(DocumentFormat.MARKDOWN);
    expect(documentFormatFromExtension('pdf')).toBe(DocumentFormat.PDF);
    expect(documentFormatFromExtension('.unknown')).toBe(DocumentFormat.PLAIN_TEXT);
  });

  it('documentFormatExtension returns correct extension', () => {
    expect(documentFormatExtension(DocumentFormat.JSON)).toBe('.json');
    expect(documentFormatExtension(DocumentFormat.PDF)).toBe('.pdf');
  });

  it('isBinaryFormat identifies PDF and DOCX', () => {
    expect(isBinaryFormat(DocumentFormat.PDF)).toBe(true);
    expect(isBinaryFormat(DocumentFormat.DOCX)).toBe(true);
    expect(isBinaryFormat(DocumentFormat.MARKDOWN)).toBe(false);
    expect(isBinaryFormat(DocumentFormat.JSON)).toBe(false);
  });

  it('Document.wordCount counts CJK and Latin words', () => {
    const doc = new Document({
      id: 'wc',
      content: '你好世界 hello world',
      format: DocumentFormat.MARKDOWN,
    });
    // 4 CJK chars + 2 Latin words = 6
    expect(doc.wordCount).toBe(6);
  });

  it('Document.charCount returns content length', () => {
    const doc = new Document({
      id: 'cc',
      content: 'abc',
      format: DocumentFormat.PLAIN_TEXT,
    });
    expect(doc.charCount).toBe(3);
  });
});
