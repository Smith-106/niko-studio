import { describe, expect, it, vi } from 'vitest';

import { AgentType } from '../../agents/base';
import { AgentFactory } from '../../agents/factory';

describe('AgentFactory', () => {
  it('returns registered mocks before touching cached or real instances', () => {
    const factory = new AgentFactory();
    const mock = { mocked: true };

    factory.registerMock(AgentType.WRITER, mock);

    expect(factory.getAgent(AgentType.WRITER)).toBe(mock);
    expect(factory.getCachedTypes()).toEqual([]);
  });

  it('caches created agent instances and clears state on reset', () => {
    const llmService = {
      generate: vi.fn(),
      generateJson: vi.fn(),
    };
    const factory = new AgentFactory(llmService as never);

    const first = factory.getAgent(AgentType.COMMANDER);
    const second = factory.getAgent(AgentType.COMMANDER);

    expect(first).toBe(second);
    expect(factory.getCachedTypes()).toEqual([AgentType.COMMANDER]);

    factory.reset();

    expect(factory.getCachedTypes()).toEqual([]);
    expect(factory.getAgent(AgentType.COMMANDER)).not.toBe(first);
  });

  it('creates supported agent types and rejects unsupported ones', () => {
    const llmService = {
      generate: vi.fn(),
      generateJson: vi.fn(),
    };
    const factory = new AgentFactory(llmService as never);

    const commander = factory.getAgent(AgentType.COMMANDER);
    const critic = factory.getAgent(AgentType.CRITIC);
    const plot = factory.getAgent(AgentType.PLOT);

    expect(commander).toBeTruthy();
    expect(critic).toBeTruthy();
    expect(plot).toBeTruthy();
    expect(() =>
      factory.getAgent('unknown' as AgentType),
    ).toThrow('Unsupported agent type');
  });
});
