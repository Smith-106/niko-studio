import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DelegateBroker,
  DelegateHandle,
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

  constructor(
    private readonly keys: string[],
    private readonly values: Record<string, string | null>,
  ) {}

  async save(key: string, value: string): Promise<void> {
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
    return [...this.keys];
  }
}

class MemoryStorage implements IPersistentStorage {
  private readonly values = new Map<string, string>();

  async save(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async load(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }

  async listKeys(): Promise<string[]> {
    return Array.from(this.values.keys());
  }
}

type DelegateBrokerWhiteBox = DelegateBroker & {
  delegates: Map<string, DelegateRecord>;
  handles: Map<string, DelegateHandle>;
  _start(id: string): Promise<void>;
  _saveJobState(id: string): void;
};

function createRecord(
  id: string,
  status: DelegateRecord['status'],
): DelegateRecord {
  return {
    id,
    task: `task-${id}`,
    status,
    priority: 'normal',
    createdAt: '2026-01-01T00:00:00.000Z',
    startedAt: status === 'queued' ? null : '2026-01-01T00:00:01.000Z',
    completedAt: null,
    timeout: 1000,
    result: null,
    error: null,
    metadata: {},
    messages: [],
  };
}

describe('workflow/delegate/delegate-broker branch-gap coverage', () => {
  let tempDir: string | null = null;
  let originalCwd: string | null = null;

  afterEach(() => {
    if (originalCwd) {
      process.chdir(originalCwd);
      originalCwd = null;
    }
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    tempDir = null;
    vi.restoreAllMocks();
  });

  it('uses the default persistence directory and tolerates the directory disappearing before listKeys', async () => {
    tempDir = createTempDir();
    originalCwd = process.cwd();
    process.chdir(tempDir);

    const persistence = new FileJobPersistence();
    await persistence.save('del-default', '{"status":"queued"}');

    expect(existsSync(join(tempDir, '.writing', 'delegate-jobs', 'del-default.json'))).toBe(true);

    rmSync(join(tempDir, '.writing'), { recursive: true, force: true });

    await expect(persistence.listKeys()).resolves.toEqual([]);
  });

  it('falls back to file persistence when broker options omit a storage implementation', async () => {
    tempDir = createTempDir();
    const broker = new DelegateBroker(
      async () => 'persisted-result',
      {
        persistDir: tempDir,
        storage: undefined as never,
      },
    );

    const id = await broker.submit({ task: 'persist with default storage' });
    await expect(broker.wait(id, 1000)).resolves.toMatchObject({
      status: 'completed',
      result: 'persisted-result',
    });

    await waitUntil(() => existsSync(join(tempDir!, `${id}.json`)));
  });

  it('cancels running delegates and wait resolves the cancelled status without an error payload', async () => {
    const broker = new DelegateBroker(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'should-not-complete';
      },
      {
        storage: new MemoryStorage(),
      },
    );

    const id = await broker.submit({ task: 'cancel-while-running', timeout: 10_000 });
    await waitUntil(() => (broker.get(id) as DelegateRecord | null)?.status === 'running');

    expect(broker.cancel(id)).toBe(true);

    const completion = await broker.wait(id, 500);
    expect((completion as unknown as { status: string }).status).toBe('cancelled');
    expect(completion.error).toBeUndefined();
    expect((broker.get(id) as DelegateRecord).status).toBe('cancelled');
  });

  it('supports queued cancellation when a handle is already present and wait() uses the default timeout fallback', async () => {
    const broker = new DelegateBroker(async () => 'unused', {
      storage: new MemoryStorage(),
    }) as DelegateBrokerWhiteBox;

    const record = createRecord('del-queued', 'queued');
    broker.delegates.set(record.id, record);
    broker.handles.set(record.id, new DelegateHandle());

    expect(broker.cancel(record.id)).toBe(true);

    const completion = await broker.wait(record.id);
    expect((completion as unknown as { status: string }).status).toBe('cancelled');
    expect(completion.error).toBeUndefined();
  });

  it('returns false when cancel reaches the non-running and non-queued guard', () => {
    const broker = new DelegateBroker(async () => 'unused', {
      storage: new MemoryStorage(),
    }) as DelegateBrokerWhiteBox;

    const record = createRecord('del-failed', 'failed');
    broker.delegates.set(record.id, record);
    broker.handles.set(record.id, new DelegateHandle());

    expect(broker.cancel(record.id)).toBe(false);
    expect((broker.get(record.id) as DelegateRecord).status).toBe('failed');
  });

  it('shutdown also cancels queued delegates that already have handles', async () => {
    const broker = new DelegateBroker(async () => 'unused', {
      storage: new MemoryStorage(),
    }) as DelegateBrokerWhiteBox;

    const record = createRecord('del-shutdown-queued', 'queued');
    broker.delegates.set(record.id, record);
    broker.handles.set(record.id, new DelegateHandle());

    await broker.shutdown();

    expect((broker.get(record.id) as DelegateRecord).status).toBe('cancelled');
  });

  it('private start/save helpers return early for missing and non-queued delegates', async () => {
    const broker = new DelegateBroker(async () => 'unused', {
      storage: new MemoryStorage(),
    }) as DelegateBrokerWhiteBox;

    await expect(broker._start('missing')).resolves.toBeUndefined();
    expect(() => broker._saveJobState('missing')).not.toThrow();

    const record = createRecord('del-completed', 'completed');
    record.completedAt = '2026-01-01T00:00:02.000Z';
    broker.delegates.set(record.id, record);

    await expect(broker._start(record.id)).resolves.toBeUndefined();
    expect((broker.get(record.id) as DelegateRecord).status).toBe('completed');
  });

  it('ignores null hydration payloads and keeps nextId monotonic when later hydrated ids are lower', async () => {
    const del2: DelegateRecord = {
      id: 'del-2',
      task: 'higher-id',
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
    const del1: DelegateRecord = {
      id: 'del-1',
      task: 'lower-id',
      status: 'failed',
      priority: 'normal',
      createdAt: '2026-01-01T00:00:00.000Z',
      startedAt: '2026-01-01T00:00:01.000Z',
      completedAt: '2026-01-01T00:00:02.000Z',
      timeout: 1000,
      result: null,
      error: 'failed',
      metadata: {},
      messages: [],
    };

    const storage = new ScriptedStorage(
      ['ghost', 'high', 'low'],
      {
        ghost: null,
        high: JSON.stringify(del2),
        low: JSON.stringify(del1),
      },
    );

    const broker = new DelegateBroker(async () => 'fresh-result', { storage });

    await waitUntil(() => broker.get('del-2') !== null && broker.get('del-1') !== null);

    const nextId = await broker.submit({ task: 'after-reordered-hydration' });
    expect(nextId).toBe('del-3');
    expect(storage.removedKeys).toEqual(expect.arrayContaining(['high', 'low']));
  });
});
