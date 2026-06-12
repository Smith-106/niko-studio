import { describe, expect, it } from 'vitest';

import type { BaseState } from '../../workflow/state.js';
import {
  AdapterRegistry,
  BaseDomainAdapter,
  type BaseEvaluationResult,
  type IWorkflowGraph,
} from '../../workflow/adapters/base-adapter.js';

class InvalidCapabilityAdapter extends BaseDomainAdapter {
  getDomainType(): string {
    return 'phase3-base-adapter-invalid-capability';
  }

  getStateClass(): new (...args: unknown[]) => BaseState {
    return Object as never;
  }

  createInitialState(userRequest: string): BaseState {
    return {
      user_request: userRequest,
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

describe('workflow/base-adapter additional coverage', () => {
  it('normalizes unsupported capability payloads into an empty set', () => {
    AdapterRegistry.registerAdapter(
      'phase3-base-adapter-invalid-capability',
      InvalidCapabilityAdapter,
      42 as unknown,
    );

    expect(AdapterRegistry.getCapabilities('phase3-base-adapter-invalid-capability')).toEqual([]);
    expect(
      AdapterRegistry.listDomainsByCapability('phase3-base-adapter-invalid-capability'),
    ).toEqual([]);
  });

  it('handles empty decisions, blank capability strings, and missing capability lookups', () => {
    class BlankCapabilityAdapter extends InvalidCapabilityAdapter {
      override getDomainType(): string {
        return 'phase3-base-adapter-blank-capability';
      }
    }

    const adapter = new BlankCapabilityAdapter();

    AdapterRegistry.registerAdapter(
      'phase3-base-adapter-blank-capability',
      BlankCapabilityAdapter,
      '   ',
    );

    expect(adapter.shouldContinue({ revision_count: 0, max_revisions: 3 })).toBe('continue');
    expect(AdapterRegistry.getCapabilities('phase3-base-adapter-blank-capability')).toEqual([]);
    expect(AdapterRegistry.getCapabilities('phase3-base-adapter-missing')).toEqual([]);
    expect(AdapterRegistry.listDomainsByCapability(undefined as unknown as string)).toEqual([]);
  });
});
