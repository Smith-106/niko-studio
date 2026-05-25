/**
 * JSONL file transport for StructuredLogger.
 *
 * Pattern learned from maestro-flow: append-only JSONL log files with
 * size-triggered rotation (rename + compress).
 *
 * Usage:
 *   const transport = new JsonlFileTransport({ path: 'logs/app.jsonl', maxSize: 10 * 1024 * 1024 });
 *   logger.addTransport(transport);
 */

import * as fs from 'fs';
import * as path from 'path';

export interface JsonlTransportOptions {
  /** Log file path (absolute or relative to cwd). */
  path: string;
  /** Max file size in bytes before rotation (default: 10MB). */
  maxSize?: number;
  /** Number of rotated files to keep (default: 5). */
  maxFiles?: number;
}

export class JsonlFileTransport {
  private readonly _path: string;
  private readonly _maxSize: number;
  private readonly _maxFiles: number;
  private _closed = false;

  constructor(options: JsonlTransportOptions) {
    this._path = path.resolve(options.path);
    this._maxSize = options.maxSize ?? 10 * 1024 * 1024; // 10MB
    this._maxFiles = options.maxFiles ?? 5;

    // Ensure directory exists
    const dir = path.dirname(this._path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /** Write a JSON log entry as a single line. */
  write(entry: Record<string, unknown>): void {
    if (this._closed) return;

    const line = JSON.stringify(entry) + '\n';

    // Check if rotation is needed before writing
    try {
      const stat = fs.statSync(this._path);
      if (stat.size >= this._maxSize) {
        this._rotate();
      }
    } catch {
      // File doesn't exist yet — no rotation needed
    }

    fs.appendFileSync(this._path, line, 'utf-8');
  }

  private _rotate(): void {
    // Rotate: current → .1, .1 → .2, ..., delete oldest
    for (let i = this._maxFiles - 1; i >= 0; i--) {
      const src = i === 0 ? this._path : `${this._path}.${i}`;
      const dst = `${this._path}.${i + 1}`;

      try {
        if (i === this._maxFiles - 1) {
          // Delete the oldest rotated file
          try { fs.unlinkSync(dst); } catch { /* ignore */ }
        }
        if (fs.existsSync(src)) {
          fs.renameSync(src, dst);
        }
      } catch {
        // Rotation failure is non-critical
      }
    }
  }

  /** Close the transport and release resources. */
  close(): void {
    this._closed = true;
  }
}
