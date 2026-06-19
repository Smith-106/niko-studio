import {
  mkdirSync,
  mkdtempSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const { s3ClientConfigs, s3SendMock } = vi.hoisted(() => ({
  s3ClientConfigs: [] as Array<Record<string, unknown>>,
  s3SendMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    constructor(config: Record<string, unknown>) {
      s3ClientConfigs.push(config);
    }

    send = s3SendMock;
    destroy = vi.fn();
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

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import {
  BackupManager,
  getBackupManager,
  resetBackupManager,
} from '../../services/backup-manager';

const tempDirs: string[] = [];

function createTempDir(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `${label}-`));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  s3SendMock.mockReset();
  s3ClientConfigs.length = 0;
  vi.unstubAllGlobals();
  resetBackupManager();
});

describe('BackupManager local backup lifecycle', () => {
  it('creates, lists, restores, reads, and deletes local backups while reporting progress', () => {
    const basePath = createTempDir('niko-backup-local-roundtrip');
    const sourcePath = join(basePath, 'source');
    const restorePath = join(basePath, 'restored');
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(join(sourcePath, 'chapter.md'), 'chapter-body', 'utf-8');
    writeFileSync(join(sourcePath, 'prepacked.zip'), 'already-compressed', 'utf-8');

    const manager = new BackupManager(join(basePath, 'backups'));
    const progressEvents: Array<Record<string, unknown>> = [];
    manager.setProgressCallback((progress) => {
      progressEvents.push({ ...progress });
      if (progress.completedFiles === 0) {
        throw new Error('ignore callback failure');
      }
    });

    try {
      const backup = manager.createBackup(sourcePath, 'manual-backup', true);
      expect(backup).toMatchObject({
        success: true,
        name: 'manual-backup',
        fileCount: 2,
      });
      expect(existsSync(join(String(backup.backupPath), 'chapter.md.gz'))).toBe(true);
      expect(existsSync(join(String(backup.backupPath), 'prepacked.zip'))).toBe(true);
      expect(progressEvents.at(-1)).toMatchObject({ status: 'completed', completedFiles: 2 });

      const listed = manager.listBackups(5);
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        id: backup.backupId,
        name: 'manual-backup',
        file_count: 2,
      });

      const fetched = manager.getBackup(String(backup.backupId));
      expect(fetched).toMatchObject({
        id: backup.backupId,
        name: 'manual-backup',
        fileCount: 2,
      });
      expect(fetched?.createdAt).toBeInstanceOf(Date);
      expect(fetched?.metadata).toEqual({});

      const restored = manager.restoreBackup(String(backup.backupId), restorePath, false);
      expect(restored).toMatchObject({
        success: true,
        backupId: backup.backupId,
        targetPath: restorePath,
        fileCount: 2,
      });
      expect(readFileSync(join(restorePath, 'chapter.md'), 'utf-8')).toBe('chapter-body');
      expect(readFileSync(join(restorePath, 'prepacked.zip'), 'utf-8')).toBe('already-compressed');

      expect(manager.deleteBackup(String(backup.backupId))).toBe(true);
      expect(manager.listBackups()).toEqual([]);
      expect(manager.getBackup(String(backup.backupId))).toBeNull();
      expect(manager.deleteBackup(String(backup.backupId))).toBe(false);
    } finally {
      manager.close();
    }
  });

  it('handles missing local sources, failed compression, and missing restore data', () => {
    const basePath = createTempDir('niko-backup-local-errors');
    const sourcePath = join(basePath, 'source');
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(join(sourcePath, 'notes.txt'), 'notes', 'utf-8');

    const manager = new BackupManager(join(basePath, 'backups'));

    try {
      expect(manager.createBackup(join(basePath, 'missing'))).toEqual({
        success: false,
        error: `Source not found: ${join(basePath, 'missing')}`,
      });

      const failingCompress = vi
        .spyOn(manager as never, '_compressFile' as never)
        .mockImplementation(() => {
          throw new Error('compression failed');
        });

      const failedBackup = manager.createBackup(sourcePath);
      expect(failedBackup).toEqual({
        success: false,
        error: 'compression failed',
      });

      failingCompress.mockRestore();

      const goodBackup = manager.createBackup(sourcePath, 'restorable', false);
      expect(goodBackup.success).toBe(true);
      rmSync(String(goodBackup.backupPath), { recursive: true, force: true });

      expect(manager.restoreBackup(String(goodBackup.backupId))).toEqual({
        success: false,
        error: `Backup data missing: ${goodBackup.backupPath}`,
      });
      expect(manager.restoreBackup('unknown-backup')).toEqual({
        success: false,
        error: 'Backup not found: unknown-backup',
      });
    } finally {
      manager.close();
    }
  });
});

