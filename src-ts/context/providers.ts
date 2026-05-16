/**
 * Context Providers - Dynamic context injection system
 *
 * Aggregates context from multiple sources: memory, skills, project config.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createLogger } from '../logger/index.js';

const log = createLogger('context-providers');

// ============================================================
// Enums & Data Classes
// ============================================================

export enum ContextPriority {
  CRITICAL = 0,
  HIGH = 10,
  NORMAL = 50,
  LOW = 100,
  OPTIONAL = 200,
}

export interface ContextItem {
  key: string;
  value: unknown;
  source: string;
  priority: ContextPriority;
  metadata: Record<string, unknown>;
  tokenEstimate: number;
}

export function createContextItem(params: {
  key: string;
  value: unknown;
  source: string;
  priority?: ContextPriority;
  metadata?: Record<string, unknown>;
  tokenEstimate?: number;
}): ContextItem {
  return {
    key: params.key,
    value: params.value,
    source: params.source,
    priority: params.priority ?? ContextPriority.NORMAL,
    metadata: params.metadata ?? {},
    tokenEstimate: params.tokenEstimate ?? 0,
  };
}

const CHINESE_CHAR_RE = /[\u4e00-\u9fff]/g;

function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(CHINESE_CHAR_RE) ?? []).length;
  const otherChars = text.length - chineseChars;
  return Math.floor(chineseChars / 1.5 + otherChars / 4);
}

function toPromptSegment(item: ContextItem): string {
  let content: string;
  if (typeof item.value === 'object' && item.value !== null) {
    content = JSON.stringify(item.value, null, 2);
  } else {
    content = String(item.value);
  }
  return `[${item.key}]\n${content}\n[/${item.key}]`;
}

// ============================================================
// Provider Interface
// ============================================================

export interface IContextProvider {
  readonly name: string;
  readonly priority: ContextPriority;
  getContext(query?: string | null, ...args: unknown[]): Promise<ContextItem[]>;
}

// ============================================================
// Base Provider
// ============================================================

export abstract class BaseContextProvider implements IContextProvider {
  readonly name: string;
  readonly priority: ContextPriority;

  constructor(name: string, priority: ContextPriority = ContextPriority.NORMAL) {
    this.name = name;
    this.priority = priority;
  }

  abstract getContext(query?: string | null, ...args: unknown[]): Promise<ContextItem[]>;

  protected _estimateTokens(text: string): number {
    return estimateTokens(text);
  }
}

// ============================================================
// Memory Context Provider
// ============================================================

export class MemoryContextProvider extends BaseContextProvider {
  private _memoryEngine: unknown;
  private _maxItems: number;
  private _relevanceThreshold: number;

  constructor(
    memoryEngine?: unknown,
    maxItems = 10,
    relevanceThreshold = 0.5,
  ) {
    super('memory', ContextPriority.HIGH);
    this._memoryEngine = memoryEngine ?? null;
    this._maxItems = maxItems;
    this._relevanceThreshold = relevanceThreshold;
  }

  async getContext(query?: string | null, ...args: unknown[]): Promise<ContextItem[]> {
    if (!this._memoryEngine) return [];

    const items: ContextItem[] = [];
    const sessionId = (args[0] as string) ?? null;

    try {
      const engine = this._memoryEngine as Record<string, unknown>;
      if (typeof engine.search === 'function') {
        const results = await (engine.search as (q: string, opts?: Record<string, unknown>) => Promise<unknown[]>)(
          query ?? '',
          { limit: this._maxItems, sessionId },
        );

        for (const result of results) {
          const r = result as Record<string, unknown>;
          if (typeof r.score === 'number' && r.score < this._relevanceThreshold) continue;

          const content = (typeof r.content === 'string' ? r.content : String(r)) as string;
          items.push(createContextItem({
            key: `memory_${items.length}`,
            value: content,
            source: this.name,
            priority: this.priority,
            metadata: {
              score: (r.score as number) ?? 1.0,
              type: (r.memory_type as string) ?? 'unknown',
            },
            tokenEstimate: this._estimateTokens(content),
          }));
        }
      }
    } catch (e) {
      log.error(`Failed to get memory context`, { error: String(e) });
    }

    return items;
  }
}

// ============================================================
// Skill Context Provider
// ============================================================

export class SkillContextProvider extends BaseContextProvider {
  private _skillLoader: unknown;
  private _maxSkillLength: number;

  constructor(skillLoader?: unknown, maxSkillLength = 4000) {
    super('skill', ContextPriority.NORMAL);
    this._skillLoader = skillLoader ?? null;
    this._maxSkillLength = maxSkillLength;
  }

  async getContext(query?: string | null, ...args: unknown[]): Promise<ContextItem[]> {
    if (!this._skillLoader) return [];

    const items: ContextItem[] = [];
    const skillIds = (args[0] as string[]) ?? [];
    const includeSummary = (args[1] as boolean) ?? true;
    const loader = this._skillLoader as Record<string, unknown>;

    try {
      const uniqueIds: string[] = [];
      const seen = new Set<string>();
      for (const id of skillIds) {
        if (!seen.has(id)) { seen.add(id); uniqueIds.push(id); }
      }

      for (const skillId of uniqueIds) {
        try {
          let content = (loader.load as (n: string) => string)(skillId);
          if (content.length > this._maxSkillLength) {
            content = content.slice(0, this._maxSkillLength) + '\n... (truncated)';
          }
          items.push(createContextItem({
            key: `skill_${skillId}`,
            value: content,
            source: this.name,
            priority: this.priority,
            metadata: { skill_id: skillId },
            tokenEstimate: this._estimateTokens(content),
          }));
        } catch { /* skill not found */ }
      }

      if (includeSummary && typeof loader.getSummary === 'function') {
        const summary = (loader.getSummary as () => string)();
        items.push(createContextItem({
          key: 'available_skills',
          value: summary,
          source: this.name,
          priority: ContextPriority.LOW,
          tokenEstimate: this._estimateTokens(summary),
        }));
      }
    } catch (e) {
      log.error(`Failed to get skill context`, { error: String(e) });
    }

    return items;
  }
}

