import { describe, expect, it, vi } from 'vitest';

import { CharacterAgent } from '../../agents/character';
import { LifecycleStage } from '../../agents/lifecycle-hooks';

describe('CharacterAgent additional coverage', () => {
  it('executes perception and reflection lifecycle hooks and exposes graph accessors', async () => {
    const agent = new CharacterAgent();
    const graphEngine = { query: vi.fn() };

    expect(agent.graphEngine).toBeNull();
    agent.graphEngine = graphEngine as never;
    expect(agent.graphEngine).toBe(graphEngine);

    agent.pushMemory('初始观察');

    const perception = await (agent as any).runLifecycle(LifecycleStage.PERCEPTION, {
      phase: 'perception',
    });
    expect(perception).toMatchObject({
      phase: 'perception',
    });
    expect(perception.memoryContext).toContain('初始观察');
    expect(perception.dynamicState).toMatchObject({
      goals: [],
      currentStates: [],
      recentActions: [],
    });

    await (agent as any).runLifecycle(LifecycleStage.REFLECTION, {
      lastAction: '推进调查',
      newGoals: ['守住秘密'],
      newStates: ['警觉'],
    });

    expect(agent.getMemoryContext()).toContain('推进调查');
    expect(agent.dynamicState).toMatchObject({
      goals: ['守住秘密'],
      currentStates: ['警觉'],
      recentActions: ['推进调查'],
    });
  });

  it('truncates overflowing long memories when the oldest event is too long', () => {
    const agent = new CharacterAgent();
    const longEvent = 'X'.repeat(120);

    agent.pushMemory(longEvent);
    for (let i = 0; i < 20; i += 1) {
      agent.pushMemory(`事件 ${i}`);
    }

    const context = agent.getMemoryContext();
    expect(context).toContain('[LTM]');
    expect(context).toContain(`${'X'.repeat(97)}...`);
  });

  it('builds an empty context when scene info is missing', async () => {
    const agent = new CharacterAgent();

    const context = await agent.getContext({});

    expect(context).toEqual({
      mainCharacter: null,
      presentCharacters: [],
      relationshipDynamics: [],
      dialogueGuidelines: {},
    });
  });

  it('maps sparse graph profiles with default values and fallback relationship types', async () => {
    const agent = new CharacterAgent({
      graphEngine: {
        query: vi.fn().mockResolvedValue([
          {
            c: {},
            relationships: [
              { target: '阿泽' },
              { target: '白露', type: 'MENTOR' },
              { type: 'ALLY' },
            ],
          },
        ]),
      } as never,
    });

    const profile = await (agent as any).getCharacterProfile('林岚');

    expect(profile).toEqual({
      name: '林岚',
      role: 'supporting',
      socialSelf: '',
      personalSelf: '',
      privateSelf: '',
      hiddenSelf: '',
      desire: '',
      fear: '',
      flaw: '',
      strength: '',
      appearance: '',
      speechPattern: '',
      mannerisms: [],
      relationships: {
        阿泽: 'KNOWS',
        白露: 'MENTOR',
      },
    });
  });

  it('merges reflection state when only partial fields are provided', async () => {
    const agent = new CharacterAgent();

    await (agent as any).runLifecycle(LifecycleStage.REFLECTION, {
      newStates: ['警觉'],
    });
    expect(agent.dynamicState).toMatchObject({
      goals: [],
      currentStates: ['警觉'],
      recentActions: [''],
    });

    await (agent as any).runLifecycle(LifecycleStage.REFLECTION, {
      newGoals: ['守住秘密'],
    });
    expect(agent.dynamicState).toMatchObject({
      goals: ['守住秘密'],
      currentStates: ['警觉'],
      recentActions: ['', ''],
    });
  });

  it('falls back when graph node omits profile and relationship collections entirely', async () => {
    const agent = new CharacterAgent({
      graphEngine: {
        query: vi.fn().mockResolvedValue([{}]),
      } as never,
    });

    const profile = await (agent as any).getCharacterProfile('缺省角色');

    expect(profile).toEqual({
      name: '缺省角色',
      role: 'supporting',
      socialSelf: '',
      personalSelf: '',
      privateSelf: '',
      hiddenSelf: '',
      desire: '',
      fear: '',
      flaw: '',
      strength: '',
      appearance: '',
      speechPattern: '',
      mannerisms: [],
      relationships: {},
    });
  });

  it('covers profile query failure and remaining relationship dynamic branches', async () => {
    const failingAgent = new CharacterAgent({
      graphEngine: {
        query: vi.fn().mockRejectedValue(new Error('graph unavailable')),
      } as never,
    });
    const logSpy = vi.spyOn(failingAgent, 'logActivity');

    await expect((failingAgent as any).getCharacterProfile('失踪者')).resolves.toEqual({
      name: '失踪者',
      role: '',
      socialSelf: '',
      personalSelf: '',
      privateSelf: '',
      hiddenSelf: '',
      desire: '',
      fear: '',
      flaw: '',
      strength: '',
      appearance: '',
      speechPattern: '',
      mannerisms: [],
      relationships: {},
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Character query failed: Error: graph unavailable',
      'WARNING',
    );

    const dynamics = await (failingAgent as any).analyzeRelationships(
      {
        name: '林岚',
        role: 'hero',
        socialSelf: '',
        personalSelf: '',
        privateSelf: '',
        hiddenSelf: '',
        desire: '',
        fear: '',
        flaw: '',
        strength: '',
        appearance: '',
        speechPattern: '',
        mannerisms: [],
        relationships: {
          夜枭: 'ENEMY',
          师父: 'MENTOR',
        },
      },
      [
        {
          name: '夜枭',
          role: '',
          socialSelf: '',
          personalSelf: '',
          privateSelf: '',
          hiddenSelf: '',
          desire: '',
          fear: '',
          flaw: '',
          strength: '',
          appearance: '',
          speechPattern: '',
          mannerisms: [],
          relationships: {},
        },
        {
          name: '师父',
          role: '',
          socialSelf: '',
          personalSelf: '',
          privateSelf: '',
          hiddenSelf: '',
          desire: '',
          fear: '',
          flaw: '',
          strength: '',
          appearance: '',
          speechPattern: '',
          mannerisms: [],
          relationships: {},
        },
      ],
    );

    expect(dynamics[0]).toContain('antagonistic relationship');
    expect(dynamics[1]).toContain('mentor-student bond');
  });
});
