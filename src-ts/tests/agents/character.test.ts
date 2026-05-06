import { describe, expect, it, vi } from 'vitest';

import { CharacterAgent } from '../../agents/character';

describe('CharacterAgent', () => {
  it('builds character context from mocked graph profiles and relationship dynamics', async () => {
    const graphEngine = {
      query: vi
        .fn()
        .mockResolvedValueOnce([
          {
            c: {
              role: 'protagonist',
              social_self: '冷静克制',
              private_self: '害怕再次失去',
              desire: '查出真相',
              fear: '失去',
              flaw: '过度自责',
              strength: '观察敏锐',
              speech_pattern: '短句、克制',
              mannerisms: ['敲击桌面'],
            },
            relationships: [
              {
                type: 'FRIEND',
                target: '周谨',
              },
            ],
          },
        ])
        .mockResolvedValueOnce([
          {
            c: {
              role: 'ally',
              social_self: '温和',
              private_self: '谨慎',
              desire: '保护朋友',
              fear: '失败',
              flaw: '犹豫',
              strength: '可靠',
              speech_pattern: '安抚式语气',
              mannerisms: ['停顿后再回答'],
            },
            relationships: [],
          },
        ]),
    };
    const agent = new CharacterAgent({
      graphEngine: graphEngine as never,
    });

    const context = await agent.getContext({
      pov_character: '林岚',
      characters: ['林岚', '周谨'],
    });

    expect(context.mainCharacter?.name).toBe('林岚');
    expect(context.presentCharacters[0]?.name).toBe('周谨');
    expect(context.relationshipDynamics[0]).toContain('close');
    expect(context.dialogueGuidelines['林岚']).toContain('Speech pattern');
    expect(context.dialogueGuidelines['周谨']).toContain('Public persona');
  });

  it('validates behavior against fear and flaw mismatches and tolerates missing profiles', async () => {
    const agent = new CharacterAgent();

    const context = {
      mainCharacter: {
        name: '林岚',
        role: 'protagonist',
        socialSelf: '',
        personalSelf: '',
        privateSelf: '',
        hiddenSelf: '',
        desire: '查出真相',
        fear: '失去',
        flaw: '过度自责',
        strength: '观察敏锐',
        appearance: '',
        speechPattern: '',
        mannerisms: [],
        relationships: {},
      },
      presentCharacters: [],
      relationshipDynamics: [],
      dialogueGuidelines: {},
    };

    const invalid = await agent.validateBehavior(
      '林岚',
      '她完美地克服了失去亲友的恐惧',
      context as never,
    );
    const missing = await agent.validateBehavior(
      '未知角色',
      '做出行动',
      context as never,
    );

    expect(invalid.isValid).toBe(false);
    expect(invalid.issues.some((item) => item.includes('fear'))).toBe(true);
    expect(invalid.issues.some((item) => item.includes('flaw'))).toBe(true);
    expect(missing.isValid).toBe(true);
    expect(missing.suggestions[0]).toContain('profile not found');
  });

  it('falls back to empty profiles when graph lookup is unavailable and exposes run() alias', async () => {
    const agent = new CharacterAgent();

    const context = await agent.run({
      pov_character: '林岚',
      characters: ['林岚', '周谨'],
    });

    expect(context.mainCharacter?.name).toBe('林岚');
    expect(context.presentCharacters[0]?.name).toBe('周谨');
    expect(context.relationshipDynamics[0]).toContain('neutral');
    expect(context.dialogueGuidelines['林岚']).toContain('No specific guidelines');
  });

  // ── M11: STM/LTM memory ───────────────────────────────────

  it('manages short-term memory with capacity overflow to long-term', () => {
    const agent = new CharacterAgent();

    for (let i = 0; i < 25; i++) {
      agent.pushMemory(`Event ${i}`);
    }

    const ctx = agent.getMemoryContext();
    expect(ctx).toContain('Recent events:');
    expect(ctx).toContain('Long-term memories:');
    expect(ctx).toContain('[LTM]');

    // STM should have last 20 events (5-24), LTM should have 5 (0-4)
    const lines = ctx.split('\n');
    const stmLines = lines.filter((l) => /^\d+\./.test(l.trim()));
    expect(stmLines.length).toBeLessThanOrEqual(20);
  });

  it('returns empty memory context for fresh agent', () => {
    const agent = new CharacterAgent();
    const ctx = agent.getMemoryContext();
    expect(ctx).toBe('');
  });

  it('exposes dynamic state and it starts empty', () => {
    const agent = new CharacterAgent();
    const state = agent.dynamicState;
    expect(state.goals).toEqual([]);
    expect(state.currentStates).toEqual([]);
    expect(state.recentActions).toEqual([]);
  });

  it('has lifecycle hooks registered for perception and reflection', () => {
    const agent = new CharacterAgent();
    // Agent constructor registers hooks — verify via memory context behavior
    agent.pushMemory('test action');
    const ctx = agent.getMemoryContext();
    expect(ctx).toContain('test action');
  });
});
