import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InMemoryWorkflowStateStore } from '../../workflow/inmemory-workflow-state-store.js';
import { MemoryManager } from '../../memory/memory-manager.js';
import type { IMemoryStore } from '../../memory/imemory-store.js';
import { MemoryEntry } from '../../memory/memory-manager.js';

// Simple synchronous IMemoryStore for testing dual-write
class TestMemoryStore implements IMemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private nextId = 1;

  async add(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    const id = `test-${this.nextId++}`;
    this.entries.set(id, new MemoryEntry({ ...entry, id } as any));
    return id;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async getBatch(ids: string[]): Promise<MemoryEntry[]> {
    return ids.map((id) => this.entries.get(id)).filter((e): e is MemoryEntry => e !== null);
  }

  async search(query: any): Promise<{ memories: MemoryEntry[]; total: number }> {
    const q = query as { query?: string; topics?: string[]; entityId?: string; limit?: number };
    let results = Array.from(this.entries.values());
    if (q.query) {
      const lower = q.query.toLowerCase();
      results = results.filter((e) => e.content.toLowerCase().includes(lower));
    }
    if (q.entityId) {
      results = results.filter((e) => e.entityId === q.entityId);
    }
    if (q.topics?.length) {
      results = results.filter((e) => e.topics.some((t) => q.topics!.includes(t)));
    }
    if (q.limit) {
      results = results.slice(0, q.limit);
    }
    return { memories: results, total: results.length };
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const entry = this.entries.get(id);
    if (entry) {
      Object.assign(entry, updates);
    }
  }

  async delete(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async rebuildIndex(): Promise<void> {}
  async count(): Promise<number> { return this.entries.size; }
  async close(): Promise<void> { this.entries.clear(); }
}

describe('Integration: IMemoryStore → MemoryManager dual-write', () => {
  let tmpDir: string;
  let store: TestMemoryStore;
  let manager: MemoryManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'int-mem-'));
    const memDir = path.join(tmpDir, 'memories');
    fs.mkdirSync(memDir, { recursive: true });
    store = new TestMemoryStore();
    manager = new MemoryManager(memDir, store);
  });

  afterEach(async () => {
    await store.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Windows EPERM */ }
  });

  it('add() syncs content to IMemoryStore', async () => {
    manager.add('dual-write test', ['test']);
    await new Promise((r) => setTimeout(r, 100));

    // Verify store received the content (note: store generates its own ID)
    const results = await store.search({ query: 'dual-write' });
    expect(results.memories.length).toBeGreaterThanOrEqual(1);
    expect(results.memories[0].content).toContain('dual-write');
  });

  it('add() creates entry in both file system and store', async () => {
    const entry = manager.add('file system entry', ['fs']);
    await new Promise((r) => setTimeout(r, 100));

    // File system verification
    expect(manager.get(entry.id)).not.toBeNull();

    // Store verification
    const results = await store.search({ query: 'file system' });
    expect(results.memories.length).toBeGreaterThanOrEqual(1);
  });

  it('initStore() creates a store instance', async () => {
    const memDir2 = path.join(tmpDir, 'mem2');
    fs.mkdirSync(memDir2, { recursive: true });
    const mgr = new MemoryManager(memDir2);
    await mgr.initStore();
    expect(mgr.getStore()).not.toBeNull();
  });
});

describe('Integration: IWorkflowStateStore hydration cycle', () => {
  let store: InMemoryWorkflowStateStore;

  beforeEach(() => {
    store = new InMemoryWorkflowStateStore();
  });

  afterEach(async () => {
    await store.close();
  });

  it('save→load→save cycle preserves plan data', async () => {
    const plan = { id: 'p1', name: 'Test Plan', steps: [], status: 'planned' };
    await store.savePlan(plan as any);

    const loaded = await store.loadPlan('p1');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('p1');
    expect(loaded!.name).toBe('Test Plan');

    // Update and reload
    await store.savePlan({ ...plan, name: 'Updated Plan' } as any);
    const updated = await store.loadPlan('p1');
    expect(updated!.name).toBe('Updated Plan');
  });

  it('session + authority + checkpoint round-trip', async () => {
    await store.savePlanSession('p1', 'session-abc');
    await store.savePlanAuthority('p1', { sessionId: 'session-abc', workspaceId: 'ws-1' });
    await store.saveCheckpoint({
      plan_id: 'p1',
      step_id: 'step-1',
      timestamp: new Date().toISOString(),
      data: { progress: 50 },
    } as any);

    expect(await store.loadPlanSession('p1')).toBe('session-abc');
    const auth = await store.loadPlanAuthority('p1');
    expect(auth!.sessionId).toBe('session-abc');

    const cp = await store.loadCheckpoint('p1');
    expect(cp!.step_id).toBe('step-1');
  });

  it('deletePlan cascades to sessions and authorities', async () => {
    await store.savePlan({ id: 'p2', name: 'Cascade', steps: [], status: 'planned' } as any);
    await store.savePlanSession('p2', 'sess-2');
    await store.savePlanAuthority('p2', { role: 'admin' });

    await store.deletePlan('p2');

    expect(await store.loadPlan('p2')).toBeNull();
    expect(await store.loadPlanSession('p2')).toBeNull();
    expect(await store.loadPlanAuthority('p2')).toBeNull();
  });

  it('listPlans returns all persisted plans', async () => {
    await store.savePlan({ id: 'a', name: 'A', steps: [], status: 'planned' } as any);
    await store.savePlan({ id: 'b', name: 'B', steps: [], status: 'planned' } as any);
    await store.savePlan({ id: 'c', name: 'C', steps: [], status: 'planned' } as any);

    const plans = await store.listPlans();
    expect(plans).toHaveLength(3);
  });
});