import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ArchitectAgent,
  createArchitectChain,
  createArchitectNode,
  lockIsValid,
  lockTotalScore,
  type StoryBlueprint,
} from '../../agents/architect.js';
import type { IAgentLLMService } from '../../agents/base.js';

type MockLlmService = IAgentLLMService & {
  generate: ReturnType<typeof vi.fn>;
  generateJson: ReturnType<typeof vi.fn>;
};

function createValidBlueprint(overrides: Partial<StoryBlueprint> = {}): StoryBlueprint {
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
    ...overrides,
  };
}

function createInvalidBlueprint(): StoryBlueprint {
  return createValidBlueprint({
    lock_analysis: {
      L_score: 1,
      L_protagonist: '林岚',
      L_desire: '',
      L_pain_point: '痛点',
      L_unique_trait: '特质',
      O_score: 1,
      O_short_term: '短期目标',
      O_long_term: '长期目标',
      O_measurable: true,
      C_score: 1,
      C_external: '外部冲突',
      C_internal: '内部冲突',
      C_escalation: '升级路径',
      K_score: 1,
      K_hooks: [],
      K_transformation: '改变',
    },
    two_doors: {
      disturbance: { trigger: '开始' },
      door_1: {},
      midpoint: { chapter: 2, event: '中点' },
      door_2: {},
      climax: { chapter: 4, event: '高潮' },
    },
    scene_cards: [
      {
        scene_id: 'BROKEN-1',
        chapter_num: 1,
        scene_num: 1,
        pov_character: '林岚',
        objective: '开始调查',
        conflict: '',
        outcome: '+',
        structural_function: 'setup',
        emotional_arc: 'flat',
        sensory_guidance: {},
        plot_beat: '开端',
        foreshadows_to_plant: [],
        foreshadows_to_harvest: [],
      },
    ],
    rhythm_analysis: {
      positive_scenes: 1,
      negative_scenes: 0,
      balance_score: 0.2,
      warnings: ['scene count too low'],
    },
    target_chapters: 4,
    target_wordcount: 4000,
  });
}

function createMockLlmService(blueprint: StoryBlueprint = createValidBlueprint()): MockLlmService {
  return {
    generate: vi.fn(async () => 'ok'),
    generateJson: vi.fn(async () => blueprint),
  } as unknown as MockLlmService;
}

