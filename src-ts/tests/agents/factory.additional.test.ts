import { describe, expect, it, vi } from 'vitest';

import { AgentType } from '../../agents/base';
import { ArchitectAgent } from '../../agents/architect';
import { CommanderAgent } from '../../agents/commander';
import { AgentFactory } from '../../agents/factory';
import { LifecycleStage } from '../../agents/lifecycle-hooks';
import { WriterAgent } from '../../agents/writer';

function createLlmService() {
  return {
    generate: vi.fn(),
    generateJson: vi.fn(),
  };
}

describe('AgentFactory additional coverage', () => {
  it('uses registered constructors before fallback construction', () => {
    const llmService = createLlmService();
    const factory = new AgentFactory(llmService as never);
    const constructor = vi.fn().mockReturnValue({ fromRegistry: true });

    factory.register(AgentType.WRITER, constructor);

    const agent = factory.getAgent(AgentType.WRITER);

    expect(agent).toEqual({ fromRegistry: true });
    expect(constructor).toHaveBeenCalledWith(llmService);
    expect(factory.getCachedTypes()).toEqual([AgentType.WRITER]);
  });

  it('registers lifecycle hooks for BaseAgent instances', () => {
    const addHookSpy = vi.spyOn(CommanderAgent.prototype, 'addHook');
    const factory = new AgentFactory(createLlmService() as never);
    const handler = vi.fn();

    const agent = factory.getAgent(AgentType.COMMANDER, {
      lifecycleHooks: [
        {
          stage: LifecycleStage.PERCEPTION,
          handler,
        },
      ],
    });

    expect(agent).toBeInstanceOf(CommanderAgent);
    expect(addHookSpy).toHaveBeenCalledWith(LifecycleStage.PERCEPTION, handler);
  });

  it('constructs architect and writer agents through default fallbacks', () => {
    const factory = new AgentFactory(createLlmService() as never);

    const architect = factory.getAgent(AgentType.ARCHITECT);
    const writer = factory.getAgent(AgentType.WRITER);

    expect(architect).toBeInstanceOf(ArchitectAgent);
    expect(writer).toBeInstanceOf(WriterAgent);
    expect(factory.getCachedTypes()).toEqual([AgentType.ARCHITECT, AgentType.WRITER]);
  });

  it('passes null to registered constructors when no llm service is available', () => {
    const factory = new AgentFactory();
    const constructor = vi.fn().mockReturnValue({ fromRegistry: true });

    factory.register(AgentType.CRITIC, constructor);
    const agent = factory.getAgent(AgentType.CRITIC);

    expect(agent).toEqual({ fromRegistry: true });
    expect(constructor).toHaveBeenCalledWith(null);
  });
});
