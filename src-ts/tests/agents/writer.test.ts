import { describe, expect, it, vi } from 'vitest';

import {
  createWriterChain,
  createWriterInput,
  createWriterNode,
  WriterAgent,
} from '../../agents/writer';
import { SkillRouter } from '../../agents/skill-router';

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

  it('loads full skill-pack content into the writer system prompt', async () => {
    const llmService = createLlmService();
    const writer = new WriterAgent({
      llmService: llmService as never,
      skillRouter: new SkillRouter(),
      skillLoader: {
        loadFull: vi.fn().mockReturnValue({
          name: 'fictional-dream',
          meta: {
            name: '虚构梦境构建技能',
            description: '四层情感递进系统',
            tags: [],
            triggers: [],
          },
          content: '# 虚构梦境构建技能\n\n## 第一层：同情 (Sympathy)\n通过具体困境建立代入。',
          path: '/tmp/skills/fictional-dream/SKILL.md',
          techniques: ['第一层：同情 (Sympathy)'],
        }),
      } as never,
    });

    await writer.write(createWriterInput({
      scene_id: 'scene-skill-1',
      objective: '建立角色连接',
      conflict: '压抑的秘密逐渐浮现',
      outcome: '留下情感钩子',
      emotional_arc: 'distance->connection',
      world_settings: {
        recommended_skills: ['fictional-dream'],
      },
    }));

    expect(llmService.generate).toHaveBeenCalled();
    const firstCallOptions = llmService.generate.mock.calls[0]?.[1] as { systemPrompt: string };
    expect(firstCallOptions.systemPrompt).toContain('## Skill Guidance');
    expect(firstCallOptions.systemPrompt).toContain('### 虚构梦境构建技能');
    expect(firstCallOptions.systemPrompt).toContain('## 第一层：同情 (Sympathy)');
    expect(firstCallOptions.systemPrompt).toContain('通过具体困境建立代入。');
  });

  it('records warnings when a requested skill-pack cannot be loaded', async () => {
    const llmService = createLlmService();
    const writer = new WriterAgent({
      llmService: llmService as never,
      skillRouter: new SkillRouter(),
      skillLoader: {
        loadFull: vi.fn().mockImplementation(() => {
          throw new Error('Skill missing');
        }),
      } as never,
    });

    const output = await writer.write(createWriterInput({
      scene_id: 'scene-skill-2',
      objective: '制造压迫感',
      conflict: '找不到可依赖的线索',
      outcome: '悬念加深',
      world_settings: {
        recommended_skills: ['missing-skill'],
      },
    }));

    expect(output.metadata).toMatchObject({
      warnings: [expect.stringContaining('skill_load_failed: missing-skill: Error: Skill missing')],
    });
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