// ============================================================
// Project Context Provider
// ============================================================

export class ProjectContextProvider extends BaseContextProvider {
  private _projectRoot: string;
  private _nikoDir: string;

  constructor(projectRoot?: string | null) {
    super('project', ContextPriority.HIGH);
    this._projectRoot = projectRoot ?? process.cwd();
    this._nikoDir = join(this._projectRoot, '.niko');
  }

  async getContext(query?: string | null, ...args: unknown[]): Promise<ContextItem[]> {
    const items: ContextItem[] = [];

    if (!existsSync(this._nikoDir)) return items;

    try {
      const includeCharacters = (args[0] as boolean) ?? true;
      const includeWorld = (args[1] as boolean) ?? true;
      const includeOutline = (args[2] as boolean) ?? true;

      const configFile = join(this._nikoDir, 'config.json');
      if (existsSync(configFile)) {
        const config = this._readJsonFile(configFile);
        items.push(createContextItem({
          key: 'project_config',
          value: config,
          source: this.name,
          priority: ContextPriority.HIGH,
          tokenEstimate: this._estimateTokens(JSON.stringify(config)),
        }));
      }

      if (includeCharacters) {
        const charsDir = join(this._nikoDir, 'characters');
        if (existsSync(charsDir)) {
          const characters: unknown[] = [];
          for (const file of readdirSync(charsDir)) {
            if (!file.endsWith('.json')) continue;
            try { characters.push(this._readJsonFile(join(charsDir, file))); } catch { /* skip */ }
          }
          if (characters.length > 0) {
            items.push(createContextItem({
              key: 'characters',
              value: characters,
              source: this.name,
              priority: ContextPriority.NORMAL,
              metadata: { count: characters.length },
              tokenEstimate: this._estimateTokens(JSON.stringify(characters)),
            }));
          }
        }
      }

      if (includeWorld) {
        const worldFile = join(this._nikoDir, 'world.json');
        if (existsSync(worldFile)) {
          const world = this._readJsonFile(worldFile);
          items.push(createContextItem({
            key: 'world',
            value: world,
            source: this.name,
            priority: ContextPriority.NORMAL,
            tokenEstimate: this._estimateTokens(JSON.stringify(world)),
          }));
        }
      }

      if (includeOutline) {
        const outlineFile = join(this._nikoDir, 'outline.json');
        if (existsSync(outlineFile)) {
          const outline = this._readJsonFile(outlineFile);
          items.push(createContextItem({
            key: 'outline',
            value: outline,
            source: this.name,
            priority: ContextPriority.HIGH,
            tokenEstimate: this._estimateTokens(JSON.stringify(outline)),
          }));
        }
      }
    } catch (e) {
      log.error(`Failed to get project context`, { error: String(e) });
    }

    return items;
  }

