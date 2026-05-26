/**
 * NowledgeMemAdapter
 *
 * Adapter that communicates with Nowledge Mem via CLI (`nmem`).
 * Gracefully degrades when the Nowledge Mem server is unavailable.
 */

import type {
  INowledgeMemService,
  NowledgeMemConfig,
  NowledgeMemMemory,
  NowledgeMemSearchResult,
  NowledgeMemThread,
  NowledgeMemGraphNeighbor,
  NowledgeMemLibraryArtifact,
  NowledgeMemCommunity,
  NowledgeMemWorkingMemory,
  NowledgeMemStatus,
  NowledgeMemFeedEntry,
} from '../protocols/nowledge-mem.js';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_API_URL = 'http://127.0.0.1:14242';

export class NowledgeMemAdapter implements INowledgeMemService {
  private config: Required<Pick<NowledgeMemConfig, 'cliPath' | 'apiUrl' | 'timeout' | 'mode'>> & NowledgeMemConfig;
  private _initialized = false;
  private _connected = false;

  constructor(config: NowledgeMemConfig = {}) {
    this.config = {
      cliPath: config.cliPath ?? this.detectCliPath(),
      apiUrl: config.apiUrl ?? DEFAULT_API_URL,
      apiKey: config.apiKey,
      space: config.space,
      mode: config.mode ?? 'cli',
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  // ── Status / Lifecycle ──

  async status(): Promise<NowledgeMemStatus> {
    try {
      const raw = await this.cli(['-j', 'status']);
      const parsed = JSON.parse(raw);
      return {
        connected: true,
        version: parsed.version ?? parsed.server_version,
        stats: parsed.stats ?? {
          memoryCount: parsed.memory_count,
          threadCount: parsed.thread_count,
          libraryCount: parsed.library_count,
        },
      };
    } catch {
      return { connected: false };
    }
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    const s = await this.status();
    this._connected = s.connected;
    this._initialized = true;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const s = await this.status();
      this._connected = s.connected;
      return s.connected;
    } catch {
      this._connected = false;
      return false;
    }
  }

  async shutdown(): Promise<void> {
    this._initialized = false;
    this._connected = false;
  }

  // ── Memory ──

  async addMemory(content: string, options?: {
    labels?: string[];
    importance?: number;
    id?: string;
  }): Promise<NowledgeMemMemory> {
    const args = ['-j', 'memories', 'add', content];
    if (options?.id) args.push('--id', options.id);
    if (options?.importance !== undefined) args.push('--importance', String(options.importance));
    if (options?.labels?.length) args.push('--labels', options.labels.join(','));
    return this.parseJson(args);
  }

  async searchMemories(query: string, options?: {
    labels?: string[];
    timeRange?: 'today' | 'week' | 'month' | 'year';
    importance?: number;
    mode?: 'normal' | 'deep';
    limit?: number;
  }): Promise<NowledgeMemSearchResult> {
    const args = ['-j', 'memories', 'search', query];
    if (options?.labels?.length) args.push('--labels', options.labels.join(','));
    if (options?.timeRange) args.push('--time-range', options.timeRange);
    if (options?.importance !== undefined) args.push('--importance', String(options.importance));
    if (options?.mode) args.push('--mode', options.mode);
    if (options?.limit) args.push('--limit', String(options.limit));
    return this.parseJson(args);
  }

  async getMemory(id: string): Promise<NowledgeMemMemory | null> {
    try {
      return await this.parseJson(['-j', 'memories', 'get', id]);
    } catch {
      return null;
    }
  }

  async updateMemory(id: string, updates: {
    content?: string;
    labels?: string[];
    importance?: number;
  }): Promise<NowledgeMemMemory> {
    const args = ['-j', 'memories', 'update', id];
    if (updates.content) args.push('--content', updates.content);
    if (updates.labels?.length) args.push('--labels', updates.labels.join(','));
    if (updates.importance !== undefined) args.push('--importance', String(updates.importance));
    return this.parseJson(args);
  }

  async deleteMemory(id: string): Promise<boolean> {
    try {
      await this.cli(['-j', 'memories', 'delete', id]);
      return true;
    } catch {
      return false;
    }
  }

  // ── Graph ──

  async expandGraph(id: string): Promise<NowledgeMemGraphNeighbor> {
    return this.parseJson(['-j', 'graph', 'expand', id]);
  }

  // ── Library ──

  async addToLibrary(paths: string[]): Promise<NowledgeMemLibraryArtifact[]> {
    const args = ['-j', 'library', 'add', ...paths];
    return this.parseJson(args);
  }

  async searchLibrary(query: string, options?: { limit?: number }): Promise<NowledgeMemLibraryArtifact[]> {
    const args = ['-j', 'library', 'search', query];
    if (options?.limit) args.push('--limit', String(options.limit));
    return this.parseJson(args);
  }

  async readArtifact(id: string): Promise<string> {
    return this.cli(['library', 'read', id]);
  }

  // ── Working Memory ──

  async getWorkingMemory(date?: string): Promise<NowledgeMemWorkingMemory> {
    const args = ['-j', 'working-memory', 'get'];
    if (date) args.push('--date', date);
    return this.parseJson(args);
  }

  async setWorkingMemory(content: string): Promise<void> {
    await this.cli(['working-memory', 'set', '--content', content]);
  }

  // ── Communities ──

  async listCommunities(limit?: number): Promise<NowledgeMemCommunity[]> {
    const args = ['-j', 'communities', 'list'];
    if (limit) args.push('--limit', String(limit));
    return this.parseJson(args);
  }

  // ── Feed ──

  async getFeed(days?: number): Promise<NowledgeMemFeedEntry[]> {
    const args = ['-j', 'feed'];
    if (days) args.push('--days', String(days));
    return this.parseJson(args);
  }

  // ── Private helpers ──

  private detectCliPath(): string {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return `${localAppData}\\Nowledge Mem\\cli\\nmem.cmd`;
    }
    return 'nmem';
  }

  private async cli(args: string[]): Promise<string> {
    const { cliPath, timeout } = this.config;
    try {
      const { stdout } = await execFileAsync(cliPath, args, {
        timeout,
        windowsVerbatimArguments: false,
        shell: cliPath.endsWith('.cmd'),
      });
      return stdout.trim();
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      if (error.code === 'ENOENT') {
        throw new Error(`Nowledge Mem CLI not found at: ${cliPath}`);
      }
      throw new Error(`Nowledge Mem CLI error: ${error.message}`);
    }
  }

  private async parseJson<T>(args: string[]): Promise<T> {
    const raw = await this.cli(args);
    if (!raw) {
      throw new Error('Nowledge Mem returned empty response');
    }
    return JSON.parse(raw) as T;
  }
}