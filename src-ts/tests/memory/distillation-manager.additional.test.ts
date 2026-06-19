import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DistillationManager,
  DistillationResult,
  DistillationTemplate,
  getDistillationManager,
  resetDistillationManager,
  type MemoryManagerForDistillation,
} from '../../memory/distillation-manager';
import type { CitationManager } from '../../memory/citation-manager';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-distillation-additional-'));
}

function createMemoryManager(id = 'mem-additional'): MemoryManagerForDistillation & { add: ReturnType<typeof vi.fn> } {
  return {
    add: vi.fn().mockReturnValue({ id }),
  };
}

function createCitationManager(): CitationManager & {
  createTransientCitation: ReturnType<typeof vi.fn>;
  makeCitation: ReturnType<typeof vi.fn>;
  getCitation: ReturnType<typeof vi.fn>;
} {
  let counter = 0;
  return {
    createTransientCitation: vi.fn((quote: string, source: unknown) => ({
      citationId: `transient-${counter++}`,
      quote,
      source,
    })),
    makeCitation: vi.fn((_transient: unknown) => ({
      citationId: `cit-${counter++}`,
      quote: 'persisted quote',
      sourceHash: 'hash',
    })),
    getCitation: vi.fn((citationId: string) => ({
      citationId,
      quote: 'persisted quote',
      sourceHash: 'hash',
    })),
  } as unknown as CitationManager & {
    createTransientCitation: ReturnType<typeof vi.fn>;
    makeCitation: ReturnType<typeof vi.fn>;
    getCitation: ReturnType<typeof vi.fn>;
  };
}

