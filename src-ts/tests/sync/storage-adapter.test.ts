import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LocalStorageAdapter,
  RemoteStorageAdapter,
} from '../../sync/storage-adapter.js';

const STORAGE_PREFIX = 'niko-sync:';
const META_KEY = `${STORAGE_PREFIX}__meta__`;
const DEVICE_KEY = `${STORAGE_PREFIX}__device_id__`;

class MemoryLocalStorage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

function mockResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('sync/storage-adapter', () => {
  let localStorageMock: MemoryLocalStorage;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorageMock = new MemoryLocalStorage();
    fetchMock = vi.fn();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock,
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'localStorage');
    Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('generates and reuses a local device id', async () => {
    const adapter = new LocalStorageAdapter();
    const generated = localStorageMock.getItem(DEVICE_KEY);

    expect(generated).toMatch(/^device-/);

    const first = await adapter.set('chapter-1', { text: 'draft' });
    expect(first.deviceId).toBe(generated);

    localStorageMock.setItem(DEVICE_KEY, 'device-fixed');
    const reusedAdapter = new LocalStorageAdapter();
    const second = await reusedAdapter.set('chapter-2', { text: 'final' });

    expect(second.deviceId).toBe('device-fixed');
  });

  it('returns null for missing or malformed local entries', async () => {
    const adapter = new LocalStorageAdapter();

    expect(await adapter.get('missing')).toBeNull();

    localStorageMock.setItem(`${STORAGE_PREFIX}broken`, '{not-json');
    expect(await adapter.get('broken')).toBeNull();
  });

  it('increments local versions, lists entries, and deletes data', async () => {
    const adapter = new LocalStorageAdapter();

    const first = await adapter.set('chapter-1', { text: 'draft' });
    const second = await adapter.set('chapter-1', { text: 'revised' }, 'device-override');
    await adapter.set('chapter-2', { text: 'other' });
    localStorageMock.setItem(`${STORAGE_PREFIX}invalid`, '{not-json');
    localStorageMock.setItem(META_KEY, '{"ignore":true}');

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(second.deviceId).toBe('device-override');
    expect(second.updatedAt).toBe(new Date('2026-06-04T10:00:00.000Z').getTime());

    const all = await adapter.list();
    expect(all.map((entry) => entry.key).sort()).toEqual(['chapter-1', 'chapter-2']);

    const filtered = await adapter.list('chapter-2');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('chapter-2');

    expect(await adapter.delete('chapter-2')).toBe(true);
    expect(await adapter.delete('chapter-2')).toBe(false);
  });

  it('returns default metadata, ignores malformed meta, and merges updates', async () => {
    const adapter = new LocalStorageAdapter();
    const defaults = await adapter.getMeta();

    expect(defaults).toEqual({
      lastSyncAt: 0,
      deviceId: expect.stringMatching(/^device-/),
      snapshotVersions: {},
    });

    localStorageMock.setItem(META_KEY, '{not-json');
    const recovered = await adapter.getMeta();
    expect(recovered.deviceId).toMatch(/^device-/);

    const merged = await adapter.setMeta({
      lastSyncAt: 42,
      snapshotVersions: { chapter: 3 },
    });

    expect(merged).toMatchObject({
      lastSyncAt: 42,
      snapshotVersions: { chapter: 3 },
    });
    expect(localStorageMock.getItem(META_KEY)).toContain('"lastSyncAt":42');
  });

  it('handles remote get success and 404 responses', async () => {
    const adapter = new RemoteStorageAdapter('https://api.example.com', 'secret');
    fetchMock
      .mockResolvedValueOnce(mockResponse({}, { ok: false, status: 404 }))
      .mockResolvedValueOnce(
        mockResponse({
          key: 'chapter-1',
          data: { text: 'remote' },
          version: 2,
          updatedAt: 100,
          deviceId: 'remote-device',
        }),
      );

    await expect(adapter.get('missing')).resolves.toBeNull();
    await expect(adapter.get('chapter-1')).resolves.toMatchObject({
      key: 'chapter-1',
      version: 2,
      deviceId: 'remote-device',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/sync/data/missing',
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret',
        },
      },
    );
  });

  it('throws when remote read and write operations fail', async () => {
    const adapter = new RemoteStorageAdapter('https://api.example.com');

    fetchMock
      .mockResolvedValueOnce(mockResponse({}, { ok: false, status: 500 }))
      .mockResolvedValueOnce(mockResponse({}, { ok: false, status: 503 }))
      .mockResolvedValueOnce(mockResponse({}, { ok: false, status: 502 }))
      .mockResolvedValueOnce(mockResponse({}, { ok: false, status: 501 }))
      .mockResolvedValueOnce(mockResponse({}, { ok: false, status: 504 }));

    await expect(adapter.get('broken')).rejects.toThrow('Remote get failed: 500');
    await expect(adapter.set('chapter', { text: 'x' }, 'dev-1')).rejects.toThrow(
      'Remote set failed: 503',
    );
    await expect(adapter.list('prefix')).rejects.toThrow('Remote list failed: 502');
    await expect(adapter.getMeta()).rejects.toThrow('Remote getMeta failed: 501');
    await expect(adapter.setMeta({ lastSyncAt: 1 })).rejects.toThrow(
      'Remote setMeta failed: 504',
    );
  });

  it('performs remote write, delete, list, and meta updates', async () => {
    const adapter = new RemoteStorageAdapter('https://api.example.com', 'token');

    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          key: 'chapter-1',
          data: { text: 'saved' },
          version: 1,
          updatedAt: 1,
          deviceId: 'dev-1',
        }),
      )
      .mockResolvedValueOnce(mockResponse({}, { ok: true, status: 204 }))
      .mockResolvedValueOnce(
        mockResponse([
          {
            key: 'chapter-1',
            data: { text: 'saved' },
            version: 1,
            updatedAt: 1,
            deviceId: 'dev-1',
          },
        ]),
      )
      .mockResolvedValueOnce(
        mockResponse({
          lastSyncAt: 77,
          deviceId: 'remote-device',
          snapshotVersions: { chapter: 1 },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          lastSyncAt: 88,
          deviceId: 'remote-device',
          snapshotVersions: { chapter: 2 },
        }),
      );

    const saved = await adapter.set('chapter-1', { text: 'saved' }, 'dev-1');
    const deleted = await adapter.delete('chapter-1');
    const listed = await adapter.list('chapter');
    const meta = await adapter.getMeta();
    const updatedMeta = await adapter.setMeta({ lastSyncAt: 88 });

    expect(saved).toMatchObject({ key: 'chapter-1', deviceId: 'dev-1' });
    expect(deleted).toBe(true);
    expect(listed).toHaveLength(1);
    expect(meta.snapshotVersions).toEqual({ chapter: 1 });
    expect(updatedMeta.lastSyncAt).toBe(88);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/sync/data/chapter-1',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify({ data: { text: 'saved' }, deviceId: 'dev-1' }),
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.example.com/sync/data?prefix=chapter',
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
      },
    );
  });

  it('lists remote data without appending a prefix query when no prefix is provided', async () => {
    const adapter = new RemoteStorageAdapter('https://api.example.com', 'token');
    fetchMock.mockResolvedValueOnce(mockResponse([]));

    await expect(adapter.list()).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/sync/data',
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
      },
    );
  });
});
