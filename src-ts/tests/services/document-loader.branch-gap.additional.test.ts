import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  vi.doUnmock('mammoth');
  vi.doUnmock('pdf-parse');
});

describe('DocumentLoader branch-gap coverage', () => {
  it('uses unknown as the unsupported extension fallback in sync and async modes', async () => {
    const { DocumentLoader } = await import('../../services/document-loader');

    expect(() => DocumentLoader.loadFile(Buffer.from('x'), 'draft.')).toThrowError(
      expect.objectContaining({
        code: 'UNSUPPORTED_FILE_TYPE',
        fileType: 'unknown',
        mode: 'sync',
      }),
    );

    await expect(
      DocumentLoader.loadFileAsync(Buffer.from('x'), 'draft.'),
    ).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
      fileType: 'unknown',
      mode: 'async',
    });
  });

  it('falls back to an empty extension when filename splitting yields no segments', async () => {
    const { DocumentLoader } = await import('../../services/document-loader');
    const splitSpy = vi
      .spyOn(String.prototype, 'split')
      .mockReturnValueOnce([] as unknown as string[]);

    expect(
      (
        DocumentLoader as unknown as {
          getFileExtension: (fileName: string) => string;
        }
      ).getFileExtension('ignored'),
    ).toBe('');
    splitSpy.mockRestore();
  });

  it('uses nested mammoth extractRawText when the top-level export is missing', async () => {
    vi.resetModules();
    const extractRawText = vi.fn().mockResolvedValue({ value: 'nested mammoth text' });
    vi.doMock('mammoth', () => ({
      __esModule: true,
      extractRawText: undefined,
      default: {
        extractRawText,
      },
    }));

    const reloaded = await import('../../services/document-loader');

    await expect(
      reloaded.DocumentLoader.loadFileAsync(Buffer.from('docx'), 'draft.docx'),
    ).resolves.toBe('nested mammoth text');
    expect(extractRawText).toHaveBeenCalledWith({ buffer: expect.any(Buffer) });
  });
});
