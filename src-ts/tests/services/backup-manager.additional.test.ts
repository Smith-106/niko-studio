import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const { s3ClientConfigs, s3DestroyMock, s3SendMock } = vi.hoisted(() => ({
  s3ClientConfigs: [] as Array<Record<string, unknown>>,
  s3DestroyMock: vi.fn(),
  s3SendMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(config: Record<string, unknown>) {
      s3ClientConfigs.push(config);
    }

    send = s3SendMock;
    destroy = s3DestroyMock;
  }

  class PutObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class ListObjectsV2Command {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class GetObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  return {
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
  };
});

import { PutObjectCommand } from '@aws-sdk/client-s3';

import {
  BackupManager,
  getBackupManager,
  resetBackupManager,
} from '../../services/backup-manager';

type BackupManagerPrivate = BackupManager & {
  _collectFiles(sourcePath: string): string[];
  _createS3Client(config: Record<string, unknown>): {
    client: { destroy(): void };
    bucket: string;
    prefix: string;
  };
  _extractWebdavHrefs(xmlBody: string): string[];
  _getDb(): {
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
    };
  };
  _normalizeS3Key(value: string): string;
  _normalizeWebdavPath(value: string): string;
  _parseWebdavResponse(
    xmlBody: string,
    baseUrl: string,
    remotePath: string,
    target: string,
    credentials: string
  ): Promise<number>;
  _readS3Body(body: unknown): Promise<Buffer>;
  _relativeWebdavPath(filePath: string, remoteBasePath: string): string | null;
  _sanitizeWebdavRelativePath(relativePath: string): string[];
};

const tempDirs: string[] = [];

function createTempDir(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `${label}-`));
  tempDirs.push(dir);
  return dir;
}

function createSparseFile(path: string, sizeBytes: number): void {
  const fd = openSync(path, 'w');
  try {
    ftruncateSync(fd, sizeBytes);
  } finally {
    closeSync(fd);
  }
}

function createManager(label: string): { basePath: string; manager: BackupManager } {
  const basePath = createTempDir(label);
  return {
    basePath,
    manager: new BackupManager(join(basePath, 'backups')),
  };
}

