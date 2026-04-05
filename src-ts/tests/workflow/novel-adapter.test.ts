import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { NovelAdapter } from '../../workflow/adapters/novel-adapter.js';
import { createWorkflow } from '../../workflow/graph-factory.js';
import { SessionManager } from '../../workflow/session/session-manager.js';
import type { WritingState, CritiqueResult } from '../../workflow/novel-state.js';

function createCritiqueResult(
  decision: CritiqueResult['decision'],
  totalScore: number,
  cScore: number,
): Partial<WritingState> {
  return {
    critique_result: {
      decision,
      total_score: totalScore,
      decision_reason: decision === 'APPROVED' ? 'ready' : 'needs work',
      actionable_feedback: decision === 'APPROVED' ? '' : 'tighten tension',
      revision_instructions: [],
      lock_analysis: {
        L: { score: 8 },
        O: { score: 8 },
        C: { score: cScore },
        K: { score: 8 },
      },
    },
    revision_count: decision === 'APPROVED' ? 1 : 2,
    revision_history: [],
    checkpoint_trace: [],
    feedback_artifacts: [],
    last_checkpoint_id: `checkpoint-${decision?.toLowerCase() ?? 'unknown'}`,
    feedback_context: decision === 'APPROVED' ? '' : 'tighten tension',
    revision_instructions: [],
  };
}

describe('NovelAdapter', () => {
  beforeEach(() => {
    vi.spyOn(SessionManager.prototype, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a novel initial state compatible with executePipeline', () => {
    const adapter = new NovelAdapter({ workflow_level: 4 });
    const state = adapter.createInitialState('写一个悬疑故事', {
      metadata: { source: 'test' },
      resume_decision: { plan_id: 'plan-1' },
    }) as WritingState & { user_request?: string; domain?: string };

    expect(state.user_idea).toBe('写一个悬疑故事');
    expect(state.user_request).toBe('写一个悬疑故事');
    expect(state.domain).toBe('novel');
    expect(state.workflow_level).toBe(4);
    expect(state.metadata).toMatchObject({
      source: 'test',
      resume_decision: { plan_id: 'plan-1' },
    });
  });

  it('builds architect and writer outputs from the current story state', async () => {
    const adapter = new NovelAdapter({});
    const initial = adapter.createInitialState('关于林岚在废弃剧院追查失踪案的悬疑故事', {
      genre: '悬疑',
    }) as WritingState;

    const architect = await adapter.architectNode(initial);
    const withPlan = { ...initial, ...architect } as WritingState;
    const writer = await adapter.writerNode(withPlan);

    expect(architect.scene_cards?.[0]?.scene_id).toBe('CH01-SC01');
    expect(architect.story_blueprint).toMatchObject({
      genre: '悬疑',
    });
    expect(writer.draft_content).toContain('林岚');
    expect(writer.draft_content).toContain('废弃剧院');
    expect(writer.draft_version).toBe(1);
  });

  it('uses heuristic quality evaluation in criticNode', async () => {
    const adapter = new NovelAdapter({});
    const state = adapter.createInitialState('关于林岚在废弃剧院追查失踪案的悬疑故事') as WritingState;
    const withDraft: WritingState = {
      ...state,
      current_scene: {
        scene_id: 'CH01-SC01',
        objective: 'find the missing clue',
        conflict: '线索指向错误的人',
        outcome: 'hook',
      },
      draft_content: '她走进剧院。突然。她看见门。突然。她继续向前。突然。',
      draft_version: 1,
    };

    const critique = await adapter.criticNode(withDraft);

    expect(critique.critique_result?.total_score).toBeGreaterThanOrEqual(0);
    expect(['APPROVED', 'REVISE', 'REWRITE']).toContain(
      critique.critique_result?.decision ?? '',
    );
    expect(Array.isArray(critique.revision_instructions)).toBe(true);
    expect(critique.feedback_context).toBeTruthy();
  });

  it('loops writer -> critic until approval and distills on first draft', async () => {
    const adapter = new NovelAdapter({
      pass_score: 90,
      min_c_score: 7,
      max_revisions: 3,
      enable_distillation: true,
    });
    const writerSpy = vi.spyOn(adapter, 'writerNode');
    const criticSpy = vi.spyOn(adapter, 'criticNode')
      .mockResolvedValueOnce(createCritiqueResult('REVISE', 70, 6))
      .mockResolvedValueOnce(createCritiqueResult('APPROVED', 99, 8));

    const state = adapter.createInitialState('写一个悬疑故事') as WritingState;
    const result = await adapter.executePipeline(state);

    expect(writerSpy).toHaveBeenCalledTimes(2);
    expect(criticSpy).toHaveBeenCalledTimes(2);
    expect(result.distillation_result).toMatchObject({ template: 'full' });
    expect(result.final_content).toContain('[Draft v2]');
    expect(result.final_score).toBe(99);
    expect(result.requires_human_intervention).toBe(false);
  });

  it('routes to human review when critic requires it', async () => {
    const adapter = new NovelAdapter({
      pass_score: 95,
      human_review_score: 85,
      max_revisions: 1,
    });
    vi.spyOn(adapter, 'criticNode').mockResolvedValueOnce(
      createCritiqueResult('REWRITE', 40, 4),
    );

    const state = adapter.createInitialState('写一个悬疑故事') as WritingState;
    const result = await adapter.executePipeline(state);

    expect(result.requires_human_intervention).toBe(true);
    expect(result.metadata).toMatchObject({
      human_review_status: 'review_required',
    });
    expect(result.final_score).toBe(40);
  });

  it('graph compile invoke delegates to the novel pipeline', async () => {
    const adapter = new NovelAdapter({ enable_distillation: true });
    const pipelineSpy = vi.spyOn(adapter, 'executePipeline');
    vi.spyOn(adapter, 'criticNode').mockResolvedValueOnce(
      createCritiqueResult('APPROVED', 99, 8),
    );
    const graph = adapter.createGraph();
    const compiled = graph.compile();

    const state = adapter.createInitialState('解释这个故事设定') as WritingState;
    const result = await compiled.invoke(state as Record<string, unknown>);

    expect(pipelineSpy).toHaveBeenCalledTimes(1);
    expect((result as WritingState).final_content).toContain('[Draft v1]');
  });
});

describe('createWorkflow integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an executable novel graph with aligned initial state', async () => {
    vi.spyOn(SessionManager.prototype, 'write').mockReturnValue(true);

    const { graph, initialState } = createWorkflow('novel', '写一个悬疑故事', 3, {
      metadata: { source: 'workflow-test' },
    });

    expect(initialState['user_idea']).toBe('写一个悬疑故事');
    expect(initialState['user_request']).toBe('写一个悬疑故事');
    expect(initialState['workflow_level']).toBe(3);

    const compiled = (graph as { compile(): { invoke(state: Record<string, unknown>): Promise<Record<string, unknown>> } }).compile();
    const result = await compiled.invoke(initialState);

    expect(result['final_content']).toBeTruthy();
    expect(result['final_score']).toBeDefined();
  });
});
