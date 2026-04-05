import { describe, expect, it } from 'vitest';

import { WorkflowLevel } from '../../workflow/types';
import { BaseLevel } from '../../workflow/levels/base-level';

class TestLevel extends BaseLevel {
  async execute(inputData: unknown): Promise<unknown> {
    return {
      level: this.level,
      inputData,
      passScore: this.config.passScore,
    };
  }

  validate(output: unknown): boolean {
    return Boolean(
      output &&
        typeof output === 'object' &&
        'level' in output &&
        output['level'] === this.level,
    );
  }
}

describe('workflow/levels/base-level', () => {
  it('exposes the configured level through the shared getter', () => {
    const level = new TestLevel({
      level: WorkflowLevel.L2_LITE,
      requiredAgents: ['writer'],
      optionalAgents: [],
      maxRevisions: 2,
      passScore: 75,
      timeoutSeconds: 120,
      persistState: false,
      persistArtifacts: false,
      checkpointEnabled: false,
      parallelExecution: false,
      maxParallelTasks: 1,
      humanReviewThreshold: 70,
      autoApprove: true,
      verbose: false,
      saveIntermediate: false,
    });

    expect(level.level).toBe(WorkflowLevel.L2_LITE);
  });

  it('lets subclasses execute and validate results against the configured level', async () => {
    const level = new TestLevel({
      level: WorkflowLevel.L4_BRAINSTORM,
      requiredAgents: ['commander', 'architect'],
      optionalAgents: ['critic'],
      maxRevisions: 4,
      passScore: 85,
      timeoutSeconds: 300,
      persistState: true,
      persistArtifacts: true,
      checkpointEnabled: true,
      parallelExecution: true,
      maxParallelTasks: 3,
      humanReviewThreshold: 80,
      autoApprove: false,
      verbose: true,
      saveIntermediate: true,
    });

    const output = await level.execute({ prompt: 'brainstorm three scene variants' });

    expect(output).toEqual({
      level: WorkflowLevel.L4_BRAINSTORM,
      inputData: { prompt: 'brainstorm three scene variants' },
      passScore: 85,
    });
    expect(level.validate(output)).toBe(true);
    expect(level.validate({ level: WorkflowLevel.L1_RAPID })).toBe(false);
  });
});
