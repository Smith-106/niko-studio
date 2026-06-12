import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BaseContextProvider,
  ContextAggregator,
  ContextPriority,
  MemoryContextProvider,
  ProjectContextProvider,
  SkillContextProvider,
  createContextItem,
  type ContextItem,
} from '../../context/providers.js';

class ProbeProvider extends BaseContextProvider {
  constructor() {
    super('probe', ContextPriority.NORMAL);
  }

  async getContext(): Promise<ContextItem[]> {
    return [];
  }

  estimate(text: string): number {
    return this._estimateTokens(text);
  }
}

class StaticProvider extends BaseContextProvider {
  constructor(
    name: string,
    priority: ContextPriority,
    private readonly items: ContextItem[],
  ) {
    super(name, priority);
  }

  async getContext(): Promise<ContextItem[]> {
    return this.items;
  }
}

describe('context/providers branch-gap coverage', () => {
  const tempDirs: string[] = [];
  const originalCwd = process.cwd();

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('estimates zero tokens for empty text', () => {
    const provider = new ProbeProvider();

    expect(provider.estimate('')).toBe(0);
  });

  it('uses an empty query fallback when memory search is called without a query', async () => {
    const search = vi.fn().mockResolvedValue([]);
    const provider = new MemoryContextProvider({ search });

    await provider.getContext(undefined, 'session-2');

    expect(search).toHaveBeenCalledWith('', { limit: 10, sessionId: 'session-2' });
  });

  it('defaults missing skill ids to an empty list and still includes the summary', async () => {
    const loader = {
      load: vi.fn(() => 'unused'),
      getSummary: vi.fn(() => 'summary-only'),
    };
    const provider = new SkillContextProvider(loader);

    const items = await provider.getContext('query', undefined, undefined);

    expect(loader.load).not.toHaveBeenCalled();
    expect(items).toEqual([
      expect.objectContaining({
        key: 'available_skills',
        value: 'summary-only',
      }),
    ]);
  });

  it('uses process.cwd by default and skips non-json character files', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-context-branch-gap-'));
    tempDirs.push(projectRoot);
    process.chdir(projectRoot);

    const nikoDir = path.join(projectRoot, '.niko');
    fs.mkdirSync(path.join(nikoDir, 'characters'), { recursive: true });
    fs.writeFileSync(path.join(nikoDir, 'characters', 'hero.json'), JSON.stringify({ name: 'Alice' }), 'utf8');
    fs.writeFileSync(path.join(nikoDir, 'characters', 'notes.txt'), 'ignore me', 'utf8');

    const provider = new ProjectContextProvider();
    const items = await provider.getContext(null, true, false, false);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'characters',
      metadata: { count: 1 },
    });
  });

  it('returns all items when no explicit max token budget is provided', async () => {
    const aggregator = new ContextAggregator();
    aggregator.addProvider(
      new StaticProvider('alpha', ContextPriority.NORMAL, [
        createContextItem({
          key: 'alpha',
          value: 'one',
          source: 'alpha',
          priority: ContextPriority.NORMAL,
          tokenEstimate: 100,
        }),
      ]),
    );
    aggregator.addProvider(
      new StaticProvider('beta', ContextPriority.LOW, [
        createContextItem({
          key: 'beta',
          value: 'two',
          source: 'beta',
          priority: ContextPriority.LOW,
          tokenEstimate: 100,
        }),
      ]),
    );

    const items = await aggregator.getContext('query');

    expect(items.map((item) => item.key)).toEqual(['alpha', 'beta']);
  });
});