describe('DistillationManager additional coverage', () => {
  let tempDir: string;
  let manager: DistillationManager;

  beforeEach(() => {
    tempDir = createTempDir();
    manager = new DistillationManager(tempDir);
  });

  afterEach(() => {
    resetDistillationManager();
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('hydrates DistillationResult defaults and preserves non-string templates', () => {
    const defaulted = DistillationResult.fromDict({
      resultId: 'defaulted',
    });

    expect(defaulted.sourceIds).toEqual([]);
    expect(defaulted.template).toBe(DistillationTemplate.SUMMARY);
    expect(defaulted.content).toBe('');
    expect(defaulted.derivedFrom).toEqual([]);
    expect(defaulted.metadata).toEqual({});

    const objectTemplate = { name: 'custom-template' } as unknown as DistillationTemplate;
    const restored = DistillationResult.fromDict({
      resultId: 'object-template',
      sourceIds: ['source'],
      template: objectTemplate,
      content: null,
      derivedFrom: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      metadata: null,
    });

    expect(restored.template).toBe(objectTemplate);
    expect(restored.content).toBe('');
    expect(restored.derivedFrom).toEqual([]);
    expect(restored.metadata).toEqual({});
  });

  it('loads valid custom-template results and ignores corrupt index files', () => {
    rmSync(tempDir, { recursive: true, force: true });
    const distillationDir = join(tempDir, 'distillations');
    mkdirSync(distillationDir, { recursive: true });
    writeFileSync(join(distillationDir, 'bad.json'), '{not valid json', 'utf-8');
    writeFileSync(
      join(distillationDir, 'custom.json'),
      JSON.stringify({
        resultId: 'custom',
        sourceIds: ['src'],
        template: 'custom-template',
        content: 'custom content',
      }),
      'utf-8',
    );

    manager = new DistillationManager(tempDir);

    const loaded = manager.getResult('custom');
    expect(loaded?.content).toBe('custom content');
    expect(manager.listByTemplate('custom-template').map((result) => result.resultId)).toEqual(['custom']);
  });

  it('returns null when a result file exists but cannot be parsed', () => {
    writeFileSync(join(tempDir, 'distillations', 'broken.json'), '{broken', 'utf-8');

    expect(manager.getResult('broken')).toBeNull();
  });

  it('deletes indexed orphan results even when template list and file are absent', () => {
    const orphan = new DistillationResult({
      resultId: 'orphan',
      sourceIds: [],
      template: 'orphan-template' as DistillationTemplate,
      content: 'orphaned',
    });
    (manager as any)._resultsIndex.set(orphan.resultId, orphan);

    expect(manager.deleteResult('orphan')).toBe(true);
    expect(existsSync(join(tempDir, 'distillations', 'orphan.json'))).toBe(false);
  });

  it('skips missing result ids while listing by template', () => {
    (manager as any)._templateIndex.set(DistillationTemplate.SUMMARY, ['missing']);

    expect(manager.listByTemplate(DistillationTemplate.SUMMARY)).toEqual([]);
    expect(manager.listByTemplate('never-indexed-template')).toEqual([]);
  });

  it('prefers topics over tags and falls back to prompt type for memory topics', () => {
    const memoryManager = createMemoryManager();
    manager.setMemoryManager(memoryManager);

    const withTopics = manager.createMemoryFromDistillation(
      'distilled content',
      'summary',
      null,
      ['tag-topic'],
      ['explicit-topic'],
    );
    const defaultTopics = manager.createMemoryFromDistillation('more content', 'plot_structure');

    expect(withTopics).toBe('mem-additional');
    expect(defaultTopics).toBe('mem-additional');
    expect(memoryManager.add).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        topics: ['explicit-topic'],
        metadata: expect.objectContaining({ derivedFrom: [] }),
      }),
    );
    expect(memoryManager.add).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        topics: ['plot_structure'],
        metadata: expect.objectContaining({ derivedFrom: [] }),
      }),
    );
  });

  it('truncates DerivedFrom citation quotes and stops at available source ids', () => {
    const citationManager = createCitationManager();
    manager.setCitationManager(citationManager);
    const longSource = 'x'.repeat(700);

    const result = manager.distill([longSource, 'unmatched source'], DistillationTemplate.SUMMARY, ['source-1']);

    expect(result.derivedFrom).toHaveLength(1);
    expect(citationManager.createTransientCitation).toHaveBeenCalledTimes(1);
    expect(citationManager.createTransientCitation.mock.calls[0][0]).toHaveLength(500);
    expect(citationManager.createTransientCitation.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        path: 'source-1',
        loc: { kind: 'full', index: 0 },
      }),
    );
    expect(citationManager.makeCitation.mock.calls[0][2]).toEqual(['derived_from', 'distillation']);
  });

  it('falls back for unrecognized LLM clients, null clients, and unknown simple templates', () => {
    manager.setLLMClient({ unexpected: vi.fn() } as any);
    const fallbackResult = manager.distill(['First sentence. Second sentence. Third sentence.'], DistillationTemplate.SUMMARY);
    expect(fallbackResult.content).toContain('First sentence.');

    (manager as any)._llmClient = null;
    expect((manager as any)._callLLM('Direct call. More detail.')).toBe('Direct call.');

    expect(manager.distill(['Unknown template content'], 'unknown-template').content).toBe('Unknown template content...');
    expect((manager as any)._resolveTemplate({ custom: true })).toEqual({ custom: true });
  });

  it('uses key point fallback when paragraphs have no first sentence', () => {
    const result = manager.distill(['.\n\n.'], DistillationTemplate.KEY_POINTS);

    expect(result.content).toBe('.\n\n.');
  });

  it('injects citation and memory managers into an existing singleton', () => {
    rmSync(tempDir, { recursive: true, force: true });
    const singleton = getDistillationManager(tempDir);
    const citationManager = createCitationManager();
    const memoryManager = createMemoryManager('mem-singleton');

    const sameSingleton = getDistillationManager(join(tempDir, 'ignored'), citationManager, memoryManager);
    const result = sameSingleton.distill(['singleton source'], DistillationTemplate.SUMMARY, ['singleton-source']);
    const memoryId = sameSingleton.createMemoryFromDistillation('singleton memory', 'summary');

    expect(sameSingleton).toBe(singleton);
    expect(result.derivedFrom).toHaveLength(1);
    expect(memoryId).toBe('mem-singleton');
  });

  it('covers legacy graph defaults and missing index directory reloads', () => {
    const knowledgeLayer = {
      addEntity: vi.fn(),
      addRelation: vi.fn(),
    };

    manager.applyToGraph(knowledgeLayer, {});
    expect(knowledgeLayer.addEntity).not.toHaveBeenCalled();
    expect(knowledgeLayer.addRelation).not.toHaveBeenCalled();

    manager.applyToGraph(knowledgeLayer, {
      entities: [{}],
      relations: [{}],
    });
    expect(knowledgeLayer.addEntity).toHaveBeenCalledWith('', '', '', '');
    expect(knowledgeLayer.addRelation).toHaveBeenCalledWith('', '', '', undefined);

    manager.applyToGraph({ addEntity: 'not-a-function', addRelation: 'not-a-function' }, {
      entities: [{}],
      relations: [{}],
    });

    rmSync(join(tempDir, 'distillations'), { recursive: true, force: true });
    expect(() => (manager as any)._loadIndex()).not.toThrow();
  });
});