afterEach(() => {
  resetBackupManager();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  s3SendMock.mockReset();
  s3DestroyMock.mockReset();
  s3ClientConfigs.length = 0;

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('BackupManager additional local coverage', () => {
  it('backs up a single file, restores to the default source path, and tolerates checksum drift', () => {
    const { basePath, manager } = createManager('niko-backup-single-file');
    const sourceFile = join(basePath, 'chapter.md');
    writeFileSync(sourceFile, 'chapter-body', 'utf-8');

    try {
      const backup = manager.createBackup(sourceFile, undefined, true);
      expect(backup.success).toBe(true);
      const storedFile = join(String(backup.backupPath), `${basename(sourceFile)}.gz`);
      expect(existsSync(storedFile)).toBe(true);

      rmSync(sourceFile, { force: true });
      const restoreDir = join(basePath, 'single-file-restore');
      const restored = manager.restoreBackup(String(backup.backupId), restoreDir, true);
      expect(restored).toMatchObject({ success: true, fileCount: 1 });
      expect(readFileSync(join(restoreDir, basename(sourceFile)), 'utf-8')).toBe('chapter-body');

      (manager as unknown as BackupManagerPrivate)
        ._getDb()
        .prepare('UPDATE backup_files SET checksum = ? WHERE backup_id = ?')
        .run('not-the-real-checksum', backup.backupId);

      const mismatchRestorePath = join(basePath, 'mismatch-restore.md');
      const mismatch = manager.restoreBackup(String(backup.backupId), mismatchRestorePath, true);
      expect(mismatch).toMatchObject({ success: true, fileCount: 1 });
      expect(readFileSync(join(mismatchRestorePath, basename(sourceFile)), 'utf-8')).toBe('chapter-body');

      writeFileSync(storedFile, 'not gzip', 'utf-8');
      const failed = manager.restoreBackup(String(backup.backupId), join(basePath, 'bad-restore.md'));
      expect(failed.success).toBe(false);
      expect(failed.error).toBeTruthy();
    } finally {
      manager.close();
    }
  });

  it('restores a directory backup to its original source path by default', () => {
    const { basePath, manager } = createManager('niko-backup-default-restore');
    const sourceDir = join(basePath, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'scene.md'), 'scene-body', 'utf-8');

    try {
      const backup = manager.createBackup(sourceDir, 'default-target', false);
      expect(backup.success).toBe(true);
      rmSync(sourceDir, { recursive: true, force: true });

      const restored = manager.restoreBackup(String(backup.backupId));

      expect(restored).toMatchObject({
        success: true,
        targetPath: sourceDir,
        fileCount: 1,
      });
      expect(readFileSync(join(sourceDir, 'scene.md'), 'utf-8')).toBe('scene-body');
    } finally {
      manager.close();
    }
  });

  it('ignores cleanup database failures after a backup operation fails', () => {
    const { basePath, manager } = createManager('niko-backup-cleanup-failure');
    const sourceDir = join(basePath, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'notes.md'), 'notes', 'utf-8');

    try {
      vi.spyOn(manager as unknown as BackupManagerPrivate, '_collectFiles').mockImplementationOnce(() => {
        throw new Error('collect failed');
      });
      vi.spyOn(manager as unknown as BackupManagerPrivate, '_getDb').mockImplementationOnce(() => {
        throw new Error('cleanup db unavailable');
      });

      expect(manager.createBackup(sourceDir)).toEqual({
        success: false,
        error: 'collect failed',
      });
    } finally {
      manager.close();
    }
  });

  it('handles invalid stored metadata and missing collect sources', () => {
    const { basePath, manager } = createManager('niko-backup-metadata-collect');
    const sourceDir = join(basePath, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'notes.md'), 'notes', 'utf-8');

    try {
      const backup = manager.createBackup(sourceDir, 'metadata-edge', false);
      expect(backup.success).toBe(true);

      (manager as unknown as BackupManagerPrivate)
        ._getDb()
        .prepare('UPDATE backups SET metadata = ? WHERE id = ?')
        .run('{bad json', backup.backupId);

      expect(manager.getBackup(String(backup.backupId))?.metadata).toEqual({});
      expect((manager as unknown as BackupManagerPrivate)._collectFiles(join(basePath, 'missing'))).toEqual([]);
    } finally {
      manager.close();
    }
  });
});

