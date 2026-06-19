import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  class ListObjectsV2Command {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  return {
    ListObjectsV2Command,
    S3Client,
  };
});

import {
  BackupManager,
  resetBackupManager,
} from '../../services/backup-manager';

type BackupManagerPrivate = BackupManager & {
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
  _normalizeWebdavPath(value: string): string;
};

const tempDirs: string[] = [];

function createTempDir(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `${label}-`));
  tempDirs.push(dir);
  return dir;
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

describe('BackupManager branch gap coverage', () => {
  it('falls back to empty metadata and rejects restore requests without a WebDAV scheme', async () => {
    const { basePath, manager } = createManager('niko-backup-branch-gap-metadata');
    const sourceDir = join(basePath, 'source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'notes.md'), 'notes', 'utf-8');

    try {
      const backup = manager.createBackup(sourceDir, 'metadata-empty', false);
      expect(backup.success).toBe(true);

      (manager as unknown as BackupManagerPrivate)
        ._getDb()
        .prepare('UPDATE backups SET metadata = ? WHERE id = ?')
        .run('', backup.backupId);

      expect(manager.getBackup(String(backup.backupId))?.metadata).toEqual({});
      await expect(
        manager.restoreFromWebdav('/dav/backups/test', {
          url: undefined as never,
          username: '',
          password: '',
        }),
      ).resolves.toEqual({
        success: false,
        error: 'WebDAV URL must include scheme',
      });
    } finally {
      manager.close();
    }
  });

  it('handles S3 restore pages that omit the Contents array entirely', async () => {
    const { basePath, manager } = createManager('niko-backup-branch-gap-s3-page');

    s3SendMock.mockResolvedValue({ IsTruncated: false });

    try {
      const restored = await manager.restoreFromS3('archives/backup-empty', {
        bucket: 'story-bucket',
      });

      expect(restored).toMatchObject({
        success: true,
        targetPath: join(basePath, 'backups', 'restored', 'backup-empty'),
        fileCount: 0,
      });
      expect(s3SendMock).toHaveBeenCalledTimes(1);
    } finally {
      manager.close();
    }
  });

  it('covers defensive href extraction fallbacks for missing capture groups', () => {
    const { manager } = createManager('niko-backup-branch-gap-hrefs');
    const privateManager = manager as unknown as BackupManagerPrivate;

    const missingResponseBody = {
      matchAll: () => [{ 1: undefined }],
    } as unknown as string;

    const missingHrefCapture = {
      matchAll: () => [{
        1: {
          match: () => ({ 0: '<href></href>', 1: undefined }),
        },
      }],
    } as unknown as string;

    try {
      expect(privateManager._extractWebdavHrefs(missingResponseBody)).toEqual([]);
      expect(privateManager._extractWebdavHrefs(missingHrefCapture)).toEqual([]);
    } finally {
      manager.close();
    }
  });

  it('covers normalization and S3 client fallback branches with exotic edge inputs', () => {
    const { manager } = createManager('niko-backup-branch-gap-private');
    const privateManager = manager as unknown as BackupManagerPrivate;

    const syntheticPath = {
      replace: () => syntheticPath,
      startsWith: () => false,
      [Symbol.toPrimitive]: () => '',
    } as unknown as string;

    try {
      expect(privateManager._normalizeWebdavPath(syntheticPath)).toBe('/');
      expect(privateManager._normalizeWebdavPath('folder')).toBe('/folder');

      const created = privateManager._createS3Client({
        bucket: 'story-bucket',
        region: '   ',
        prefix: null,
      });

      expect(created).toMatchObject({
        bucket: 'story-bucket',
        prefix: '',
      });
      expect(s3ClientConfigs[0]).toMatchObject({
        region: 'us-east-1',
        forcePathStyle: false,
      });
      created.client.destroy();
      expect(s3DestroyMock).toHaveBeenCalledTimes(1);
    } finally {
      manager.close();
    }
  });
});
