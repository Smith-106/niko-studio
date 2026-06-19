import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renameSyncMock = vi.hoisted(() => vi.fn());

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  renameSyncMock.mockImplementation(actual.renameSync);
  return {
    ...actual,
    renameSync: renameSyncMock,
  };
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { JsonlFileTransport } from '../../logger/jsonl-file-transport.js';

describe('JsonlFileTransport additional coverage', () => {
  let tmpDir: string;
  let logPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-transport-extra-'));
    logPath = path.join(tmpDir, 'app.jsonl');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('swallows rotation rename failures and still appends the new line', () => {
    const transport = new JsonlFileTransport({
      path: logPath,
      maxSize: 1,
      maxFiles: 2,
    });

    transport.write({ level: 'info', message: 'seed' });
    renameSyncMock.mockImplementationOnce(() => {
      throw new Error('rename blocked');
    });

    expect(() =>
      transport.write({ level: 'info', message: 'after-rotation-failure' }),
    ).not.toThrow();

    transport.close();

    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('seed');
    expect(content).toContain('after-rotation-failure');
  });
});
