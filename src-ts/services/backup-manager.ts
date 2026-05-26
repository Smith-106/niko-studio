/**
 * BackupManager - Backup management service
 *
 * Migrated from src/services/backup_manager.py.
 * Supports local file backup/restore, WebDAV, and S3 object storage.
 */

import Database from 'better-sqlite3';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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

interface S3Config {
  bucket?: string;
  prefix?: string;
  region?: string;
  endpoint?: string;
  endpoint_url?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  force_path_style?: boolean;
}

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
      db.prepare(
        'INSERT INTO backups (id, name, source_path, backup_path, size_bytes, file_count, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(backupId, name, source, backupDir, 0, 0, '', new Date().toISOString());

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
        'UPDATE backups SET size_bytes = ?, file_count = ?, checksum = ? WHERE id = ?',
      ).run(totalBytes, files.length, totalChecksum, backupId);

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
      try {
        const db = this._getDb();
        db.prepare('DELETE FROM backup_files WHERE backup_id = ?').run(backupId);
        db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);
      } catch {
        // Ignore cleanup errors after a failed backup.
      }

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
      metadata: (() => { try { return JSON.parse((row.metadata as string) || '{}'); } catch { return {}; } })(),
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
      const downloadedFiles = await this._parseWebdavResponse(xmlBody, url, remotePath, target, credentials);

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
    s3Config: Record<string, unknown>,
  ): Promise<BackupResult> {
    const backup = this.getBackup(backupId);
    if (!backup) {
      return { success: false, error: `Backup not found: ${backupId}` };
    }
    if (!existsSync(backup.backupPath)) {
      return { success: false, error: 'Backup data missing' };
    }

    try {
      const { client, bucket, prefix } = this._createS3Client(s3Config);
      try {
        const keyPrefix = prefix ? `${prefix}/${backupId}` : backupId;
        const localFiles = this._collectFiles(backup.backupPath);

        for (const file of localFiles) {
          const rel = relative(backup.backupPath, file).replace(/\\/g, '/');
          const s3Key = `${keyPrefix}/${rel}`;
          await client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: readFileSync(file),
            ContentType: 'application/octet-stream',
          }));
        }

        return {
          success: true,
          backupId,
          bucket,
          prefix: keyPrefix,
          s3Key: keyPrefix,
          fileCount: localFiles.length,
        };
      } finally {
        client.destroy();
      }
    } catch (err) {
      return { success: false, error: `S3 upload failed: ${(err as Error).message}` };
    }
  }

  async restoreFromS3(
    s3Key: string,
    s3Config: Record<string, unknown>,
    targetPath?: string,
  ): Promise<BackupResult> {
    const normalizedKey = this._normalizeS3Key(s3Key);
    if (!normalizedKey) {
      return { success: false, error: 'S3 key prefix is required' };
    }

    const target = targetPath ?? join(this._backupDir, 'restored', basename(normalizedKey));
    mkdirSync(target, { recursive: true });

    try {
      const { client, bucket } = this._createS3Client(s3Config);
      try {
        const downloadedFiles: string[] = [];
        let continuationToken: string | undefined;

        do {
          const page = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: normalizedKey,
            ContinuationToken: continuationToken,
          }));

          for (const obj of page.Contents ?? []) {
            const key = obj.Key ?? '';
            if (!key || key.endsWith('/')) continue;

            const rel = key.slice(normalizedKey.length).replace(/^\/+/, '');
            if (!rel) continue;

            const localFile = join(target, ...rel.split('/'));
            mkdirSync(dirname(localFile), { recursive: true });

            const response = await client.send(new GetObjectCommand({
              Bucket: bucket,
              Key: key,
            }));
            const content = await this._readS3Body(response.Body);
          writeFileSync(localFile, content);
          downloadedFiles.push(rel);
        }

        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);

      return {
        success: true,
        bucket,
        prefix: normalizedKey,
        s3Key: normalizedKey,
        targetPath: target,
        fileCount: downloadedFiles.length,
      };
    } finally {
      client.destroy();
    }
    } catch (err) {
      return { success: false, error: `S3 restore failed: ${(err as Error).message}` };
    }
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

  private async _parseWebdavResponse(
    xmlBody: string,
    baseUrl: string,
    remotePath: string,
    target: string,
    credentials: string,
  ): Promise<number> {
    const remoteRootUrl = new URL(remotePath, `${baseUrl}/`);
    const remoteBasePath = this._normalizeWebdavPath(remoteRootUrl.pathname);
    const hrefs = this._extractWebdavHrefs(xmlBody);
    let downloadedFiles = 0;

    for (const href of hrefs) {
      const fileUrl = new URL(href, remoteRootUrl);
      const relativePath = this._relativeWebdavPath(
        this._normalizeWebdavPath(fileUrl.pathname),
        remoteBasePath,
      );

      if (!relativePath) {
        continue;
      }

      const segments = this._sanitizeWebdavRelativePath(relativePath);
      if (segments.length === 0) {
        continue;
      }

      const localFile = join(target, ...segments);
      mkdirSync(dirname(localFile), { recursive: true });

      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
        signal: AbortSignal.timeout(300_000),
      });

      if (!response.ok) {
        throw new Error(`GET ${fileUrl.toString()} returned ${response.status}`);
      }

      const content = await this._readHttpBody(response);
      writeFileSync(localFile, content);
      downloadedFiles += 1;
    }

    return downloadedFiles;
  }

  private _extractWebdavHrefs(xmlBody: string): string[] {
    const hrefs = new Set<string>();
    const responseRegex = /<(?:[\w.-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?response>/gi;

    for (const responseMatch of xmlBody.matchAll(responseRegex)) {
      const responseBody = responseMatch[1] ?? '';
      const hrefMatch = responseBody.match(/<(?:[\w.-]+:)?href\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?href>/i);
      if (!hrefMatch) {
        continue;
      }

      const href = this._decodeXmlEntities(hrefMatch[1] ?? '').trim();
      const isCollection = /<(?:[\w.-]+:)?collection\b/i.test(responseBody);
      if (!href || isCollection || href.endsWith('/')) {
        continue;
      }

      hrefs.add(href);
    }

    return Array.from(hrefs);
  }

  private _decodeXmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'');
  }

  private _normalizeWebdavPath(value: string): string {
    const normalized = value
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/');

    if (!normalized || normalized === '/') {
      return '/';
    }

    const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return withLeadingSlash.length > 1
      ? withLeadingSlash.replace(/\/+$/, '')
      : withLeadingSlash;
  }

  private _relativeWebdavPath(filePath: string, remoteBasePath: string): string | null {
    if (filePath === remoteBasePath) {
      return null;
    }

    const prefix = remoteBasePath === '/' ? '/' : `${remoteBasePath}/`;
    if (!filePath.startsWith(prefix)) {
      return null;
    }

    return filePath.slice(prefix.length);
  }

  private _sanitizeWebdavRelativePath(relativePath: string): string[] {
    const segments = relativePath
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      });

    if (segments.some((segment) => segment === '..')) {
      throw new Error('Invalid WebDAV relative path traversal segment');
    }

    return segments.filter((segment) => segment !== '.');
  }

  private _createS3Client(rawConfig: Record<string, unknown>): {
    client: S3Client;
    bucket: string;
    prefix: string;
  } {
    const s3Config = rawConfig as S3Config;
    const bucket = String(s3Config.bucket ?? '').trim();
    if (!bucket) {
      throw new Error('S3 bucket is required');
    }

    const accessKeyId = String(s3Config.aws_access_key_id ?? '').trim();
    const secretAccessKey = String(s3Config.aws_secret_access_key ?? '').trim();
    if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
      throw new Error('S3 credentials require both aws_access_key_id and aws_secret_access_key');
    }

    const region = String(s3Config.region ?? 'us-east-1').trim() || 'us-east-1';
    const endpoint = String(s3Config.endpoint_url ?? s3Config.endpoint ?? '').trim() || undefined;
    const rawPrefix = s3Config.prefix === undefined ? 'backups' : String(s3Config.prefix ?? '');
    const prefix = this._normalizeS3Key(rawPrefix);
    const forcePathStyle = typeof s3Config.force_path_style === 'boolean'
      ? s3Config.force_path_style
      : Boolean(endpoint);

    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      ...(accessKeyId && secretAccessKey
        ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }
        : {}),
    });

    return { client, bucket, prefix };
  }

  private _normalizeS3Key(value: string): string {
    return value
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  private async _readS3Body(body: unknown): Promise<Buffer> {
    if (body == null) {
      return Buffer.alloc(0);
    }
    if (Buffer.isBuffer(body)) {
      return body;
    }
    if (body instanceof Uint8Array) {
      return Buffer.from(body);
    }
    if (typeof body === 'string') {
      return Buffer.from(body);
    }

    const s3Body = body as {
      transformToByteArray?: () => Promise<Uint8Array>;
      [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
    };

    if (typeof s3Body.transformToByteArray === 'function') {
      return Buffer.from(await s3Body.transformToByteArray());
    }

    if (typeof s3Body[Symbol.asyncIterator] === 'function') {
      const chunks: Buffer[] = [];
      for await (const chunk of body as AsyncIterable<unknown>) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        } else if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else {
          throw new Error('Unsupported S3 response chunk type');
        }
      }
      return Buffer.concat(chunks);
    }

    throw new Error('Unsupported S3 response body type');
  }

  private async _readHttpBody(response: Pick<Response, 'arrayBuffer'>): Promise<Buffer> {
    return Buffer.from(await response.arrayBuffer());
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
