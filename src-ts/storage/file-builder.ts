/**
 * FileBuilder - Base Builder for Atomic File Operations
 *
 * Implements the builder pattern with:
 * - Fluent API (with* methods return this)
 * - Atomic writes (write to temp file, then rename)
 * - Backup and rollback support
 * - Configurable encoding
 *
 * Usage:
 *     const path = new FileBuilder()
 *         .withPath("/path/to/file.txt")
 *         .withContent("Hello, World!")
 *         .withEncoding("utf-8")
 *         .withBackup(true)
 *         .build();
 *
 *     // Rollback if needed
 *     builder.rollback();
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class FileBuilderError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'FileBuilderError';
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface FileBuilderState {
  path: string | null;
  content: string | null;
  encoding: string;
  createParents: boolean;
  backupEnabled: boolean;
  backupPath: string | null;
  lastWrittenPath: string | null;
  tempSuffix: string;
  onSuccess: ((filePath: string) => void) | null;
  onError: ((error: Error) => void) | null;
}

function defaultState(): FileBuilderState {
  return {
    path: null,
    content: null,
    encoding: 'utf-8',
    createParents: true,
    backupEnabled: false,
    backupPath: null,
    lastWrittenPath: null,
    tempSuffix: '.tmp',
    onSuccess: null,
    onError: null,
  };
}

// ---------------------------------------------------------------------------
// FileBuilder
// ---------------------------------------------------------------------------

export class FileBuilder {
  protected _state: FileBuilderState;

  constructor() {
    this._state = defaultState();
  }

  // -- Fluent setters -----------------------------------------------------

  withPath(filePath: string): this {
    this._state.path = filePath;
    return this;
  }

  withContent(content: string): this {
    this._state.content = content;
    return this;
  }

  withEncoding(encoding: string): this {
    this._state.encoding = encoding;
    return this;
  }

  withBackup(enabled: boolean = true): this {
    this._state.backupEnabled = enabled;
    return this;
  }

  withCreateParents(enabled: boolean = true): this {
    this._state.createParents = enabled;
    return this;
  }

  withTempSuffix(suffix: string): this {
    this._state.tempSuffix = suffix;
    return this;
  }

  withOnSuccess(callback: (filePath: string) => void): this {
    this._state.onSuccess = callback;
    return this;
  }

  withOnError(callback: (error: Error) => void): this {
    this._state.onError = callback;
    return this;
  }

  // -- Validation ---------------------------------------------------------

  protected _validate(): void {
    if (this._state.path === null) {
      throw new FileBuilderError('Path is required. Use withPath() to set it.');
    }
    if (this._state.content === null) {
      throw new FileBuilderError('Content is required. Use withContent() to set it.');
    }
  }

  // -- Backup -------------------------------------------------------------

  protected _createBackup(): string | null {
    if (!this._state.backupEnabled) {
      return null;
    }

    const filePath = this._state.path;
    if (filePath === null || !fs.existsSync(filePath)) {
      return null;
    }

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, '')
      .replace(/\..+$/, '')
      .replace(/Z$/, '');

    const backupName = `${base}.${timestamp}.bak${ext}`;
    const backupPath = path.join(dir, backupName);

    try {
      fs.copyFileSync(filePath, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  // -- Atomic write -------------------------------------------------------

  protected _atomicWrite(
    filePath: string,
    content: string,
    encoding: string,
  ): void {
    const dir = path.dirname(filePath);

    // Create parent directories if needed
    if (this._state.createParents) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Generate temp file path in same directory (for same-filesystem rename)
    const base = path.basename(filePath);
    const uuid8 = randomUUID().split('-')[0]; // first 8 hex chars
    const tempName = `.${base}.${uuid8}${this._state.tempSuffix}`;
    const tempPath = path.join(dir, tempName);

    try {
      // Write to temp file
      fs.writeFileSync(tempPath, content, encoding as BufferEncoding);

      // On Windows, remove the target first if it exists
      if (os.platform() === 'win32' && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Atomic rename (works on same filesystem)
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      // Clean up temp file on error
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch {
        // Swallow cleanup errors -- the original error is more important
      }
      throw err;
    }
  }

  // -- Build --------------------------------------------------------------

  build(): string {
    try {
      this._validate();

      const filePath = this._state.path!;
      const content = this._state.content!;
      const encoding = this._state.encoding;

      // Create backup if enabled
      this._state.backupPath = this._createBackup();

      // Perform atomic write
      this._atomicWrite(filePath, content, encoding);

      // Store last written path for rollback
      this._state.lastWrittenPath = filePath;

      // Call success callback
      if (this._state.onSuccess) {
        this._state.onSuccess(filePath);
      }

      return filePath;
    } catch (err) {
      // Call error callback
      if (this._state.onError) {
        this._state.onError(
          err instanceof Error ? err : new Error(String(err)),
        );
      }

      if (err instanceof FileBuilderError) {
        throw err;
      }
      throw new FileBuilderError(
        `Failed to write file: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }

  // -- Rollback -----------------------------------------------------------

  rollback(): boolean {
    if (this._state.lastWrittenPath === null) {
      return false;
    }

    const filePath = this._state.lastWrittenPath;

    try {
      if (
        this._state.backupPath !== null &&
        fs.existsSync(this._state.backupPath)
      ) {
        // Restore from backup
        fs.copyFileSync(this._state.backupPath, filePath);
        fs.unlinkSync(this._state.backupPath);
      } else if (fs.existsSync(filePath)) {
        // No backup, just delete
        fs.unlinkSync(filePath);
      }

      this._state.lastWrittenPath = null;
      this._state.backupPath = null;
      return true;
    } catch {
      return false;
    }
  }

  // -- Reset --------------------------------------------------------------

  reset(): this {
    this._state = defaultState();
    return this;
  }

  // -- State getter -------------------------------------------------------

  get state(): Readonly<FileBuilderState> {
    return this._state;
  }
}
