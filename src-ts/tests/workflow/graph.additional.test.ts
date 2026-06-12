import { describe, expect, it } from 'vitest';

import {
  distillationStateFromDict,
  distillationTemplateFromString,
  DistillationNode,
  DistillationTemplate,
  SimpleWorkflowGraph,
  shouldDistill,
} from '../../workflow/graph';

describe('workflow/graph additional coverage', () => {
  it('fills distillation defaults when template and fields are missing', () => {
    expect(distillationTemplateFromString('')).toBe(DistillationTemplate.FULL);

    expect(distillationStateFromDict({})).toEqual({
      sources: [],
      template: DistillationTemplate.FULL,
      result: {},
      scene_id: '',
      chapter_num: 0,
      is_completed: false,
      error: null,
    });
  });

  it('stops conditional routing when the router returns nothing', async () => {
    const graph = new SimpleWorkflowGraph();
    graph.addNode('start', async () => ({ step: 'start' }));
    graph.addConditionalEdge('start', () => undefined as unknown as string, {});
    graph.setEntryPoint('start');

    await expect(graph.compile().invoke({ seed: true } as never)).resolves.toEqual({
      seed: true,
      step: 'start',
    });
  });

  it('returns the original state when there is no draft content to distill', () => {
    const node = new DistillationNode(DistillationTemplate.SUMMARY);
    const state = { current_scene: { scene_id: 'unused' }, untouched: true };

    expect(node.process(state as never)).toBe(state);
  });

  it('fills distillation result defaults when no scene or error list is present', () => {
    const node = new DistillationNode(DistillationTemplate.FULL);
    (node as unknown as { _executeDistillation: () => Record<string, unknown> })._executeDistillation =
      () => ({});

    const processed = node.process({
      draft_content: 'draft text',
      current_scene: null,
    } as never) as Record<string, unknown>;

    expect(processed.distillation_result).toMatchObject({
      entities_count: 0,
      relations_count: 0,
      events_count: 0,
      entities: [],
      relations: [],
      events: [],
      template: DistillationTemplate.FULL,
      scene_id: '',
    });
    expect(processed.errors).toEqual([
      'Distillation completed: template=full',
    ]);
    expect(processed.distillation_state).toMatchObject({
      chapter_num: 0,
      is_completed: true,
      error: null,
    });
  });

  it('records warning errors even when the incoming state has no error list', () => {
    const node = new DistillationNode(DistillationTemplate.FULL);
    (node as unknown as { _executeDistillation: () => never })._executeDistillation = () => {
      throw 'boom';
    };

    const processed = node.process({
      draft_content: 'draft text',
      current_scene: null,
    } as never) as Record<string, unknown>;

    expect(processed.errors).toEqual([
      'Distillation warning: boom',
    ]);
    expect(processed.distillation_state).toMatchObject({
      error: 'boom',
      is_completed: false,
    });
  });

  it('respects missing config defaults, disabled distillation, and prior results', () => {
    expect(shouldDistill({ draft_content: 'draft' } as never)).toBe(true);
    expect(
      shouldDistill({
        draft_content: 'draft',
        config: { enable_distillation: false },
      } as never),
    ).toBe(false);
    expect(
      shouldDistill({
        draft_content: 'draft',
        distillation_result: { done: true },
        config: { enable_distillation: true },
      } as never),
    ).toBe(false);
  });
});