describe('BackupManager S3 parity', () => {
  it('uploads backup artifacts to S3 using normalized keys and client config', async () => {
    const basePath = createTempDir('niko-backup-s3-upload');
    const sourcePath = join(basePath, 'source');
    mkdirSync(join(sourcePath, 'nested'), { recursive: true });
    writeFileSync(join(sourcePath, 'scene.md'), '# Scene 1', 'utf-8');
    writeFileSync(join(sourcePath, 'nested', 'notes.txt'), 'nested notes', 'utf-8');

    const manager = new BackupManager(join(basePath, 'backups'));

    try {
      const backup = manager.createBackup(sourcePath);
      expect(backup).toMatchObject({ success: true, fileCount: 2 });

      s3SendMock.mockResolvedValue({});

      const result = await manager.backupToS3(String(backup.backupId), {
        bucket: 'story-bucket',
        prefix: '/archives/',
        region: 'ap-southeast-1',
        endpoint_url: 'http://127.0.0.1:9000',
        aws_access_key_id: 'minio',
        aws_secret_access_key: 'minio-secret',
      });

expect(result).toMatchObject({
        success: true,
        backupId: backup.backupId,
        bucket: 'story-bucket',
        prefix: `archives/${backup.backupId}`,
        s3Key: `archives/${backup.backupId}`,
        fileCount: 2,
      });

      const putCommands = s3SendMock.mock.calls
        .map(([command]) => command)
        .filter((command) => command instanceof PutObjectCommand) as Array<{ input: Record<string, unknown> }>;

      expect(putCommands).toHaveLength(2);
      expect(putCommands.map((command) => command.input['Key']).sort()).toEqual([
        `archives/${backup.backupId}/nested/notes.txt.gz`,
        `archives/${backup.backupId}/scene.md.gz`,
      ].sort());
      expect(putCommands.every((command) => Buffer.isBuffer(command.input['Body']))).toBe(true);

      expect(s3ClientConfigs[0]).toMatchObject({
        region: 'ap-southeast-1',
        endpoint: 'http://127.0.0.1:9000',
        forcePathStyle: true,
        credentials: {
          accessKeyId: 'minio',
          secretAccessKey: 'minio-secret',
        },
      });
    } finally {
      manager.close();
    }
  });

  it('restores all objects under an S3 prefix into the target directory', async () => {
    const basePath = createTempDir('niko-backup-s3-restore');
    const targetPath = join(basePath, 'restored');
    const manager = new BackupManager(join(basePath, 'backups'));

    s3SendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [
            { Key: 'archives/backup-789/scene.md.gz' },
            { Key: 'archives/backup-789/nested/notes.txt.gz' },
            { Key: 'archives/backup-789/' },
          ],
          IsTruncated: false,
        };
      }

      if (command instanceof GetObjectCommand) {
        const key = String((command as { input: Record<string, unknown> }).input['Key']);
        if (key.endsWith('scene.md.gz')) {
          return { Body: Buffer.from('scene-bytes') };
        }
        if (key.endsWith('nested/notes.txt.gz')) {
          return { Body: Buffer.from('notes-bytes') };
        }
      }

      throw new Error(`Unexpected command: ${(command as { constructor?: { name?: string } }).constructor?.name}`);
    });

    try {
      const result = await manager.restoreFromS3('archives/backup-789', {
        bucket: 'story-bucket',
      }, targetPath);

      expect(result).toMatchObject({
        success: true,
        bucket: 'story-bucket',
        prefix: 'archives/backup-789',
        s3Key: 'archives/backup-789',
        targetPath,
        fileCount: 2,
      });
      expect(readFileSync(join(targetPath, 'scene.md.gz'), 'utf-8')).toBe('scene-bytes');
      expect(readFileSync(join(targetPath, 'nested', 'notes.txt.gz'), 'utf-8')).toBe('notes-bytes');

      const listCommand = s3SendMock.mock.calls
        .map(([command]) => command)
        .find((command) => command instanceof ListObjectsV2Command) as { input: Record<string, unknown> } | undefined;

      expect(listCommand?.input).toMatchObject({
        Bucket: 'story-bucket',
        Prefix: 'archives/backup-789',
      });
    } finally {
      manager.close();
    }
  });

  it('fails deterministically when S3 credentials are incomplete', async () => {
    const basePath = createTempDir('niko-backup-s3-config');
    const sourcePath = join(basePath, 'source');
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(join(sourcePath, 'scene.md'), '# Scene 2', 'utf-8');

    const manager = new BackupManager(join(basePath, 'backups'));

    try {
      const backup = manager.createBackup(sourcePath);
      expect(backup.success).toBe(true);

      const result = await manager.backupToS3(String(backup.backupId), {
        bucket: 'story-bucket',
        aws_access_key_id: 'only-access-key',
      });

      expect(result).toEqual({
        success: false,
        error: 'S3 upload failed: S3 credentials require both aws_access_key_id and aws_secret_access_key',
      });
      expect(s3SendMock).not.toHaveBeenCalled();
    } finally {
      manager.close();
    }
  });

  it('handles paginated restore, traversal filtering, and multiple S3 body types', async () => {
    const basePath = createTempDir('niko-backup-s3-paged');
    const targetPath = join(basePath, 'restore-target');
    const manager = new BackupManager(join(basePath, 'backups'));

    const asyncBody = {
      async *[Symbol.asyncIterator]() {
        yield 'part-1';
        yield Buffer.from('-part-2');
      },
    };

    s3SendMock.mockImplementation(async (command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        const token = (command as { input: Record<string, unknown> }).input['ContinuationToken'];
        if (!token) {
          return {
            Contents: [
              { Key: 'archives/backup-456/scene.txt' },
              { Key: 'archives/backup-456/../escape.txt' },
            ],
            IsTruncated: true,
            NextContinuationToken: 'page-2',
          };
        }
        return {
          Contents: [
            { Key: 'archives/backup-456/nested/notes.txt' },
            { Key: 'archives/backup-456/final.txt' },
          ],
          IsTruncated: false,
        };
      }

      if (command instanceof GetObjectCommand) {
        const key = String((command as { input: Record<string, unknown> }).input['Key']);
        if (key.endsWith('scene.txt')) {
          return { Body: 'scene-body' };
        }
        if (key.endsWith('notes.txt')) {
          return {
            Body: {
              transformToByteArray: async () => new Uint8Array(Buffer.from('notes-body')),
            },
          };
        }
        if (key.endsWith('final.txt')) {
          return { Body: asyncBody };
        }
      }

      throw new Error('Unexpected S3 command');
    });

    try {
      const restored = await manager.restoreFromS3('archives/backup-456', { bucket: 'story-bucket' }, targetPath);
      expect(restored).toMatchObject({
        success: true,
        bucket: 'story-bucket',
        prefix: 'archives/backup-456',
        targetPath,
        fileCount: 3,
      });
      expect(readFileSync(join(targetPath, 'scene.txt'), 'utf-8')).toBe('scene-body');
      expect(readFileSync(join(targetPath, 'nested', 'notes.txt'), 'utf-8')).toBe('notes-body');
      expect(readFileSync(join(targetPath, 'final.txt'), 'utf-8')).toBe('part-1-part-2');
      expect(existsSync(join(targetPath, '..', 'escape.txt'))).toBe(false);
    } finally {
      manager.close();
    }
  });

  it('rejects invalid restore inputs and surfaces upload precondition errors', async () => {
    const basePath = createTempDir('niko-backup-s3-errors');
    const sourcePath = join(basePath, 'source');
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(join(sourcePath, 'scene.md'), '# Scene 3', 'utf-8');
    const manager = new BackupManager(join(basePath, 'backups'));

    try {
      expect(await manager.restoreFromS3('', { bucket: 'story-bucket' })).toEqual({
        success: false,
        error: 'S3 key prefix is required',
      });

      const backup = manager.createBackup(sourcePath);
      expect(backup.success).toBe(true);
      rmSync(String(backup.backupPath), { recursive: true, force: true });

      expect(await manager.backupToS3(String(backup.backupId), { bucket: 'story-bucket' })).toEqual({
        success: false,
        error: 'Backup data missing',
      });

      expect(await manager.backupToS3('missing-backup', { bucket: 'story-bucket' })).toEqual({
        success: false,
        error: 'Backup not found: missing-backup',
      });

      expect(await manager.restoreFromS3('archives/backup-789', {})).toEqual({
        success: false,
        error: 'S3 restore failed: S3 bucket is required',
      });
    } finally {
      manager.close();
    }
  });
});

