import { describe, expect, it } from 'vitest';

import * as agents from '../../agents';
import {
  MODEL_PRICING as directModelPricing,
  ModelProvider,
  tokenUsageToDict as directTokenUsageToDict,
} from '../../agents/base';
import {
  ThoughtStatus,
  ThoughtType,
  thoughtDataFromDictProper,
} from '../../agents/sequential-thinking';
import {
  SKILL_REGISTRY as directSkillRegistry,
  TASK_SKILL_MAP as directTaskSkillMap,
  TaskType,
  getSkillsForTask as directGetSkillsForTask,
} from '../../agents/skill-router';
import { ArchitectAgent } from '../../agents/architect';
import { AgentFactory } from '../../agents/factory';

describe('agents/index barrel', () => {
  it('re-exports representative helper utilities and registries through the public entrypoint', () => {
    expect(agents.MODEL_PRICING).toBe(directModelPricing);
    expect(agents.tokenUsageToDict).toBe(directTokenUsageToDict);
    expect(agents.SKILL_REGISTRY).toBe(directSkillRegistry);
    expect(agents.TASK_SKILL_MAP).toBe(directTaskSkillMap);
    expect(agents.getSkillsForTask).toBe(directGetSkillsForTask);

    const usage = agents.tokenUsageToDict({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      estimatedCost: 0.01,
      timestamp: new Date('2026-04-04T00:00:00.000Z'),
    });
    const thought = agents.thoughtDataFromDict({
      id: 'thought-1',
      content: '分析当前问题',
      thought_type: 'analysis',
      status: 'completed',
      created_at: '2026-04-04T00:00:00.000Z',
    });
    const skill = agents.getSkillsForTask(TaskType.QUALITY_REVIEW)[0];

    expect(usage).toMatchObject({
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
    });
    expect(thought).toMatchObject({
      id: 'thought-1',
      thoughtType: ThoughtType.ANALYSIS,
      status: ThoughtStatus.COMPLETED,
    });
    expect(skill).toMatchObject({
      skillId: 'script-doctor',
      priority: 1,
    });
    expect(agents.MODEL_PRICING['gpt-4o'].provider).toBe(ModelProvider.OPENAI);
  });

  it('re-exports representative classes and aliased helpers from the underlying modules', () => {
    expect(agents.thoughtDataFromDict).toBe(thoughtDataFromDictProper);
    expect(agents.ArchitectAgent).toBe(ArchitectAgent);
    expect(agents.AgentFactory).toBe(AgentFactory);
    expect(agents.SequentialThinking).toBeDefined();
    expect(agents.SkillRouter).toBeDefined();
    expect(agents.CharacterAgent).toBeDefined();
    expect(agents.PlotAgent).toBeDefined();
    expect(agents.WorldbuildingAgent).toBeDefined();
    expect(agents.CriticAgent).toBeDefined();
    expect(agents.WriterAgent).toBeDefined();
    expect(agents.CommanderAgent).toBeDefined();
  });
});
