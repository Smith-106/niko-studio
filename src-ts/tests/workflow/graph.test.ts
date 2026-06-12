import { describe, expect, it, vi } from 'vitest';

import {
  createDistillationNode,
  distillationStateFromDict,
  distillationStateToDict,
  distillationTemplateFromString,
  DistillationTemplate,
  DistillationNode,
  SimpleWorkflowGraph,
  shouldDistill,
  warnLegacyEntrypoint,
} from '../../workflow/graph';

describe('workflow/graph', () => {
  it('normalizes distillation template aliases and roundtrips distillation state', () => {
    expect(distillationTemplateFromString('entity')).toBe(
      DistillationTemplate.ENTITY_EXTRACTION,
    );
    expect(distillationTemplateFromString('plot')).toBe(
      DistillationTemplate.PLOT_STRUCTURE,
    );
    expect(distillationTemplateFromString('unknown')).toBe(DistillationTemplate.FULL);

    const state = {
      sources: ['draft'],
      template: DistillationTemplate.SUMMARY,
      result: { summary: 'ok' },
      scene_id: 'scene-1',
      chapter_num: 2,
      is_completed: true,
      error: null,
    };

    expect(distillationStateFromDict(distillationStateToDict(state))).toEqual(state);
  });

  it('runs a simple workflow graph sequentially and respects conditional routing', async () => {
    const graph = new SimpleWorkflowGraph();
    graph.addNode('start', async () => ({ step: 'start', route: 'middle' }));
    graph.addNode('middle', async () => ({ step: 'middle', done: true }));
    graph.addNode('alt', async () => ({ step: 'alt' }));
    graph.addConditionalEdge('start', (state) => String((state as Record<string, unknown>).route));
    graph.addEdge('middle', '');
    graph.setEntryPoint('start');

    const result = await graph.compile().invoke({} as never);

    expect((result as Record<string, unknown>).step).toBe('middle');
    expect((result as Record<string, unknown>).done).toBe(true);
  });

  it('handles direct edges, cycles, and missing nodes without throwing', async () => {
    const direct = new SimpleWorkflowGraph();
    direct.addNode('start', async () => ({ step: 'start' }));
    direct.addNode('end', async () => ({ done: true }));
    direct.addEdge('start', 'end');
    direct.setEntryPoint('start');

    await expect(direct.compile().invoke({} as never)).resolves.toMatchObject({
      step: 'start',
      done: true,
    });

    const cycle = new SimpleWorkflowGraph();
    cycle.addNode('loop', async () => ({ looped: true }));
    cycle.addEdge('loop', 'loop');
    cycle.setEntryPoint('loop');

    await expect(cycle.compile().invoke({} as never)).resolves.toMatchObject({
      looped: true,
    });

    const missing = new SimpleWorkflowGraph();
    missing.setEntryPoint('missing');

    await expect(missing.compile().invoke({ untouched: true } as never)).resolves.toEqual({
      untouched: true,
    });
  });

  it('processes distillation results and helper functions over draft state', () => {
    const node = new DistillationNode(DistillationTemplate.SUMMARY);
    const processed = node.process({
      draft_content: 'draft text',
      current_scene: {
        scene_id: 'scene-2',
        chapter_num: 3,
      },
      errors: [],
    } as never) as Record<string, unknown>;

    expect(processed.distillation_result).toMatchObject({
      template: DistillationTemplate.SUMMARY,
      scene_id: 'scene-2',
      entities_count: 0,
      relations_count: 0,
      events_count: 0,
    });
    expect((processed.distillation_state as Record<string, unknown>).is_completed).toBe(
      true,
    );

    expect(
      shouldDistill({
        draft_content: 'draft',
        config: { enable_distillation: true },
      } as never),
    ).toBe(true);
    expect(
      shouldDistill({
        draft_content: '',
        config: { enable_distillation: true },
      } as never),
    ).toBe(false);

    const created = createDistillationNode('character');
    const createdResult = created.process({
      draft_content: 'draft',
      current_scene: {},
      errors: [],
    } as never) as Record<string, unknown>;

    expect(createdResult.distillation_result).toMatchObject({
      template: DistillationTemplate.CHARACTER_ARC,
    });
  });

  it('records distillation warnings when distillation execution fails', () => {
    const node = new DistillationNode(DistillationTemplate.FULL);
    (node as unknown as { _executeDistillation: () => never })._executeDistillation =
      () => {
        throw new Error('distill failed');
      };

    const processed = node.process({
      draft_content: 'draft text',
      current_scene: {
        scene_id: 'scene-warning',
        chapter_num: 4,
      },
      errors: ['existing'],
    } as never) as Record<string, unknown>;

    expect(processed.errors).toEqual([
      'existing',
      expect.stringContaining('Distillation warning: Error: distill failed'),
    ]);
    expect(processed.distillation_state).toMatchObject({
      scene_id: 'scene-warning',
      chapter_num: 4,
      is_completed: false,
      error: 'Error: distill failed',
    });
  });

  it('emits the legacy warning message when legacy graph entrypoints are used', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    warnLegacyEntrypoint('legacy-test');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('source=legacy-test'),
    );

    warnSpy.mockRestore();
  });
});
