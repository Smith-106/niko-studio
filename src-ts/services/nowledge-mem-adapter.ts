/**
 * NowledgeMemAdapter
 *
 * CLI-based adapter for Nowledge Mem service.
 * Communicates via `nmem` CLI commands.
 * Gracefully degrades when CLI is unavailable.
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
  NowledgeMemSource,
  NowledgeMemRelation,
  NowledgeMemRelationType,
  NowledgeMemSpace,
} from '../protocols/nowledge-mem.js';
import { NowledgeMemEvolvesKind } from '../protocols/nowledge-mem.js';
import { spawn as nodeSpawn } from 'child_process';

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class NowledgeMemAdapter implements INowledgeMemService {
  private config: NowledgeMemConfig;
  private _available = false;
  private cliPath: string;

  constructor(config?: NowledgeMemConfig) {
    this.config = config ?? {};
    this.cliPath = this.config.cliPath ?? 'nmem';
  }

  private async exec(args: string[], stdinContent?: string): Promise<CliResult> {
    const timeout = this.config.timeout ?? 10000;

    return new Promise((resolve) => {
      const env = {
        ...process.env,
        NMEM_API_KEY: this.config.apiKey ?? '',
        NMEM_SPACE: this.config.space ?? '',
      };
      const child = nodeSpawn(this.cliPath, args, { env, timeout });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      if (stdinContent) {
        child.stdin?.write(stdinContent);
        child.stdin?.end();
      }

      const timer = setTimeout(() => {
        child.kill();
        resolve({ stdout, stderr: stderr || 'timeout', exitCode: 1 });
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 1 });
      });

      child.on('error', (err: Error) => {
        clearTimeout(timer);
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          resolve({ stdout: '', stderr: 'nmem CLI not found', exitCode: 127 });
        } else {
          resolve({ stdout, stderr: err.message, exitCode: 1 });
        }
      });
    });
  }

  private parseJson<T>(stdout: string): T | null {
    try {
      return JSON.parse(stdout) as T;
    } catch {
      return null;
    }
  }

  // ── Status ──

  async status(): Promise<NowledgeMemStatus> {
    const result = await this.exec(['status', '--json']);
    if (result.exitCode !== 0) {
      return { connected: false };
    }
    const parsed = this.parseJson<NowledgeMemStatus>(result.stdout);
    return parsed ?? { connected: true, version: 'unknown' };
  }

  // ── Memory CRUD ──

  async addMemory(content: string, options?: {
    labels?: string[];
    importance?: number;
    id?: string;
    title?: string;
    unitType?: string;
    when?: string;
    eventStart?: string;
    eventEnd?: string;
    sourceRefs?: string[];
    spaceId?: string;
  }): Promise<NowledgeMemMemory> {
    const args = ['memories', 'add', content];

    if (options?.id) args.push('--id', options.id);
    if (options?.title) args.push('--title', options.title);
    if (options?.importance !== undefined) args.push('--importance', String(options.importance));
    if (options?.unitType) args.push('--unit-type', options.unitType);
    if (options?.when) args.push('--when', options.when);
    if (options?.eventStart) args.push('--event-start', options.eventStart);
    if (options?.eventEnd) args.push('--event-end', options.eventEnd);
    if (options?.spaceId) args.push('--space', options.spaceId);
    if (options?.labels?.length) args.push('--labels', options.labels.join(','));
    if (options?.sourceRefs?.length) args.push('--source-refs', options.sourceRefs.join(','));

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to add memory: ${result.stderr}`);
    }
    const parsed = this.parseJson<NowledgeMemMemory>(result.stdout);
    if (parsed) return parsed;
    return {
      id: options?.id ?? result.stdout.trim(),
      content,
      labels: options?.labels,
      importance: options?.importance,
    };
  }

  async searchMemories(query: string, options?: {
    labels?: string[];
    timeRange?: string;
    importance?: number;
    mode?: string;
    limit?: number;
    unitType?: string;
    eventFrom?: string;
    eventTo?: string;
    recordedFrom?: string;
    recordedTo?: string;
    spaceId?: string;
  }): Promise<NowledgeMemSearchResult> {
    const args = ['memories', 'search', query, '--json'];

    if (options?.limit) args.push('--limit', String(options.limit));
    if (options?.labels?.length) args.push('--labels', options.labels.join(','));
    if (options?.timeRange) args.push('--time-range', options.timeRange);
    if (options?.importance !== undefined) args.push('--importance', String(options.importance));
    if (options?.mode) args.push('--mode', options.mode);
    if (options?.unitType) args.push('--unit-type', options.unitType);
    if (options?.eventFrom) args.push('--event-from', options.eventFrom);
    if (options?.eventTo) args.push('--event-to', options.eventTo);
    if (options?.recordedFrom) args.push('--recorded-from', options.recordedFrom);
    if (options?.recordedTo) args.push('--recorded-to', options.recordedTo);
    if (options?.spaceId) args.push('--space', options.spaceId);

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      return { memories: [], total: 0, query };
    }
    const parsed = this.parseJson<NowledgeMemSearchResult>(result.stdout);
    return parsed ?? { memories: [], total: 0, query };
  }

  async searchByTimeRange(options: {
    eventFrom?: string;
    eventTo?: string;
    recordedFrom?: string;
    recordedTo?: string;
    labels?: string[];
    unitType?: string;
    spaceId?: string;
    limit?: number;
  }): Promise<NowledgeMemSearchResult> {
    const args = ['memories', 'search', '--json'];

    if (options.eventFrom) args.push('--event-from', options.eventFrom);
    if (options.eventTo) args.push('--event-to', options.eventTo);
    if (options.recordedFrom) args.push('--recorded-from', options.recordedFrom);
    if (options.recordedTo) args.push('--recorded-to', options.recordedTo);
    if (options.labels?.length) args.push('--labels', options.labels.join(','));
    if (options.unitType) args.push('--unit-type', options.unitType);
    if (options.spaceId) args.push('--space', options.spaceId);
    if (options.limit) args.push('--limit', String(options.limit));

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      return { memories: [], total: 0 };
    }
    const parsed = this.parseJson<NowledgeMemSearchResult>(result.stdout);
    return parsed ?? { memories: [], total: 0 };
  }

  async getMemory(id: string): Promise<NowledgeMemMemory | null> {
    const result = await this.exec(['memories', 'get', '--id', id, '--json']);
    if (result.exitCode !== 0) return null;
    return this.parseJson<NowledgeMemMemory>(result.stdout);
  }

  async listMemories(options?: {
    type?: string;
    label?: string;
    since?: string;
    limit?: number;
    spaceId?: string;
  }): Promise<NowledgeMemMemory[]> {
    const args = ['memories', 'list', '--json'];

    if (options?.type) args.push('--type', options.type);
    if (options?.label) args.push('--label', options.label);
    if (options?.since) args.push('--since', options.since);
    if (options?.limit) args.push('--limit', String(options.limit));
    if (options?.spaceId) args.push('--space', options.spaceId);

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    const parsed = this.parseJson<NowledgeMemMemory[]>(result.stdout);
    return parsed ?? [];
  }

  async updateMemory(id: string, updates: {
    content?: string;
    title?: string;
    labels?: string[];
    importance?: number;
    unitType?: string;
  }): Promise<NowledgeMemMemory | null> {
    const args = ['memories', 'update', '--id', id];

    if (updates.content !== undefined) args.push('--content', updates.content);
    if (updates.title !== undefined) args.push('--title', updates.title);
    if (updates.importance !== undefined) args.push('--importance', String(updates.importance));
    if (updates.labels?.length) args.push('--labels', updates.labels.join(','));
    if (updates.unitType !== undefined) args.push('--unit-type', updates.unitType);

    const result = await this.exec(args);
    if (result.exitCode !== 0) return null;
    return this.parseJson<NowledgeMemMemory>(result.stdout);
  }

  async deleteMemory(id: string): Promise<boolean> {
    const result = await this.exec(['memories', 'delete', '--id', id]);
    return result.exitCode === 0;
  }

  async moveMemory(id: string, targetSpaceId: string): Promise<boolean> {
    const result = await this.exec(['memories', 'move', '--id', id, '--space', targetSpaceId]);
    return result.exitCode === 0;
  }

  // ── Graph operations ──

  async expandGraph(id: string): Promise<NowledgeMemGraphNeighbor> {
    const result = await this.exec(['graph', 'expand', '--id', id, '--json']);
    if (result.exitCode !== 0) {
      return { memoryId: id, relations: [] };
    }
    const parsed = this.parseJson<NowledgeMemGraphNeighbor>(result.stdout);
    return parsed ?? { memoryId: id, relations: [] };
  }

  async createRelation(source: string, target: string, options: {
    type: NowledgeMemRelationType;
    evolvesKind?: NowledgeMemEvolvesKind;
    strength?: number;
  }): Promise<void> {
    const args = ['graph', 'add-relation', '--from', source, '--to', target, '--type', options.type];

    if (options.evolvesKind) args.push('--evolves-kind', options.evolvesKind);
    if (options.strength !== undefined) args.push('--strength', String(options.strength));

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to create relation: ${result.stderr}`);
    }
  }

  async getRelatedMemories(id: string, depth?: number): Promise<NowledgeMemMemory[]> {
    const args = ['graph', 'expand', '--id', id, '--json'];
    if (depth) args.push('--depth', String(depth));

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];

    const parsed = this.parseJson<{ memories?: NowledgeMemMemory[] }>(result.stdout);
    return parsed?.memories ?? [];
  }

  async searchRelations(options: {
    type?: NowledgeMemRelationType;
    fromId?: string;
    toId?: string;
    limit?: number;
  }): Promise<NowledgeMemRelation[]> {
    const args = ['graph', 'search', '--json'];

    if (options.type) args.push('--type', options.type);
    if (options.fromId) args.push('--from', options.fromId);
    if (options.toId) args.push('--to', options.toId);
    if (options.limit) args.push('--limit', String(options.limit));

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    return this.parseJson<NowledgeMemRelation[]>(result.stdout) ?? [];
  }

  async getEvolvesChain(id: string, options?: { evolvesKind?: NowledgeMemEvolvesKind }): Promise<NowledgeMemMemory[]> {
    const args = ['graph', 'evolves', '--id', id, '--json'];
    if (options?.evolvesKind) args.push('--evolves-kind', options.evolvesKind);

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    return this.parseJson<NowledgeMemMemory[]>(result.stdout) ?? [];
  }

  // ── Space operations ──

  async createSpace(name: string, options?: { description?: string }): Promise<import('../protocols/nowledge-mem.js').NowledgeMemSpace> {
    const args = ['spaces', 'create', name, '--json'];
    if (options?.description) args.push('--description', options.description);

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to create space: ${result.stderr}`);
    }
    const parsed = this.parseJson<import('../protocols/nowledge-mem.js').NowledgeMemSpace>(result.stdout);
    return parsed ?? { id: result.stdout.trim(), name };
  }

  async listSpaces(): Promise<import('../protocols/nowledge-mem.js').NowledgeMemSpace[]> {
    const result = await this.exec(['spaces', 'list', '--json']);
    if (result.exitCode !== 0) return [];
    return this.parseJson<import('../protocols/nowledge-mem.js').NowledgeMemSpace[]>(result.stdout) ?? [];
  }

  async getSpace(id: string): Promise<import('../protocols/nowledge-mem.js').NowledgeMemSpace | null> {
    const result = await this.exec(['spaces', 'get', '--id', id, '--json']);
    if (result.exitCode !== 0) return null;
    return this.parseJson<import('../protocols/nowledge-mem.js').NowledgeMemSpace>(result.stdout);
  }

  async switchSpace(id: string): Promise<boolean> {
    const result = await this.exec(['spaces', 'switch', '--id', id]);
    return result.exitCode === 0;
  }

  async addSpaceMember(spaceId: string, entityId: string): Promise<boolean> {
    const result = await this.exec(['spaces', 'add-member', '--space', spaceId, '--entity', entityId]);
    return result.exitCode === 0;
  }

  async removeSpaceMember(spaceId: string, entityId: string): Promise<boolean> {
    const result = await this.exec(['spaces', 'remove-member', '--space', spaceId, '--entity', entityId]);
    return result.exitCode === 0;
  }

  // ── Source operations ──

  async addSource(pathOrUrl: string, options?: {
    type?: 'file' | 'url' | 'reference';
    labels?: string[];
  }): Promise<NowledgeMemSource> {
    const args = ['sources', 'add', pathOrUrl];

    if (options?.type) args.push('--type', options.type);
    if (options?.labels?.length) args.push('--labels', options.labels.join(','));

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to add source: ${result.stderr}`);
    }
    const parsed = this.parseJson<NowledgeMemSource>(result.stdout);
    return parsed ?? { id: result.stdout.trim(), type: options?.type ?? 'file', name: pathOrUrl };
  }

  async listSources(options?: { type?: string; limit?: number }): Promise<NowledgeMemSource[]> {
    const args = ['sources', 'list', '--json'];

    if (options?.type) args.push('--type', options.type);
    if (options?.limit) args.push('--limit', String(options.limit));

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    return this.parseJson<NowledgeMemSource[]>(result.stdout) ?? [];
  }

  async getSource(id: string): Promise<NowledgeMemSource | null> {
    const result = await this.exec(['sources', 'get', '--id', id, '--json']);
    if (result.exitCode !== 0) return null;
    return this.parseJson<NowledgeMemSource>(result.stdout);
  }

  async deleteSource(id: string): Promise<boolean> {
    const result = await this.exec(['sources', 'delete', '--id', id]);
    return result.exitCode === 0;
  }

  async ingestSource(id: string, options?: { dryRun?: boolean }): Promise<{
    memoryIds: string[];
    extractedEntities: number;
  }> {
    const args = ['sources', 'ingest', '--id', id];

    if (options?.dryRun) args.push('--dry-run');

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      return { memoryIds: [], extractedEntities: 0 };
    }
    const parsed = this.parseJson<{ memoryIds: string[]; extractedEntities: number }>(result.stdout);
    return parsed ?? { memoryIds: [], extractedEntities: 0 };
  }

  async searchSourceChunks(sourceId: string, query: string, options?: { limit?: number }): Promise<Array<{ content: string; score: number }>> {
    const args = ['sources', 'search-chunks', '--id', sourceId, query, '--json'];

    if (options?.limit) args.push('--limit', String(options.limit));

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    return this.parseJson<Array<{ content: string; score: number }>>(result.stdout) ?? [];
  }

  // ── Library ──

  async addToLibrary(paths: string[]): Promise<NowledgeMemLibraryArtifact[]> {
    const result = await this.exec(['library', 'add', ...paths, '--json']);
    if (result.exitCode !== 0) return [];
    return this.parseJson<NowledgeMemLibraryArtifact[]>(result.stdout) ?? [];
  }

  async searchLibrary(query: string, options?: { limit?: number }): Promise<NowledgeMemLibraryArtifact[]> {
    const args = ['library', 'search', query, '--json'];
    if (options?.limit) args.push('--limit', String(options.limit));

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    return this.parseJson<NowledgeMemLibraryArtifact[]>(result.stdout) ?? [];
  }

  async readArtifact(id: string): Promise<string> {
    const result = await this.exec(['library', 'read', '--id', id]);
    if (result.exitCode !== 0) return '';
    return result.stdout;
  }

  // ── Working memory ──

  async getWorkingMemory(date?: string): Promise<NowledgeMemWorkingMemory> {
    const args = ['working-memory', 'show', '--json'];
    if (date) args.push('--date', date);

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      return { date: date ?? new Date().toISOString().slice(0, 10), content: '' };
    }
    const parsed = this.parseJson<NowledgeMemWorkingMemory>(result.stdout);
    return parsed ?? { date: date ?? new Date().toISOString().slice(0, 10), content: result.stdout };
  }

  async setWorkingMemory(content: string): Promise<void> {
    const result = await this.exec(['working-memory', 'set'], content);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to set working memory: ${result.stderr}`);
    }
  }

  // ── Communities ──

  async listCommunities(limit?: number): Promise<NowledgeMemCommunity[]> {
    const args = ['communities', 'list', '--json'];
    if (limit) args.push('--limit', String(limit));

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    return this.parseJson<NowledgeMemCommunity[]>(result.stdout) ?? [];
  }

  // ── Feed ──

  async getFeed(days?: number): Promise<NowledgeMemFeedEntry[]> {
    const args = ['feed', 'show', '--json'];
    if (days) args.push('--days', String(days));

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    return this.parseJson<NowledgeMemFeedEntry[]>(result.stdout) ?? [];
  }

  // ── Distillation ──

  async summarizeMemories(ids: string[]): Promise<string> {
    const result = await this.exec(['memories', 'summarize', '--ids', ids.join(','), '--json']);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to summarize memories: ${result.stderr}`);
    }
    const parsed = this.parseJson<{ summary: string }>(result.stdout);
    return parsed?.summary ?? result.stdout;
  }

  // ── Threads ──

  async addThread(messages: Array<{ role: string; content: string }>, options?: {
    title?: string;
    source?: string;
    spaceId?: string;
  }): Promise<NowledgeMemThread> {
    const stdinContent = JSON.stringify(messages);
    const args = ['threads', 'add', '--stdin', '--json'];

    if (options?.title) args.push('--title', options.title);
    if (options?.source) args.push('--source', options.source);
    if (options?.spaceId) args.push('--space', options.spaceId);

    const result = await this.exec(args, stdinContent);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to add thread: ${result.stderr}`);
    }
    const parsed = this.parseJson<NowledgeMemThread>(result.stdout);
    return parsed ?? { id: result.stdout.trim(), title: options?.title ?? '', messages };
  }

  async searchThreads(query: string, options?: { limit?: number }): Promise<NowledgeMemThread[]> {
    const args = ['threads', 'search', query, '--json'];
    if (options?.limit) args.push('--limit', String(options.limit));

    const result = await this.exec(args);
    if (result.exitCode !== 0) return [];
    return this.parseJson<NowledgeMemThread[]>(result.stdout) ?? [];
  }

  async getThread(id: string): Promise<NowledgeMemThread | null> {
    const result = await this.exec(['threads', 'get', '--id', id, '--json']);
    if (result.exitCode !== 0) return null;
    return this.parseJson<NowledgeMemThread>(result.stdout);
  }

  async appendThread(id: string, messages: Array<{ role: string; content: string }>, options?: {
    idempotencyKey?: string;
  }): Promise<NowledgeMemThread | null> {
    const stdinContent = JSON.stringify(messages);
    const args = ['threads', 'append', '--id', id, '--stdin', '--json'];

    if (options?.idempotencyKey) args.push('--idempotency-key', options.idempotencyKey);

    const result = await this.exec(args, stdinContent);
    if (result.exitCode !== 0) return null;
    return this.parseJson<NowledgeMemThread>(result.stdout);
  }

  async importThread(options: {
    file?: string;
    messages?: Array<{ role: string; content: string }>;
    stdin?: boolean;
    title?: string;
    source?: string;
  }): Promise<NowledgeMemThread> {
    const args = ['threads', 'import', '--json'];

    if (options.file) args.push('--file', options.file);
    if (options.title) args.push('--title', options.title);
    if (options.source) args.push('--source', options.source);

    let stdinContent: string | undefined;
    if (options.messages) {
      args.push('--stdin');
      stdinContent = JSON.stringify(options.messages);
    }

    const result = await this.exec(args, stdinContent);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to import thread: ${result.stderr}`);
    }
    const parsed = this.parseJson<NowledgeMemThread>(result.stdout);
    return parsed ?? { id: result.stdout.trim(), title: options.title ?? '' };
  }

  async saveThread(options?: { title?: string; source?: string; spaceId?: string }): Promise<NowledgeMemThread> {
    const args = ['threads', 'save', '--json'];
    if (options?.title) args.push('--title', options.title);
    if (options?.source) args.push('--source', options.source);
    if (options?.spaceId) args.push('--space', options.spaceId);

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to save thread: ${result.stderr}`);
    }
    const parsed = this.parseJson<NowledgeMemThread>(result.stdout);
    return parsed ?? { id: result.stdout.trim(), title: options?.title ?? '' };
  }

  async reconcileTail(id: string, options?: { strategy?: 'merge' | 'trim'; maxOverlap?: number }): Promise<{
    reconciled: boolean;
    mergedCount?: number;
    trimmedCount?: number;
  }> {
    const args = ['threads', 'reconcile-tail', '--id', id, '--json'];
    if (options?.strategy) args.push('--strategy', options.strategy);
    if (options?.maxOverlap) args.push('--max-overlap', String(options.maxOverlap));

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      return { reconciled: false };
    }
    const parsed = this.parseJson<{ reconciled: boolean; mergedCount?: number; trimmedCount?: number }>(result.stdout);
    return parsed ?? { reconciled: false };
  }

  // ── Library import ──

  async importFromLibrary(source: string, options?: {
    maxItems?: number;
    filterLabels?: string[];
    dryRun?: boolean;
  }): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
    ids: string[];
  }> {
    const args = ['library', 'import', source, '--json'];

    if (options?.maxItems) args.push('--max-items', String(options.maxItems));
    if (options?.filterLabels?.length) args.push('--labels', options.filterLabels.join(','));
    if (options?.dryRun) args.push('--dry-run');

    const result = await this.exec(args);
    if (result.exitCode !== 0) {
      return { imported: 0, skipped: 0, errors: [result.stderr], ids: [] };
    }
    const parsed = this.parseJson<{ imported: number; skipped: number; errors: string[]; ids: string[] }>(result.stdout);
    return parsed ?? { imported: 0, skipped: 0, errors: [], ids: [] };
  }

  // ── Lifecycle ──

  async initialize(): Promise<void> {
    const status = await this.status();
    this._available = status.connected;
  }

  async healthCheck(): Promise<boolean> {
    const status = await this.status();
    this._available = status.connected;
    return status.connected;
  }

  async shutdown(): Promise<void> {
    this._available = false;
  }

  get available(): boolean {
    return this._available;
  }
}