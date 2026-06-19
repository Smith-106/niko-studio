import { describe, expect, it, vi } from 'vitest';

import { CommanderAgent } from '../../agents/commander';
import { WorkflowLevel } from '../../workflow/types';

describe('CommanderAgent branch gap coverage', () => {
  it('falls back to empty skills when the detected scene type has no mapping', async () => {
    const commander = new CommanderAgent(null);
    vi.spyOn(commander, 'detectSceneChange').mockResolvedValue('unmapped-scene' as never);

    const assignments = await commander.dispatchTasks(
      'task without a mapped scene type',
      WorkflowLevel.L2_LITE,
    );

    expect(assignments).toEqual([
      expect.objectContaining({
        agentType: 'writer',
        skills: [],
      }),
    ]);
  });

  it('falls back to an empty task description when run input omits both description fields', async () => {
    const commander = new CommanderAgent(null);
    const executeSpy = vi.spyOn(commander, 'execute');

    const result = await commander.run({});

    expect(executeSpy).toHaveBeenCalledWith('');
    expect(result).toMatchObject({
      workflowLevel: WorkflowLevel.L3_STANDARD,
    });
  });
});
