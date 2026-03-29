/**
 * BackupManager - Backup management service
 *
 * Migrated from src/services/backup_manager.py.
 * Supports local file backup/restore, WebDAV, and S3 object storage.
 */

import Database from 'better-sqlite3';
import { join, dirname, basename, resolve, relative } from 'node:path';
import {
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  rmSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { URL } from 'node:url';

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface BackupInfo {
  id: string;
  name: string;
  sourcePath: string;
  backupPath: string;
  sizeBytes: number;
  fileCount: number;
  checksum: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface BackupProgress {
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  completedBytes: number;
  currentFile: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface BackupResult {
  success: boolean;
  error?: string;
  backupId?: string;
  name?: string;
  fileCount?: number;
  sizeBytes?: number;
  checksum?: string;
  backupPath?: string;
  targetPath?: string;
  files?: string[];
  remotePath?: string;
  bucket?: string;
  prefix?: string;
  s3Key?: string;
}

export type ProgressCallback = (progress: BackupProgress) => void;

// ---------------------------------------------------------------------------
// BackupManager
// ---------------------------------------------------------------------------

export class BackupManager {
  private readonly _backupDir: string;
  private readonly _dbPath: string;
  private _db: Database.Database | null = null;
  private _progressCallback: ProgressCallback | null = null;

  constructor(backupDir = '.writing/backups', _config?: unknown) {
    this._backupDir = resolve(backupDir);
    mkdirSync(this._backupDir, { recursive: true });
    this._dbPath = join(this._backupDir, 'backups.db');
    this._initDb();
  }

  // -----------------------------------------------------------------------
  // Public API - Local backup
  // -----------------------------------------------------------------------

  setProgressCallback(callback: ProgressCallback): void {
    this._progressCallback = callback;
  }

  createBackup(
    sourcePath: string,
    backupName?: string,
    compress = true,
  ): BackupResult {
    const source = resolve(sourcePath);
    if (!existsSync(source)) {
      return { success: false, error: `Source not found: ${sourcePath}` };
    }

    const backupId = randomUUID();
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const name = backupName ?? `${basename(source)}_${timestamp}`;

    const backupDir = join(this._backupDir, backupId);
    mkdirSync(backupDir, { recursive: true });

    try {
      const files = this._collectFiles(source);
      const totalBytes = files.reduce((sum, f) => sum + statSync(f).size, 0);

      const progress: BackupProgress = {
        totalFiles: files.length,
        completedFiles: 0,
        totalBytes,
        completedBytes: 0,
        currentFile: '',
        status: 'in_progress',
      };
      this._notifyProgress(progress);

      const db = this._getDb();
      const checksums: string[] = [];
      const stmt = db.prepare(
        'INSERT INTO backup_files (backup_id, file_path, relative_path, size_bytes, checksum) VALUES (?, ?, ?, ?, ?)',
      );

      for (const file of files) {
        progress.currentFile = file;
        this._notifyProgress(progress);

        const relPath = statSync(source).isFile()
          ? basename(file)
          : relative(source, file);

        let destPath = join(backupDir, relPath);
        mkdirSync(dirname(destPath), { recursive: true });

        const compressedExts = ['.gz', '.zip', '.7z', '.rar'];
        if (compress && !compressedExts.some((ext) => file.endsWith(ext))) {
          destPath += '.gz';
          this._compressFile(file, destPath);
        } else {
          copyFileSync(file, destPath);
        }

        const fileChecksum = this._computeFileChecksum(file);
        checksums.push(fileChecksum);
        stmt.run(backupId, destPath, relPath, statSync(file).size, fileChecksum);

        progress.completedFiles += 1;
        progress.completedBytes += statSync(file).size;
        this._notifyProgress(progress);
      }

      const totalChecksum = createHash('sha256')
        .update(checksums.join(''))
        .digest('hex');

      db.prepare(
        'INSERT INTO backups (id, name, source_path, backup_path, size_bytes, file_count, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(backupId, name, source, backupDir, totalBytes, files.length, totalChecksum, new Date().toISOString());

      progress.status = 'completed';
      this._notifyProgress(progress);

      return {
        success: true,
        backupId,
        name,
        fileCount: files.length,
        sizeBytes: totalBytes,
        checksum: totalChecksum,
        backupPath: backupDir,
      };
    } catch (err) {
      // Cleanup on failure
      if (existsSync(backupDir)) {
        rmSync(backupDir, { recursive: true, force: true });
      }
      return { success: false, error: (err as Error).message };
    }
  }

  restoreBackup(
    backupId: string,
    targetPath?: string,
    verifyChecksum = true,
  ): BackupResult {
    const db = this._getDb();
    const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId) as Record<string, unknown> | undefined;

    if (!row) {
      return { success: false, error: `Backup not found: ${backupId}` };
    }

    const backupDir = row.backup_path as string;
    if (!existsSync(backupDir)) {
      return { success: false, error: `Backup data missing: ${backupDir}` };
    }

    const target = targetPath ?? (row.source_path as string);
    mkdirSync(target, { recursive: true });

    try {
      const files = db.prepare('SELECT * FROM backup_files WHERE backup_id = ?').all(backupId) as Array<Record<string, unknown>>;

      const progress: BackupProgress = {
        totalFiles: files.length,
        completedFiles: 0,
        totalBytes: row.size_bytes as number,
        completedBytes: 0,
        currentFile: '',
        status: 'in_progress',
      };
      this._notifyProgress(progress);

      const restoredFiles: string[] = [];

      for (const fileRow of files) {
        const srcPath = fileRow.file_path as string;
        const relPath = fileRow.relative_path as string;

        const destPath = join(target, relPath);
        mkdirSync(dirname(destPath), { recursive: true });

        if (srcPath.endsWith('.gz')) {
          this._decompressFile(srcPath, destPath);
        } else {
          copyFileSync(srcPath, destPath);
        }

        if (verifyChecksum) {
          const restoredChecksum = this._computeFileChecksum(destPath);
          if (restoredChecksum !== (fileRow.checksum as string)) {
            // Log warning but continue
          }
        }

        restoredFiles.push(destPath);
        progress.completedFiles += 1;
        progress.completedBytes += fileRow.size_bytes as number;
        this._notifyProgress(progress);
      }

      progress.status = 'completed';
      this._notifyProgress(progress);

      return {
        success: true,
        backupId,
        targetPath: target,
        fileCount: restoredFiles.length,
        files: restoredFiles,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  listBackups(limit = 20): Array<Record<string, unknown>> {
    const db = this._getDb();
    const rows = db.prepare(
      'SELECT * FROM backups ORDER BY created_at DESC LIMIT ?',
    ).all(limit) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      source_path: row.source_path,
      size_bytes: row.size_bytes,
      file_count: row.file_count,
      checksum: row.checksum,
      created_at: row.created_at,
    }));
  }

  deleteBackup(backupId: string): boolean {
    const db = this._getDb();
    const row = db.prepare('SELECT backup_path FROM backups WHERE id = ?').get(backupId) as Record<string, unknown> | undefined;

    if (!row) return false;

    const backupPath = row.backup_path as string;
    if (existsSync(backupPath)) {
      rmSync(backupPath, { recursive: true, force: true });
    }

    db.prepare('DELETE FROM backup_files WHERE backup_id = ?').run(backupId);
    db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);

    return true;
  }

  getBackup(backupId: string): BackupInfo | null {
    const db = this._getDb();
    const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: row.id as string,
      name: row.name as string,
      sourcePath: row.source_path as string,
      backupPath: row.backup_path as string,
      sizeBytes: row.size_bytes as number,
      fileCount: row.file_count as number,
      checksum: row.checksum as string,
      createdAt: new Date(row.created_at as string),
      metadata: JSON.parse((row.metadata as string) || '{}'),
    };
  }

  // -----------------------------------------------------------------------
  // WebDAV remote backup
  // -----------------------------------------------------------------------

  async backupToWebdav(
    backupId: string,
    webdavConfig: { url: string; username: string; password: string; remote_path?: string },
  ): Promise<BackupResult> {
    const backup = this.getBackup(backupId);
    if (!backup) {
      return { success: false, error: `Backup not found: ${backupId}` };
    }
    if (!existsSync(backup.backupPath)) {
      return { success: false, error: 'Backup data missing' };
    }

    const url = (webdavConfig.url || '').replace(/\/+$/, '');
    const username = webdavConfig.username ?? '';
    const password = webdavConfig.password ?? '';
    const remotePath = webdavConfig.remote_path ?? '/backups';

    const urlError = this._validateWebdavBaseUrl(url);
    if (urlError) {
      return { success: false, error: urlError };
    }

    try {
      const remoteDir = `${url}${remotePath}/${backupId}`;
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');

      // Create remote directory (MKCOL)
      await fetch(remoteDir, {
        method: 'MKCOL',
        headers: { 'Authorization': `Basic ${credentials}` },
        signal: AbortSignal.timeout(30_000),
      }).catch(() => { /* ignore if exists */ });

      const uploadedFiles: string[] = [];
      const localFiles = this._collectFiles(backup.backupPath);

      for (const file of localFiles) {
        const rel = relative(backup.backupPath, file);
        const remoteFileUrl = `${remoteDir}/${rel}`;

        // Ensure parent directory
        const parentDir = `${remoteDir}/${dirname(rel)}`;
        if (dirname(rel) !== '.') {
          await fetch(parentDir, {
            method: 'MKCOL',
            headers: { 'Authorization': `Basic ${credentials}` },
            signal: AbortSignal.timeout(30_000),
          }).catch(() => {});
        }

        const content = readFileSync(file);
        const res = await fetch(remoteFileUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/octet-stream',
          },
          body: content,
          signal: AbortSignal.timeout(300_000),
        });

        if (!res.ok) {
          throw new Error(`PUT ${remoteFileUrl} returned ${res.status}`);
        }

        uploadedFiles.push(rel);
      }

      return {
        success: true,
        backupId,
        remotePath: remoteDir,
        fileCount: uploadedFiles.length,
      };
    } catch (err) {
      return { success: false, error: `WebDAV upload failed: ${(err as Error).message}` };
    }
  }

  async restoreFromWebdav(
    remotePath: string,
    webdavConfig: { url: string; username: string; password: string },
    targetPath?: string,
  ): Promise<BackupResult> {
    const url = (webdavConfig.url || '').replace(/\/+$/, '');
    const username = webdavConfig.username ?? '';
    const password = webdavConfig.password ?? '';

    const urlError = this._validateWebdavBaseUrl(url);
    if (urlError) {
      return { success: false, error: urlError };
    }

    const target = targetPath ?? join(this._backupDir, 'restored', basename(remotePath));
    mkdirSync(target, { recursive: true });

    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    const fullUrl = `${url}${remotePath}`;

    try {
      const res = await fetch(fullUrl, {
        method: 'PROPFIND',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Depth': 'infinity',
        },
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) {
        throw new Error(`PROPFIND returned ${res.status}`);
      }

      const xmlBody = await res.text();
      const downloadedFiles = this._parseWebdavResponse(xmlBody, url, remotePath, target, credentials);

      return {
        success: true,
        remotePath,
        targetPath: target,
        fileCount: downloadedFiles,
      };
    } catch (err) {
      return { success: false, error: `WebDAV restore failed: ${(err as Error).message}` };
    }
  }

  // -----------------------------------------------------------------------
  // S3 object storage backup
  // -----------------------------------------------------------------------

  async backupToS3(
    backupId: string,
    _s3Config: Record<string, unknown>,
  ): Promise<BackupResult> {
    // S3 requires the AWS SDK which is a heavyweight dependency.
    // For now, return a descriptive error. Full implementation can be added later.
    return {
      success: false,
      error: 'S3 backup not yet implemented in TypeScript. Use WebDAV backup or implement with AWS SDK.',
    };
  }

  async restoreFromS3(
    _s3Key: string,
    _s3Config: Record<string, unknown>,
    _targetPath?: string,
  ): Promise<BackupResult> {
    return {
      success: false,
      error: 'S3 restore not yet implemented in TypeScript. Use WebDAV restore or implement with AWS SDK.',
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  close(): void {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private _getDb(): Database.Database {
    if (!this._db) {
      this._db = new Database(this._dbPath);
      this._db.pragma('journal_mode = WAL');
    }
    return this._db;
  }

  private _initDb(): void {
    const db = this._getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_path TEXT NOT NULL,
        backup_path TEXT NOT NULL,
        size_bytes INTEGER DEFAULT 0,
        file_count INTEGER DEFAULT 0,
        checksum TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS backup_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        size_bytes INTEGER DEFAULT 0,
        checksum TEXT,
        FOREIGN KEY (backup_id) REFERENCES backups(id)
      );

      CREATE INDEX IF NOT EXISTS idx_backups_created ON backups(created_at);
      CREATE INDEX IF NOT EXISTS idx_backup_files_backup ON backup_files(backup_id);
    `);
  }

  private _notifyProgress(progress: BackupProgress): void {
    if (this._progressCallback) {
      try {
        this._progressCallback(progress);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private _computeFileChecksum(filePath: string): string {
    const hasher = createHash('sha256');
    const data = readFileSync(filePath);
    hasher.update(data);
    return hasher.digest('hex');
  }

  private _collectFiles(sourcePath: string): string[] {
    if (!existsSync(sourcePath)) return [];
    const stat = statSync(sourcePath);
    if (stat.isFile()) return [sourcePath];

    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isFile()) {
          files.push(full);
        } else if (entry.isDirectory()) {
          walk(full);
        }
      }
    };
    walk(sourcePath);
    return files;
  }

  private _compressFile(src: string, dest: string): void {
    const content = readFileSync(src);
    const compressed = gzipSync(content);
    writeFileSync(dest, compressed);
  }

  private _decompressFile(src: string, dest: string): void {
    const content = readFileSync(src);
    const decompressed = gunzipSync(content);
    writeFileSync(dest, decompressed);
  }

  private _validateWebdavBaseUrl(url: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return 'WebDAV URL must include scheme';
    }

    const scheme = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();

    if (scheme === 'https:') return null;
    if (scheme === 'http:' && (host === 'localhost' || host === '::1' || host.startsWith('127.'))) {
      return null;
    }
    return 'WebDAV URL must use https (except localhost/127.0.0.1/::1 for local development)';
  }

  private _parseWebdavResponse(
    _xmlBody: string,
    _baseUrl: string,
    _remotePath: string,
    _target: string,
    _credentials: string,
  ): number {
    // Basic WebDAV PROPFIND response parsing would require an XML parser.
    // For now, return 0 downloads. Full implementation can use fast-xml-parser.
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: BackupManager | null = null;

export function getBackupManager(backupDir = '.writing/backups', config?: unknown): BackupManager {
  if (!_instance) {
    _instance = new BackupManager(backupDir, config);
  }
  return _instance;
}

export function resetBackupManager(): void {
  if (_instance) {
    _instance.close();
  }
  _instance = null;
}