describe('ArchitectAgent additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../services/distill-service.js');
  });

  it('covers disabled thinking and distillation branches', async () => {
    const llm = createMockLlmService();
    const agent = new ArchitectAgent({
      llmService: llm,
      enableSequentialThinking: false,
      enableDistillation: false,
      knowledgeLayer: 'invalid-layer',
    });

    const blueprint = await agent.plan('关于林岚调查失踪案的悬疑故事', '悬疑', 12, 120000);
    const distilled = await agent.distillBlueprint(blueprint);

    expect(lockTotalScore(blueprint.lock_analysis)).toBe(32);
    expect(lockIsValid(blueprint.lock_analysis)).toBe(true);
    expect(
      lockIsValid({
        ...blueprint.lock_analysis,
        K_score: 3,
      }),
    ).toBe(false);
    expect(agent.getThinkingChain()).toBe('SequentialThinking not enabled');
    expect(agent.getThinkingData()).toEqual({});
    expect(distilled).toEqual({
      entities: [],
      relations: [],
      status: 'distillation_disabled',
    });
    expect(agent.getDistillationPrompts('蓝图内容')).toEqual({});
  });

  it('uses fallback planning warnings when heuristic scene count is lower than target chapters', async () => {
    const agent = new ArchitectAgent(null);

    const blueprint = await agent.plan('关于林岚调查失踪案的悬疑故事', '悬疑', 30, 120000);

    expect(blueprint.scene_cards.length).toBeLessThan(blueprint.target_chapters);
    expect(lockIsValid(blueprint.lock_analysis)).toBe(true);
  });

  it('falls back from generateStoryBlueprint when validation fails', async () => {
    const llm = createMockLlmService(createInvalidBlueprint());
    const agent = new ArchitectAgent({ llmService: llm });

    await expect(
      agent.plan('坏蓝图请求', '悬疑', 4, 4000),
    ).rejects.toThrow(/LOCK total score 4 < 28/);

    await expect(
      agent.plan('坏蓝图请求', '悬疑', 4, 4000),
    ).rejects.toThrow(/Protagonist lacks a clear desire/);

    const fallback = await agent.generateStoryBlueprint('坏蓝图请求', 4, '悬疑');

    expect(fallback).toMatchObject({
      request: '坏蓝图请求',
      chapter_count: 4,
      genre: '悬疑',
      fallback: true,
    });
  });

  it('routes distillation through an empty-object knowledge layer fallback', async () => {
    const distillChapterMock = vi.fn().mockResolvedValue({
      entities: [{ id: 'c1', name: '林岚', type: 'character' }],
      relations: [],
      summary: 'distilled summary',
    });
    const applyToGraphMock = vi.fn();

    vi.resetModules();
    vi.doMock('../../services/distill-service.js', () => ({
      DistillationService: class {
        distillChapter = distillChapterMock;
        applyToGraph = applyToGraphMock;
        getDistillationPrompt = vi.fn((taskType: string) => `prompt:${taskType}`);
      },
    }));

    const { ArchitectAgent: ArchitectAgentWithMock } = await import('../../agents/architect.js');
    const llm = createMockLlmService();
    const agent = new ArchitectAgentWithMock({
      llmService: llm,
      enableDistillation: true,
      knowledgeLayer: 'invalid-layer',
    });

    const [, distilled] = await agent.planWithDistillation(
      '关于林岚调查失踪案的悬疑故事',
      '悬疑',
      12,
      120000,
    );

    expect(distilled).toMatchObject({
      entities: [{ id: 'c1', name: '林岚', type: 'character' }],
      summary: 'distilled summary',
    });
    expect(applyToGraphMock).toHaveBeenCalledWith({}, {
      entities: [{ id: 'c1', name: '林岚', type: 'character' }],
      relations: [],
      summary: 'distilled summary',
    });
  });

  it('covers node and chain default fallbacks when state vars are missing', async () => {
    const nodeLlm = createMockLlmService();
    const node = createArchitectNode(nodeLlm);

    const nodeState = await node({});
    const nodePrompt = nodeLlm.generateJson.mock.calls[0]?.[0] as string;

    expect(nodeState).toMatchObject({
      lock_score: 32,
      scene_cards: expect.any(Array),
    });
    expect(nodePrompt).toContain('## Genre');
    expect(nodePrompt).toContain('fantasy');
    expect(nodePrompt).toContain('Target chapters: 30');
    expect(nodePrompt).toContain('Target word count: 600000');

    const chainLlm = createMockLlmService();
    const chain = createArchitectChain(chainLlm);
    const blueprint = await chain.invoke({});
    const chainPrompt = chainLlm.generateJson.mock.calls[0]?.[0] as string;

    expect(blueprint.title).toBe('测试蓝图');
    expect(chainPrompt).toContain('## Genre');
    expect(chainPrompt).toContain('fantasy');
    expect(chainPrompt).toContain('Target chapters: 30');
    expect(chainPrompt).toContain('Target word count: 600000');
  });

  it('falls back to the default protagonist and desire when the idea is blank or unmatched', () => {
    const agent = new ArchitectAgent({ llmService: createMockLlmService() }) as unknown as {
      extractProtagonist: (idea: string) => string;
      extractDesire: (idea: string) => string;
    };

    expect(agent.extractProtagonist('plain request without pattern')).toBe('主角');
    expect(agent.extractDesire('   ')).toBe('完成目标');
  });
});
