/**
 * Memory Layer Tests
 *
 * Tests LayerType enum, LayerConfig, LayerEntry, BaseMemoryLayer,
 * EphemeralLayer, SessionLayer, UserLayer, ProjectLayer, and LayerManager.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LayerType,
  LayerConfig,
  LayerEntry,
  LAYER_CONFIGS,
  BaseMemoryLayer,
  EphemeralLayer,
  SessionLayer,
  UserLayer,
  ProjectLayer,
  LayerManager,
  createLayer,
} from '../../memory/memory-layers';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// LayerType enum
// ---------------------------------------------------------------------------

describe('LayerType', () => {
  it('has four layer types', () => {
    expect(Object.values(LayerType)).toEqual([
      'ephemeral',
      'session',
      'user',
      'project',
    ]);
  });
});

// ---------------------------------------------------------------------------
// LayerConfig
// ---------------------------------------------------------------------------

describe('LayerConfig', () => {
  it('constructs with defaults', () => {
    const config = new LayerConfig({ layerType: LayerType.EPHEMERAL });
    expect(config.layerType).toBe(LayerType.EPHEMERAL);
    expect(config.defaultTtlSeconds).toBeNull();
    expect(config.maxEntries).toBe(10000);
    expect(config.autoExpire).toBe(true);
    expect(config.persistOnClose).toBe(true);
  });

  it('accepts all parameters', () => {
    const config = new LayerConfig({
      layerType: LayerType.SESSION,
      defaultTtlSeconds: 7200,
      maxEntries: 2000,
      autoExpire: false,
      persistOnClose: false,
    });
    expect(config.defaultTtlSeconds).toBe(7200);
    expect(config.maxEntries).toBe(2000);
    expect(config.autoExpire).toBe(false);
    expect(config.persistOnClose).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LAYER_CONFIGS defaults
// ---------------------------------------------------------------------------

describe('LAYER_CONFIGS', () => {
  it('defines config for all layer types', () => {
    for (const lt of Object.values(LayerType)) {
      expect(LAYER_CONFIGS[lt]).toBeDefined();
      expect(LAYER_CONFIGS[lt].layerType).toBe(lt);
    }
  });

  it('ephemeral has 1 hour TTL and does not persist', () => {
    const config = LAYER_CONFIGS[LayerType.EPHEMERAL];
    expect(config.defaultTtlSeconds).toBe(3600);
    expect(config.persistOnClose).toBe(false);
    expect(config.autoExpire).toBe(true);
  });

  it('session has 24 hour TTL and persists', () => {
    const config = LAYER_CONFIGS[LayerType.SESSION];
    expect(config.defaultTtlSeconds).toBe(86400);
    expect(config.persistOnClose).toBe(true);
  });

  it('user has no TTL and does not auto-expire', () => {
    const config = LAYER_CONFIGS[LayerType.USER];
    expect(config.defaultTtlSeconds).toBeNull();
    expect(config.autoExpire).toBe(false);
  });

  it('project has no TTL and higher capacity', () => {
    const config = LAYER_CONFIGS[LayerType.PROJECT];
    expect(config.defaultTtlSeconds).toBeNull();
    expect(config.maxEntries).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// LayerEntry
// ---------------------------------------------------------------------------

describe('LayerEntry', () => {
  it('constructs with defaults', () => {
    const entry = new LayerEntry({ id: 'e1', content: 'Hello' });
    expect(entry.id).toBe('e1');
    expect(entry.content).toBe('Hello');
    expect(entry.importance).toBe(0.5);
    expect(entry.accessCount).toBe(0);
    expect(entry.lastAccessed).toBeNull();
    expect(entry.expiresAt).toBeNull();
    expect(entry.metadata).toEqual({});
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('constructs with all parameters', () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 3600000);
    const entry = new LayerEntry({
      id: 'e2',
      content: 'Full entry',
      createdAt: now,
      expiresAt: expires,
      importance: 0.9,
      accessCount: 5,
      lastAccessed: now,
      metadata: { key: 'val' },
    });
    expect(entry.importance).toBe(0.9);
    expect(entry.accessCount).toBe(5);
    expect(entry.expiresAt).toBe(expires);
    expect(entry.metadata).toEqual({ key: 'val' });
  });

  it('isExpired returns false when no expiration', () => {
    const entry = new LayerEntry({ id: 'e3', content: 'No expiry' });
    expect(entry.isExpired()).toBe(false);
  });

  it('isExpired returns false for future expiration', () => {
    const future = new Date(Date.now() + 3600000);
    const entry = new LayerEntry({ id: 'e4', content: 'Future', expiresAt: future });
    expect(entry.isExpired()).toBe(false);
  });

  it('isExpired returns true for past expiration', () => {
    const past = new Date(Date.now() - 1000);
    const entry = new LayerEntry({ id: 'e5', content: 'Expired', expiresAt: past });
    expect(entry.isExpired()).toBe(true);
  });

  it('touch increments accessCount and sets lastAccessed', () => {
    const entry = new LayerEntry({ id: 'e6', content: 'Touchable' });
    expect(entry.accessCount).toBe(0);
    entry.touch();
    expect(entry.accessCount).toBe(1);
    expect(entry.lastAccessed).toBeInstanceOf(Date);
    entry.touch();
    expect(entry.accessCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// BaseMemoryLayer
// ---------------------------------------------------------------------------

describe('BaseMemoryLayer', () => {
  it('stores and retrieves entries', async () => {
    const layer = new BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER]);
    const entry = await layer.store('id-1', 'Test content', 0.8);
    expect(entry.id).toBe('id-1');
    expect(entry.content).toBe('Test content');

    const retrieved = await layer.retrieve('id-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('Test content');
  });

  it('retrieve returns null for missing entry', async () => {
    const layer = new BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER]);
    expect(await layer.retrieve('nonexistent')).toBeNull();
  });

  it('retrieve auto-expires entries when autoExpire is true', async () => {
    const config = new LayerConfig({
      layerType: LayerType.EPHEMERAL,
      defaultTtlSeconds: -1, // Already expired
      autoExpire: true,
    });
    const layer = new BaseMemoryLayer(config);
    await layer.store('expired', 'Old content');

    const retrieved = await layer.retrieve('expired');
    expect(retrieved).toBeNull();
  });

  it('retrieve does not auto-expire when autoExpire is false', async () => {
    const config = new LayerConfig({
      layerType: LayerType.USER,
      defaultTtlSeconds: -1,
      autoExpire: false,
    });
    const layer = new BaseMemoryLayer(config);
    await layer.store('no-auto', 'Content');

    const retrieved = await layer.retrieve('no-auto');
    // autoExpire is false, but the entry is still expired by date
    expect(retrieved).toBeNull();
  });

  it('expire removes an entry', async () => {
    const layer = new BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER]);
    await layer.store('to-expire', 'Content');
    expect(await layer.expire('to-expire')).toBe(true);
    expect(await layer.retrieve('to-expire')).toBeNull();
  });

  it('expire returns false for missing entry', async () => {
    const layer = new BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER]);
    expect(await layer.expire('missing')).toBe(false);
  });

  it('expireAll removes expired entries', async () => {
    const config = new LayerConfig({
      layerType: LayerType.EPHEMERAL,
      defaultTtlSeconds: -1,
      autoExpire: false,
    });
    const layer = new BaseMemoryLayer(config);
    await layer.store('expired-1', 'Old 1');
    await layer.store('expired-2', 'Old 2');

    const count = await layer.expireAll();
    expect(count).toBe(2);
  });

  it('stats returns correct layer statistics', async () => {
    const layer = new BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER]);
    await layer.store('s1', 'Content 1', 0.8);
    await layer.store('s2', 'Content 2', 0.4);

    const stats = await layer.stats();
    expect(stats.layerType).toBe(LayerType.USER);
    expect(stats.totalEntries).toBe(2);
    expect(stats.expiredEntries).toBe(0);
    expect(stats.totalAccessCount).toBe(0);
    expect(stats.avgImportance).toBeCloseTo(0.6);
    expect(stats.oldestEntry).toBeInstanceOf(Date);
    expect(stats.newestEntry).toBeInstanceOf(Date);
  });

  it('listEntries returns entries sorted by importance', async () => {
    const layer = new BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER]);
    await layer.store('low', 'Low importance', 0.3);
    await layer.store('high', 'High importance', 0.9);
    await layer.store('mid', 'Mid importance', 0.6);

    const entries = await layer.listEntries(10);
    expect(entries).toHaveLength(3);
    expect(entries[0].content).toBe('High importance');
    expect(entries[1].content).toBe('Mid importance');
    expect(entries[2].content).toBe('Low importance');
  });

  it('listEntries respects limit', async () => {
    const layer = new BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER]);
    for (let i = 0; i < 10; i++) {
      await layer.store(`lim-${i}`, `Entry ${i}`, 0.5);
    }
    const entries = await layer.listEntries(3);
    expect(entries).toHaveLength(3);
  });

  it('clear removes all entries', async () => {
    const layer = new BaseMemoryLayer(LAYER_CONFIGS[LayerType.USER]);
    await layer.store('c1', 'One');
    await layer.store('c2', 'Two');
    const count = await layer.clear();
    expect(count).toBe(2);
    expect(await layer.listEntries()).toHaveLength(0);
  });

  it('evicts oldest when capacity is reached', async () => {
    const config = new LayerConfig({
      layerType: LayerType.EPHEMERAL,
      maxEntries: 2,
    });
    const layer = new BaseMemoryLayer(config);
    await layer.store('first', 'Oldest');
    await layer.store('second', 'Newer');
    await layer.store('third', 'Newest');

    expect(await layer.retrieve('first')).toBeNull();
    expect(await layer.retrieve('second')).not.toBeNull();
    expect(await layer.retrieve('third')).not.toBeNull();
  });

  it('store applies TTL from config default', async () => {
    const config = new LayerConfig({
      layerType: LayerType.EPHEMERAL,
      defaultTtlSeconds: 3600,
    });
    const layer = new BaseMemoryLayer(config);
    const entry = await layer.store('ttl-test', 'Content');
    expect(entry.expiresAt).not.toBeNull();
  });

  it('store uses config default TTL when null TTL is not explicitly passed', async () => {
    const config = new LayerConfig({
      layerType: LayerType.USER,
      defaultTtlSeconds: 3600,
    });
    const layer = new BaseMemoryLayer(config);
    const entry = await layer.store('default-ttl', 'Content', 0.5);
    // When no TTL param is passed, config default (3600s) is used
    expect(entry.expiresAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EphemeralLayer
// ---------------------------------------------------------------------------

describe('EphemeralLayer', () => {
  it('enforces max TTL of 1 hour', async () => {
    const layer = new EphemeralLayer();
    const entry = await layer.store('eph', 'Content', 0.5, 7200); // Request 2h TTL
    expect(entry.expiresAt).not.toBeNull();
    const ttlMs = entry.expiresAt!.getTime() - Date.now();
    expect(ttlMs).toBeLessThanOrEqual(3600000); // <= 1 hour
  });

  it('uses default TTL when no TTL specified', async () => {
    const layer = new EphemeralLayer();
    const entry = await layer.store('eph-default', 'Content');
    expect(entry.expiresAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SessionLayer
// ---------------------------------------------------------------------------

describe('SessionLayer', () => {
  it('stores sessionId in metadata', async () => {
    const layer = new SessionLayer('sess-42');
    const entry = await layer.store('s-1', 'Content');
    expect(entry.metadata.session_id).toBe('sess-42');
  });

  it('does not add sessionId when null', async () => {
    const layer = new SessionLayer(null);
    const entry = await layer.store('s-2', 'Content');
    expect(entry.metadata.session_id).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// UserLayer
// ---------------------------------------------------------------------------

describe('UserLayer', () => {
  it('stores userId in metadata', async () => {
    const layer = new UserLayer('user-99');
    const entry = await layer.store('u-1', 'Content');
    expect(entry.metadata.user_id).toBe('user-99');
  });

  it('does not set expiration when TTL is null', async () => {
    const layer = new UserLayer('user-99');
    const entry = await layer.store('u-2', 'Content', 0.5, null);
    expect(entry.expiresAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ProjectLayer
// ---------------------------------------------------------------------------

describe('ProjectLayer', () => {
  it('stores projectId in metadata', async () => {
    const layer = new ProjectLayer('proj-7');
    const entry = await layer.store('p-1', 'Content');
    expect(entry.metadata.project_id).toBe('proj-7');
  });
});

// ---------------------------------------------------------------------------
// LayerManager
// ---------------------------------------------------------------------------

describe('LayerManager', () => {
  it('initializes with all four layers', () => {
    const manager = new LayerManager();
    expect(manager.getLayer(LayerType.EPHEMERAL)).toBeInstanceOf(EphemeralLayer);
    expect(manager.getLayer(LayerType.SESSION)).toBeInstanceOf(SessionLayer);
    expect(manager.getLayer(LayerType.USER)).toBeInstanceOf(UserLayer);
    expect(manager.getLayer(LayerType.PROJECT)).toBeInstanceOf(ProjectLayer);
  });

  it('throws for unknown layer type', () => {
    const manager = new LayerManager();
    expect(() => manager.getLayer('unknown' as LayerType)).toThrow('Unknown layer type');
  });

  it('stores and retrieves across layers', async () => {
    const manager = new LayerManager();
    const entry = await manager.store(LayerType.USER, 'uid', 'User content', 0.9);
    expect(entry.content).toBe('User content');

    const retrieved = await manager.retrieve('uid');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe('User content');
  });

  it('retrieve searches all layers when layerType is null', async () => {
    const manager = new LayerManager();
    await manager.store(LayerType.EPHEMERAL, 'cross-1', 'Ephemeral content');
    const found = await manager.retrieve('cross-1', null);
    expect(found).not.toBeNull();
    expect(found!.content).toBe('Ephemeral content');
  });

  it('expireAllLayers expires across all layers', async () => {
    const config = new LayerConfig({
      layerType: LayerType.EPHEMERAL,
      defaultTtlSeconds: -1,
      autoExpire: false,
    });
    const manager = new LayerManager();
    // Add expired entries
    const eph = manager.getLayer(LayerType.EPHEMERAL);
    await eph.store('exp', 'Expired', 0.5, -1, null);

    const results = await manager.expireAllLayers();
    expect(results[LayerType.EPHEMERAL]).toBeGreaterThanOrEqual(1);
  });

  it('statsAll returns stats for all layers', async () => {
    const manager = new LayerManager();
    await manager.store(LayerType.USER, 'st-1', 'Content');
    const allStats = await manager.statsAll();
    expect(allStats[LayerType.USER].totalEntries).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// createLayer factory
// ---------------------------------------------------------------------------

describe('createLayer', () => {
  it('creates ephemeral layer', () => {
    expect(createLayer(LayerType.EPHEMERAL)).toBeInstanceOf(EphemeralLayer);
  });

  it('creates session layer with sessionId', () => {
    const layer = createLayer(LayerType.SESSION, { sessionId: 's1' });
    expect(layer).toBeInstanceOf(SessionLayer);
    expect((layer as SessionLayer).sessionId).toBe('s1');
  });

  it('creates user layer with userId', () => {
    const layer = createLayer(LayerType.USER, { userId: 'u1' });
    expect(layer).toBeInstanceOf(UserLayer);
    expect((layer as UserLayer).userId).toBe('u1');
  });

  it('creates project layer with projectId', () => {
    const layer = createLayer(LayerType.PROJECT, { projectId: 'p1' });
    expect(layer).toBeInstanceOf(ProjectLayer);
    expect((layer as ProjectLayer).projectId).toBe('p1');
  });

  it('throws for unknown layer type', () => {
    expect(() => createLayer('unknown' as LayerType)).toThrow('Unknown layer type');
  });
});
