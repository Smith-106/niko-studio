import { describe, expect, it } from 'vitest';

import type { BaseState } from '../../workflow/state';
import { BaseWorkflow } from '../../workflow/base-workflow';

class TestWorkflow extends BaseWorkflow {
  private state: BaseState = {
    session_id: 'session-1',
    current_step: 'init',
    metadata: {},
  };

  exposeConfig(): Record<string, unknown> {
    return this.config;
  }

  run(inputData: unknown): unknown {
    this.state = {
      ...this.state,
      current_step: 'completed',
      metadata: { inputData },
    };
    return {
      ok: true,
      inputData,
      config: this.config,
    };
  }

  getState(): BaseState {
    return this.state;
  }
}

describe('workflow/base-workflow', () => {
  it('falls back to an empty config when constructed without options', () => {
    expect(new TestWorkflow().exposeConfig()).toEqual({});
    expect(new TestWorkflow(null).exposeConfig()).toEqual({});
  });

  it('retains provided config and exposes subclass run/state behavior', () => {
    const workflow = new TestWorkflow({
      mode: 'test',
      retries: 2,
    });

    expect(workflow.exposeConfig()).toEqual({
      mode: 'test',
      retries: 2,
    });

    expect(workflow.getState()).toMatchObject({
      session_id: 'session-1',
      current_step: 'init',
    });

    const result = workflow.run({ prompt: 'draft scene' });

    expect(result).toEqual({
      ok: true,
      inputData: { prompt: 'draft scene' },
      config: {
        mode: 'test',
        retries: 2,
      },
    });
    expect(workflow.getState()).toMatchObject({
      current_step: 'completed',
      metadata: {
        inputData: { prompt: 'draft scene' },
      },
    });
  });
});
