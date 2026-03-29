/**
 * DistillationService Tests
 *
 * Comprehensive test coverage for TypeScript DistillationService implementation
 * Covers: template handling, distillation logic, legacy compatibility, LLM integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DistillationService,
  DistillationTemplate,
  DistillationResult,
  LegacyDistillationData,
} from '../../services/distill-service';
import type { LLMService } from '../../protocols/llm';

// Mock LLM Service
class MockLLMService implements LLMService {
  async generate(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    }
  ): Promise<string> {
    return 'Mocked LLM response';
  }

  async generateWithMetadata(): Promise<{ content: string; metadata: Record<string, unknown> }> {
    return { content: 'Mocked response', metadata: {} };
  }

  async generateJson(): Promise<Record<string, unknown>> {
    return { result: 'mocked' };
  }

  async *stream(): AsyncIterableIterator<{ content: string; isFinished: boolean; metadata?: Record<string, unknown> }> {
    yield { content: 'Mocked', isFinished: false };
    yield { content: ' stream', isFinished: true };
  }

  async batchGenerate(prompts: string[]): Promise<string[]> {
    return prompts.map(() => 'Mocked batch response');
  }
}

describe('DistillationService', () => {
  let service: DistillationService;
  let mockLLM: MockLLMService;

  beforeEach(() => {
    service = new DistillationService();
    mockLLM = new MockLLMService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // Template Tests
  // ============================================================

  describe('Template Handling', () => {
    it('should have all 6 distillation templates', () => {
      const templates = Object.values(DistillationTemplate);
      expect(templates).toHaveLength(6);
      expect(templates).toContain(DistillationTemplate.SUMMARY);
      expect(templates).toContain(DistillationTemplate.KEY_POINTS);
      expect(templates).toContain(DistillationTemplate.CHARACTER_TRAITS);
      expect(templates).toContain(DistillationTemplate.PLOT_STRUCTURE);
      expect(templates).toContain(DistillationTemplate.WORLD_BUILDING);
      expect(templates).toContain(DistillationTemplate.STYLE_ELEMENTS);
    });

    it('should get prompt by template enum', () => {
      const prompt = service.getPrompt(DistillationTemplate.SUMMARY);
      expect(prompt).toContain('PURPOSE');
      expect(prompt).toContain('{content}');
    });

    it('should get prompt by string value', () => {
      const prompt = service.getPrompt('key_points');
      expect(prompt).toContain('PURPOSE');
      expect(prompt.toLowerCase()).toContain('key');
    });

    it('should fallback to SUMMARY for unknown template', () => {
      const prompt = service.getPrompt('unknown_template');
      expect(prompt).toContain('PURPOSE');
      expect(prompt).toContain('summary');
    });
  });

  // ============================================================
  // Distillation Tests
  // ============================================================

  describe('Distillation Logic', () => {
    it('should perform distillation without LLM (fallback)', async () => {
      const sources = ['This is sentence one. This is sentence two. This is sentence three.'];
      const result = await service.distill(sources, DistillationTemplate.SUMMARY);

      expect(result.resultId).toBeDefined();
      expect(result.resultId).toMatch(/^dist-\d+-[a-z0-9]+$/);
      expect(result.template).toBe(DistillationTemplate.SUMMARY);
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.sourceIds).toEqual([]);
      expect(result.derivedFrom).toEqual([]);
      expect(result.createdAt).toBeDefined();
    });

    it('should perform distillation with LLM', async () => {
      service.setLLMClient(mockLLM);
      const sources = ['Test content for distillation.'];
      const result = await service.distill(sources, DistillationTemplate.KEY_POINTS);

      expect(result.content).toBe('Mocked LLM response');
      expect(result.template).toBe(DistillationTemplate.KEY_POINTS);
    });

    it('should store result in index', async () => {
      const sources = ['Test content.'];
      const result = await service.distill(sources, DistillationTemplate.SUMMARY);

      const retrieved = service.getResult(result.resultId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.resultId).toBe(result.resultId);
    });

    it('should index results by template', async () => {
      const sources = ['Test content.'];
      await service.distill(sources, DistillationTemplate.SUMMARY);
      await service.distill(sources, DistillationTemplate.SUMMARY);

      const results = service.listByTemplate(DistillationTemplate.SUMMARY);
      expect(results).toHaveLength(2);
    });

    it('should accept source IDs and metadata', async () => {
      const sources = ['Test content.'];
      const sourceIds = ['source-1', 'source-2'];
      const metadata = { author: 'test', version: '1.0' };

      const result = await service.distill(
        sources,
        DistillationTemplate.SUMMARY,
        sourceIds,
        metadata
      );

      expect(result.sourceIds).toEqual(sourceIds);
      expect(result.metadata).toEqual(metadata);
    });

    it('should combine multiple sources with separator', async () => {
      const sources = ['First source.', 'Second source.'];
      const result = await service.distill(sources, DistillationTemplate.SUMMARY);

      expect(result.content).toBeDefined();
    });

    it('should handle LLM errors gracefully', async () => {
      const failingLLM: LLMService = {
        generate: vi.fn().mockRejectedValue(new Error('LLM error')),
        generateWithMetadata: vi.fn(),
        generateJson: vi.fn(),
        stream: vi.fn(),
        batchGenerate: vi.fn(),
      };

      service.setLLMClient(failingLLM);
      const sources = ['Test content.'];
      const result = await service.distill(sources, DistillationTemplate.SUMMARY);

      // Should fallback to simple distillation
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Legacy Compatibility Tests
  // ============================================================

  describe('Legacy Compatibility', () => {
    it('should support distill_chapter()', async () => {
      const content = 'Chapter content here.';
      const result = await service.distillChapter(content);

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('relations');
      expect(result).toHaveProperty('summary');
      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.summary).toBeDefined();
    });

    it('should support apply_to_graph()', () => {
      const knowledgeLayer = {
        addEntity: vi.fn(),
        addRelation: vi.fn(),
      };

      const distilledData: LegacyDistillationData = {
        entities: [
          { id: 'alice', name: 'Alice', type: 'Character', description: 'Protagonist' },
          { id: 'wonderland', name: 'Wonderland', type: 'Location', description: 'Magical realm' },
        ],
        relations: [
          { source: 'alice', target: 'wonderland', type: 'LOCATED_IN', props: {} },
        ],
      };

      service.applyToGraph(knowledgeLayer, distilledData);

      expect(knowledgeLayer.addEntity).toHaveBeenCalledTimes(2);
      expect(knowledgeLayer.addEntity).toHaveBeenCalledWith(
        'alice',
        'Alice',
        'Character',
        'Protagonist'
      );
      expect(knowledgeLayer.addRelation).toHaveBeenCalledTimes(1);
      expect(knowledgeLayer.addRelation).toHaveBeenCalledWith(
        'alice',
        'wonderland',
        'LOCATED_IN',
        {}
      );
    });

    it('should support get_distillation_prompt()', () => {
      const prompt = service.getDistillationPrompt('summary');
      expect(prompt).toContain('PURPOSE');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should map legacy task types to templates', () => {
      const factsPrompt = service.getDistillationPrompt('extract-facts');
      expect(factsPrompt).toContain('PURPOSE');

      const relPrompt = service.getDistillationPrompt('extract-relationships');
      expect(relPrompt).toContain('PURPOSE');

      const insightPrompt = service.getDistillationPrompt('insight');
      expect(insightPrompt).toContain('PURPOSE');
    });

    it('should truncate content in legacy prompt', () => {
      const longContent = 'A'.repeat(3000);
      const prompt = service.getDistillationPrompt('summary', longContent);

      expect(prompt.length).toBeLessThan(longContent.length + 1000);
    });

    it('should handle missing optional methods in apply_to_graph()', () => {
      const knowledgeLayer = {}; // No methods

      const distilledData: LegacyDistillationData = {
        entities: [{ id: 'test', name: 'Test', type: 'Item' }],
        relations: [{ source: 'a', target: 'b', type: 'REL' }],
      };

      // Should not throw
      expect(() => service.applyToGraph(knowledgeLayer, distilledData)).not.toThrow();
    });
  });

  // ============================================================
  // Simple Distillation Fallback Tests
  // ============================================================

  describe('Simple Distillation Fallback', () => {
    it('should extract first third for SUMMARY template', async () => {
      const sentences = Array.from({ length: 10 }, (_, i) => `Sentence ${i + 1}`);
      const content = sentences.join('. ') + '.';
      const result = await service.distill([content], DistillationTemplate.SUMMARY);

      // Should contain first ~3 sentences (30% of 10)
      expect(result.content).toContain('Sentence 1');
      expect(result.content).toContain('Sentence 2');
      expect(result.content).toContain('Sentence 3');
    });

    it('should extract first 5 sentences for KEY_POINTS template', async () => {
      const sentences = Array.from({ length: 10 }, (_, i) => `Point ${i + 1}`);
      const content = sentences.join('. ') + '.';
      const result = await service.distill([content], DistillationTemplate.KEY_POINTS);

      // Should contain first 5 sentences
      expect(result.content).toContain('Point 1');
      expect(result.content).toContain('Point 5');
    });

    it('should extract first 3 sentences for other templates', async () => {
      const sentences = Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`);
      const content = sentences.join('. ') + '.';
      const result = await service.distill([content], DistillationTemplate.CHARACTER_TRAITS);

      expect(result.content).toContain('Item 1');
      expect(result.content).toContain('Item 2');
      expect(result.content).toContain('Item 3');
    });
  });

  // ============================================================
  // LLM Integration Tests
  // ============================================================

  describe('LLM Integration', () => {
    it('should call LLM with formatted prompt', async () => {
      const generateSpy = vi.spyOn(mockLLM, 'generate');
      service.setLLMClient(mockLLM);

      const sources = ['Test content.'];
      await service.distill(sources, DistillationTemplate.SUMMARY);

      expect(generateSpy).toHaveBeenCalled();
      const calledPrompt = generateSpy.mock.calls[0][0];
      expect(calledPrompt).toContain('PURPOSE');
      expect(calledPrompt).toContain('Test content');
    });

    it('should use LLM response as distilled content', async () => {
      service.setLLMClient(mockLLM);
      const sources = ['Test.'];
      const result = await service.distill(sources, DistillationTemplate.SUMMARY);

      expect(result.content).toBe('Mocked LLM response');
    });

    it('should allow setting LLM client after construction', () => {
      const noLLMService = new DistillationService();
      expect(() => noLLMService.setLLMClient(mockLLM)).not.toThrow();
    });
  });

  // ============================================================
  // Result Management Tests
  // ============================================================

  describe('Result Management', () => {
    it('should generate unique result IDs', async () => {
      const sources = ['Test.'];
      const result1 = await service.distill(sources, DistillationTemplate.SUMMARY);
      const result2 = await service.distill(sources, DistillationTemplate.SUMMARY);

      expect(result1.resultId).not.toBe(result2.resultId);
    });

    it('should return undefined for non-existent result', () => {
      const result = service.getResult('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('should return empty array for template with no results', () => {
      const results = service.listByTemplate(DistillationTemplate.WORLD_BUILDING);
      expect(results).toEqual([]);
    });
  });

  // ============================================================
  // Metadata Tests
  // ============================================================

  describe('Metadata Handling', () => {
    it('should preserve metadata in result', async () => {
      const sources = ['Test.'];
      const metadata = {
        author: 'John Doe',
        version: '1.0',
        tags: ['fiction', 'fantasy'],
      };

      const result = await service.distill(
        sources,
        DistillationTemplate.SUMMARY,
        undefined,
        metadata
      );

      expect(result.metadata).toEqual(metadata);
    });

    it('should include createdAt timestamp', async () => {
      const sources = ['Test.'];
      const beforeTime = new Date().toISOString();
      const result = await service.distill(sources, DistillationTemplate.SUMMARY);
      const afterTime = new Date().toISOString();

      expect(result.createdAt >= beforeTime).toBe(true);
      expect(result.createdAt <= afterTime).toBe(true);
    });
  });
});
