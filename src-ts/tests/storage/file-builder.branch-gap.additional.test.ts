import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileBuilder, FileBuilderError } from '../../storage/file-builder.js';

class ExposedFileBuilder extends FileBuilder {
  createBackupNow(): string | null {
    return this._createBackup();
  }

  atomicWriteNow(filePath: string, content: string, encoding = 'utf-8'): void {
    this._atomicWrite(filePath, content, encoding);
  }
}

class PrimitiveWriteFailureBuilder extends FileBuilder {
  protected _atomicWrite(): void {
    throw 'primitive write failure';
  }
}

class FileBuilderErrorThrowingBuilder extends FileBuilder {
  protected _validate(): void {
    throw new FileBuilderError('custom validation failure');
  }
}

describe('storage/file-builder branch-gap coverage', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-file-builder-branch-gap-'));
  });

  afterEach(() => {
    vi.doUnmock('node:fs');
    vi.resetModules();
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns null when backup copy fails for an existing file', async () => {
    const target = path.join(tempDir, 'source.txt');
    fs.writeFileSync(target, 'seed', 'utf8');

    vi.resetModules();
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        copyFileSync: () => {
          throw new Error('copy denied');
        },
      };
    });

    const mod = await import('../../storage/file-builder.js?backup-copy-fail');

    class DynamicBackupBuilder extends mod.FileBuilder {
      createBackupNow(): string | null {
        return this._createBackup();
      }
    }

    const builder = new DynamicBackupBuilder()
      .withPath(target)
      .withContent('seed')
      .withBackup(true);

    expect(builder.createBackupNow()).toBeNull();
  });

  it('cleans up temp files when atomic rename fails', async () => {
    const target = path.join(tempDir, 'rename-fails.txt');

    vi.resetModules();
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        renameSync: () => {
          throw new Error('rename denied');
        },
      };
    });

    const mod = await import('../../storage/file-builder.js?rename-fail');

    class DynamicAtomicBuilder extends mod.FileBuilder {
      atomicWriteNow(filePath: string, content: string, encoding = 'utf-8'): void {
        this._atomicWrite(filePath, content, encoding);
      }
    }

    const builder = new DynamicAtomicBuilder();

    expect(() => builder.atomicWriteNow(target, 'new content')).toThrow('rename denied');
    expect(
      fs.readdirSync(tempDir).filter((name) => name.includes('rename-fails.txt')).length,
    ).toBe(0);
  });

  it('swallows temp cleanup failures and still rethrows the original atomic write error', async () => {
    const target = path.join(tempDir, 'cleanup-fails.txt');

    vi.resetModules();
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        renameSync: () => {
          throw new Error('rename denied');
        },
        unlinkSync: (file: fs.PathLike) => {
          if (String(file).includes('cleanup-fails.txt')) {
            throw new Error('cleanup denied');
          }
          return actual.unlinkSync(file);
        },
      };
    });

    const mod = await import('../../storage/file-builder.js?cleanup-fail');

    class DynamicAtomicBuilder extends mod.FileBuilder {
      atomicWriteNow(filePath: string, content: string, encoding = 'utf-8'): void {
        this._atomicWrite(filePath, content, encoding);
      }
    }

    const builder = new DynamicAtomicBuilder();

    expect(() => builder.atomicWriteNow(target, 'new content')).toThrow('rename denied');
  });

  it('normalizes non-Error build failures for the error callback and wrapped exception', () => {
    const onError = vi.fn();
    const target = path.join(tempDir, 'primitive.txt');
    const builder = new PrimitiveWriteFailureBuilder()
      .withPath(target)
      .withContent('broken')
      .withOnError(onError);

    expect(() => builder.build()).toThrowError('Failed to write file: primitive write failure');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('primitive write failure');
  });

  it('rethrows FileBuilderError instances without wrapping them again', () => {
    const onError = vi.fn();
    const builder = new FileBuilderErrorThrowingBuilder().withOnError(onError);

    expect(() => builder.build()).toThrowError(FileBuilderError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(FileBuilderError);
    expect(onError.mock.calls[0][0].message).toBe('custom validation failure');
  });
});
