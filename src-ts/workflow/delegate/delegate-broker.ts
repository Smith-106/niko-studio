/**
 * Delegate Broker — 任务代理调度器
 *
 * 参考 maestro-flow 的 delegate-broker 模式。
 * 管理任务代理的生命周期：提交 → 排队 → 运行 → 完成/失败/取消。
 * 支持消息注入（运行中通信）和超时检测。
 */

import { createLogger } from '../../logger/index.js';
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { IWebSocketRelayService } from '../../container/types';

/**
 * IPersistentStorage — minimal persistence interface for DelegateBroker.
 * Abstracts file/SQLite storage so job state survives process restarts.
 */
export interface IPersistentStorage {
  save(key: string, value: string): Promise<void>;
  load(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
  listKeys(): Promise<string[]>;
}

/**
 * Default file-based persistence adapter.
 * Uses the same `.writing/delegate-jobs/` directory structure
 * as the original raw-fs implementation — backward compatible.
 */
export class FileJobPersistence implements IPersistentStorage {
  private readonly dir: string;

  constructor(dir: string = '.writing/delegate-jobs') {
    this.dir = dir;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  async save(key: string, value: string): Promise<void> {
    writeFileSync(join(this.dir, `${key}.json`), value, 'utf-8');
  }

  async load(key: string): Promise<string | null> {
    const filePath = join(this.dir, `${key}.json`);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf-8');
  }

  async remove(key: string): Promise<void> {
    const filePath = join(this.dir, `${key}.json`);
    try { unlinkSync(filePath); } catch { /* already gone */ }
  }

  async listKeys(): Promise<string[]> {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''));
  }
}

const _log = createLogger('delegate-broker');

// ─── Types ──────────────────────────────────────────────────────────────────

export type DelegateStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type DelegatePriority = 'low' | 'normal' | 'high';

export interface DelegateSpec {
  task: string;
  priority?: DelegatePriority;
  timeout?: number; // ms, default 5 min
  metadata?: Record<string, unknown>;
}

export interface DelegateRecord {
  id: string;
  task: string;
  status: DelegateStatus;
  priority: DelegatePriority;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  timeout: number;
  result: unknown;
  error: string | null;
  metadata: Record<string, unknown>;
  messages: DelegateMessage[];
}

export interface DelegateMessage {
  from: 'broker' | 'user' | 'system';
  content: string;
  timestamp: string;
}

export interface DelegateCompletion {
  id: string;
  status: 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

export type DelegateExecutor = (task: string, delegate: DelegateHandle) => Promise<unknown>;

// ─── DelegateHandle — 运行时句柄 ──────────────────────────────────────────

export class DelegateHandle {
  private _cancelled = false;
  private readonly _messages: DelegateMessage[] = [];

  get cancelled(): boolean {
    return this._cancelled;
  }

  cancel(): void {
    this._cancelled = true;
  }

  injectMessage(from: DelegateMessage['from'], content: string): void {
    this._messages.push({ from, content, timestamp: new Date().toISOString() });
  }

  drainMessages(): DelegateMessage[] {
    const msgs = [...this._messages];
    this._messages.length = 0;
    return msgs;
  }
}

// ─── DelegateBroker ────────────────────────────────────────────────────────

export class DelegateBroker {
  private readonly delegates: Map<string, DelegateRecord> = new Map();
  private readonly handles: Map<string, DelegateHandle> = new Map();
  private readonly executor: DelegateExecutor;
  private readonly defaultTimeout: number;
  private readonly storage: IPersistentStorage;
  private readonly relay: IWebSocketRelayService | null;
  private nextId = 1;

  constructor(executor: DelegateExecutor, options?: { defaultTimeout?: number; persistDir?: string; relay?: IWebSocketRelayService; storage?: IPersistentStorage }) {
    this.executor = executor;
    this.defaultTimeout = options?.defaultTimeout ?? 300_000; // 5 min
    this.relay = options?.relay ?? null;
    this.storage = options?.storage ?? new FileJobPersistence(options?.persistDir);

    this._hydrateFromStore();
  }

  /**
   * 提交一个任务
   */
  async submit(spec: DelegateSpec): Promise<string> {
    const id = `del-${this.nextId++}`;
    const record: DelegateRecord = {
      id,
      task: spec.task,
      status: 'queued',
      priority: spec.priority ?? 'normal',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      timeout: spec.timeout ?? this.defaultTimeout,
      result: null,
      error: null,
      metadata: spec.metadata ?? {},
      messages: [],
    };

    this.delegates.set(id, record);
    _log.info('Delegate queued', { id, task: spec.task });
    this._broadcast('status', { id, status: 'queued', task: spec.task });
    this._saveJobState(id);

    // Auto-start
    setImmediate(() => this._start(id));
    return id;
  }

  /**
   * 获取任务状态
   */
  get(id: string): DelegateRecord | null {
    return this.delegates.get(id) ?? null;
  }

  /**
   * 列出所有任务
   */
  list(filter?: { status?: DelegateStatus }): DelegateRecord[] {
    const records = Array.from(this.delegates.values());
    if (filter?.status) {
      return records.filter(r => r.status === filter.status);
    }
    return records;
  }

