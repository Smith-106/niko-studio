import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryChunk } from '../../memory/memory-chunk';
import {
  Document,
  DocumentFilter,
  DocumentFormat,
  StoreManager,
  documentFormatExtension,
  documentFormatFromExtension,
  isBinaryFormat,
} from '../../store/store-manager';

function createBasePath(): string {
  return mkdtempSync(join(tmpdir(), 'niko-store-manager-'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('store/store-manager', () => {
  it('supports bounded CRUD, search, export, and stats behavior', () => {
    const basePath = createBasePath();
    const manager = new StoreManager({ basePath });

    try {
      const docId = manager.addDocument(
        'chapter-1.md',
        '# Chapter 1\nThe silver key appears.',
        { chapter: 1, source_type: 'chapter' },
      );

      const updated = manager.updateDocument(
        docId,
        '# Chapter 1\nThe silver key appears again.',
        { revised: true },
      );
      const loaded = manager.getDocument(docId);
      const listed = manager.listDocuments(new DocumentFilter({ format: DocumentFormat.MARKDOWN }));
      const found = manager.searchByContent('appears again', 5);
      const exportPath = join(basePath, 'exports', 'chapter-1.md');
      const exported = manager.exportDocument(docId, exportPath, true);
      const stats = manager.stats();
      const removed = manager.deleteDocument(docId);

      expect(updated).toBe(true);
      expect(loaded).toMatchObject({
        id: docId,
        format: DocumentFormat.MARKDOWN,
      });
      expect(loaded?.content).toContain('appears again');
      expect(loaded?.metadata).toMatchObject({
        chapter: 1,
        revised: true,
      });
      expect(listed).toHaveLength(1);
      expect(found).toHaveLength(1);
      expect(found[0]?.id).toBe(docId);
      expect(exported).toBe(true);
      expect(existsSync(exportPath)).toBe(true);
      expect(readFileSync(exportPath, 'utf-8')).toContain(`doc_id: ${docId}`);
      expect(stats).toMatchObject({
        document_count: 1,
        total_chunks: expect.any(Number),
      });
      expect(removed).toBe(true);
      expect(manager.getDocument(docId)).toBeNull();
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('syncs store documents to OpenKL with local metadata defaults and aggregated errors', () => {
    const basePath = createBasePath();
    const manager = new StoreManager({ basePath });
    const chapterContent = 'silver-key '.repeat(160);

    try {
      const chapterId = manager.addDocument(
        'chapter-2.md',
        chapterContent,
        {
          source_type: 'chapter',
          chapter: 2,
          format: 'stale-format',
          chunk_count: -1,
        },
      );
      const notesId = manager.addDocument('notes.txt', 'Short note for fallback sync.', {
        tag: 'fallback',
      });

      const chapterDoc = manager.getDocument(chapterId);
      const ingestContent = vi.fn((content: string, docId?: string | null) => {
        if (docId === notesId) {
          throw new Error('sync failed');
        }
        return `${docId}-shadow`;
      });

      const result = manager.syncWithOpenKL({ ingestContent });

      expect(ingestContent).toHaveBeenCalledTimes(2);
      expect(ingestContent).toHaveBeenNthCalledWith(
        1,
        chapterContent,
        chapterId,
        'chapter',
        null,
        true,
        expect.objectContaining({
          chapter: 2,
          format: chapterDoc?.format,
          chunk_count: chapterDoc?.chunkCount,
          source_type: 'chapter',
          source_path: 'chapter-2.md',
          source_name: 'chapter-2.md',
        }),
      );
      expect(ingestContent).toHaveBeenNthCalledWith(
        2,
        'Short note for fallback sync.',
        notesId,
        'store',
        null,
        true,
        expect.objectContaining({
          format: DocumentFormat.PLAIN_TEXT,
          source_path: 'notes.txt',
          source_name: 'notes.txt',
          tag: 'fallback',
        }),
      );
      expect(result).toMatchObject({
        synced: 1,
        total: 2,
      });
      expect(result.errors).toEqual([
        {
          doc_id: notesId,
          error: 'Error: sync failed',
        },
      ]);
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('imports OpenKL documents while preserving source type, default path behavior, and duplicate skips', () => {
    const basePath = createBasePath();
    const manager = new StoreManager({ basePath });

    try {
      const existingId = manager.addDocument(
        'existing.md',
        'Existing content should win over duplicate import attempts.',
        { source_type: 'chapter', chapter: 1 },
        'existing-doc',
      );
      const iterDocuments = vi.fn((sourceType?: string | null) => {
        expect(sourceType).toBe('chapter');
        return [
          {
            doc_id: existingId,
            content: 'This duplicate should be skipped.',
            path: 'store/sources/existing.md',
            source_type: 'chapter',
            metadata: { chapter: 99 },
          },
          {
            doc_id: 'imported-doc',
            content: 'Imported chapter content from OpenKL.',
            path: 'imports/chapter-3.md',
            source_type: 'chapter',
            metadata: { chapter: 3, imported: true },
          },
          {
            doc_id: 'fallback-doc',
            content: 'Imported without an explicit path.',
            source_type: 'chapter',
          },
        ];
      });

      const imported = manager.importFromOpenKL({ iterDocuments }, 'chapter');
      const importedDoc = manager.getDocument('imported-doc');
      const fallbackDoc = manager.getDocument('fallback-doc');
      const existingDoc = manager.getDocument(existingId);

      expect(imported).toBe(2);
      expect(iterDocuments).toHaveBeenCalledOnce();
      expect(existingDoc?.content).toContain('Existing content should win');
      expect(importedDoc).toMatchObject({
        id: 'imported-doc',
        content: 'Imported chapter content from OpenKL.',
        format: DocumentFormat.MARKDOWN,
      });
      expect(importedDoc?.metadata).toMatchObject({
        chapter: 3,
        imported: true,
        source_type: 'chapter',
        source_path: 'imports/chapter-3.md',
        source_name: 'chapter-3.md',
      });
      expect(manager.getNormalizedContent('imported-doc')).toBeNull();
      expect(fallbackDoc?.metadata).toMatchObject({
        source_type: 'chapter',
        source_path: 'fallback-doc.md',
        source_name: 'fallback-doc.md',
      });
      expect(manager.getNormalizedContent('fallback-doc')).toBeNull();
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers document helper compatibility and filter branches', () => {
    const createdAt = new Date('2026-04-01T10:00:00.000Z');
    const updatedAt = new Date('2026-04-02T10:00:00.000Z');
    const legacyChunk = MemoryChunk.create('Legacy chunk content.', 'legacy-doc', 0, 1, {
      lane: 'main',
    });

    const legacyDoc = Document.fromDict({
      id: 'legacy-doc',
      content: 'Three short words',
      format: DocumentFormat.JSON,
      metadata: { tags: ['plot', 'chapter'], stage: 'draft' },
      chunks: [legacyChunk.toDict()],
      created_at: createdAt.toISOString(),
      updated_at: updatedAt,
    });
    const fallbackDoc = Document.fromDict({
      id: 'fallback-doc',
      content: 'fallback body',
      metadata: null,
    });

    expect(documentFormatFromExtension('.MD')).toBe(DocumentFormat.MARKDOWN);
    expect(documentFormatFromExtension('.unknown')).toBe(DocumentFormat.PLAIN_TEXT);
    expect(documentFormatExtension(DocumentFormat.JSON)).toBe('.json');
    expect(documentFormatExtension('odd-format' as DocumentFormat)).toBe('.txt');
    expect(isBinaryFormat(DocumentFormat.PDF)).toBe(true);
    expect(isBinaryFormat(DocumentFormat.MARKDOWN)).toBe(false);
    expect(legacyDoc.chunkCount).toBe(1);
    expect(legacyDoc.wordCount).toBe(3);
    expect(legacyDoc.charCount).toBe('Three short words'.length);
    expect(legacyDoc.toDict()).toMatchObject({
      id: 'legacy-doc',
      format: DocumentFormat.JSON,
      metadata: { tags: ['plot', 'chapter'], stage: 'draft' },
    });
    expect(fallbackDoc.format).toBe(DocumentFormat.MARKDOWN);
    expect(fallbackDoc.metadata).toEqual({});
    expect(fallbackDoc.created_at).toBeInstanceOf(Date);
    expect(fallbackDoc.updated_at).toBeInstanceOf(Date);

    const matchingFilter = new DocumentFilter({
      format: DocumentFormat.JSON,
      tags: ['chapter'],
      created_after: new Date('2026-03-31T00:00:00.000Z'),
      created_before: new Date('2026-04-03T00:00:00.000Z'),
      metadata_match: { stage: 'draft' },
    });

    expect(matchingFilter.matches(legacyDoc)).toBe(true);
    expect(new DocumentFilter({ format: DocumentFormat.MARKDOWN }).matches(legacyDoc)).toBe(false);
    expect(new DocumentFilter({ tags: ['missing'] }).matches(legacyDoc)).toBe(false);
    expect(
      new DocumentFilter({
        created_after: new Date('2026-04-03T00:00:00.000Z'),
      }).matches(legacyDoc),
    ).toBe(false);
    expect(
      new DocumentFilter({
        created_before: new Date('2026-03-31T00:00:00.000Z'),
      }).matches(legacyDoc),
    ).toBe(false);
    expect(
      new DocumentFilter({
        metadata_match: { stage: 'published' },
      }).matches(legacyDoc),
    ).toBe(false);
  });

  it('covers import, batch, export, and clear-all public behavior', async () => {
    const basePath = createBasePath();
    const fixturesDir = join(basePath, 'fixtures');
    const nestedDir = join(fixturesDir, 'nested');
    const exportsDir = join(basePath, 'exports');
    const markdownPath = join(fixturesDir, 'chapter-4.md');
    const textPath = join(fixturesDir, 'notes.txt');
    const jsonPath = join(nestedDir, 'scene.json');
    const brokenPdfPath = join(fixturesDir, 'broken.pdf');
    const ignoredPath = join(fixturesDir, 'ignore.bin');
    const manager = new StoreManager({ basePath, chunkSize: 48, chunkOverlap: 8 });

    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(markdownPath, 'North Bridge secret. '.repeat(30), 'utf-8');
    writeFileSync(textPath, 'Short note from the archive.', 'utf-8');
    writeFileSync(jsonPath, '{"scene":"North Bridge","mood":"tense"}', 'utf-8');
    writeFileSync(brokenPdfPath, 'not a real pdf payload', 'utf-8');
    writeFileSync(ignoredPath, 'ignore me', 'utf-8');

    try {
      const importedFileId = manager.importFile(
        markdownPath,
        { tags: ['story'], lane: 'main' },
        'fixture-doc',
      );

      expect(() => manager.importFile(join(fixturesDir, 'missing.md'))).toThrow(
        'File not found',
      );
      expect(manager.getDocument(importedFileId)?.metadata).toMatchObject({
        lane: 'main',
        source_name: 'chapter-4.md',
      });
      expect(manager.getChunks(importedFileId).length).toBeGreaterThan(1);
      expect(manager.getChunks('missing-doc')).toEqual([]);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(manager.rechunkDocument('missing-doc', 24, 4)).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith('Document not found: missing-doc');

      const rechunked = manager.rechunkDocument(importedFileId, 24, 4);
      expect(rechunked).toBe(manager.getChunks(importedFileId).length);

      const importResult = await manager.importDirectory(fixturesDir);

      expect(importResult).toMatchObject({
        imported: 3,
        total_files: 4,
      });
      expect(importResult.errors).toHaveLength(1);
      expect(importResult.errors[0]).toMatchObject({
        file: brokenPdfPath,
      });
      expect(manager.listDocuments()).toHaveLength(4);

      const storyChunks = manager.getAllChunks(
        new DocumentFilter({ metadata_match: { lane: 'main' } }),
      );
      const chunkMatches = manager.searchChunks('North Bridge', 2);
      const exported = manager.exportAll(
        exportsDir,
        true,
        new DocumentFilter({ format: DocumentFormat.MARKDOWN }),
      );

      expect(storyChunks.length).toBeGreaterThan(0);
      expect(chunkMatches).toHaveLength(2);
      expect(chunkMatches[0]).toMatchObject({
        doc_format: expect.any(String),
        doc_id: expect.any(String),
      });
      expect(exported).toBeGreaterThan(0);
      expect(existsSync(join(exportsDir, `${importedFileId}.md`))).toBe(true);
      expect(readFileSync(join(exportsDir, `${importedFileId}.md`), 'utf-8')).toContain(
        `doc_id: ${importedFileId}`,
      );
      expect(() => manager.clearAll()).toThrow('Must set confirm=true to clear all documents');
      await expect(manager.importDirectory(join(basePath, 'missing-dir'))).rejects.toThrow(
        'Not a directory',
      );

      const cleared = manager.clearAll(true);

      expect(cleared).toBe(4);
      expect(manager.documentCount).toBe(0);
      expect(manager.totalChunks).toBe(0);
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers multi-format loading and binary import compatibility paths', async () => {
    const basePath = createBasePath();
    const fixturesDir = join(basePath, 'binary-fixtures');
    const yamlPath = join(fixturesDir, 'outline.yaml');
    const textPath = join(fixturesDir, 'notes.txt');
    const pdfPath = join(fixturesDir, 'artifact.pdf');
    const docxPath = join(fixturesDir, 'artifact.docx');
    const manager = new StoreManager({ basePath, autoChunk: false });

    mkdirSync(fixturesDir, { recursive: true });
    writeFileSync(yamlPath, 'chapter: 3\nmood: tense\n', 'utf-8');
    writeFileSync(textPath, 'plain fallback text', 'utf-8');
    writeFileSync(pdfPath, 'fake pdf payload', 'utf-8');
    writeFileSync(docxPath, 'fake docx payload', 'utf-8');

    try {
      await expect(manager.loadFileContent(yamlPath)).resolves.toContain('chapter: 3');
      await expect(manager.loadFileContent(textPath)).resolves.toBe('plain fallback text');
      await expect(manager.loadFileContent(pdfPath)).rejects.toThrow(
        'pdf-parse is required for PDF support',
      );
      await expect(manager.loadFileContent(docxPath)).rejects.toThrow(
        'mammoth is required for DOCX support',
      );
      await expect(manager.importBinaryFile(join(fixturesDir, 'missing.pdf'))).rejects.toThrow(
        'File not found',
      );

      const loadSpy = vi.spyOn(manager, 'loadFileContent').mockResolvedValue('Extracted binary text');
      const binaryId = await manager.importBinaryFile(
        pdfPath,
        { source_type: 'attachment', tags: ['binary'] },
        'binary-doc',
      );
      const binaryDoc = manager.getDocument(binaryId);

      expect(loadSpy).toHaveBeenCalledWith(pdfPath);
      expect(binaryDoc).toMatchObject({
        id: 'binary-doc',
        content: 'Extracted binary text',
        format: DocumentFormat.PDF,
      });
      expect(binaryDoc?.metadata).toMatchObject({
        source_type: 'attachment',
        original_format: DocumentFormat.PDF,
        original_file: 'artifact.pdf',
        source_name: 'artifact.pdf',
      });
      expect(existsSync(join(basePath, 'store', 'sources', `${binaryId}_original.pdf`))).toBe(true);
      expect(manager.getNormalizedContent(binaryId)).toContain('doc_id: binary-doc');
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});
