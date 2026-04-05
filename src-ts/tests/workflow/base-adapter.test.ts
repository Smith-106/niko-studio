import { describe, expect, it } from 'vitest';

import type { BaseState } from '../../workflow/state';
import {
  AdapterRegistry,
  BaseDomainAdapter,
  type BaseEvaluationResult,
  type IWorkflowGraph,
} from '../../workflow/adapters/base-adapter';

class TestAdapter extends BaseDomainAdapter {
  getDomainType(): string {
    return 'phase3-base-adapter-test';
  }

  getStateClass(): new (...args: unknown[]) => BaseState {
    return Object as never;
  }

  createInitialState(userRequest: string, extra?: Record<string, unknown>): BaseState {
    return {
      user_request: userRequest,
      metadata: extra ?? {},
      max_revisions: 3,
    };
  }

  evaluate(): BaseEvaluationResult {
    return {
      decision: 'APPROVED',
      decision_reason: 'ok',
      total_score: 100,
      dimension_scores: {},
      feedback: '',
      revision_instructions: [],
    };
  }

  createGraph(): IWorkflowGraph {
    return {
      addNode() {},
      addEdge() {},
      addConditionalEdge() {},
      compile() {
        return {
          async invoke(state: BaseState) {
            return state;
          },
        };
      },
    };
  }
}

describe('workflow/base-adapter', () => {
  it('exposes default helper behavior for config merging and routing decisions', () => {
    const adapter = new TestAdapter();

    expect(adapter.getNodes()).toEqual({});
    expect(adapter.getRoutingRules()).toEqual({});
    expect(adapter.getDefaultConfig()).toEqual({
      pass_score: 80,
      human_review_score: 70,
      max_revisions: 3,
      auto_approve_timeout: 300,
      verbose: true,
      save_intermediate: true,
      domain: 'phase3-base-adapter-test',
      domain_config: {},
    });
    expect(adapter.mergeConfig({ pass_score: 90, custom_flag: true })).toEqual({
      pass_score: 90,
      human_review_score: 70,
      max_revisions: 3,
      auto_approve_timeout: 300,
      verbose: true,
      save_intermediate: true,
      domain: 'phase3-base-adapter-test',
      domain_config: {},
      custom_flag: true,
    });
    expect(adapter.shouldContinue({ decision: 'APPROVED' })).toBe('finalize');
    expect(adapter.shouldContinue({ decision: 'HUMAN_REVIEW' })).toBe('human_review');
    expect(adapter.shouldContinue({ decision: 'REVISE' })).toBe('revise');
    expect(adapter.shouldContinue({ decision: 'REWRITE' })).toBe('revise');
    expect(adapter.shouldContinue({ revision_count: 3, max_revisions: 3 })).toBe(
      'human_review',
    );
    expect(adapter.shouldContinue({ decision: 'UNKNOWN' })).toBe('continue');
  });

  it('registers adapters, normalizes capabilities, and creates adapter instances', () => {
    class StringCapabilityAdapter extends TestAdapter {
      override getDomainType(): string {
        return 'phase3-base-adapter-string-capability';
      }
    }

    class ArrayCapabilityAdapter extends TestAdapter {
      override getDomainType(): string {
        return 'phase3-base-adapter-array-capability';
      }
    }

    AdapterRegistry.registerAdapter(
      'phase3-base-adapter-string-capability',
      StringCapabilityAdapter,
      ' workflow ',
    );
    AdapterRegistry.registerAdapter(
      'phase3-base-adapter-array-capability',
      ArrayCapabilityAdapter,
      ['phase3', 'workflow', 'phase3', ''],
    );

    expect(AdapterRegistry.get('phase3-base-adapter-string-capability')).toBe(
      StringCapabilityAdapter,
    );
    expect(
      AdapterRegistry.getCapabilities('phase3-base-adapter-string-capability'),
    ).toEqual(['workflow']);
    expect(
      AdapterRegistry.getCapabilities('phase3-base-adapter-array-capability'),
    ).toEqual(['phase3', 'workflow']);
    expect(AdapterRegistry.listDomains()).toEqual(
      expect.arrayContaining([
        'phase3-base-adapter-string-capability',
        'phase3-base-adapter-array-capability',
      ]),
    );
    expect(AdapterRegistry.listDomainsByCapability('workflow')).toEqual(
      expect.arrayContaining([
        'phase3-base-adapter-string-capability',
        'phase3-base-adapter-array-capability',
      ]),
    );
    expect(AdapterRegistry.listDomainsByCapability('')).toEqual([]);

    const created = AdapterRegistry.createAdapter('phase3-base-adapter-array-capability', {
      pass_score: 88,
    });

    expect(created).toBeInstanceOf(ArrayCapabilityAdapter);
    expect((created as TestAdapter).getDefaultConfig().domain).toBe(
      'phase3-base-adapter-array-capability',
    );
    expect(AdapterRegistry.createAdapter('phase3-missing-adapter')).toBeNull();
  });
});