  /**
   * 向运行中的任务注入消息
   */
  inject(id: string, content: string, from: DelegateMessage['from'] = 'user'): boolean {
    const handle = this.handles.get(id);
    if (!handle) return false;

    handle.injectMessage(from, content);

    const record = this.delegates.get(id);
    if (record) {
      record.messages.push({ from, content, timestamp: new Date().toISOString() });
    }

    _log.info('Message injected', { id, from });
    return true;
  }

  /**
   * 取消任务
   */
  cancel(id: string): boolean {
    const handle = this.handles.get(id);
    const record = this.delegates.get(id);
    if (!handle || !record) return false;

    if (record.status !== 'running' && record.status !== 'queued') return false;

    handle.cancel();
    record.status = 'cancelled';
    record.completedAt = new Date().toISOString();
    this.handles.delete(id);

    _log.info('Delegate cancelled', { id });
    this._broadcast('status', { id, status: 'cancelled' });
    return true;
  }

  /**
   * 等待任务完成
   */
  async wait(id: string, timeout?: number): Promise<DelegateCompletion> {
    const deadline = Date.now() + (timeout ?? 60_000);

    while (Date.now() < deadline) {
      const record = this.delegates.get(id);
      if (!record) throw new Error(`Delegate ${id} not found`);

      if (record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') {
        return {
          id,
          status: record.status as 'completed' | 'failed',
          result: record.result,
          error: record.error ?? undefined,
        };
      }

      await new Promise(r => setTimeout(r, 200));
    }

    throw new Error(`Timeout waiting for delegate ${id}`);
  }

  /**
   * 关闭 broker，取消所有运行中的任务
   */
  async shutdown(): Promise<void> {
    for (const [id, handle] of this.handles) {
      handle.cancel();
      const record = this.delegates.get(id);
      if (record && (record.status === 'running' || record.status === 'queued')) {
        record.status = 'cancelled';
        record.completedAt = new Date().toISOString();
      }
    }
    this.handles.clear();
    _log.info('Broker shutdown', { cancelled: this.handles.size });
  }

  // ─── Internal ────────────────────────────────────────────────────────

  private _broadcast(event: string, payload: Record<string, unknown>): void {
    if (this.relay) {
      this.relay.broadcast(`delegate:${event}`, payload);
    }
  }

  private async _start(id: string): Promise<void> {
    const record = this.delegates.get(id);
    if (!record || record.status !== 'queued') return;

    const handle = new DelegateHandle();
    this.handles.set(id, handle);

    record.status = 'running';
    record.startedAt = new Date().toISOString();
    _log.info('Delegate started', { id });
    this._broadcast('status', { id, status: 'running' });
    this._saveJobState(id);

    // Timeout guard
    const timeoutId = setTimeout(() => {
      if (record.status === 'running') {
        handle.cancel();
        record.status = 'failed';
        record.error = `Timeout after ${record.timeout}ms`;
        record.completedAt = new Date().toISOString();
        _log.warn('Delegate timed out', { id });
        this._broadcast('status', { id, status: 'failed', error: `Timeout after ${record.timeout}ms` });
        this._saveJobState(id);
      }
    }, record.timeout);

    try {
      const result = await this.executor(record.task, handle);

      clearTimeout(timeoutId);

      if (record.status === 'running') {
        record.status = 'completed';
        record.result = result;
        record.completedAt = new Date().toISOString();
        _log.info('Delegate completed', { id });
        this._broadcast('status', { id, status: 'completed' });
        this._saveJobState(id);
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (record.status === 'running') {
        record.status = 'failed';
        record.error = String(err);
        record.completedAt = new Date().toISOString();
        _log.error('Delegate failed', { id, error: String(err) });
        this._broadcast('status', { id, status: 'failed', error: String(err) });
      }
    } finally {
      this.handles.delete(id);
    }
  }

  // ─── Persistence ────────────────────────────────────────────────────

  private _saveJobState(id: string): void {
    const record = this.delegates.get(id);
    if (!record) return;

    // Fire-and-forget save — persistence failure is non-critical
    void this.storage.save(id, JSON.stringify(record)).catch((err) => {
      _log.warn('Failed to persist job state', { id, error: String(err) });
    });
  }

  private _hydrateFromStore(): void {
    // Fire-and-forget hydrate — load persisted jobs on startup
    void this.storage.listKeys().then(async (keys) => {
      for (const key of keys) {
        try {
          const raw = await this.storage.load(key);
          if (!raw) continue;

          const record: DelegateRecord = JSON.parse(raw);

          // Only recover terminal state jobs (completed/failed/cancelled)
          if (record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') {
            this.delegates.set(record.id, record);
            // Parse nextId from delegate IDs: "del-{N}"
            const num = parseInt(record.id.replace('del-', ''), 10);
            if (num >= this.nextId) this.nextId = num + 1;

            // Clean up completed job files after hydration
            void this.storage.remove(key).catch(() => {});
          } else {
            // Non-terminal jobs were interrupted — mark as failed
            record.status = 'failed';
            record.error = 'Process interrupted (recovered from persistence)';
            record.completedAt = new Date().toISOString();
            this.delegates.set(record.id, record);
            const num = parseInt(record.id.replace('del-', ''), 10);
            if (num >= this.nextId) this.nextId = num + 1;
            this._saveJobState(record.id);
          }
        } catch {
          // Skip corrupt entries
          void this.storage.remove(key).catch(() => {});
        }
      }
      _log.info('Hydrated delegates from store', { count: this.delegates.size });
    }).catch(() => {
      // Store read failure — start fresh
    });
  }
}
