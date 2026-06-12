import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DelegateBroker,
  FileJobPersistence,
  type DelegateRecord,
  type IPersistentStorage,
} from '../../../workflow/delegate/delegate-broker.js';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-delegate-broker-'));
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number = 1500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Condition not met before timeout');
}

class ScriptedStorage implements IPersistentStorage {
  readonly removedKeys: string[] = [];
  readonly savedEntries: Array<{ key: string; value: string }> = [];

  constructor(
    private readonly keys: string[],
    private readonly values: Record<string, string | null>,
    private readonly options: {
      failListKeys?: boolean;
      failSave?: boolean;
    } = {},
  ) {}

  async save(key: string, value: string): Promise<void> {
    if (this.options.failSave) {
      throw new Error('save failed');
    }

    this.savedEntries.push({ key, value });
    this.values[key] = value;
  }

  async load(key: string): Promise<string | null> {
    return this.values[key] ?? null;
  }

  async remove(key: string): Promise<void> {
    this.removedKeys.push(key);
    delete this.values[key];
  }

  async listKeys(): Promise<string[]> {
    if (this.options.failListKeys) {
      throw new Error('list failed');
    }

    return [...this.keys];
  }
}

describe('workflow/delegate/delegate-broker additional coverage', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('FileJobPersistence round-trips saved job files', async () => {
    tempDir = createTempDir();
    const persistence = new FileJobPersistence(tempDir);

    await persistence.save('del-1', '{"status":"queued"}');
    await persistence.save('del-2', '{"status":"completed"}');
    writeFileSync(join(tempDir, 'notes.txt'), 'ignore-me', 'utf8');

    await expect(persistence.load('del-1')).resolves.toBe('{"status":"queued"}');
    await expect(persistence.load('missing')).resolves.toBeNull();
    await expect(persistence.listKeys()).resolves.toEqual(['del-1', 'del-2']);

    await persistence.remove('del-1');
    await persistence.remove('del-404');

    expect(existsSync(join(tempDir, 'del-1.json'))).toBe(false);
    expect(readFileSync(join(tempDir, 'del-2.json'), 'utf8')).toContain('completed');
  });

  it('filters completed delegates and surfaces wait and cancel edge cases', async () => {
    const broker = new DelegateBroker(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return 'ok';
      },
      {
        storage: new ScriptedStorage([], {}),
      },
    );

    const id = await broker.submit({ task: 'filter-test' });

    await expect(broker.wait(id, 5)).rejects.toThrow(`Timeout waiting for delegate ${id}`);

    const completion = await broker.wait(id, 1000);
    expect(completion.status).toBe('completed');
    expect(broker.list({ status: 'completed' })).toHaveLength(1);
    expect(broker.cancel(id)).toBe(false);

    await expect(broker.wait('missing-id', 20)).rejects.toThrow('Delegate missing-id not found');
  });

  it('broadcasts relay events and tolerates persistence save failures', async () => {
    const relay = {
      broadcast: vi.fn(),
    };
    const broker = new DelegateBroker(
      async (task, handle) => {
        expect(task).toBe('relay-test');
        expect(handle.cancelled).toBe(false);
        return 'relay-result';
      },
      {
        relay: relay as never,
        storage: new ScriptedStorage([], {}, { failSave: true }),
      },
    );

    const id = await broker.submit({ task: 'relay-test' });
    const completion = await broker.wait(id, 1000);

    expect(completion).toMatchObject({
      id,
      status: 'completed',
      result: 'relay-result',
    });
    expect(relay.broadcast).toHaveBeenCalledWith('delegate:status', {
      id,
      status: 'queued',
      task: 'relay-test',
    });
    expect(relay.broadcast).toHaveBeenCalledWith('delegate:status', {
      id,
      status: 'running',
    });
    expect(relay.broadcast).toHaveBeenCalledWith('delegate:status', {
      id,
      status: 'completed',
    });
  });

  it('hydrates terminal, interrupted, and corrupt persisted records', async () => {
    const terminalRecord: DelegateRecord = {
      id: 'del-7',
      task: 'terminal-task',
      status: 'completed',
      priority: 'normal',
      createdAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:01.000Z',
      completedAt: '2026-01-01T00:00:02.000Z',
      timeout: 1000,
      result: 'done',
      error: null,
      metadata: {},
      messages: [],
    };
    const interruptedRecord: DelegateRecord = {
      id: 'del-8',
      task: 'interrupted-task',
      status: 'running',
      priority: 'high',
      createdAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:01.000Z',
      completedAt: null,
      timeout: 1000,
      result: null,
      error: null,
      metadata: { branch: 'main' },
      messages: [],
    };
    const storage = new ScriptedStorage(
      ['terminal', 'interrupted', 'corrupt'],
      {
        terminal: JSON.stringify(terminalRecord),
        interrupted: JSON.stringify(interruptedRecord),
        corrupt: '{broken json',
      },
    );

    const broker = new DelegateBroker(async () => 'fresh-result', { storage });

    await waitUntil(() => broker.get('del-7') !== null && broker.get('del-8') !== null);

    expect(broker.get('del-7')).toMatchObject({
      id: 'del-7',
      status: 'completed',
      result: 'done',
    });
    expect(broker.get('del-8')).toMatchObject({
      id: 'del-8',
      status: 'failed',
      error: 'Process interrupted (recovered from persistence)',
    });
    expect(storage.removedKeys).toEqual(expect.arrayContaining(['terminal', 'corrupt']));
    expect(storage.savedEntries.some((entry) => entry.key === 'del-8')).toBe(true);

    const nextId = await broker.submit({ task: 'after-hydration' });
    expect(nextId).toBe('del-9');
  });

  it('starts fresh when hydration listing fails', async () => {
    const broker = new DelegateBroker(async () => 'ok', {
      storage: new ScriptedStorage([], {}, { failListKeys: true }),
    });

    const id = await broker.submit({ task: 'fresh-start' });
    expect(id).toBe('del-1');
    await expect(broker.wait(id, 1000)).resolves.toMatchObject({ status: 'completed' });
  });
});