describe('BackupManager WebDAV restore parity', () => {
  it('parses PROPFIND XML and downloads remote files into the target directory', async () => {
    const basePath = createTempDir('niko-backup-webdav-restore');
    const targetPath = join(basePath, 'restored');
    const manager = new BackupManager(join(basePath, 'backups'));
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === 'PROPFIND') {
        return {
          ok: true,
          text: async () => `<?xml version="1.0" encoding="utf-8"?>
            <d:multistatus xmlns:d="DAV:">
              <d:response>
                <d:href>/dav/backups/backup-123/</d:href>
                <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
              </d:response>
              <d:response>
                <d:href>/dav/backups/backup-123/chapter%201.md</d:href>
              </d:response>
              <d:response>
                <d:href>http://127.0.0.1:1900/dav/backups/backup-123/nested/notes.txt</d:href>
              </d:response>
            </d:multistatus>`,
        };
      }

      if (url.endsWith('/chapter%201.md')) {
        return {
          ok: true,
          arrayBuffer: async () => Buffer.from('chapter body'),
        };
      }

      if (url.endsWith('/nested/notes.txt')) {
        return {
          ok: true,
          arrayBuffer: async () => Buffer.from('nested body'),
        };
      }

      throw new Error(`Unexpected fetch ${init?.method ?? 'GET'} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await manager.restoreFromWebdav('/dav/backups/backup-123', {
        url: 'http://127.0.0.1:1900',
        username: 'demo',
        password: 'secret',
      }, targetPath);

      expect(result).toMatchObject({
        success: true,
        remotePath: '/dav/backups/backup-123',
        targetPath,
        fileCount: 2,
      });
      expect(readFileSync(join(targetPath, 'chapter 1.md'), 'utf-8')).toBe('chapter body');
      expect(readFileSync(join(targetPath, 'nested', 'notes.txt'), 'utf-8')).toBe('nested body');

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://127.0.0.1:1900/dav/backups/backup-123',
        expect.objectContaining({
          method: 'PROPFIND',
          headers: expect.objectContaining({
            Authorization: 'Basic ZGVtbzpzZWNyZXQ=',
            Depth: 'infinity',
          }),
        }),
      );
    } finally {
      manager.close();
    }
  });

  it('fails when a WebDAV file download returns a non-ok response', async () => {
    const basePath = createTempDir('niko-backup-webdav-error');
    const manager = new BackupManager(join(basePath, 'backups'));
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);

      if (init?.method === 'PROPFIND') {
        return {
          ok: true,
          text: async () => `<?xml version="1.0" encoding="utf-8"?>
            <d:multistatus xmlns:d="DAV:">
              <d:response>
                <d:href>/dav/backups/backup-404/missing.txt</d:href>
              </d:response>
            </d:multistatus>`,
        };
      }

      if (url.endsWith('/missing.txt')) {
        return {
          ok: false,
          status: 404,
          arrayBuffer: async () => Buffer.alloc(0),
        };
      }

      throw new Error(`Unexpected fetch ${init?.method ?? 'GET'} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await manager.restoreFromWebdav('/dav/backups/backup-404', {
        url: 'http://127.0.0.1:1900',
        username: 'demo',
        password: 'secret',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('WebDAV restore failed: GET http://127.0.0.1:1900/dav/backups/backup-404/missing.txt returned 404');
    } finally {
      manager.close();
    }
  });

  it('uploads backup files to WebDAV, creating parent collections as needed', async () => {
    const basePath = createTempDir('niko-backup-webdav-upload');
    const sourcePath = join(basePath, 'source');
    mkdirSync(join(sourcePath, 'nested'), { recursive: true });
    writeFileSync(join(sourcePath, 'chapter.md'), 'chapter', 'utf-8');
    writeFileSync(join(sourcePath, 'nested', 'notes.txt'), 'notes', 'utf-8');
    const manager = new BackupManager(join(basePath, 'backups'));

    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return { ok: true, status: 201 };
      }
      return { ok: true, status: 201 };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const backup = manager.createBackup(sourcePath, 'uploadable', false);
      const uploaded = await manager.backupToWebdav(String(backup.backupId), {
        url: 'https://dav.example.com/',
        username: 'demo',
        password: 'secret',
        remote_path: '/vault',
      });

      expect(uploaded).toMatchObject({
        success: true,
        backupId: backup.backupId,
        remotePath: `https://dav.example.com/vault/${backup.backupId}`,
        fileCount: 2,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/vault/${backup.backupId}/nested`),
        expect.objectContaining({ method: 'MKCOL' }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/chapter.md'),
        expect.objectContaining({ method: 'PUT' }),
      );
    } finally {
      manager.close();
    }
  });

  it('rejects invalid WebDAV configurations and reports upload/restore failures', async () => {
    const basePath = createTempDir('niko-backup-webdav-errors');
    const sourcePath = join(basePath, 'source');
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(join(sourcePath, 'chapter.md'), 'chapter', 'utf-8');
    const manager = new BackupManager(join(basePath, 'backups'));

    try {
      const backup = manager.createBackup(sourcePath, 'webdav-errors', false);
      expect(await manager.backupToWebdav(String(backup.backupId), {
        url: 'http://example.com',
        username: 'demo',
        password: 'secret',
      })).toEqual({
        success: false,
        error: 'WebDAV URL must use https (except localhost/127.0.0.1/::1 for local development)',
      });

      expect(await manager.backupToWebdav('missing-backup', {
        url: 'https://dav.example.com',
        username: 'demo',
        password: 'secret',
      })).toEqual({
        success: false,
        error: 'Backup not found: missing-backup',
      });

      rmSync(String(backup.backupPath), { recursive: true, force: true });
      expect(await manager.backupToWebdav(String(backup.backupId), {
        url: 'https://dav.example.com',
        username: 'demo',
        password: 'secret',
      })).toEqual({
        success: false,
        error: 'Backup data missing',
      });

      const fetchUploadFail = vi.fn(async (_input: unknown, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          return { ok: false, status: 500 };
        }
        return { ok: true, status: 201 };
      });
      vi.stubGlobal('fetch', fetchUploadFail);
      const freshBackup = manager.createBackup(sourcePath, 'fresh-backup', false);
      const uploadFailure = await manager.backupToWebdav(String(freshBackup.backupId), {
        url: 'https://dav.example.com',
        username: 'demo',
        password: 'secret',
      });
      expect(uploadFailure.success).toBe(false);
      expect(uploadFailure.error).toContain('WebDAV upload failed: PUT');

      const fetchRestoreFail = vi.fn(async (_input: unknown, init?: RequestInit) => {
        if (init?.method === 'PROPFIND') {
          return { ok: false, status: 401, text: async () => '' };
        }
        throw new Error('unexpected');
      });
      vi.stubGlobal('fetch', fetchRestoreFail);
      expect(await manager.restoreFromWebdav('/dav/backups/protected', {
        url: 'https://dav.example.com',
        username: 'demo',
        password: 'secret',
      })).toEqual({
        success: false,
        error: 'WebDAV restore failed: PROPFIND returned 401',
      });

      expect(await manager.restoreFromWebdav('/dav/backups/protected', {
        url: 'ftp://dav.example.com',
        username: 'demo',
        password: 'secret',
      })).toEqual({
        success: false,
        error: 'WebDAV URL must use https (except localhost/127.0.0.1/::1 for local development)',
      });
    } finally {
      manager.close();
    }
  });

  it('guards against invalid WebDAV traversal segments during restore', async () => {
    const basePath = createTempDir('niko-backup-webdav-traversal');
    const manager = new BackupManager(join(basePath, 'backups'));
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (init?.method === 'PROPFIND') {
        return {
          ok: true,
          text: async () => `<?xml version="1.0" encoding="utf-8"?>
            <d:multistatus xmlns:d="DAV:">
              <d:response>
                <d:href>/dav/backups/backup-321/%2E%2E/escape.txt</d:href>
              </d:response>
            </d:multistatus>`,
        };
      }
      throw new Error('unexpected');
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await manager.restoreFromWebdav('/dav/backups/backup-321', {
        url: 'https://dav.example.com',
        username: 'demo',
        password: 'secret',
      });
      expect(result).toMatchObject({
        success: true,
        remotePath: '/dav/backups/backup-321',
        fileCount: 0,
      });
      expect(() =>
        (manager as unknown as { _sanitizeWebdavRelativePath: (path: string) => string[] })
          ._sanitizeWebdavRelativePath('%2E%2E/escape.txt'),
      ).toThrow('Invalid WebDAV relative path traversal segment');
    } finally {
      manager.close();
    }
  });
});

describe('BackupManager singleton helpers', () => {
  it('reuses and resets the singleton instance', () => {
    const basePath = createTempDir('niko-backup-singleton');
    const first = getBackupManager(join(basePath, 'singleton'));
    const second = getBackupManager(join(basePath, 'singleton-other'));
    expect(first).toBe(second);

    resetBackupManager();

    const third = getBackupManager(join(basePath, 'singleton-new'));
    expect(third).not.toBe(first);
    third.close();
  });
});
