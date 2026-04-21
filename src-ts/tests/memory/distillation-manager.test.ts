/**
 * DistillationManager Tests
 *
 * Comprehensive test coverage for distillation templates, simple distillation,
 * LLM integration, batch operations, citation tracking, and legacy API.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DistillationManager,
  DistillationTemplate,
  DistillationResult,
  DISTILLATION_PROMPTS,
  resetDistillationManager,
  type MemoryManagerForDistillation,
} from '../../memory/distillation-manager';
import type { CitationManager } from '../../memory/citation-manager';
import { PersistedCitation } from '../../memory/citation-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-distillation-'));
}

function createMockCitationManager(): { manager: CitationManager; createTransientCitation: ReturnType<typeof vi.fn>; makeCitation: ReturnType<typeof vi.fn> } {
  const mockPersisted = new (class extends PersistedCitation {
    constructor() { super({ citationId: 'cit-mock', quote: 'q', sourceHash: 'h' }); }
  })();

  const createTransientCitation = vi.fn().mockReturnValue({ citationId: 'transient-mock' });
  const makeCitation = vi.fn().mockReturnValue(mockPersisted);
  const getCitation = vi.fn().mockReturnValue(mockPersisted);

  const manager = {
    createTransientCitation,
    makeCitation,
    getCitation,
  } as unknown as CitationManager;

  return { manager, createTransientCitation, makeCitation };
}

function createMockMemoryManager(returnId: string = 'mem-distill'): MemoryManagerForDistillation {
  return {
    add: vi.fn().mockReturnValue({ id: returnId }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  resetDistillationManager();
  vi.restoreAllMocks();
});

describe('DistillationTemplate enum', () => {
  it('has expected template values', () => {
    expect(DistillationTemplate.SUMMARY).toBe('summary');
    expect(DistillationTemplate.KEY_POINTS).toBe('key_points');
    expect(DistillationTemplate.CHARACTER_TRAITS).toBe('character_traits');
    expect(DistillationTemplate.PLOT_STRUCTURE).toBe('plot_structure');
    expect(DistillationTemplate.WORLD_BUILDING).toBe('world_building');
    expect(DistillationTemplate.STYLE_ELEMENTS).toBe('style_elements');
  });
});

describe('DISTILLATION_PROMPTS', () => {
  it('has prompts for all templates', () => {
    for (const template of Object.values(DistillationTemplate)) {
      expect(DISTILLATION_PROMPTS[template]).toBeTruthy();
      expect(DISTILLATION_PROMPTS[template]).toContain('{content}');
    }
  });
});

describe('DistillationResult', () => {
  it('constructs with all fields', () => {
    const result = new DistillationResult({
      resultId: 'r-1',
      sourceIds: ['s1', 's2'],
      template: DistillationTemplate.SUMMARY,
      content: 'Summary content',
      derivedFrom: ['cit-1'],
      createdAt: '2025-06-01T00:00:00Z',
      metadata: { key: 'value' },
    });
    expect(result.resultId).toBe('r-1');
    expect(result.sourceIds).toEqual(['s1', 's2']);
    expect(result.template).toBe(DistillationTemplate.SUMMARY);
    expect(result.content).toBe('Summary content');
    expect(result.derivedFrom).toEqual(['cit-1']);
  });

  it('uses defaults for optional fields', () => {
    const result = new DistillationResult({
      resultId: 'r-2',
      sourceIds: [],
      template: DistillationTemplate.KEY_POINTS,
      content: 'Points',
    });
    expect(result.derivedFrom).toEqual([]);
    expect(result.createdAt).toBeTruthy();
    expect(result.metadata).toEqual({});
  });

  it('round-trips through toDict and fromDict', () => {
    const original = new DistillationResult({
      resultId: 'r-rt',
      sourceIds: ['src-1'],
      template: DistillationTemplate.PLOT_STRUCTURE,
      content: 'Plot analysis',
      derivedFrom: ['cit-a', 'cit-b'],
      metadata: { chapters: 3 },
    });
    const dict = original.toDict();
    const restored = DistillationResult.fromDict(dict);
    expect(restored.resultId).toBe('r-rt');
    expect(restored.template).toBe(DistillationTemplate.PLOT_STRUCTURE);
    expect(restored.derivedFrom).toEqual(['cit-a', 'cit-b']);
  });

  it('handles legacy field names in fromDict', () => {
    const dict = {
      resultId: 'r-legacy',
      sourceIds: ['s1'],
      template: 'character_traits',
      content: 'traits',
      derived_from: ['cit-x'],
      created_at: '2025-01-01T00:00:00Z',
    };
    const restored = DistillationResult.fromDict(dict);
    expect(restored.resultId).toBe('r-legacy');
    expect(restored.template).toBe(DistillationTemplate.CHARACTER_TRAITS);
    expect(restored.derivedFrom).toEqual(['cit-x']);
  });
});

describe('DistillationManager', () => {
  let tempDir: string;
  let manager: DistillationManager;

  beforeEach(() => {
    tempDir = createTempDir();
    manager = new DistillationManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getPrompt', () => {
    it('returns correct prompt for template', () => {
      const prompt = manager.getPrompt(DistillationTemplate.SUMMARY);
      expect(prompt).toContain('PURPOSE');
      expect(prompt).toContain('{content}');
    });

    it('falls back to SUMMARY for unknown template', () => {
      const prompt = manager.getPrompt('unknown-template');
      expect(prompt).toBe(DISTILLATION_PROMPTS[DistillationTemplate.SUMMARY]);
    });

    it('accepts string template names', () => {
      const prompt = manager.getPrompt('key_points');
      expect(prompt).toBe(DISTILLATION_PROMPTS[DistillationTemplate.KEY_POINTS]);
    });
  });

  describe('distill (simple, no LLM)', () => {
    it('distills SUMMARY from single source', () => {
      const content = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six.';
      const result = manager.distill([content], DistillationTemplate.SUMMARY);
      expect(result.content).toBeTruthy();
      expect(result.resultId).toMatch(/^dist-/);
      expect(result.template).toBe(DistillationTemplate.SUMMARY);
      expect(result.sourceIds).toEqual([]);
    });

    it('distills KEY_POINTS from paragraphs', () => {
      const content = 'First paragraph with key point about characters.\n\nSecond paragraph about plot development.\n\nThird paragraph about world building.';
      const result = manager.distill([content], DistillationTemplate.KEY_POINTS);
      expect(result.content).toBeTruthy();
      expect(result.content).toMatch(/^\d+\./); // numbered points
    });

    it('distills CHARACTER_TRAITS', () => {
      const result = manager.distill(['Character analysis text here'], DistillationTemplate.CHARACTER_TRAITS);
      expect(result.content).toContain('Character Analysis');
    });

    it('distills PLOT_STRUCTURE', () => {
      const content = 'Once upon a time. The hero began a journey. They faced obstacles. Finally they reached the end.';
      const result = manager.distill([content], DistillationTemplate.PLOT_STRUCTURE);
      expect(result.content).toContain('Plot Structure');
      expect(result.content).toContain('Beginning');
      expect(result.content).toContain('Middle');
      expect(result.content).toContain('End');
    });

    it('distills WORLD_BUILDING', () => {
      const result = manager.distill(['World info'], DistillationTemplate.WORLD_BUILDING);
      expect(result.content).toContain('World-Building');
    });

    it('distills STYLE_ELEMENTS with word count stats', () => {
      const result = manager.distill(['A short sentence. Another sentence here.'], DistillationTemplate.STYLE_ELEMENTS);
      expect(result.content).toContain('Word count');
      expect(result.content).toContain('Sentence count');
      expect(result.content).toContain('Average sentence length');
    });

    it('joins multiple sources with separator', () => {
      const result = manager.distill(['Source A', 'Source B'], DistillationTemplate.SUMMARY);
      expect(result.sourceIds).toEqual([]);
      // Content should be based on combined content
      expect(result.content).toBeTruthy();
    });

    it('creates citations when CitationManager is set', () => {
      const { manager: citationMgr, makeCitation } = createMockCitationManager();
      manager.setCitationManager(citationMgr);

      const result = manager.distill(['source text'], DistillationTemplate.SUMMARY, ['source-id-1']);
      expect(result.derivedFrom.length).toBeGreaterThan(0);
      expect(makeCitation).toHaveBeenCalled();
    });

    it('passes metadata to result', () => {
      const result = manager.distill(['text'], DistillationTemplate.SUMMARY, null, { chapter: 1 });
      expect(result.metadata).toEqual({ chapter: 1 });
    });
  });

  describe('distill with LLM client', () => {
    it('calls LLM generate function', () => {
      const llmClient = { generate: vi.fn().mockReturnValue('LLM generated summary') };
      const llmManager = new DistillationManager(tempDir, null, null, llmClient);
      try {
        const result = llmManager.distill(['text'], DistillationTemplate.SUMMARY);
        expect(llmClient.generate).toHaveBeenCalled();
        expect(result.content).toBe('LLM generated summary');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('calls LLM complete function when generate not available', () => {
      const llmClient = { complete: vi.fn().mockReturnValue('LLM completed text') };
      const llmManager = new DistillationManager(tempDir, null, null, llmClient);
      try {
        const result = llmManager.distill(['text'], DistillationTemplate.KEY_POINTS);
        expect(llmClient.complete).toHaveBeenCalled();
        expect(result.content).toBe('LLM completed text');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('uses LLM as function', () => {
      const llmFn = vi.fn().mockReturnValue('Function response');
      const fnManager = new DistillationManager(tempDir, null, null, llmFn as any);
      try {
        const result = fnManager.distill(['text'], DistillationTemplate.SUMMARY);
        expect(llmFn).toHaveBeenCalled();
        expect(result.content).toBe('Function response');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('falls back to simple distill when LLM throws', () => {
      const llmClient = { generate: vi.fn().mockImplementation(() => { throw new Error('LLM fail'); }) };
      const llmManager = new DistillationManager(tempDir, null, null, llmClient);
      try {
        const result = llmManager.distill(['text'], DistillationTemplate.SUMMARY);
        expect(result.content).toBeTruthy();
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('getResult', () => {
    it('retrieves result from index', () => {
      const created = manager.distill(['text'], DistillationTemplate.SUMMARY);
      const retrieved = manager.getResult(created.resultId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe(created.content);
    });

    it('returns null for non-existent result', () => {
      expect(manager.getResult('non-existent')).toBeNull();
    });

    it('loads result from disk file', () => {
      const created = manager.distill(['text'], DistillationTemplate.SUMMARY);
      // Create a new manager to test loading from disk
      const newManager = new DistillationManager(tempDir);
      try {
        const loaded = newManager.getResult(created.resultId);
        expect(loaded).not.toBeNull();
        expect(loaded!.content).toBe(created.content);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('deleteResult', () => {
    it('deletes a result', () => {
      const created = manager.distill(['text'], DistillationTemplate.SUMMARY);
      expect(manager.deleteResult(created.resultId)).toBe(true);
      expect(manager.getResult(created.resultId)).toBeNull();
    });

    it('returns false for non-existent result', () => {
      expect(manager.deleteResult('non-existent')).toBe(false);
    });
  });

  describe('listByTemplate', () => {
    it('lists results filtered by template', () => {
      manager.distill(['text'], DistillationTemplate.SUMMARY);
      manager.distill(['text'], DistillationTemplate.SUMMARY);
      manager.distill(['text'], DistillationTemplate.KEY_POINTS);

      const summaries = manager.listByTemplate(DistillationTemplate.SUMMARY);
      expect(summaries.length).toBe(2);
      expect(summaries.every((r) => r.template === DistillationTemplate.SUMMARY)).toBe(true);

      const keyPoints = manager.listByTemplate(DistillationTemplate.KEY_POINTS);
      expect(keyPoints.length).toBe(1);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        manager.distill([`text ${i}`], DistillationTemplate.SUMMARY);
      }
      const results = manager.listByTemplate(DistillationTemplate.SUMMARY, 3);
      expect(results.length).toBe(3);
    });

    it('sorts by createdAt descending', () => {
      manager.distill(['first'], DistillationTemplate.SUMMARY);
      manager.distill(['second'], DistillationTemplate.SUMMARY);
      const results = manager.listByTemplate(DistillationTemplate.SUMMARY);
      expect(results[0].createdAt >= results[1].createdAt).toBe(true);
    });
  });

  describe('getDerivedFrom', () => {
    it('returns citations from CitationManager', () => {
      const { manager: citationMgr } = createMockCitationManager();
      manager.setCitationManager(citationMgr);
      const result = manager.distill(['source'], DistillationTemplate.SUMMARY, ['src-id']);
      const derived = manager.getDerivedFrom(result.resultId);
      expect(derived.length).toBeGreaterThan(0);
    });

    it('returns empty array when CitationManager not set', () => {
      const result = manager.distill(['source'], DistillationTemplate.SUMMARY);
      const derived = manager.getDerivedFrom(result.resultId);
      expect(derived).toEqual([]);
    });

    it('returns empty array for non-existent result', () => {
      expect(manager.getDerivedFrom('non-existent')).toEqual([]);
    });
  });

  describe('batchDistill', () => {
    it('distills with all templates', () => {
      const results = manager.batchDistill(['Batch content here']);
      expect(results.size).toBe(Object.keys(DistillationTemplate).length);
      for (const [template, result] of results) {
        expect(result.content).toBeTruthy();
        expect(result.template).toBe(template);
      }
    });

    it('continues on individual template failure', () => {
      // Override _simpleDistill to fail for one template
      const originalDistill = manager.distill.bind(manager);
      let failCount = 0;
      vi.spyOn(manager as any, '_simpleDistill').mockImplementation((content: string, template: string) => {
        failCount++;
        if (failCount === 1) throw new Error('Intentional failure');
        return `Fallback for ${template}`;
      });

      const results = manager.batchDistill(['test']);
      expect(results.size).toBeLessThan(Object.keys(DistillationTemplate).length);
    });
  });

  describe('createMemoryFromDistillation', () => {
    it('returns null when MemoryManager not set', () => {
      expect(manager.createMemoryFromDistillation('content', 'summary')).toBeNull();
    });

    it('creates memory entry via MemoryManager', () => {
      const mockMem = createMockMemoryManager();
      manager.setMemoryManager(mockMem);
      const memId = manager.createMemoryFromDistillation('distilled content', 'summary', ['cit-1'], ['tag-a']);
      expect(memId).toBe('mem-distill');
      expect(mockMem.add).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'distilled content',
          source: 'distill',
          importance: 0.7,
        }),
      );
    });
  });

  describe('stats', () => {
    it('returns correct statistics', () => {
      manager.distill(['text'], DistillationTemplate.SUMMARY);
      manager.distill(['text'], DistillationTemplate.KEY_POINTS);
      const stats = manager.stats();
      expect(stats.totalResults).toBe(2);
      expect(stats.byTemplate[DistillationTemplate.SUMMARY]).toBe(1);
      expect(stats.byTemplate[DistillationTemplate.KEY_POINTS]).toBe(1);
    });
  });

  describe('listTemplates', () => {
    it('returns all template names and descriptions', () => {
      const templates = manager.listTemplates();
      expect(templates.length).toBe(Object.keys(DistillationTemplate).length);
      for (const t of templates) {
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
      }
    });
  });

  describe('legacy API', () => {
    it('distillChapter returns summary and structure', () => {
      const result = manager.distillChapter('Chapter content about a hero');
      expect(result.summary).toBeTruthy();
      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
    });

    it('applyToGraph calls addEntity and addRelation', () => {
      const knowledgeLayer = {
        addEntity: vi.fn(),
        addRelation: vi.fn(),
      };
      const distilledData = {
        entities: [{ id: 'e1', name: 'Hero', type: 'character', description: 'The hero' }],
        relations: [{ source: 'e1', target: 'e2', type: 'knows', props: {} }],
      };
      manager.applyToGraph(knowledgeLayer, distilledData);
      expect(knowledgeLayer.addEntity).toHaveBeenCalledWith('e1', 'Hero', 'character', 'The hero');
      expect(knowledgeLayer.addRelation).toHaveBeenCalledWith('e1', 'e2', 'knows', {});
    });

    it('getDistillationPrompt maps task types', () => {
      const extractFacts = manager.getDistillationPrompt('extract-facts', 'content');
      expect(extractFacts).toContain('PURPOSE');

      const insight = manager.getDistillationPrompt('insight');
      expect(insight).toContain('{content}');

      // Unknown type falls back to SUMMARY
      const unknown = manager.getDistillationPrompt('unknown');
      expect(unknown).toBe(manager.getPrompt(DistillationTemplate.SUMMARY));
    });

    it('getDistillationPrompt substitutes content into template', () => {
      const prompt = manager.getDistillationPrompt('extract-facts', 'Some long content here');
      expect(prompt).toContain('Some long content here');
    });
  });

  describe('setCitationManager / setMemoryManager / setLLMClient', () => {
    it('setCitationManager updates the citation manager', () => {
      const { manager: cm } = createMockCitationManager();
      manager.setCitationManager(cm);
      // Verify by checking derivedFrom is populated after distill
      const result = manager.distill(['source'], DistillationTemplate.SUMMARY, ['src-id']);
      expect(result.derivedFrom.length).toBeGreaterThan(0);
    });

    it('setLLMClient enables LLM-based distillation', () => {
      const llm = { generate: vi.fn().mockReturnValue('LLM output') };
      manager.setLLMClient(llm);
      const result = manager.distill(['text'], DistillationTemplate.SUMMARY);
      expect(llm.generate).toHaveBeenCalled();
      expect(result.content).toBe('LLM output');
    });
  });
});
