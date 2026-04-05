import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as store from '../../store';
import {
  Document as DirectDocument,
  DocumentFilter as DirectDocumentFilter,
  DocumentFormat as DirectDocumentFormat,
  StoreManager as DirectStoreManager,
  documentFormatExtension,
} from '../../store/store-manager';
import { OpenKLContract as DirectOpenKLContract, OpenKLPaths as DirectOpenKLPaths } from '../../store/openkl-contract';

function createBasePath(): string {
  return mkdtempSync(join(tmpdir(), 'niko-store-barrel-'));
}

describe('store/index barrel', () => {
  it('re-exports representative store classes, enums, and helpers through the public entrypoint', () => {
    expect(store.StoreManager).toBe(DirectStoreManager);
    expect(store.Document).toBe(DirectDocument);
    expect(store.DocumentFilter).toBe(DirectDocumentFilter);
    expect(store.DocumentFormat).toBe(DirectDocumentFormat);
    expect(store.OpenKLContract).toBe(DirectOpenKLContract);
    expect(store.OpenKLPaths).toBe(DirectOpenKLPaths);
    expect(store.documentFormatExtension(store.DocumentFormat.MARKDOWN)).toBe('.md');
  });

  it('provides a working StoreManager path through the barrel', () => {
    const basePath = createBasePath();
    const manager = new store.StoreManager({ basePath });

    try {
      const docId = manager.addDocument(
        'chapter-1.md',
        '# Chapter 1\nThe silver key appears.',
        { chapter: 1 },
      );
      const loaded = manager.getDocument(docId);
      const listed = manager.listDocuments(new store.DocumentFilter({ format: store.DocumentFormat.MARKDOWN }));
      const normalized = manager.getNormalizedContent(docId);
      const removed = manager.deleteDocument(docId);

      expect(docId).toContain('doc-');
      expect(loaded).toMatchObject({
        id: docId,
        format: store.DocumentFormat.MARKDOWN,
      });
      expect(loaded?.metadata).toMatchObject({
        chapter: 1,
        source_name: 'chapter-1.md',
      });
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(docId);
      expect(normalized).toContain(`doc_id: ${docId}`);
      expect(normalized).toContain('The silver key appears.');
      expect(documentFormatExtension(loaded!.format)).toBe('.md');
      expect(removed).toBe(true);
      expect(manager.getDocument(docId)).toBeNull();
    } finally {
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});
