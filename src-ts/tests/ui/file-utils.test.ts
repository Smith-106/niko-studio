import { afterEach, describe, expect, it, vi } from 'vitest';

import { DocumentLoader } from '../../services/document-loader.js';
import type { IndexingService } from '../../services/indexing-service.js';
import {
  processUploadedFile,
  recursiveCharacterSplit,
} from '../../ui/file-utils.js';

describe('ui/file-utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('splits paragraph-sized sections into separate chunks', () => {
    const chunks = recursiveCharacterSplit('alpha beta\n\ngamma delta', 12, 2);

    expect(chunks).toEqual(['alpha beta', 'gamma delta']);
  });

  it('falls back to character chunking when no separators exist', () => {
    const chunks = recursiveCharacterSplit('X'.repeat(25), 10, 2);

    expect(chunks).toEqual(['XXXXXXXXXX', 'XXXXXXXXXX', 'XXXXX']);
  });

  it.each(['pdf', 'docx'])(
    'rejects synchronous %s uploads',
    (extension) => {
      expect(() =>
        processUploadedFile(
          Buffer.from('ignored'),
          `draft.${extension}`,
          'session-1',
          { addDocument: vi.fn() } as unknown as IndexingService,
        ),
      ).toThrow(
        `Synchronous processing is not supported for .${extension} uploads.`,
      );
    },
  );

  it('sanitizes chunk ids, indexes all chunks, and reports progress', () => {
    vi.spyOn(DocumentLoader, 'loadFile').mockReturnValue('Z'.repeat(2505));

    const addDocument = vi.fn();
    const progressCallback = vi.fn();

    const chunkCount = processUploadedFile(
      Buffer.from('ignored'),
      'My$ Draft?.txt',
      'session-42',
      { addDocument } as unknown as IndexingService,
      progressCallback,
    );

    expect(DocumentLoader.loadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'My$ Draft?.txt',
    );
    expect(chunkCount).toBe(3);
    expect(addDocument.mock.calls).toEqual([
      ['session-42_My_Draft.txt_part_0', 'Z'.repeat(1000), 'uploaded_material'],
      ['session-42_My_Draft.txt_part_1', 'Z'.repeat(1000), 'uploaded_material'],
      ['session-42_My_Draft.txt_part_2', 'Z'.repeat(505), 'uploaded_material'],
    ]);
    expect(progressCallback.mock.calls).toEqual([
      [1 / 3],
      [2 / 3],
      [1],
    ]);
  });
});