describe('BackupManager additional WebDAV coverage', () => {
  it('rejects WebDAV URLs that omit a scheme', async () => {
    const { basePath, manager } = createManager('niko-backup-webdav-scheme');
    const sourceDir = join(basePath, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'chapter.md'), 'chapter', 'utf-8');

    try {
      const backup = manager.createBackup(sourceDir, 'webdav-scheme', false);

      await expect(manager.backupToWebdav(String(backup.backupId), {
        url: '',
        username: 'demo',
        password: 'secret',
      })).resolves.toEqual({
        success: false,
        error: 'WebDAV URL must include scheme',
      });
    } finally {
      manager.close();
    }
  });

  it('skips base, outside, and dot-only WebDAV paths without downloading', async () => {
    const { basePath, manager } = createManager('niko-backup-webdav-private');
    const fetchMock = vi.fn(async () => {
      throw new Error('GET should not be called for skipped paths');
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const downloaded = await (manager as unknown as BackupManagerPrivate)._parseWebdavResponse(
        `<?xml version="1.0" encoding="utf-8"?>
        <d:multistatus xmlns:d="DAV:">
          <d:response><d:href>/dav/backups/backup-1</d:href></d:response>
          <d:response><d:href>/dav/backups/other/file.md</d:href></d:response>
          <d:response><d:href>/dav/backups/backup-1/%2E</d:href></d:response>
        </d:multistatus>`,
        'https://dav.example.com',
        '/dav/backups/backup-1',
        join(basePath, 'restore'),
        'Basic test'
      );

      expect(downloaded).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();

      const privateManager = manager as unknown as BackupManagerPrivate;
      vi.spyOn(privateManager, '_sanitizeWebdavRelativePath').mockReturnValueOnce([]);
      const skippedBySanitizer = await privateManager._parseWebdavResponse(
        `<?xml version="1.0" encoding="utf-8"?>
        <d:multistatus xmlns:d="DAV:">
          <d:response><d:href>/dav/backups/backup-1/empty-after-sanitize.md</d:href></d:response>
        </d:multistatus>`,
        'https://dav.example.com',
        '/dav/backups/backup-1',
        join(basePath, 'restore-empty'),
        'Basic test'
      );

      expect(skippedBySanitizer).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      manager.close();
    }
  });

  it('normalizes WebDAV helper edge cases', () => {
    const { manager } = createManager('niko-backup-webdav-helpers');
    const privateManager = manager as unknown as BackupManagerPrivate;

    try {
      expect(privateManager._extractWebdavHrefs(`
        <d:multistatus xmlns:d="DAV:">
          <d:response><d:propstat /></d:response>
          <d:response><d:href></d:href></d:response>
          <d:response><d:href>/folder/</d:href></d:response>
          <d:response><d:href>/collection</d:href><d:collection /></d:response>
          <d:response><d:href>/plain&amp;encoded&quot;&#39;.md</d:href></d:response>
        </d:multistatus>
      `)).toEqual(['/plain&encoded"\'.md']);

      expect(privateManager._normalizeWebdavPath('')).toBe('/');
      expect(privateManager._normalizeWebdavPath('\\nested\\file//')).toBe('/nested/file');
      expect(privateManager._relativeWebdavPath('/base', '/base')).toBeNull();
      expect(privateManager._relativeWebdavPath('/outside/file.md', '/base')).toBeNull();
      expect(privateManager._relativeWebdavPath('/file.md', '/')).toBe('file.md');
      expect(privateManager._sanitizeWebdavRelativePath('./%E0%A4%A/file.md')).toEqual([
        '%E0%A4%A',
        'file.md',
      ]);
    } finally {
      manager.close();
    }
  });

  it('uses default WebDAV credentials when optional fields are absent', async () => {
    const { basePath, manager } = createManager('niko-backup-webdav-defaults');
    const sourceDir = join(basePath, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'chapter.md'), 'chapter', 'utf-8');

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (init?.method === 'PROPFIND') {
        return {
          ok: true,
          text: async () => '<d:multistatus xmlns:d="DAV:" />',
        };
      }
      return { ok: true, status: 201 };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const backup = manager.createBackup(sourceDir, 'webdav-defaults', false);
      const uploaded = await manager.backupToWebdav(String(backup.backupId), {
        url: 'https://dav.example.com',
      } as never);
      expect(uploaded.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Basic Og==' }),
        })
      );

      const restored = await manager.restoreFromWebdav('/dav/backups/empty', {
        url: 'https://dav.example.com',
      } as never);
      expect(restored).toMatchObject({ success: true, fileCount: 0 });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://dav.example.com/dav/backups/empty',
        expect.objectContaining({
          method: 'PROPFIND',
          headers: expect.objectContaining({ Authorization: 'Basic Og==' }),
        })
      );
    } finally {
      manager.close();
    }
  });
});

