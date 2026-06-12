import { describe, expect, it, vi } from 'vitest';

import { EntityType } from '../../graph/graph-manager.js';
import { DimensionType } from '../../memory/six-dimensional-memory.js';
import { NarrativeRelationType } from '../../services/mappers/narrative-relation-mapper.js';
import { registerNarrativeTools } from '../../mcp/narrative-tools.js';

describe('mcp/narrative-tools', () => {
  it('maps entity, relation, and memory parameters into engine calls with sensible fallbacks', async () => {
    const engine = {
      addEntity: vi.fn().mockResolvedValue('entity-1'),
      getEntity: vi.fn().mockResolvedValue(null),
      queryEntities: vi.fn().mockResolvedValue([{ id: 'entity-1' }]),
      addRelation: vi.fn().mockResolvedValue('relation-1'),
      addNarrativeMemory: vi.fn().mockResolvedValue('memory-1'),
      plantForeshadow: vi.fn().mockResolvedValue('foreshadow-1'),
      getPendingForeshadows: vi.fn().mockResolvedValue([{ foreshadowId: 'f-1' }]),
      getWritingContext: vi.fn().mockResolvedValue({ chapter: 3 }),
    };
    const bridge = {
      syncFromKnowledgeLayer: vi.fn().mockResolvedValue({ pulled: 1 }),
      getSyncStatus: vi.fn().mockReturnValue({ knowledgeLayerOnline: true }),
      resolveConflict: vi.fn(),
    };
    const analyzer = {
      analyzeHook: vi.fn().mockReturnValue({ score: 80 }),
      analyzeCliffhanger: vi.fn().mockReturnValue({ score: 70 }),
      analyzeEmotionCraft: vi.fn().mockReturnValue({ score: 60 }),
      analyzeSuspense: vi.fn().mockReturnValue({ score: 50 }),
      generateQualityReport: vi.fn().mockReturnValue({ overall: 65 }),
    };

    const tools = registerNarrativeTools(engine as never, bridge as never, analyzer as never);

    await expect(
      tools['narrative.add_entity']({ type: 'character', name: 'Alice', description: 'Lead', aliases: ['Al'] }),
    ).resolves.toEqual({ id: 'entity-1', type: EntityType.CHARACTER, name: 'Alice' });
    await expect(
      tools['narrative.add_entity']({ type: 'unknown', name: 'Vault', description: 'Fallback' }),
    ).resolves.toEqual({ id: 'entity-1', type: EntityType.CONCEPT, name: 'Vault' });
    expect(engine.addEntity).toHaveBeenNthCalledWith(
      1,
      EntityType.CHARACTER,
      { name: 'Alice', description: 'Lead', aliases: ['Al'] },
    );
    expect(engine.addEntity).toHaveBeenNthCalledWith(
      2,
      EntityType.CONCEPT,
      { name: 'Vault', description: 'Fallback', aliases: undefined },
    );

    await expect(tools['narrative.get_entity']({ id: 'missing' })).resolves.toEqual({ error: 'Entity not found' });
    await expect(tools['narrative.query_entities']({ type: 'event', name: 'Alarm' })).resolves.toEqual([{ id: 'entity-1' }]);
    await expect(tools['narrative.query_entities']({ name: 'Fallback' })).resolves.toEqual([{ id: 'entity-1' }]);
    expect(engine.queryEntities).toHaveBeenCalledWith({ type: EntityType.EVENT, name: 'Alarm' });
    expect(engine.queryEntities).toHaveBeenCalledWith({ type: undefined, name: 'Fallback' });

    await expect(
      tools['narrative.add_relation']({ from: 'a', to: 'b', type: 'precedes', strength: 0.8 }),
    ).resolves.toEqual({ id: 'relation-1' });
    await expect(
      tools['narrative.add_relation']({ from: 'a', to: 'b', type: 'unknown' }),
    ).resolves.toEqual({ id: 'relation-1' });
    expect(engine.addRelation).toHaveBeenNthCalledWith(1, 'a', 'b', NarrativeRelationType.PRECEDES, 0.8);
    expect(engine.addRelation).toHaveBeenNthCalledWith(2, 'a', 'b', NarrativeRelationType.RELATED_TO, undefined);

    await expect(
      tools['narrative.add_memory']({ dimension: 'worldview', content: 'Rule', entityId: 'entity-1', importance: 0.7, chapter: 3 }),
    ).resolves.toEqual({ id: 'memory-1', dimension: DimensionType.WORLDVIEW });
    await expect(
      tools['narrative.add_memory']({ dimension: 'unknown', content: 'Fallback memory' }),
    ).resolves.toEqual({ id: 'memory-1', dimension: DimensionType.CONTEXT });
    expect(engine.addNarrativeMemory).toHaveBeenNthCalledWith(
      1,
      DimensionType.WORLDVIEW,
      'Rule',
      { entityId: 'entity-1', importance: 0.7, chapter: 3 },
    );
    expect(engine.addNarrativeMemory).toHaveBeenNthCalledWith(
      2,
      DimensionType.CONTEXT,
      'Fallback memory',
      { entityId: undefined, importance: undefined, chapter: undefined },
    );
  });

  it('forwards foreshadow, analyzer, sync, and writing-context operations', async () => {
    const engine = {
      addEntity: vi.fn(),
      getEntity: vi.fn().mockResolvedValue({ id: 'entity-1' }),
      queryEntities: vi.fn(),
      addRelation: vi.fn(),
      addNarrativeMemory: vi.fn(),
      plantForeshadow: vi.fn().mockResolvedValue('foreshadow-1'),
      getPendingForeshadows: vi.fn().mockResolvedValue([{ foreshadowId: 'f-1' }]),
      getWritingContext: vi.fn().mockResolvedValue({ chapter: 7, projectId: 'proj-1' }),
    };
    const bridge = {
      syncFromKnowledgeLayer: vi.fn().mockResolvedValue({ pulled: 2 }),
      getSyncStatus: vi.fn().mockReturnValue({ knowledgeLayerOnline: true }),
      resolveConflict: vi.fn(),
    };
    const analyzer = {
      analyzeHook: vi.fn().mockReturnValue({ score: 81 }),
      analyzeCliffhanger: vi.fn().mockReturnValue({ score: 72 }),
      analyzeEmotionCraft: vi.fn().mockReturnValue({ score: 63 }),
      analyzeSuspense: vi.fn().mockReturnValue({ score: 54 }),
      generateQualityReport: vi.fn().mockReturnValue({ overall: 68 }),
    };

    const tools = registerNarrativeTools(engine as never, bridge as never, analyzer as never);

    await expect(
      tools['narrative.plant_foreshadow']({ entityId: 'entity-1', hint: 'bell', chapter: 4, maxDistance: 2 }),
    ).resolves.toEqual({ id: 'foreshadow-1' });
    expect(engine.plantForeshadow).toHaveBeenCalledWith('entity-1', 'bell', 4, { maxDistance: 2 });

    await expect(tools['narrative.get_foreshadow_alerts']({ currentChapter: 8 })).resolves.toEqual([{ foreshadowId: 'f-1' }]);
    expect(engine.getPendingForeshadows).toHaveBeenCalledWith(8);

    await expect(tools['narrative.analyze_hook']({ text: 'hook' })).resolves.toEqual({ score: 81 });
    await expect(tools['narrative.analyze_cliffhanger']({ text: 'cliff' })).resolves.toEqual({ score: 72 });
    await expect(tools['narrative.analyze_emotion_craft']({ text: 'emotion' })).resolves.toEqual({ score: 63 });
    await expect(tools['narrative.analyze_suspense']({ text: 'suspense' })).resolves.toEqual({ score: 54 });
    await expect(tools['narrative.quality_report']({ text: 'report' })).resolves.toEqual({ overall: 68 });

    await expect(tools['nowledge.sync_from']()).resolves.toEqual({ pulled: 2 });
    await expect(tools['nowledge.bridge_status']()).resolves.toEqual({ knowledgeLayerOnline: true });
    await expect(
      tools['nowledge.resolve_conflict']({ index: 1, resolution: 'remote_wins' }),
    ).resolves.toEqual({ resolved: true });
    expect(bridge.resolveConflict).toHaveBeenCalledWith(1, 'remote_wins');

    await expect(
      tools['narrative.writing_context']({ chapter: 7, projectId: 'proj-1' }),
    ).resolves.toEqual({ chapter: 7, projectId: 'proj-1' });
    expect(engine.getWritingContext).toHaveBeenCalledWith(7, 'proj-1');
  });
});
