import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { atomicWriteSync, atomicWriteFile } from '../../utils/atomic-write.js';

describe('atomic-write', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-write-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('atomicWriteSync', () => {
    it('writes content to target file atomically', () => {
      const target = path.join(tmpDir, 'output.txt');
      atomicWriteSync(target, 'hello world');
      expect(fs.readFileSync(target, 'utf-8')).toBe('hello world');
    });

    it('overwrites existing file', () => {
      const target = path.join(tmpDir, 'output.txt');
      fs.writeFileSync(target, 'old content');
      atomicWriteSync(target, 'new content');
      expect(fs.readFileSync(target, 'utf-8')).toBe('new content');
    });

    it('does not leave .tmp file on success', () => {
      const target = path.join(tmpDir, 'output.txt');
      atomicWriteSync(target, 'data');
      const files = fs.readdirSync(tmpDir);
      expect(files).toEqual(['output.txt']);
    });

    it('creates parent directories if needed', () => {
      const target = path.join(tmpDir, 'sub', 'dir', 'output.txt');
      atomicWriteSync(target, 'nested');
      expect(fs.readFileSync(target, 'utf-8')).toBe('nested');
    });

    it('handles Buffer input', () => {
      const target = path.join(tmpDir, 'binary.bin');
      const buf = Buffer.from([0x01, 0x02, 0x03]);
      atomicWriteSync(target, buf);
      expect(fs.readFileSync(target)).toEqual(buf);
    });
  });

  describe('atomicWriteFile', () => {
    it('writes content asynchronously', async () => {
      const target = path.join(tmpDir, 'async-output.txt');
      await atomicWriteFile(target, 'async hello');
      expect(fs.readFileSync(target, 'utf-8')).toBe('async hello');
    });

    it('overwrites existing file asynchronously', async () => {
      const target = path.join(tmpDir, 'async-output.txt');
      fs.writeFileSync(target, 'old');
      await atomicWriteFile(target, 'new');
      expect(fs.readFileSync(target, 'utf-8')).toBe('new');
    });

    it('does not leave .tmp file on success', async () => {
      const target = path.join(tmpDir, 'async-output.txt');
      await atomicWriteFile(target, 'data');
      const files = fs.readdirSync(tmpDir);
      expect(files).toEqual(['async-output.txt']);
    });
  });
});