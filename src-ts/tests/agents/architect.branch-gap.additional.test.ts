import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArchitectAgent, type StoryBlueprint } from '../../agents/architect.js';
import type { IAgentLLMService } from '../../agents/base.js';

function createValidBlueprint(): StoryBlueprint {
  return {
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
  };
}

function createMockLlmService(): IAgentLLMService {
  return {
    generate: vi.fn(async () => 'ok'),
    generateJson: vi.fn(async () => createValidBlueprint()),
  };
}

describe('ArchitectAgent branch gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../services/distill-service.js');
  });

  it('covers object-option llm fallback, enabled thinking accessors, and non-suspense heuristic visuals', async () => {
    const agent = new ArchitectAgent({
      enableSequentialThinking: true,
      thinkingMaxDepth: 12,
    } as any);

    const blueprint = await agent.plan(
      '关于艾拉在遗迹中寻找真相的科幻故事',
      '科幻',
      6,
      6000,
    );

    expect(blueprint.scene_cards[0]?.sensory_guidance).toMatchObject({
      visual: '明确场景锚点',
    });
    expect(agent.getThinkingChain()).not.toBe('SequentialThinking not enabled');
    expect(agent.getThinkingData()).not.toEqual({});
  });

  it('falls back from non-Error llm failures during planning', async () => {
    const llm = {
      generate: vi.fn(async () => 'ok'),
      generateJson: vi.fn(async () => {
        throw 'llm string failure';
      }),
    } as unknown as IAgentLLMService;
    const agent = new ArchitectAgent({ llmService: llm });

    const blueprint = await agent.plan(
      '关于林岚调查失踪案的悬疑故事',
      '悬疑',
      8,
      80000,
    );

    expect(blueprint.title).toContain('林岚');
    expect(blueprint.lock_analysis.L_protagonist).toContain('林岚');
  });

  it('falls back from non-Error plan failures in generateStoryBlueprint', async () => {
    const agent = new ArchitectAgent({ llmService: createMockLlmService() });
    vi.spyOn(agent, 'plan').mockRejectedValue('plan string failure');

    const fallback = await agent.generateStoryBlueprint('坏蓝图请求', 4, '悬疑');

    expect(fallback).toMatchObject({
      request: '坏蓝图请求',
      chapter_count: 4,
      genre: '悬疑',
      fallback: true,
    });
  });

  it('counts non-array distillation payloads as zero entities and relations when thinking is enabled', async () => {
    const distillChapterMock = vi.fn().mockResolvedValue({
      entities: { id: 'entity-object' },
      relations: 'broken-relations',
      summary: 'distilled summary',
    });

    vi.doMock('../../services/distill-service.js', () => ({
      DistillationService: class {
        distillChapter = distillChapterMock;
        applyToGraph = vi.fn();
        getDistillationPrompt = vi.fn((taskType: string) => `prompt:${taskType}`);
      },
    }));

    const { ArchitectAgent: ArchitectAgentWithMock } = await import('../../agents/architect.js');
    const agent = new ArchitectAgentWithMock({
      llmService: createMockLlmService(),
      enableSequentialThinking: true,
      enableDistillation: true,
    });

    const [, distilled] = await agent.planWithDistillation(
      '关于林岚调查失踪案的悬疑故事',
      '悬疑',
      12,
      120000,
    );

    expect(distilled.summary).toBe('distilled summary');
    expect(agent.getThinkingChain()).toContain('Knowledge distillation complete: 0 entities, 0 relations');
  });

  it('falls back to default protagonist and desire for nullish private inputs', () => {
    const agent = new ArchitectAgent({ llmService: createMockLlmService() }) as any;

    expect(agent.extractProtagonist(undefined)).toBe('主角');
    expect(agent.extractDesire(undefined)).toBe('完成目标');
  });
});