describe('BackupManager additional S3 coverage', () => {
  it('uploads to S3 with an empty prefix and explicit forcePathStyle false', async () => {
    const { basePath, manager } = createManager('niko-backup-s3-empty-prefix');
    const sourceDir = join(basePath, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'scene.md'), 'scene', 'utf-8');
    s3SendMock.mockResolvedValue({});

    try {
      const backup = manager.createBackup(sourceDir, 's3-empty-prefix', false);
      const uploaded = await manager.backupToS3(String(backup.backupId), {
        bucket: 'story-bucket',
        prefix: '',
        endpoint: 'http://127.0.0.1:9000',
        force_path_style: false,
      });

      expect(uploaded).toMatchObject({
        success: true,
        prefix: String(backup.backupId),
        s3Key: String(backup.backupId),
      });
      expect(s3ClientConfigs[0]).toMatchObject({
        endpoint: 'http://127.0.0.1:9000',
        forcePathStyle: false,
        region: 'us-east-1',
      });

      const putCommand = s3SendMock.mock.calls
        .map(([command]) => command)
        .find((command) => command instanceof PutObjectCommand) as { input: Record<string, unknown> };
      expect(putCommand.input['Key']).toBe(`${backup.backupId}/scene.md`);
    } finally {
      manager.close();
    }
  });

  it('destroys the S3 client when upload aborts on a too-large file', async () => {
    const { basePath, manager } = createManager('niko-backup-s3-large-file');
    const sourceDir = join(basePath, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'small.md'), 'small', 'utf-8');
    const hugeFile = join(basePath, 'huge.bin');
    createSparseFile(hugeFile, 100 * 1024 * 1024 + 1);

    try {
      const backup = manager.createBackup(sourceDir, 's3-large-file', false);
      vi.spyOn(manager as unknown as BackupManagerPrivate, '_collectFiles').mockReturnValueOnce([hugeFile]);

      const uploaded = await manager.backupToS3(String(backup.backupId), {
        bucket: 'story-bucket',
      });

      expect(uploaded.success).toBe(false);
      expect(uploaded.error).toContain('S3 upload failed: File too large for S3 upload');
      expect(s3SendMock).not.toHaveBeenCalled();
      expect(s3DestroyMock).toHaveBeenCalledTimes(1);
    } finally {
      manager.close();
    }
  });

  it('covers S3 client defaults and response body edge cases', async () => {
    const { manager } = createManager('niko-backup-s3-private');
    const privateManager = manager as unknown as BackupManagerPrivate;

    try {
      const created = privateManager._createS3Client({ bucket: 'story-bucket' });
      created.client.destroy();
      expect(created).toMatchObject({
        bucket: 'story-bucket',
        prefix: 'backups',
      });
      expect(s3ClientConfigs[0]).toMatchObject({
        region: 'us-east-1',
        forcePathStyle: false,
      });
      expect(privateManager._normalizeS3Key('\\nested/key/')).toBe('nested/key');

      await expect(privateManager._readS3Body(null)).resolves.toEqual(Buffer.alloc(0));
      await expect(privateManager._readS3Body(new Uint8Array([1, 2, 3]))).resolves.toEqual(Buffer.from([1, 2, 3]));
      await expect(privateManager._readS3Body({
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array([4, 5]);
        },
      })).resolves.toEqual(Buffer.from([4, 5]));
      await expect(privateManager._readS3Body({
        async *[Symbol.asyncIterator]() {
          yield { unsupported: true };
        },
      })).rejects.toThrow('Unsupported S3 response chunk type');
      await expect(privateManager._readS3Body({ unsupported: true })).rejects.toThrow(
        'Unsupported S3 response body type'
      );
    } finally {
      manager.close();
    }
  });

  it('skips empty S3 restore objects and supports default restore target', async () => {
    const { basePath, manager } = createManager('niko-backup-s3-skip-empty');

    s3SendMock.mockImplementation(async (command: { input?: Record<string, unknown> }) => {
      if (command.input && 'Prefix' in command.input) {
        return {
          Contents: [
            {},
            { Key: '' },
            { Key: 'archives/backup-empty' },
            { Key: 'archives/backup-empty/' },
            { Key: 'archives/backup-empty/file.txt' },
          ],
          IsTruncated: false,
        };
      }
      return { Body: Buffer.from('file-body') };
    });

    try {
      const restored = await manager.restoreFromS3('archives/backup-empty', {
        bucket: 'story-bucket',
      });

      const expectedTarget = join(basePath, 'backups', 'restored', 'backup-empty');
      expect(restored).toMatchObject({
        success: true,
        targetPath: expectedTarget,
        fileCount: 1,
      });
      expect(readFileSync(join(expectedTarget, 'file.txt'), 'utf-8')).toBe('file-body');
    } finally {
      manager.close();
    }
  });
});

describe('BackupManager singleton exit hook', () => {
  it('runs the registered shutdown listener without exiting the process', () => {
    const basePath = createTempDir('niko-backup-exit-hook');
    const instance = getBackupManager(join(basePath, 'singleton'));
    const shutdown = process
      .listeners('exit')
      .filter((listener) => listener.name === 'shutdown')
      .at(-1);

    expect(shutdown).toBeTypeOf('function');
    shutdown?.(0);

    const next = getBackupManager(join(basePath, 'singleton-next'));
    expect(next).not.toBe(instance);
    next.close();
  });
});
