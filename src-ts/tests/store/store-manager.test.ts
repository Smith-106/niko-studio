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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
      const missingUpdate = manager.updateDocument('missing-doc', 'Nothing to update');
      const loaded = manager.getDocument(docId);
      const listed = manager.listDocuments(new DocumentFilter({ format: DocumentFormat.MARKDOWN }));
      const found = manager.searchByContent('appears again', 5);
      const exportPath = join(basePath, 'exports', 'chapter-1.md');
      const plainExportPath = join(basePath, 'exports', 'chapter-1-plain.md');
      const exported = manager.exportDocument(docId, exportPath, true);
      const plainExported = manager.exportDocument(docId, plainExportPath, false);
      const stats = manager.stats();
      const removed = manager.deleteDocument(docId);
      const missingDelete = manager.deleteDocument('missing-doc');

      expect(updated).toBe(true);
      expect(missingUpdate).toBe(false);
      expect(missingDelete).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Document not found for update'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Document not found for deletion'));
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
      expect(manager.listDocuments(new DocumentFilter({ format: DocumentFormat.JSON }))).toEqual([]);
      expect(found).toHaveLength(1);
      expect(found[0]?.id).toBe(docId);
      expect(manager.searchByContent('missing phrase')).toEqual([]);
      expect(manager.searchChunks('missing phrase', 1)).toEqual([]);
      expect(exported).toBe(true);
      expect(plainExported).toBe(true);
      expect(existsSync(exportPath)).toBe(true);
      expect(readFileSync(exportPath, 'utf-8')).toContain(`doc_id: ${docId}`);
      expect(readFileSync(plainExportPath, 'utf-8')).toContain('appears again');
      expect(stats).toMatchObject({
        document_count: 1,
        total_chunks: expect.any(Number),
      });
      expect(removed).toBe(true);
      expect(manager.getDocument(docId)).toBeNull();
      expect(manager.exportDocument('missing-doc', join(basePath, 'exports', 'missing.md'))).toBe(false);
      expect(manager.importFromOpenKL({ iterDocuments: () => [] }, 'chapter')).toBe(0);
      expect(manager.syncWithOpenKL({ ingestContent: vi.fn() })).toMatchObject({
        synced: 0,
        errors: [],
        total: 0,
      });
    } finally {
      warnSpy.mockRestore();
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

  it('covers document helper compatibility and filter branches', async () => {
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
      format: DocumentFormat.MARKDOWN,
      metadata: null,
    });
    const mixedDateDoc = Document.fromDict({
      id: 'mixed-date-doc',
      content: 'mixed body',
      format: DocumentFormat.PLAIN_TEXT,
      created_at: new Date('2026-04-03T10:00:00.000Z'),
      updated_at: '2026-04-04T10:00:00.000Z',
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
    expect(mixedDateDoc.created_at).toEqual(new Date('2026-04-03T10:00:00.000Z'));
    expect(mixedDateDoc.updated_at).toEqual(new Date('2026-04-04T10:00:00.000Z'));
    expect(mixedDateDoc.format).toBe(DocumentFormat.PLAIN_TEXT);

    const noTagsDoc = new Document({
      id: 'no-tags-doc',
      content: 'untagged',
      format: DocumentFormat.MARKDOWN,
      metadata: undefined,
    });
    expect(noTagsDoc.metadata).toEqual({});
    expect(new DocumentFilter({ tags: ['chapter'] }).matches(noTagsDoc)).toBe(false);

    const createdWithNullMetadata = Document.create('null metadata body', DocumentFormat.PLAIN_TEXT, null);
    expect(createdWithNullMetadata.metadata).toEqual({});
    expect(createdWithNullMetadata.format).toBe(DocumentFormat.PLAIN_TEXT);
    expect(createdWithNullMetadata.id).toMatch(/^doc-\d{14}-[0-9a-f]{8}$/);

    const createdWithCustomId = Document.create(
      'custom id body',
      DocumentFormat.JSON,
      { lane: 'alt' },
      'custom-doc-id',
    );
    expect(createdWithCustomId.id).toBe('custom-doc-id');
    expect(createdWithCustomId.metadata).toMatchObject({ lane: 'alt' });
    expect(createdWithCustomId.created_at).toBeInstanceOf(Date);
    expect(createdWithCustomId.updated_at).toBeInstanceOf(Date);

    const createdWithoutChunks = new Document({
      id: 'no-chunks-doc',
      content: 'chunkless',
      format: DocumentFormat.PLAIN_TEXT,
      chunks: undefined,
    });
    expect(createdWithoutChunks.chunks).toEqual([]);

    const explicitDateDoc = new Document({
      id: 'explicit-date-doc',
      content: 'explicit date body',
      format: DocumentFormat.PLAIN_TEXT,
      created_at: new Date('2026-04-06T00:00:00.000Z'),
      updated_at: undefined,
    });
    expect(explicitDateDoc.created_at).toEqual(new Date('2026-04-06T00:00:00.000Z'));
    expect(explicitDateDoc.updated_at).toBeInstanceOf(Date);

    const dictDoc = Document.fromDict({
      id: 'dict-default-metadata',
      content: 'dict body',
      format: DocumentFormat.MARKDOWN,
      metadata: undefined,
      chunks: [],
    });
    expect(dictDoc.metadata).toEqual({});

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

    const managerBasePath = createBasePath();
    try {
      const manager = new StoreManager({ basePath: managerBasePath, autoChunk: false });
      const noChunkDocId = manager.addDocument('no-chunks.md', 'no chunks body', {}, 'doc-no-chunks', false);
      expect(manager.getDocument(noChunkDocId)?.chunks).toEqual([]);
      expect(manager.searchChunks('no chunks body', 1)).toEqual([]);
    } finally {
      rmSync(managerBasePath, { recursive: true, force: true });
    }

    const limitManagerBasePath = createBasePath();
    try {
      const limitManager = new StoreManager({ basePath: limitManagerBasePath });
      const limitDocId = limitManager.addDocument('limit-doc.md', 'alpha beta gamma', {}, 'limit-doc-id');
      expect(limitManager.searchByContent('alpha', 0)).toEqual([
        expect.objectContaining({ id: limitDocId }),
      ]);
      expect(limitManager.searchChunks('alpha', 0)).toEqual([
        expect.objectContaining({ doc_id: limitDocId }),
      ]);
    } finally {
      rmSync(limitManagerBasePath, { recursive: true, force: true });
    }

    const exportManagerBasePath = createBasePath();
    try {
      const exportManager = new StoreManager({ basePath: exportManagerBasePath });
      const exportDocId = exportManager.addDocument('export-doc.md', 'export body', {}, 'export-doc-id');
      const outputPath = join(exportManagerBasePath, 'exports', 'fallback-normalized.md');
      const originalGetNormalized = exportManager.getNormalizedContent.bind(exportManager);
      const normalizedSpy = vi.spyOn(exportManager, 'getNormalizedContent').mockImplementation((docId) => {
        if (docId === exportDocId) {
          return null;
        }
        return originalGetNormalized(docId);
      });
      expect(exportManager.exportDocument(exportDocId, outputPath, true)).toBe(true);
      expect(readFileSync(outputPath, 'utf-8')).toContain('doc_id: export-doc-id');
      normalizedSpy.mockRestore();
    } finally {
      rmSync(exportManagerBasePath, { recursive: true, force: true });
    }

    const rechunkManagerBasePath = createBasePath();
    try {
      const rechunkManager = new StoreManager({ basePath: rechunkManagerBasePath });
      const rechunkDocId = rechunkManager.addDocument(
        'rechunk-doc.md',
        'zeta '.repeat(80),
        {},
        'rechunk-doc-id',
      );
      expect(rechunkManager.rechunkDocument(rechunkDocId, undefined, 0)).toBeGreaterThan(0);
      expect(rechunkManager.rechunkDocument(rechunkDocId, null, null)).toBeGreaterThan(0);
    } finally {
      rmSync(rechunkManagerBasePath, { recursive: true, force: true });
    }

    const pdfManagerBasePath = createBasePath();
    try {
      const pdfManager = new StoreManager({ basePath: pdfManagerBasePath, autoChunk: false });
      const pdfPath = join(pdfManagerBasePath, 'missing-text.pdf');
      writeFileSync(pdfPath, 'fake pdf payload', 'utf-8');

      vi.doMock('pdf-parse', () => ({
        default: vi.fn(async () => ({ text: undefined })),
      }));
      await expect(pdfManager.loadFileContent(pdfPath)).resolves.toBe('');
      vi.doUnmock('pdf-parse');

      const importPdfSpy = vi.spyOn(pdfManager, 'loadFileContent').mockResolvedValueOnce('pdf import text');
      await pdfManager.importBinaryFile(pdfPath, null, 'pdf-import-doc');
      expect(importPdfSpy).toHaveBeenCalledWith(pdfPath);
      importPdfSpy.mockRestore();
    } finally {
      rmSync(pdfManagerBasePath, { recursive: true, force: true });
    }

    const docxManagerBasePath = createBasePath();
    try {
      const docxManager = new StoreManager({ basePath: docxManagerBasePath, autoChunk: false });
      const docxPath = join(docxManagerBasePath, 'missing-text.docx');
      writeFileSync(docxPath, 'fake docx payload', 'utf-8');

      vi.doMock('mammoth', () => ({
        extractRawText: vi.fn(async () => ({ value: undefined })),
      }));
      await expect(docxManager.loadFileContent(docxPath)).resolves.toBe('');
      vi.doUnmock('mammoth');

      const importDocxSpy = vi.spyOn(docxManager, 'loadFileContent').mockResolvedValueOnce('docx import text');
      await docxManager.importBinaryFile(docxPath, null, 'docx-import-doc');
      expect(importDocxSpy).toHaveBeenCalledWith(docxPath);
      importDocxSpy.mockRestore();
    } finally {
      rmSync(docxManagerBasePath, { recursive: true, force: true });
    }
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
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Document not found'));

      const rechunked = manager.rechunkDocument(importedFileId, 24, 4);
      expect(rechunked).toBe(manager.getChunks(importedFileId).length);

      const importBinarySpy = vi.spyOn(manager, 'importBinaryFile');
      const importResult = await manager.importDirectory(fixturesDir);

      expect(importResult).toMatchObject({
        imported: 3,
        total_files: 4,
      });
      expect(importResult.errors).toHaveLength(1);
      expect(importResult.errors[0]).toMatchObject({
        file: brokenPdfPath,
      });
      expect(importBinarySpy).toHaveBeenCalledWith(brokenPdfPath);
      const importedPdfPath = join(basePath, 'fixtures', 'import-ok.pdf');
      writeFileSync(importedPdfPath, 'mock importable pdf payload', 'utf-8');
      const importDirectoryLoadSpy = vi.spyOn(manager, 'loadFileContent').mockResolvedValueOnce('imported pdf text');
      const importDirectoryWithPdf = await manager.importDirectory(fixturesDir, false, ['.pdf']);
      expect(importDirectoryWithPdf).toMatchObject({ imported: 1, total_files: 2 });
      expect(importDirectoryWithPdf.errors).toHaveLength(1);
      expect([brokenPdfPath, importedPdfPath]).toContain(importDirectoryWithPdf.errors[0]?.file);
      expect(importDirectoryLoadSpy).toHaveBeenCalledWith(importedPdfPath);
      expect(importDirectoryLoadSpy).toHaveBeenCalledWith(brokenPdfPath);
      importDirectoryLoadSpy.mockRestore();
      importBinarySpy.mockRestore();
      expect(manager.listDocuments()).toHaveLength(5);
      expect(
        manager.listDocuments(new DocumentFilter({ metadata_match: { lane: 'missing' } })),
      ).toEqual([]);

      const storyChunks = manager.getAllChunks(
        new DocumentFilter({ metadata_match: { lane: 'main' } }),
      );
      expect(manager.getAllChunks(new DocumentFilter({ metadata_match: { lane: 'missing' } }))).toEqual([]);
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

      expect(cleared).toBe(5);
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

  it('covers default-path initialization and index load failure branches', () => {
    const tempRoot = createBasePath();
    const invalidDocBasePath = join(tempRoot, 'invalid-doc-store');
    const invalidJsonBasePath = join(tempRoot, 'invalid-json-store');

    try {
      const ensureSpy = vi
        .spyOn(StoreManager.prototype as unknown as { _ensureDirectories: () => void }, '_ensureDirectories')
        .mockImplementation(() => {});
      const loadSpy = vi
        .spyOn(StoreManager.prototype as unknown as { _loadIndex: () => void }, '_loadIndex')
        .mockImplementation(() => {});
      const defaultManager = new StoreManager({ basePath: undefined });
      expect(defaultManager.basePath).toBe('.writing');
      ensureSpy.mockRestore();
      loadSpy.mockRestore();

      const invalidDocStoreRoot = join(invalidDocBasePath, 'store');
      mkdirSync(invalidDocStoreRoot, { recursive: true });
      writeFileSync(
        join(invalidDocStoreRoot, '.index.json'),
        '{"documents":[{"id":"broken","content":"ok","chunks":{}}]}',
        'utf-8',
      );

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const invalidDocManager = new StoreManager({ basePath: invalidDocBasePath });
      expect(invalidDocManager.documentCount).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load document'));
      warnSpy.mockRestore();

      const invalidJsonStoreRoot = join(invalidJsonBasePath, 'store');
      mkdirSync(invalidJsonStoreRoot, { recursive: true });
      writeFileSync(join(invalidJsonStoreRoot, '.index.json'), '{invalid-json', 'utf-8');
      const invalidJsonErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const brokenManager = new StoreManager({ basePath: invalidJsonBasePath });
      expect(brokenManager.documentCount).toBe(0);
      expect(invalidJsonErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load index'),
      );
      invalidJsonErrorSpy.mockRestore();

      const blockedSaveBasePath = join(tempRoot, 'blocked-save-store');
      const blockedStoreRoot = join(blockedSaveBasePath, 'store');
      mkdirSync(blockedStoreRoot, { recursive: true });
      writeFileSync(join(blockedStoreRoot, '.index.json'), '{}', 'utf-8');
      const saveErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const blockedSaveManager = new StoreManager({ basePath: blockedSaveBasePath });
      const blockedIndexDir = join(blockedStoreRoot, 'index-as-dir');
      mkdirSync(blockedIndexDir, { recursive: true });
      blockedSaveManager.indexPath = blockedIndexDir;

      const blockedDocId = blockedSaveManager.addDocument('blocked.md', 'blocked write body');
      expect(blockedDocId).toBeTruthy();
      expect(saveErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to save index'));
      saveErrorSpy.mockRestore();
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
