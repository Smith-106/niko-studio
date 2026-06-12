import { describe, expect, it } from 'vitest';

import type { BaseState } from '../../workflow/state';
import { AdapterRegistry, BaseDomainAdapter } from '../../workflow/adapters/base-adapter';
import {
  createWorkflow,
  WorkflowFactory,
} from '../../workflow/graph-factory';
import { WorkflowLevel } from '../../workflow/types';

class TestAdapter extends BaseDomainAdapter {
  getDomainType(): string {
    return 'test-domain';
  }

  getStateClass(): new (...args: unknown[]) => BaseState {
    return Object as never;
  }

  createInitialState(userRequest: string, extra?: Record<string, unknown>): BaseState {
    return {
      user_request: userRequest,
      user_idea: userRequest,
      workflow_level: this.config.workflow_level ?? null,
      metadata: extra?.metadata ?? null,
      resume_decision: extra?.resume_decision ?? null,
    } as BaseState;
  }

  evaluate(): never {
    throw new Error('not used');
  }

  createGraph() {
    const snapshot = { ...this.config };
    return {
      compile() {
        return {
          async invoke(state: BaseState) {
            return {
              ...state,
              graph_domain: 'test-domain',
              graph_config: snapshot,
            } as BaseState;
          },
        };
      },
    };
  }
}

const TEST_DOMAIN = 'phase3-graph-factory-test-domain';

WorkflowFactory.registerAdapter(TEST_DOMAIN, TestAdapter, ['testing', 'phase3']);

