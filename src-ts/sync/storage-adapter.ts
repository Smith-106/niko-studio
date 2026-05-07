/**
 * Storage Adapter — abstract interface for local/remote data storage.
 *
 * Provides a uniform API for reading/writing syncable data regardless
 * of backend. Used by SyncEngine to abstract storage operations.
 */

export interface SyncData {
  key: string;
  data: unknown;
  version: number;
  updatedAt: number; // ISO timestamp
  deviceId: string;
}

export interface SyncMeta {
  lastSyncAt: number;
  deviceId: string;
  snapshotVersions: Record<string, number>;
}

export interface StorageAdapter {
  readonly type: 'local' | 'remote';

  get(key: string): Promise<SyncData | null>;
  set(key: string, data: unknown, deviceId: string): Promise<SyncData>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<SyncData[]>;
  getMeta(): Promise<SyncMeta>;
  setMeta(meta: Partial<SyncMeta>): Promise<SyncMeta>;
}

// ============================================================
// Local Storage Adapter (localStorage-based)
// ============================================================

const STORAGE_PREFIX = 'niko-sync:';
const META_KEY = `${STORAGE_PREFIX}__meta__`;

function generateDeviceId(): string {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}__device_id__`);
  if (stored) return stored;
  const id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(`${STORAGE_PREFIX}__device_id__`, id);
  return id;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly type = 'local' as const;
  private deviceId: string;

  constructor() {
    this.deviceId = generateDeviceId();
  }

  async get(key: string): Promise<SyncData | null> {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SyncData;
    } catch {
      return null;
    }
  }

  async set(key: string, data: unknown, deviceId?: string): Promise<SyncData> {
    const existing = await this.get(key);
    const entry: SyncData = {
      key,
      data,
      version: (existing?.version ?? 0) + 1,
      updatedAt: Date.now(),
      deviceId: deviceId ?? this.deviceId,
    };
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
    return entry;
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = `${STORAGE_PREFIX}${key}`;
    if (localStorage.getItem(fullKey) === null) return false;
    localStorage.removeItem(fullKey);
    return true;
  }

  async list(prefix?: string): Promise<SyncData[]> {
    const results: SyncData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(STORAGE_PREFIX) || k === META_KEY || k.endsWith('__device_id__')) continue;
      if (prefix && !k.slice(STORAGE_PREFIX.length).startsWith(prefix)) continue;
      try {
        results.push(JSON.parse(localStorage.getItem(k)!));
      } catch {}
    }
    return results;
  }

  async getMeta(): Promise<SyncMeta> {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    return { lastSyncAt: 0, deviceId: this.deviceId, snapshotVersions: {} };
  }

  async setMeta(partial: Partial<SyncMeta>): Promise<SyncMeta> {
    const current = await this.getMeta();
    const updated = { ...current, ...partial };
    localStorage.setItem(META_KEY, JSON.stringify(updated));
    return updated;
  }
}

// ============================================================
// Remote Storage Adapter (HTTP-based, for cloud sync)
// ============================================================

export class RemoteStorageAdapter implements StorageAdapter {
  readonly type = 'remote' as const;

  constructor(private baseUrl: string, private authToken?: string) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) h['Authorization'] = `Bearer ${this.authToken}`;
    return h;
  }

  async get(key: string): Promise<SyncData | null> {
    const resp = await fetch(`${this.baseUrl}/sync/data/${encodeURIComponent(key)}`, {
      headers: this.headers(),
    });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Remote get failed: ${resp.status}`);
    return resp.json() as Promise<SyncData>;
  }

  async set(key: string, data: unknown, deviceId: string): Promise<SyncData> {
    const resp = await fetch(`${this.baseUrl}/sync/data/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ data, deviceId }),
    });
    if (!resp.ok) throw new Error(`Remote set failed: ${resp.status}`);
    return resp.json() as Promise<SyncData>;
  }

  async delete(key: string): Promise<boolean> {
    const resp = await fetch(`${this.baseUrl}/sync/data/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
    return resp.ok;
  }

  async list(prefix?: string): Promise<SyncData[]> {
    const params = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    const resp = await fetch(`${this.baseUrl}/sync/data${params}`, {
      headers: this.headers(),
    });
    if (!resp.ok) throw new Error(`Remote list failed: ${resp.status}`);
    return resp.json() as Promise<SyncData[]>;
  }

  async getMeta(): Promise<SyncMeta> {
    const resp = await fetch(`${this.baseUrl}/sync/meta`, {
      headers: this.headers(),
    });
    if (!resp.ok) throw new Error(`Remote getMeta failed: ${resp.status}`);
    return resp.json() as Promise<SyncMeta>;
  }

  async setMeta(partial: Partial<SyncMeta>): Promise<SyncMeta> {
    const resp = await fetch(`${this.baseUrl}/sync/meta`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(partial),
    });
    if (!resp.ok) throw new Error(`Remote setMeta failed: ${resp.status}`);
    return resp.json() as Promise<SyncMeta>;
  }
}