  private _readJsonFile(filePath: string): unknown {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }
}

// ============================================================
// Context Aggregator
// ============================================================

export class ContextAggregator {
  private _providers: IContextProvider[] = [];
  private _maxTotalTokens: number;

  constructor(maxTotalTokens = 8000) {
    this._maxTotalTokens = maxTotalTokens;
  }

  addProvider(provider: IContextProvider): void {
    this._providers.push(provider);
    this._providers.sort((a, b) => a.priority - b.priority);
  }

  removeProvider(name: string): boolean {
    const idx = this._providers.findIndex(p => p.name === name);
    if (idx >= 0) { this._providers.splice(idx, 1); return true; }
    return false;
  }

  async getContext(
    query?: string | null,
    maxTokens?: number | null,
    providerKwargs?: Record<string, Record<string, unknown>>,
    ...kwargs: unknown[]
  ): Promise<ContextItem[]> {
    const allItems: ContextItem[] = [];
    const kwPerProvider = providerKwargs ?? {};

    const results = await Promise.allSettled(
      this._providers.map(provider => {
        const extra = kwPerProvider[provider.name] ?? {};
        return provider.getContext(query, ...kwargs, ...Object.values(extra));
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') allItems.push(...result.value);
    }

    allItems.sort((a, b) => a.priority - b.priority);

    const limit = maxTokens ?? null;
    return limit !== null ? this._applyTokenBudget(allItems, limit) : allItems;
  }

  private _applyTokenBudget(items: ContextItem[], maxTokens: number): ContextItem[] {
    const result: ContextItem[] = [];
    let totalTokens = 0;

    for (const item of items) {
      if (totalTokens + item.tokenEstimate <= maxTokens) {
        result.push(item);
        totalTokens += item.tokenEstimate;
      } else if (item.priority <= ContextPriority.HIGH) {
        result.push(item);
        totalTokens += item.tokenEstimate;
      }
    }

    return result;
  }

  toPrompt(items: ContextItem[]): string {
    if (items.length === 0) return '';
    return items.map(toPromptSegment).join('\n\n');
  }

  listProviders(): string[] {
    return this._providers.map(p => p.name);
  }
}

// ============================================================
// Convenience Functions
// ============================================================

export function getDefaultAggregator(
  memoryEngine?: unknown,
  skillLoader?: unknown,
  projectRoot?: string | null,
): ContextAggregator {
  const aggregator = new ContextAggregator();
  if (memoryEngine) aggregator.addProvider(new MemoryContextProvider(memoryEngine));
  if (skillLoader) aggregator.addProvider(new SkillContextProvider(skillLoader));
  aggregator.addProvider(new ProjectContextProvider(projectRoot));
  return aggregator;
}
