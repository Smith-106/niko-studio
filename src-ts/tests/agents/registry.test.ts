import { describe, expect, it } from 'vitest';

import { AgentType } from '../../agents/base';
import { AgentRegistry } from '../../agents/registry';

describe('agents/registry', () => {
  it('registers, resolves, enumerates, and clones constructors', () => {
    const registry = new AgentRegistry();
    const architectCtor = () => ({ type: 'architect' });
    const writerCtor = () => ({ type: 'writer' });

    expect(registry.has(AgentType.ARCHITECT)).toBe(false);
    expect(registry.resolve(AgentType.ARCHITECT)).toBeUndefined();

    registry.register(AgentType.ARCHITECT, architectCtor);
    registry.register(AgentType.WRITER, writerCtor);

    expect(registry.has(AgentType.ARCHITECT)).toBe(true);
    expect(registry.resolve(AgentType.ARCHITECT)).toBe(architectCtor);
    expect(registry.types()).toEqual([AgentType.ARCHITECT, AgentType.WRITER]);

    const copy = registry.toMap();
    expect(copy.get(AgentType.WRITER)).toBe(writerCtor);

    copy.delete(AgentType.ARCHITECT);
    expect(registry.has(AgentType.ARCHITECT)).toBe(true);
  });
});