describe('workflow/graph-factory', () => {
  it('registers adapters and exposes domains and capabilities', () => {
    const adapter = WorkflowFactory.createAdapter(TEST_DOMAIN, {
      custom_flag: 'yes',
    });

    expect(adapter).toBeInstanceOf(TestAdapter);
    expect(WorkflowFactory.listDomains()).toContain(TEST_DOMAIN);
    expect(WorkflowFactory.listDomainsByCapability('phase3')).toContain(TEST_DOMAIN);
    expect(WorkflowFactory.getAdapterCapabilities(TEST_DOMAIN)).toEqual([
      'phase3',
      'testing',
    ]);
  });

  it('throws a descriptive error for unknown domains and returns level descriptions', () => {
    expect(() =>
      WorkflowFactory.create('missing-domain', 3),
    ).toThrow("Unknown domain: 'missing-domain'");

    expect(WorkflowFactory.getLevelDescription(4)).toMatchObject({
      name: 'Brainstorm',
    });
    expect(WorkflowFactory.getLevelDescription(999)).toEqual({});
  });

  it('creates graphs with merged workflow-level config in WorkflowFactory.create', async () => {
    const graph = WorkflowFactory.create(TEST_DOMAIN, 'l5', {
      custom_flag: 'yes',
    }) as {
      compile(): {
        invoke(state: BaseState): Promise<BaseState>;
      };
    };

    const result = await graph.compile().invoke({
      workflow_level: 0,
    } as BaseState);

    expect((result as Record<string, unknown>).graph_config).toMatchObject({
      workflow_level: 5,
      custom_flag: 'yes',
    });
  });

  it('creates initial state with merged metadata and resume decisions', () => {
    const { graph, initialState } = createWorkflow(
      TEST_DOMAIN,
      '继续当前会话',
      4,
      {
        metadata: { source: 'graph-factory-test' },
        tool: 'gemini',
        resume_ids: ['session-1'],
        custom_id: 'custom-session',
      },
    );

    expect(graph).toBeTruthy();
    expect(initialState.user_request).toBe('继续当前会话');
    expect(initialState.workflow_level).toBe(4);
    expect((initialState.metadata as Record<string, unknown>).source).toBe(
      'graph-factory-test',
    );
    expect((initialState.metadata as Record<string, unknown>).resume_decision).toBeTruthy();
    expect(initialState.resume_decision).toBeTruthy();
  });

  it('falls back to sane defaults when createWorkflow receives sparse config', () => {
    const { initialState } = createWorkflow(TEST_DOMAIN, 'plain request');

    expect(initialState.user_request).toBe('plain request');
    expect(initialState.workflow_level).toBe(3);
    expect(initialState.resume_decision).toBeNull();
    expect(initialState.metadata).toEqual({});
  });

  it('throws a descriptive error from createWorkflow for unknown domains', () => {
    expect(() => createWorkflow('missing-domain', 'request', 3)).toThrow(
      'Unknown domain: missing-domain',
    );
  });

  it('preserves existing resume metadata and ignores non-object metadata inputs', () => {
    const withExistingResume = createWorkflow(TEST_DOMAIN, 'resume request', 3, {
      metadata: {
        resume_decision: { mode: 'preserved' },
        source: 'existing',
      },
      resume_ids: ['session-2'],
      tool: 'codex',
    });

    expect(withExistingResume.initialState.resume_decision).toBeTruthy();
    expect(withExistingResume.initialState.metadata).toMatchObject({
      source: 'existing',
      resume_decision: { mode: 'preserved' },
    });

    const withInvalidMetadata = createWorkflow(TEST_DOMAIN, 'invalid metadata', 3, {
      metadata: 'not-an-object',
      resume_ids: ['session-3'],
      tool: 'codex',
    });

    expect(withInvalidMetadata.initialState.metadata).toMatchObject({
      resume_decision: expect.any(Object),
    });
  });

  it('treats null metadata as empty metadata before merging resume decisions', () => {
    const { initialState } = createWorkflow(TEST_DOMAIN, 'null metadata', 3, {
      metadata: null,
      resume_ids: ['session-null'],
      tool: 'codex',
    });

    expect(initialState.metadata).toMatchObject({
      resume_decision: expect.any(Object),
    });
    expect((initialState.metadata as Record<string, unknown>)['source']).toBeUndefined();
  });

  it('covers defensive workflow-level and configured-adapter fallbacks', async () => {
    const invalidWorkflowLevel = { unsupported: true } as unknown as number;
    const fallbackLevelGraph = WorkflowFactory.create(TEST_DOMAIN, invalidWorkflowLevel) as {
      compile(): {
        invoke(state: BaseState): Promise<BaseState>;
      };
    };

    const fallbackLevelResult = await fallbackLevelGraph.compile().invoke({
      workflow_level: 0,
    } as BaseState);
    expect((fallbackLevelResult as Record<string, unknown>).graph_config).toMatchObject({
      workflow_level: WorkflowLevel.L3_STANDARD,
    });

    const adapter = WorkflowFactory.createAdapter(TEST_DOMAIN, null);
    expect(adapter).toBeInstanceOf(TestAdapter);

    const originalCreateAdapter = AdapterRegistry.createAdapter;
    let callCount = 0;
    AdapterRegistry.createAdapter = ((domain: string, config?: Record<string, unknown> | null) => {
      callCount += 1;
      if (callCount === 1) {
        return originalCreateAdapter.call(AdapterRegistry, domain, config);
      }
      return null;
    }) as typeof AdapterRegistry.createAdapter;

    try {
      const graph = WorkflowFactory.create(TEST_DOMAIN, WorkflowLevel.L3_STANDARD) as {
        compile(): {
          invoke(state: BaseState): Promise<BaseState>;
        };
      };

      const result = await graph.compile().invoke({ workflow_level: 0 } as BaseState);
      expect((result as Record<string, unknown>).graph_config).toEqual({});
    } finally {
      AdapterRegistry.createAdapter = originalCreateAdapter;
    }
  });

  it('registers adapters without capabilities when none are provided', () => {
    const domain = 'phase3-graph-factory-no-capabilities';
    WorkflowFactory.registerAdapter(domain, TestAdapter, null);

    expect(WorkflowFactory.getAdapterCapabilities(domain)).toEqual([]);
    expect(WorkflowFactory.listDomainsByCapability('')).toEqual([]);
  });
});
