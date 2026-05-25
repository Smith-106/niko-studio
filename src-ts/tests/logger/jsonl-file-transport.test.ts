import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JsonlFileTransport } from '../../logger/jsonl-file-transport.js';

describe('JsonlFileTransport', () => {
  let tmpDir: string;
  let logPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-transport-test-'));
    logPath = path.join(tmpDir, 'app.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates log file and writes JSON entries', () => {
    const transport = new JsonlFileTransport({ path: logPath });
    transport.write({ level: 'info', message: 'hello' });
    transport.close();

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('hello');
  });

  it('appends multiple entries as separate lines', () => {
    const transport = new JsonlFileTransport({ path: logPath });
    transport.write({ level: 'info', message: 'first' });
    transport.write({ level: 'warn', message: 'second' });
    transport.close();

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).message).toBe('first');
    expect(JSON.parse(lines[1]).message).toBe('second');
  });

  it('creates directory if it does not exist', () => {
    const nestedPath = path.join(tmpDir, 'sub', 'dir', 'app.jsonl');
    const transport = new JsonlFileTransport({ path: nestedPath });
    transport.write({ level: 'info', message: 'nested' });
    transport.close();

    expect(fs.existsSync(nestedPath)).toBe(true);
  });

  it('rotates file when maxSize is exceeded', () => {
    const transport = new JsonlFileTransport({
      path: logPath,
      maxSize: 100, // 100 bytes
      maxFiles: 3,
    });

    // Write enough data to trigger rotation
    for (let i = 0; i < 20; i++) {
      transport.write({ level: 'info', message: `entry ${i} with padding to increase size` });
    }
    transport.close();

    // After rotation, original file should exist (new empty one) and .1 should exist (rotated)
    expect(fs.existsSync(logPath)).toBe(true);
    expect(fs.existsSync(`${logPath}.1`)).toBe(true);
  });

  it('respects maxFiles by deleting oldest rotated file', () => {
    const transport = new JsonlFileTransport({
      path: logPath,
      maxSize: 50,
      maxFiles: 2,
    });

    for (let i = 0; i < 50; i++) {
      transport.write({ level: 'info', message: `entry ${i} padding for size` });
    }
    transport.close();

    // With maxFiles=2, we should have at most .1 and .2
    expect(fs.existsSync(`${logPath}.3`)).toBe(false);
  });

  it('handles close gracefully', () => {
    const transport = new JsonlFileTransport({ path: logPath });
    transport.write({ level: 'info', message: 'before close' });
    transport.close();

    // Writing after close should not throw (silently ignored)
    expect(() => transport.write({ level: 'info', message: 'after close' })).not.toThrow();
  });
});
