import { describe, expect, it, vi } from 'vitest';

import {
  CommanderAgent,
  createCommanderChain,
  createCommanderNode,
  SceneType,
} from '../../agents/commander';
import { WorkflowLevel } from '../../workflow/types';

describe('CommanderAgent', () => {
  it('routes tasks heuristically when llm is unavailable', async () => {
    const commander = new CommanderAgent(null);

    await expect(commander.route('修复一个错别字')).resolves.toBe(
      WorkflowLevel.L1_RAPID,
    );
    await expect(commander.route('设计一个世界观和角色冲突')).resolves.toBe(
      WorkflowLevel.L4_BRAINSTORM,
    );
    await expect(commander.route('写一个完整小说项目路线图')).resolves.toBe(
      WorkflowLevel.L5_COORDINATOR,
    );
  });

  it('detects scene types and dispatches task chains by workflow level', async () => {
    const commander = new CommanderAgent(null);

    await expect(commander.detectSceneChange('这是一个充满悬念和紧张感的片段')).resolves.toBe(
      SceneType.SUSPENSE,
    );
    await expect(commander.detectSceneChange('只是普通过渡段落')).resolves.toBe(
      SceneType.TRANSITION,
    );

    const standardAssignments = await commander.dispatchTasks(
      '写一个章节并完善角色成长',
      WorkflowLevel.L3_STANDARD,
    );
    const brainstormAssignments = await commander.dispatchTasks(
      '设计世界观和角色设定',
      WorkflowLevel.L4_BRAINSTORM,
    );

    expect(standardAssignments.map((item) => item.agentType)).toEqual([
      'architect',
      'writer',
      'critic',
    ]);
    expect(standardAssignments[1]?.dependsOn).toEqual(['task-001']);
    expect(brainstormAssignments).toHaveLength(5);
    expect(brainstormAssignments[1]).toMatchObject({
      agentType: 'character',
      sceneType: SceneType.CHARACTER_FOCUS,
    });
  });

  it('integrates multi-agent results and executes the full planning pipeline', async () => {
    const commander = new CommanderAgent(null);

    const integrated = commander.integrateResults([
      {
        agentType: 'architect',
        content: '结构方案',
        tokensUsed: 120,
      },
      {
        agentType: 'writer',
        content: '写作结果',
        tokensUsed: 200,
      },
      {
        agentType: 'critic',
        score: 90,
        decision: 'APPROVED',
      },
    ]);

    expect(integrated).toMatchObject({
      status: 'completed',
      content: '写作结果',
    });
    expect(integrated.metadata).toMatchObject({
      agentsInvoked: ['architect', 'writer', 'critic'],
      totalTokens: 320,
      qualityScore: 90,
      decision: 'APPROVED',
    });

    const executed = await commander.execute('设计一个世界观和角色设定');

    expect(executed.workflowLevel).toBe(WorkflowLevel.L4_BRAINSTORM);
    expect(executed.totalSteps).toBe(5);
    expect(executed.estimatedTokens).toBeGreaterThan(0);
  });

  it('uses llm route result when valid and exposes node or chain helpers', async () => {
    const llmService = {
      generateJson: vi.fn().mockResolvedValue({
        reasoning: '复杂任务',
        workflowLevel: 5,
      }),
    };
    const commander = new CommanderAgent(llmService as never);

    await expect(commander.route('需要完整多阶段项目规划')).resolves.toBe(
      WorkflowLevel.L5_COORDINATOR,
    );

    const node = createCommanderNode(llmService as never);
    const nodeResult = await node({ userRequest: '规划完整小说项目' });

    expect(nodeResult.commanderOutput).toMatchObject({
      workflowLevel: WorkflowLevel.L5_COORDINATOR,
    });

    const chain = createCommanderChain(llmService as never);
    const chainResult = await chain('设计完整项目路线图');

    expect(chainResult.workflowLevel).toBe(WorkflowLevel.L5_COORDINATOR);
  });
});
