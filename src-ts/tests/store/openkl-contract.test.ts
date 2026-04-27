import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DocumentMapping,
  OpenKLContract,
  OpenKLPaths,
} from '../../store/openkl-contract';

function createBasePath(): string {
  return mkdtempSync(join(tmpdir(), 'niko-openkl-'));
}

function createSourceFile(basePath: string, name: string, content: string): string {
  const sourcePath = join(basePath, name);
  writeFileSync(sourcePath, content, 'utf-8');
  return sourcePath;
}

describe('store/openkl-contract', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('derives the expected OpenKL directory structure and mapping shape', () => {
    const paths = new OpenKLPaths('workspace');
    const mapping = new DocumentMapping({
      docId: 'doc-1',
      path: 'store/sources/doc-1.md',
      sha256: 'abc',
      sourceType: 'notes',
      createdAt: '2026-04-05T00:00:00.000Z',
      updatedAt: '2026-04-05T00:00:00.000Z',
      metadata: { tag: 'story' },
    });

    expect(paths.sources).toBe(join('workspace', 'store', 'sources'));
    expect(paths.normalized).toBe(join('workspace', 'store', 'normalized'));
    expect(paths.mappingFile).toBe(join('workspace', '.ok', 'mapping.jsonl'));
    expect(paths.allPaths()).toContain(join('workspace', 'sessions', 'active'));
    expect(mapping.toDict()).toMatchObject({
      doc_id: 'doc-1',
      path: 'store/sources/doc-1.md',
      source_type: 'notes',
      metadata: { tag: 'story' },
    });
    expect(mapping.metadata).toEqual({ tag: 'story' });
    expect(DocumentMapping.fromDict(mapping.toDict())).toMatchObject({
      docId: 'doc-1',
      path: 'store/sources/doc-1.md',
    });
    const defaultCtorMapping = new DocumentMapping({
      docId: 'doc-ctor-default',
      path: 'store/sources/default-ctor.md',
      sha256: 'ctor',
      sourceType: 'notes',
      createdAt: '2026-04-05T00:00:00.000Z',
      updatedAt: '2026-04-05T00:00:00.000Z',
    });
    expect(defaultCtorMapping.metadata).toEqual({});
    expect(
      DocumentMapping.fromDict({
        doc_id: 'doc-default-metadata',
        path: 'store/sources/default.md',
        sha256: 'def',
        source_type: 'general',
        created_at: '2026-04-05T00:00:00.000Z',
        updated_at: '2026-04-05T00:00:00.000Z',
        metadata: undefined,
      }).metadata,
    ).toEqual({});
  });

  it('loads persisted mappings with compatibility defaults and skips blank or invalid lines', () => {
    const basePath = createBasePath();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      mkdirSync(join(basePath, '.ok'), { recursive: true });
      writeFileSync(
        join(basePath, '.ok', 'mapping.jsonl'),
        '\nnot-json\n{"doc_id":"doc-compat","path":"store/sources/doc-compat.md","sha256":"sha","created_at":"2026-04-05T00:00:00.000Z","updated_at":"2026-04-05T00:00:00.000Z"}\n',
        'utf-8',
      );

      const contract = new OpenKLContract(basePath);
      const listed = contract.listDocuments();

      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        doc_id: 'doc-compat',
        source_type: 'general',
        metadata: {},
      });
      expect(warnSpy).toHaveBeenCalledOnce();
    } finally {
      warnSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('keeps initialization resilient when mapping persistence is unreadable', () => {
    const basePath = createBasePath();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      mkdirSync(join(basePath, '.ok', 'mapping.jsonl'), { recursive: true });

      const contract = new OpenKLContract(basePath);

      expect(contract.listDocuments()).toEqual([]);
      expect(errorSpy).toHaveBeenCalledOnce();
      expect(errorSpy.mock.calls[0]?.[0]).toContain('Failed to load mappings');
    } finally {
      errorSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('handles missing mapping file branch when structure setup is bypassed', () => {
    const basePath = createBasePath();
    const ensureSpy = vi
      .spyOn(OpenKLContract.prototype as unknown as { _ensureStructure: () => void }, '_ensureStructure')
      .mockImplementation(() => {});

    try {
      const contract = new OpenKLContract(basePath);
      expect(contract.listDocuments()).toEqual([]);
    } finally {
      ensureSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers ingestFile validation, auto-generated ids, CRUD fallbacks, and filtered iteration', () => {
    const basePath = createBasePath();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    try {
      const contract = new OpenKLContract(basePath);
      const textSource = createSourceFile(basePath, 'chapter-2.TXT', 'Scene A\rScene B');
      const imageSource = createSourceFile(basePath, 'cover.png', 'not-really-a-png');

      expect(() => contract.ingestFile(join(basePath, 'missing.md'))).toThrow(/Source file not found/);
      expect(() => contract.ingestFile(imageSource)).toThrow(/Unsupported file type: \.png/);

      const fileDocId = contract.ingestFile(textSource, null, 'notes', false);
      const normalizedFileDocId = contract.ingestFile(
        textSource,
        'doc-normalized-file',
        'notes',
        true,
      );
      const contentDocId = contract.ingestContent('Chapter only', 'doc-chapter', 'chapter', null, false);

      expect(fileDocId).toMatch(/^doc-\d{8}.*-[0-9a-f]{8}$/);
      expect(contract.getNormalizedContent(fileDocId)).toBeNull();
      expect(contract.getNormalizedContent(normalizedFileDocId)).toContain('source:');
      expect(contract.getDocument('missing-doc')).toBeNull();

      const limited = contract.listDocuments(null, 1);
      const filtered = contract.listDocuments('chapter');
      const iterated = Array.from(contract.iterDocuments('chapter'));

      expect(limited).toHaveLength(1);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.doc_id).toBe(contentDocId);
      expect(iterated).toHaveLength(1);
      expect(iterated[0]).toMatchObject({ doc_id: contentDocId, content: 'Chapter only' });

      const missingSourcePath = join(basePath, 'store', 'sources', 'doc-chapter.md');
      unlinkSync(missingSourcePath);

      expect(contract.getDocument(contentDocId)).toBeNull();
      expect(contract.deleteDocument('missing-doc')).toBe(false);
      expect(contract.deleteDocument(contentDocId)).toBe(true);
      expect(contract.deleteDocument(normalizedFileDocId)).toBe(true);
      expect(contract.getNormalizedContent(contentDocId)).toBeNull();
      expect(contract.getNormalizedContent(normalizedFileDocId)).toBeNull();
      expect(warnSpy.mock.calls.some(([message]) => String(message).includes('Document file missing'))).toBe(true);
      expect(infoSpy.mock.calls.some(([message]) => String(message).includes('Deleted document'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('logs mapping persistence failures without breaking ingest or delete public behavior', () => {
    const basePath = createBasePath();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const contract = new OpenKLContract(basePath);
      const brokenMappingDir = join(basePath, '.ok', 'mapping-dir');
      mkdirSync(brokenMappingDir, { recursive: true });

      const currentPaths = contract.paths;
      (contract as unknown as {
        paths: Record<string, string>;
      }).paths = {
        basePath: currentPaths.basePath,
        sources: currentPaths.sources,
        normalized: currentPaths.normalized,
        citations: currentPaths.citations,
        memoriesByDate: currentPaths.memoriesByDate,
        memoriesTopics: currentPaths.memoriesTopics,
        mappingFile: brokenMappingDir,
      };

      const docId = contract.ingestContent('Shadow mapping', 'doc-shadow', 'note', null, false);

      expect(docId).toBe('doc-shadow');
      expect(contract.listDocuments()).toHaveLength(1);
      expect(errorSpy.mock.calls.some(([message]) => String(message).includes('Failed to append mapping'))).toBe(true);
      expect(contract.deleteDocument(docId)).toBe(true);
      expect(errorSpy.mock.calls.some(([message]) => String(message).includes('Failed to save mappings'))).toBe(true);
    } finally {
      errorSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('ingests content, emits memory/citation files, and reports integrity through the public contract', () => {
    const basePath = createBasePath();
    const contract = new OpenKLContract(basePath);

    try {
      const docId = contract.ingestContent(
        'Chapter 1\r\nHero meets the silver key.',
        'doc-openkl-1',
        'chapter',
        'chapter-1.md',
        true,
        { chapter: 1 },
      );

      const listed = contract.listDocuments('chapter');
      const loaded = contract.getDocument(docId);
      const normalized = contract.getNormalizedContent(docId);
      const memoryPath = contract.createMemory('mem-1', 'Remember the silver key.', ['plot'], { chapter: 1 });
      const citationPath = contract.saveCitation('cite-1', { source: docId, quote: 'silver key' });
      const citation = contract.getCitation('cite-1');
      const integrity = contract.verifyIntegrity();

      expect(docId).toBe('doc-openkl-1');
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        doc_id: 'doc-openkl-1',
        source_type: 'chapter',
        metadata: { chapter: 1 },
      });
      expect(loaded).toMatchObject({
        doc_id: 'doc-openkl-1',
        content: 'Chapter 1\r\nHero meets the silver key.',
      });
      expect(normalized).toContain('source: chapter-1.md');
      expect(normalized).toContain('Chapter 1\nHero meets the silver key.');
      expect(readFileSync(memoryPath, 'utf-8')).toContain('Remember the silver key.');
      expect(readFileSync(citationPath, 'utf-8')).toContain('silver key');
      expect(citation).toMatchObject({ source: docId, quote: 'silver key' });
      expect(integrity).toMatchObject({
        total_documents: 1,
        missing_files: [],
        hash_mismatches: [],
      });
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers optional memory metadata, missing citations, and integrity anomaly reporting', () => {
    const basePath = createBasePath();
    const contract = new OpenKLContract(basePath);

    try {
      const hashDocId = contract.ingestContent('stable body', 'doc-hash', 'chapter', 'hash.md', false);
      const missingDocId = contract.ingestContent('missing body', 'doc-missing', 'chapter', 'missing.md', false);
      const memoryPath = contract.createMemory('mem-untagged', 'Loose thought');

      writeFileSync(join(basePath, 'store', 'sources', 'hash.md'), 'mutated body', 'utf-8');
      unlinkSync(join(basePath, 'store', 'sources', 'missing.md'));
      writeFileSync(join(basePath, 'store', 'sources', 'orphan.md'), 'orphan', 'utf-8');

      const integrity = contract.verifyIntegrity();

      expect(readFileSync(memoryPath, 'utf-8')).toContain('topics: []');
      expect(readFileSync(memoryPath, 'utf-8')).toContain('metadata: {}');
      expect(contract.getCitation('missing-citation')).toBeNull();
      expect(integrity).toMatchObject({
        missing_files: [missingDocId],
        orphaned_files: [join('store', 'sources', 'orphan.md')],
      });
      expect(integrity.hash_mismatches).toContainEqual(
        expect.objectContaining({
          doc_id: hashDocId,
        }),
      );

      rmSync(contract.paths.sources, { recursive: true, force: true });

      expect(contract.verifyIntegrity()).toMatchObject({
        total_documents: 2,
      });
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers doc-id generation and malformed mapping ingestion branches', () => {
    const basePath = createBasePath();
    const contract = new OpenKLContract(basePath);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const fixedNow = new Date('2026-04-27T12:34:56.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      const generatedId = contract.ingestContent('Auto id content', undefined, 'note', 'auto-id.md', false);
      expect(generatedId).toMatch(/^doc-[0-9A-Z]+-[0-9a-f]{8}$/);

      vi.useRealTimers();

      const mappingFilePath = contract.paths.mappingFile;
      const originalMapping = readFileSync(mappingFilePath, 'utf-8');
      writeFileSync(mappingFilePath, `${originalMapping}{bad-json\n`, 'utf-8');

      const reloaded = new OpenKLContract(basePath);
      expect(reloaded.listDocuments().map((doc) => doc.doc_id)).toEqual(
        expect.arrayContaining([generatedId]),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid mapping line:'));
    } finally {
      warnSpy.mockRestore();
      vi.useRealTimers();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('uses copy fallback for topic links on win32 platforms', () => {
    const basePath = createBasePath();
    const contract = new OpenKLContract(basePath);

    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    try {
      const memoryPath = contract.createMemory('mem-copy-fallback', 'Copied topic memory', ['topic-copy']);
      const topicLinkPath = join(contract.paths.memoriesTopics, 'topic-copy', 'mem-copy-fallback.md');

      expect(memoryPath).toContain(join('memories', 'by_date'));
      expect(existsSync(topicLinkPath)).toBe(true);
      expect(readFileSync(topicLinkPath, 'utf-8')).toContain('Copied topic memory');
    } finally {
      platformSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers non-win32 topic link handling branches without breaking memory creation', () => {
    const basePath = createBasePath();
    const contract = new OpenKLContract(basePath);
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');

    try {
      const memoryPath = contract.createMemory('mem-symlink-branch', 'Symlink branch memory', ['topic-symlink']);

      expect(existsSync(memoryPath)).toBe(true);
      expect(readFileSync(memoryPath, 'utf-8')).toContain('Symlink branch memory');
    } finally {
      platformSpy.mockRestore();
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});
