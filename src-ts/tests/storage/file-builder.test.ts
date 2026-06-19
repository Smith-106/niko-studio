import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileBuilder, FileBuilderError } from '../../storage/file-builder.js';

class ExposedFileBuilder extends FileBuilder {
  validateNow(): void {
    this._validate();
  }

  createBackupNow(): string | null {
    return this._createBackup();
  }

  atomicWriteNow(filePath: string, content: string, encoding = 'utf-8'): void {
    this._atomicWrite(filePath, content, encoding);
  }
}

describe('storage/file-builder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-file-builder-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('validates required path and content before writing', () => {
    const builder = new ExposedFileBuilder();

    expect(() => builder.validateNow()).toThrowError(FileBuilderError);
    builder.withPath(path.join(tempDir, 'note.txt'));
    expect(() => builder.validateNow()).toThrowError('Content is required');

    builder.withContent('ready');
    expect(() => builder.validateNow()).not.toThrow();
  });

  it('builds a file, updates state, and triggers the success callback', () => {
    const onSuccess = vi.fn();
    const target = path.join(tempDir, 'nested', 'note.txt');
    const builder = new FileBuilder()
      .withPath(target)
      .withContent('hello world')
      .withOnSuccess(onSuccess);

    const written = builder.build();

    expect(written).toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toBe('hello world');
    expect(onSuccess).toHaveBeenCalledWith(target);
    expect(builder.state.lastWrittenPath).toBe(target);
  });

  it('creates backups when requested and can roll back to the previous content', () => {
    const target = path.join(tempDir, 'chapter.txt');
    fs.writeFileSync(target, 'original', 'utf8');
    const builder = new FileBuilder()
      .withPath(target)
      .withContent('updated')
      .withBackup(true);

    builder.build();

    expect(fs.readFileSync(target, 'utf8')).toBe('updated');
    expect(builder.state.backupPath).toBeTruthy();
    expect(builder.rollback()).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('original');
    expect(builder.state.backupPath).toBeNull();
    expect(builder.state.lastWrittenPath).toBeNull();
  });

  it('deletes a freshly created file when rolling back without a backup', () => {
    const target = path.join(tempDir, 'generated.txt');
    const builder = new FileBuilder()
      .withPath(target)
      .withContent('generated');

    builder.build();

    expect(fs.existsSync(target)).toBe(true);
    expect(builder.rollback()).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
    expect(builder.rollback()).toBe(false);
  });

  it('returns false when rollback cleanup itself fails', () => {
    const builder = new FileBuilder();
    (builder as unknown as { _state: { lastWrittenPath: string; backupPath: string | null } })._state.lastWrittenPath = tempDir;
    (builder as unknown as { _state: { lastWrittenPath: string; backupPath: string | null } })._state.backupPath = null;

    expect(builder.rollback()).toBe(false);
  });

  it('surfaces write errors through the error callback and wraps them in FileBuilderError', () => {
    const onError = vi.fn();
    const target = path.join(tempDir, 'missing', 'note.txt');
    const builder = new FileBuilder()
      .withPath(target)
      .withContent('broken')
      .withCreateParents(false)
      .withOnError(onError);

    expect(() => builder.build()).toThrowError(FileBuilderError);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('can create explicit backup files and returns null when unavailable', () => {
    const target = path.join(tempDir, 'source.txt');
    fs.writeFileSync(target, 'seed', 'utf8');

    const disabled = new ExposedFileBuilder().withPath(target).withContent('seed');
    expect(disabled.createBackupNow()).toBeNull();

    const missing = new ExposedFileBuilder()
      .withPath(path.join(tempDir, 'missing.txt'))
      .withContent('seed')
      .withBackup(true);
    expect(missing.createBackupNow()).toBeNull();

    const enabled = new ExposedFileBuilder()
      .withPath(target)
      .withContent('seed')
      .withBackup(true);
    const backupPath = enabled.createBackupNow();

    expect(backupPath).toBeTruthy();
    expect(fs.readFileSync(backupPath!, 'utf8')).toBe('seed');
  });

  it('supports the Windows overwrite branch during atomic writes', () => {
    const target = path.join(tempDir, 'windows.txt');
    fs.writeFileSync(target, 'old', 'utf8');
    vi.spyOn(os, 'platform').mockReturnValue('win32');

    const builder = new ExposedFileBuilder();
    builder.atomicWriteNow(target, 'new');

    expect(fs.readFileSync(target, 'utf8')).toBe('new');
    expect(fs.readdirSync(tempDir)).toEqual(['windows.txt']);
  });

  it('resets builder state back to defaults', () => {
    const builder = new FileBuilder()
      .withPath(path.join(tempDir, 'reset.txt'))
      .withContent('value')
      .withEncoding('utf16le')
      .withBackup(true)
      .withCreateParents(false)
      .withTempSuffix('.stage');

    builder.reset();

    expect(builder.state).toMatchObject({
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
    });
  });
});
