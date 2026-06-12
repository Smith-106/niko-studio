import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DistillationService,
  DistillationTemplate,
  type LegacyDistillationData,
} from '../../services/distill-service';

describe('DistillationService additional coverage', () => {
  let service: DistillationService;

  beforeEach(() => {
    service = new DistillationService();
  });

  it('falls back to summary prompt for unknown string templates', () => {
    const summaryPrompt = service.getPrompt(DistillationTemplate.SUMMARY);

    expect(service.getPrompt('not-a-real-template')).toBe(summaryPrompt);
  });

  it('handles non-string template values through prompt fallback', async () => {
    const strangeTemplate = { legacy: true } as unknown as DistillationTemplate;

    const result = await service.distill(
      ['First sentence. Second sentence. Third sentence. Fourth sentence.'],
      strangeTemplate
    );

    expect(result.content).toBe('First sentence. Second sentence. Third sentence.');
  });

  it('falls back to summary when distill receives an unknown string template', async () => {
    const result = await service.distill(
      ['One sentence. Two sentence. Three sentence. Four sentence.'],
      'legacy-unknown-template'
    );

    expect(result.template).toBe(DistillationTemplate.SUMMARY);
    expect(result.content).toBe('One sentence.');
    expect(result.metadata).toEqual({});
  });

  it('applies graph data when descriptions or arrays are missing', () => {
    const knowledgeLayer = {
      addEntity: vi.fn(),
      addRelation: vi.fn(),
    };

    const entityOnly = {
      entities: [{ id: 'hero', name: 'Hero', type: 'Character' }],
      relations: undefined,
    } as unknown as LegacyDistillationData;

    const relationOnly = {
      entities: undefined,
      relations: [{ source: 'hero', target: 'city', type: 'VISITS' }],
    } as unknown as LegacyDistillationData;

    service.applyToGraph(knowledgeLayer, entityOnly);
    service.applyToGraph(knowledgeLayer, relationOnly);

    expect(knowledgeLayer.addEntity).toHaveBeenCalledWith('hero', 'Hero', 'Character', '');
    expect(knowledgeLayer.addRelation).toHaveBeenCalledWith('hero', 'city', 'VISITS', undefined);
  });

  it('uses simple summary fallback when callLLM is invoked without a client', async () => {
    const internalService = service as unknown as DistillationService & {
      callLLM: (prompt: string) => Promise<string>;
    };

    await expect(
      internalService.callLLM('Alpha sentence. Beta sentence. Gamma sentence.')
    ).resolves.toBe('Alpha sentence.');
  });
});
