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
  getDefaultAggregator,
  type ContextItem,
} from '../../context/providers.js';

class StaticProvider extends BaseContextProvider {
  constructor(
    name: string,
    priority: ContextPriority,
    private readonly items: ContextItem[],
    private readonly error?: Error,
  ) {
    super(name, priority);
  }

  async getContext(): Promise<ContextItem[]> {
    if (this.error) {
      throw this.error;
    }
    return this.items;
  }
}

describe('context/providers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds context items with sensible defaults', () => {
    const item = createContextItem({
      key: 'story',
      value: 'hero',
      source: 'unit',
    });

    expect(item).toEqual({
      key: 'story',
      value: 'hero',
      source: 'unit',
      priority: ContextPriority.NORMAL,
      metadata: {},
      tokenEstimate: 0,
    });
  });

  it('collects memory context from the injected engine and filters low scores', async () => {
    const search = vi.fn().mockResolvedValue([
      { content: '高价值记忆', score: 0.9, memory_type: 'session' },
      { content: 'ignored', score: 0.2, memory_type: 'session' },
      { foo: 'bar' },
    ]);
    const provider = new MemoryContextProvider({ search }, 5, 0.5);

    const items = await provider.getContext('hero', 'session-1');

    expect(search).toHaveBeenCalledWith('hero', { limit: 5, sessionId: 'session-1' });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      key: 'memory_0',
      value: '高价值记忆',
      source: 'memory',
      priority: ContextPriority.HIGH,
      metadata: { score: 0.9, type: 'session' },
    });
    expect(items[0].tokenEstimate).toBeGreaterThan(0);
    expect(items[1]).toMatchObject({
      key: 'memory_1',
      value: '[object Object]',
      metadata: { score: 1, type: 'unknown' },
    });
  });

  it('gracefully degrades when the memory engine is missing or throws', async () => {
    const noEngineProvider = new MemoryContextProvider();
    await expect(noEngineProvider.getContext('hero')).resolves.toEqual([]);

    const errorProvider = new MemoryContextProvider({
      search: vi.fn().mockRejectedValue(new Error('boom')),
    });
    await expect(errorProvider.getContext('hero')).resolves.toEqual([]);
  });

  it('loads unique skill context, truncates long content, and can append a summary', async () => {
    const loader = {
      load: vi.fn((id: string) => {
        if (id === 'missing') {
          throw new Error('missing');
        }
        return `${id}:${'x'.repeat(16)}`;
      }),
      getSummary: vi.fn(() => 'skill-a, skill-b'),
    };
    const provider = new SkillContextProvider(loader, 12);

    const items = await provider.getContext('query', ['skill-a', 'skill-a', 'missing', 'skill-b'], true);

    expect(loader.load).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      key: 'skill_skill-a',
      source: 'skill',
      metadata: { skill_id: 'skill-a' },
    });
    expect(String(items[0].value)).toContain('(truncated)');
    expect(items[2]).toMatchObject({
      key: 'available_skills',
      value: 'skill-a, skill-b',
      priority: ContextPriority.LOW,
    });
  });

  it('can omit the skill summary and return an empty list without a loader', async () => {
    const provider = new SkillContextProvider();
    await expect(provider.getContext('query', ['skill-a'], false)).resolves.toEqual([]);

    const loader = {
      load: vi.fn(() => 'brief'),
      getSummary: vi.fn(() => 'unused'),
    };
    const loadedProvider = new SkillContextProvider(loader);
    const items = await loadedProvider.getContext('query', ['skill-a'], false);

    expect(items).toHaveLength(1);
    expect(loader.getSummary).not.toHaveBeenCalled();
  });

  it('keeps collected skill items when the summary loader throws', async () => {
    const provider = new SkillContextProvider({
      load: vi.fn(() => 'skill-body'),
      getSummary: vi.fn(() => {
        throw new Error('summary failed');
      }),
    });

    const items = await provider.getContext('query', ['skill-a'], true);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'skill_skill-a',
      value: 'skill-body',
    });
  });

  it('loads project context from .niko artifacts and respects include flags', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-context-provider-'));
    tempDirs.push(projectRoot);

    const nikoDir = path.join(projectRoot, '.niko');
    fs.mkdirSync(path.join(nikoDir, 'characters'), { recursive: true });
    fs.writeFileSync(path.join(nikoDir, 'config.json'), JSON.stringify({ title: 'Atlas' }), 'utf8');
    fs.writeFileSync(path.join(nikoDir, 'characters', 'hero.json'), JSON.stringify({ name: 'Alice' }), 'utf8');
    fs.writeFileSync(path.join(nikoDir, 'characters', 'broken.json'), '{not-json', 'utf8');
    fs.writeFileSync(path.join(nikoDir, 'world.json'), JSON.stringify({ realm: 'North' }), 'utf8');
    fs.writeFileSync(path.join(nikoDir, 'outline.json'), JSON.stringify({ acts: 3 }), 'utf8');

    const provider = new ProjectContextProvider(projectRoot);
    const items = await provider.getContext(null, true, false, true);

    expect(items.map((item) => item.key)).toEqual(['project_config', 'characters', 'outline']);
    expect(items[1]).toMatchObject({
      key: 'characters',
      metadata: { count: 1 },
    });
    expect(items[2].priority).toBe(ContextPriority.HIGH);
  });

  it('loads world context when the world include flag is enabled', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-context-world-'));
    tempDirs.push(projectRoot);

    const nikoDir = path.join(projectRoot, '.niko');
    fs.mkdirSync(nikoDir, { recursive: true });
    fs.writeFileSync(path.join(nikoDir, 'world.json'), JSON.stringify({ realm: 'North' }), 'utf8');

    const provider = new ProjectContextProvider(projectRoot);
    const items = await provider.getContext(null, false, true, false);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'world',
      value: { realm: 'North' },
      priority: ContextPriority.NORMAL,
    });
    expect(items[0].tokenEstimate).toBeGreaterThan(0);
  });

  it('returns an empty project context when .niko is absent or data loading fails', async () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-context-empty-'));
    tempDirs.push(projectRoot);

    const provider = new ProjectContextProvider(projectRoot);
    await expect(provider.getContext()).resolves.toEqual([]);

    const nikoDir = path.join(projectRoot, '.niko');
    fs.mkdirSync(nikoDir, { recursive: true });
    fs.writeFileSync(path.join(nikoDir, 'config.json'), '{broken', 'utf8');

    await expect(provider.getContext()).resolves.toEqual([]);
  });

  it('aggregates provider output, applies priority ordering, and honors token budgets', async () => {
    const alwaysIncluded = createContextItem({
      key: 'critical',
      value: 'must include first',
      source: 'critical',
      priority: ContextPriority.CRITICAL,
      tokenEstimate: 2,
    });
    const overflowHighPriority = createContextItem({
      key: 'must_keep',
      value: 'must keep even when over budget',
      source: 'must_keep',
      priority: ContextPriority.HIGH,
      tokenEstimate: 10,
    });
    const lowPriority = createContextItem({
      key: 'optional',
      value: 'later',
      source: 'optional',
      priority: ContextPriority.LOW,
      tokenEstimate: 4,
    });
    const aggregator = new ContextAggregator();
    aggregator.addProvider(new StaticProvider('optional', ContextPriority.LOW, [lowPriority]));
    aggregator.addProvider(new StaticProvider('failing', ContextPriority.NORMAL, [], new Error('skip me')));
    aggregator.addProvider(
      new StaticProvider('critical', ContextPriority.HIGH, [alwaysIncluded, overflowHighPriority]),
    );

    const items = await aggregator.getContext('query', 8);

    expect(items.map((item) => item.key)).toEqual(['critical', 'must_keep']);
    expect(aggregator.listProviders()).toEqual(['critical', 'failing', 'optional']);
    expect(aggregator.removeProvider('failing')).toBe(true);
    expect(aggregator.removeProvider('missing')).toBe(false);
  });

  it('formats aggregated context into prompt segments', () => {
    const aggregator = new ContextAggregator();
    const text = aggregator.toPrompt([
      createContextItem({
        key: 'summary',
        value: { chapter: 3, scene: 'storm' },
        source: 'unit',
      }),
      createContextItem({
        key: 'note',
        value: 'stay sharp',
        source: 'unit',
      }),
    ]);

    expect(text).toContain('[summary]');
    expect(text).toContain('"chapter": 3');
    expect(text).toContain('[note]');
    expect(text).toContain('stay sharp');
    expect(aggregator.toPrompt([])).toBe('');
  });

  it('builds the default aggregator with optional providers in order', () => {
    const memoryEngine = { search: vi.fn() };
    const skillLoader = { load: vi.fn(), getSummary: vi.fn() };
    const aggregator = getDefaultAggregator(memoryEngine, skillLoader, '/tmp/project');

    expect(aggregator.listProviders()).toEqual(['memory', 'project', 'skill']);
  });
});
