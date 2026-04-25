import { describe, expect, it, vi } from 'vitest';

import {
  createWriterChain,
  createWriterInput,
  createWriterNode,
  WriterAgent,
} from '../../agents/writer';

function createLlmService() {
  return {
    generate: vi.fn().mockResolvedValue('生成的文本内容'),
  };
}

describe('WriterAgent', () => {
  it('normalizes writer input from partial fields and scene_card fallback', () => {
    const input = createWriterInput({
      scene_card: {
        scene_id: 'scene-2',
        chapter_num: 3,
        pov_character: '林岚',
        objective: '逃离现场',
        conflict: '被追兵包围',
        outcome: '暂时脱险',
        plot_beat: 'midpoint',
        emotional_arc: 'fear->resolve',
        sensory_guidance: { visual: '雾气' },
      },
      foreshadows_to_plant: ['旧怀表'],
    });

    expect(input).toMatchObject({
      scene_id: 'scene-2',
      chapter_num: 3,
      pov_character: '林岚',
      objective: '逃离现场',
      conflict: '被追兵包围',
      outcome: '暂时脱险',
      plot_beat: 'midpoint',
      emotional_arc: 'fear->resolve',
      word_target: 2000,
      foreshadows_to_plant: ['旧怀表'],
    });
  });

  it('returns empty retrieval context when knowledge retrieval is disabled', async () => {
    const writer = new WriterAgent({
      llmService: createLlmService() as never,
      enableKnowledgeRetrieval: false,
    });

    const retrieved = await writer.retrieveContext('林岚', ['character'], 5);

    expect(retrieved).toEqual({
      entities: [],
      relations: [],
      memories: [],
    });
  });

  it('writes with context and attaches warnings or knowledge summary metadata', async () => {
    const llmService = createLlmService();
    const writer = new WriterAgent({
      llmService: llmService as never,
      enableKnowledgeRetrieval: false,
    });

    const output = await writer.writeWithKnowledge(
      createWriterInput({
        scene_id: 'scene-3',
        objective: '潜入宅邸',
        conflict: '守卫巡逻',
        outcome: '顺利潜入',
      }),
      '潜入宅邸需要注意哪些人物和地点',
    );

    expect(llmService.generate).toHaveBeenCalled();
    expect(output.content.length).toBeGreaterThan(0);
    expect(output.metadata).toMatchObject({
      knowledge_retrieved: {
        entities_count: 0,
        relations_count: 0,
        memories_count: 0,
      },
    });
  });

  it('attaches retrieval packets when workspace-backed knowledge retrieval is enabled', async () => {
    const llmService = createLlmService();
    const writer = new WriterAgent({
      llmService: llmService as never,
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
        },
      } as never,
      knowledgeLayer: {
        search_entities: vi.fn().mockResolvedValue([
          {
            authority: {
              workspaceId: 'atlas-workspace',
              scopeAuthority: 'workspace',
              canonAuthority: 'canon-page',
              projectionAuthority: 'derived',
              promotion: 'manual',
              promotedFrom: 'manual',
              status: 'active',
            },
            description: 'A detective who knows the dock ledger by heart.',
            filePath: 'characters/aster.md',
            id: 'char-aster',
            name: 'Aster',
            origin: 'wiki-canon',
            pageId: 'page-aster',
            score: 0.92,
            slug: 'characters/aster',
            type: 'character',
          },
        ]),
        get_related_entities: vi.fn().mockResolvedValue([
          {
            canonAuthority: 'canon-page',
            id: 'rel-1',
            origin: 'wiki-projection-graph',
            pageId: 'page-aster',
            projectionAuthority: 'derived',
            projectionId: 'graph:page-aster',
            source: 'Aster',
            sourceId: 'char-aster',
            target: 'Old Dock',
            targetId: 'loc-old-dock',
            type: 'visits',
            workspaceId: 'atlas-workspace',
          },
        ]),
        search_memories: vi.fn().mockResolvedValue([
          {
            authority: {
              workspaceId: 'atlas-workspace',
              scopeAuthority: 'workspace',
              canonAuthority: 'canon-page',
              projectionAuthority: 'derived',
              promotion: 'manual',
              promotedFrom: 'manual',
              status: 'active',
            },
            content: 'Aster once lost a witness at Old Dock during a midnight handoff.',
            id: 'memory-1',
            origin: 'wiki-canon',
            pageId: 'page-aster',
            score: 0.81,
            title: 'Aster Memory',
          },
        ]),
      },
    });

    const output = await writer.writeWithKnowledge(
      createWriterInput({
        scene_id: 'scene-6',
        pov_character: 'Aster',
        objective: 'Find the ledger',
        conflict: 'Evade the dock watch',
        outcome: 'Reach the archive room',
      }),
      false,
    );

    expect(output.metadata).toMatchObject({
      knowledge_retrieved: {
        entities_count: 1,
        relations_count: 1,
        memories_count: 1,
      },
      retrieval_packet: {
        schemaVersion: '2026-04-25',
        query: 'Aster Find the ledger Evade the dock watch',
        workspaceId: 'atlas-workspace',
        counts: {
          entities: 1,
          relations: 1,
          memories: 1,
          total: 3,
        },
      },
    });
    expect((output.metadata?.['retrieval_packet'] as { packets: Array<Record<string, unknown>> }).packets)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity',
          title: 'Aster',
          pageId: 'page-aster',
        }),
        expect.objectContaining({
          kind: 'relation',
          title: 'Aster visits Old Dock',
          pageId: 'page-aster',
        }),
        expect.objectContaining({
          kind: 'memory',
          title: 'Aster Memory',
          pageId: 'page-aster',
        }),
      ]));
  });

  it('revises drafts according to feedback and records forbidden words found', async () => {
    const llmService = {
      generate: vi.fn().mockResolvedValue('She suddenly looked up and unexpectedly smiled.'),
    };
    const writer = new WriterAgent({
      llmService: llmService as never,
      enableKnowledgeRetrieval: false,
    });

    const revised = await writer.revise(
      '原始草稿',
      {
        issues: ['冲突不足'],
        suggestions: ['提高压迫感'],
        dimension_scores: {
          dialogue_quality: 6,
        },
      },
      true,
      {
        humanization_preset: 'human_writing',
      },
    );

    expect(llmService.generate).toHaveBeenCalled();
    expect(revised.content).toContain('suddenly');
    expect(revised.forbidden_words_found).toContain('suddenly');
  });

  it('exposes writer node and chain helpers over the normalized contract', async () => {
    const llmService = createLlmService();
    const node = createWriterNode(llmService as never);
    const nodeResult = await node({
      current_scene_card: {
        scene_id: 'scene-4',
        objective: '寻找线索',
        conflict: '线索被误导',
        outcome: '获得碎片信息',
      },
      character_profiles: [],
      world_settings: {},
    });

    expect(nodeResult.writer_self_check).toBeTruthy();
    expect(nodeResult.draft_content).toContain('生成的文本内容');

    const chain = createWriterChain(llmService as never);
    const chainResult = await chain.invoke(
      JSON.stringify({
        scene_id: 'scene-5',
        objective: '逼近真相',
        conflict: '误导线索',
        outcome: '发现新方向',
      }),
      1200,
    );

    expect(chainResult).toContain('生成的文本内容');
  });
});
