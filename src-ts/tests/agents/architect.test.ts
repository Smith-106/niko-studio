import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArchitectAgent, lockTotalScore } from '../../agents/architect.js';
import type { IAgentLLMService } from '../../agents/base.js';

function createMockLlmService(): IAgentLLMService {
  return {
    generate: vi.fn(async () => 'ok'),
    generateJson: vi.fn(async () => ({
      title: '测试蓝图',
      genre: '悬疑',
      logline: '主角追查真相并完成转变。',
      lock_analysis: {
        L_score: 8,
        L_protagonist: '林岚',
        L_desire: '查出失踪案真相',
        L_pain_point: '害怕再次失去重要之人',
        L_unique_trait: '能够捕捉细微异常',
        O_score: 8,
        O_short_term: '找到第一条关键线索',
        O_long_term: '揭开案件全貌',
        O_measurable: true,
        C_score: 8,
        C_external: '凶手不断误导调查',
        C_internal: '林岚质疑自己的判断',
        C_escalation: '每一次逼近真相都会付出更高代价',
        K_score: 8,
        K_hooks: ['线索出现', '信任崩塌', '代价揭晓'],
        K_transformation: '从逃避责任到主动承担',
      },
      two_doors: {
        disturbance: { trigger: '失踪案发生' },
        door_1: { chapter: 8, event: '进入危险区域' },
        midpoint: { chapter: 15, event: '真相反转' },
        door_2: { chapter: 23, event: '失去退路' },
        climax: { chapter: 30, event: '最终对决' },
      },
      scene_cards: [
        {
          scene_id: 'CH01-SC01',
          chapter_num: 1,
          scene_num: 1,
          pov_character: '林岚',
          objective: '找到线索',
          conflict: '现场被清理',
          outcome: '+',
          structural_function: 'setup',
          emotional_arc: 'calm->unease',
          sensory_guidance: {},
          plot_beat: '线索出现',
          foreshadows_to_plant: ['异常细节'],
          foreshadows_to_harvest: [],
        },
      ],
      rhythm_analysis: {
        positive_scenes: 1,
        negative_scenes: 0,
        balance_score: 0.8,
        warnings: [],
      },
      target_chapters: 30,
      target_wordcount: 600000,
    })),
  };
}

describe('ArchitectAgent', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../services/distill-service.js');
  });

  it('supports legacy constructor style from AgentFactory', async () => {
    const llm = createMockLlmService();
    const agent = new ArchitectAgent(llm);

    const blueprint = await agent.plan('关于林岚调查失踪案的悬疑故事', '悬疑', 30, 600000);

    expect(blueprint.title).toBe('测试蓝图');
    expect(lockTotalScore(blueprint.lock_analysis)).toBe(32);
  });

  it('falls back to heuristic blueprint when llm is unavailable', async () => {
    const agent = new ArchitectAgent(null);

    const blueprint = await agent.plan('关于林岚调查失踪案的悬疑故事', '悬疑', 12, 120000);

    expect(blueprint.genre).toBe('悬疑');
    expect(blueprint.scene_cards.length).toBeGreaterThanOrEqual(3);
    expect(lockTotalScore(blueprint.lock_analysis)).toBeGreaterThanOrEqual(28);
    expect(blueprint.lock_analysis.L_protagonist).toContain('林岚');
  });

  it('uses default distillation service in planWithDistillation', async () => {
    const llm = createMockLlmService();
    const agent = new ArchitectAgent({ llmService: llm, enableDistillation: true });

    const [blueprint, distilled] = await agent.planWithDistillation(
      '关于林岚调查失踪案的悬疑故事',
      '悬疑',
      12,
      120000,
    );

    expect(blueprint.title).toBeTruthy();
    expect(distilled).toMatchObject({
      entities: [],
      relations: [],
    });
    expect(typeof distilled.summary).toBe('string');
    expect(agent.getDistillationPrompts('蓝图内容')).toHaveProperty('extract-facts');
  });

  it('bridges the default distillation service through the architect distill contract', async () => {
    const distillChapterMock = vi.fn().mockResolvedValue({
      entities: [{ id: 'c1', name: '林岚', type: 'character' }],
      relations: [],
      summary: 'distilled summary',
    });
    const applyToGraphMock = vi.fn();
    const getDistillationPromptMock = vi.fn((taskType: string) => `prompt:${taskType}`);

    vi.resetModules();
    vi.doMock('../../services/distill-service.js', () => ({
      DistillationService: class {
        distillChapter = distillChapterMock;
        applyToGraph = applyToGraphMock;
        getDistillationPrompt = getDistillationPromptMock;
      },
    }));

    const { ArchitectAgent: ArchitectAgentWithMock } = await import('../../agents/architect.js');

    const llm = createMockLlmService();
    const knowledgeLayer = {
      addEntity: vi.fn(),
      addRelation: vi.fn(),
    };
    const agent = new ArchitectAgentWithMock({
      llmService: llm,
      enableDistillation: true,
      knowledgeLayer,
    });

    const [blueprint, distilled] = await agent.planWithDistillation(
      '关于林岚调查失踪案的悬疑故事',
      '悬疑',
      12,
      120000,
    );

    expect(blueprint.title).toBeTruthy();
    expect(distilled).toMatchObject({
      entities: [{ id: 'c1', name: '林岚', type: 'character' }],
      summary: 'distilled summary',
    });
    expect(distillChapterMock).toHaveBeenCalledWith(expect.stringContaining('# Story Blueprint'));
    expect(applyToGraphMock).toHaveBeenCalledWith(knowledgeLayer, {
      entities: [{ id: 'c1', name: '林岚', type: 'character' }],
      relations: [],
      summary: 'distilled summary',
    });
    expect(agent.getDistillationPrompts('蓝图内容')).toEqual({
      'extract-facts': 'prompt:extract-facts',
      'extract-relationships': 'prompt:extract-relationships',
    });
  });
});
