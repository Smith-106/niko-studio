import { describe, expect, it, vi } from 'vitest';

import {
  CommanderAgent,
  createCommanderNode,
  SceneType,
} from '../../agents/commander';
import { WorkflowLevel } from '../../workflow/types';

describe('CommanderAgent additional coverage', () => {
  it('falls back to default heuristic routing when no keywords match', async () => {
    const commander = new CommanderAgent(null);

    await expect(commander.route('opaque request with no routing hints')).resolves.toBe(
      WorkflowLevel.L3_STANDARD,
    );
  });

  it('falls back to heuristics when llm routing throws', async () => {
    const llmService = {
      generateJson: vi.fn().mockRejectedValue(new Error('llm offline')),
    };
    const commander = new CommanderAgent(llmService as never);
    const logSpy = vi.spyOn(commander, 'logActivity');

    await expect(commander.route('short snippet about a quiet hallway')).resolves.toBe(
      WorkflowLevel.L2_LITE,
    );
    expect(logSpy).toHaveBeenCalledWith(
      'LLM routing failed, falling back to heuristics',
      expect.objectContaining({
        detail: expect.any(Error),
      }),
    );
  });

  it('dispatches rapid and lite tasks with expected payloads', async () => {
    const commander = new CommanderAgent(null);

    const rapid = await commander.dispatchTasks(
      'fix a typo in this paragraph',
      WorkflowLevel.L1_RAPID,
    );
    const lite = await commander.dispatchTasks(
      'short snippet about a quiet hallway',
      WorkflowLevel.L2_LITE,
    );

    expect(rapid).toEqual([
      expect.objectContaining({
        agentType: 'writer',
        sceneType: SceneType.TRANSITION,
        instruction: 'Quick fix: fix a typo in this paragraph',
        skills: [],
        context: { level: 'L1', max_tokens: 500 },
        dependsOn: [],
      }),
    ]);
    expect(lite).toEqual([
      expect.objectContaining({
        agentType: 'writer',
        sceneType: SceneType.TRANSITION,
        instruction: 'Write: short snippet about a quiet hallway',
        skills: ['transition-craft', 'timeline-craft'],
        context: { level: 'L2', max_tokens: 1000 },
        dependsOn: [],
      }),
    ]);
  });

  it('integrates unknown and sparse agent results with defaults', () => {
    const commander = new CommanderAgent(null);

    const integrated = commander.integrateResults([
      {},
      {
        agentType: 'writer',
      },
      {
        agentType: 'critic',
      },
    ]);

    expect(integrated).toMatchObject({
      status: 'completed',
      content: '',
      metadata: {
        agentsInvoked: ['unknown', 'writer', 'critic'],
        totalTokens: 0,
        qualityScore: 0,
        decision: 'UNKNOWN',
      },
    });
  });

  it('uses description fallback in run and empty-state fallback in commander node', async () => {
    const commander = new CommanderAgent(null);

    const runResult = await commander.run({
      description: 'short snippet with minimal context',
    } as never);
    expect(runResult).toMatchObject({
      workflowLevel: WorkflowLevel.L2_LITE,
      totalSteps: 1,
    });

    const node = createCommanderNode(null);
    const nodeResult = await node({});

    expect(nodeResult).toMatchObject({
      commanderOutput: {
        workflowLevel: WorkflowLevel.L3_STANDARD,
      },
    });
  });
});
