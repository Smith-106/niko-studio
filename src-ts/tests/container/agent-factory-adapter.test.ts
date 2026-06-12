import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentType as ContainerAgentType } from '../../container/types';
import { AgentType as BaseAgentType } from '../../agents/base';

const getAgentMock = vi.fn();
const registerMockMock = vi.fn();

vi.mock('../../agents/factory', () => ({
  AgentFactory: class {
    getAgent = getAgentMock;
    registerMock = registerMockMock;
  },
}));

describe('AgentFactoryAdapter', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('maps container agent and llm contracts onto the underlying agent factory', async () => {
    const executeMock = vi.fn().mockResolvedValue('writer-result');
    getAgentMock.mockReturnValueOnce({ execute: executeMock });

    const llm = {
      generate: vi.fn().mockResolvedValue('text'),
      generateJson: vi.fn().mockResolvedValue({ ok: true }),
      stream: vi.fn(),
    };

    const { AgentFactoryAdapter } = await import('../../container/adapters.js');
    const adapter = new AgentFactoryAdapter();
    const agent = adapter.getAgent(
      ContainerAgentType.Writer,
      'writer-alpha',
      { tone: 'tight' },
      llm,
    );

    await expect(agent.execute('draft task')).resolves.toBe('writer-result');
    expect(getAgentMock).toHaveBeenCalledWith(BaseAgentType.WRITER, {
      name: 'writer-alpha',
      config: { tone: 'tight' },
      llmService: {
        generate: expect.any(Function),
        generateJson: expect.any(Function),
      },
    });

    const llmService = getAgentMock.mock.calls[0]?.[1]?.llmService as {
      generate: (prompt: string) => Promise<string>;
      generateJson: (prompt: string) => Promise<Record<string, unknown>>;
    };
    await expect(llmService.generate('hello')).resolves.toBe('text');
    await expect(llmService.generateJson('hello')).resolves.toEqual({ ok: true });
    expect(llm.generate).toHaveBeenCalledWith('hello', undefined);
    expect(llm.generateJson).toHaveBeenCalledWith('hello', undefined);
    expect(agent.getName()).toBe('writer-alpha');
    expect(agent.getType()).toBe(ContainerAgentType.Writer);
  });

  it('maps registerMock to the underlying base-agent enum', async () => {
    const { AgentFactoryAdapter } = await import('../../container/adapters.js');
    const adapter = new AgentFactoryAdapter();
    const mockAgent = {
      execute: vi.fn(),
      getName: vi.fn().mockReturnValue('critic-mock'),
      getType: vi.fn().mockReturnValue(ContainerAgentType.Critic),
    };

    adapter.registerMock(ContainerAgentType.Critic, mockAgent);

    expect(registerMockMock).toHaveBeenCalledWith(BaseAgentType.CRITIC, mockAgent);
  });

  it('bridges writer write and revise contracts through the generic execute surface', async () => {
    const writeMock = vi.fn().mockResolvedValue({
      content: 'scene draft',
      wordcount: 321,
      sensory_types_used: ['visual', 'auditory'],
      forbidden_words_found: ['suddenly'],
      sections_needing_review: ['trim opening'],
    });
    const reviseMock = vi.fn().mockResolvedValue({
      content: 'scene revised',
      wordcount: 299,
      forbidden_words_found: [],
    });
    getAgentMock.mockReturnValueOnce({
      write: writeMock,
      revise: reviseMock,
    });

    const { AgentFactoryAdapter } = await import('../../container/adapters.js');
    const adapter = new AgentFactoryAdapter();
    const agent = adapter.getAgent(ContainerAgentType.Writer, 'writer-bridge');

    await expect(
      agent.execute('', {
        mode: 'write',
        scene_card: {
          scene_id: 'SC-9',
          chapter_num: 2,
          pov_character: 'Lin',
          objective: 'Find clue',
          conflict: 'Blocked by rain',
          outcome: '+',
          plot_beat: 'reveal',
          emotional_arc: 'calm->tense',
          sensory_guidance: { visual: 'fog' },
          world_settings: { location: 'dock' },
          foreshadows_to_plant: ['silver bell'],
        },
        skills: ['tension-scene'],
        word_target: 900,
        allow_llm_fallback: false,
      }),
    ).resolves.toEqual({
      content: 'scene draft',
      wordcount: 321,
      sensory_types_used: ['visual', 'auditory'],
      forbidden_words_found: ['suddenly'],
      sections_needing_review: ['trim opening'],
    });

    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scene_id: 'SC-9',
        chapter_num: 2,
        pov_character: 'Lin',
        objective: 'Find clue',
        conflict: 'Blocked by rain',
        outcome: '+',
        plot_beat: 'reveal',
        emotional_arc: 'calm->tense',
        sensory_guidance: { visual: 'fog' },
        world_settings: {
          location: 'dock',
          recommended_skills: ['tension-scene'],
        },
        foreshadows_to_plant: ['silver bell'],
        word_target: 900,
      }),
      false,
    );

    await expect(
      agent.execute('', {
        mode: 'revise',
        draft: 'old draft',
        feedback: { issues: ['weak tension'] },
        allow_llm_fallback: false,
        quality_goals: { coherence: 80 },
      }),
    ).resolves.toEqual({
      content: 'scene revised',
      wordcount: 299,
      forbidden_words_found: [],
    });

    expect(reviseMock).toHaveBeenCalledWith(
      'old draft',
      { issues: ['weak tension'] },
      false,
      { coherence: 80 },
    );
  });

  it('falls back to run(input) for non-execute agents such as plot', async () => {
    const runMock = vi.fn().mockResolvedValue({ currentPosition: 'SC-4' });
    getAgentMock.mockReturnValueOnce({ run: runMock });

    const { AgentFactoryAdapter } = await import('../../container/adapters.js');
    const adapter = new AgentFactoryAdapter();
    const agent = adapter.getAgent(ContainerAgentType.Plot, 'plot-bridge');

    await expect(
      agent.execute('', {
        input: {
          scene_id: 'SC-4',
          structural_function: 'Rising',
        },
      }),
    ).resolves.toEqual({ currentPosition: 'SC-4' });

    expect(getAgentMock).toHaveBeenCalledWith(BaseAgentType.PLOT, {
      name: 'plot-bridge',
      config: undefined,
      llmService: undefined,
    });
    expect(runMock).toHaveBeenCalledWith({
      scene_id: 'SC-4',
      structural_function: 'Rising',
    });
  });

  it('resets the underlying factory and rejects unsupported runtime contracts', async () => {
    getAgentMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({});

    const { AgentFactoryAdapter } = await import('../../container/adapters.js');
    const adapter = new AgentFactoryAdapter();

    await expect(
      adapter.getAgent(ContainerAgentType.Plot, 'plot-missing').execute('plot task'),
    ).rejects.toThrow('does not expose an executable runtime contract');

    adapter.reset();

    await expect(
      adapter.getAgent(ContainerAgentType.Writer, 'writer-missing').execute('', { mode: 'write' }),
    ).rejects.toThrow('Writer agent does not support write()');
  });

  it('rejects missing writer revise contracts and normalizes sparse write inputs', async () => {
    const sparseWriteMock = vi.fn().mockResolvedValue({ content: 'fallback draft' });
    getAgentMock
      .mockReturnValueOnce({
        write: vi.fn().mockResolvedValue({ ok: true }),
      })
      .mockReturnValueOnce({ write: sparseWriteMock });

    const { AgentFactoryAdapter } = await import('../../container/adapters.js');
    const adapter = new AgentFactoryAdapter();

    await expect(
      adapter.getAgent(ContainerAgentType.Writer, 'writer-revise-missing').execute('', {
        mode: 'revise',
      }),
    ).rejects.toThrow('Writer agent does not support revise()');

    await expect(
      adapter.getAgent(ContainerAgentType.Writer, 'writer-sparse').execute('', {
        mode: 'write',
        scene_card: {
          scene_id: 'SC-10',
          sensory_guidance: 'foggy',
          character_profiles: [{ id: 'hero-1' }],
          foreshadows_to_plant: 'bell',
          foreshadows_to_harvest: ['clue'],
        },
      }),
    ).resolves.toEqual({ content: 'fallback draft' });

    expect(sparseWriteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scene_id: 'SC-10',
        world_settings: {},
        sensory_guidance: 'foggy',
        character_profiles: [{ id: 'hero-1' }],
        foreshadows_to_plant: [],
        foreshadows_to_harvest: ['clue'],
      }),
      true,
    );
  });

  it('rejects unsupported container agent types', async () => {
    const { AgentFactoryAdapter } = await import('../../container/adapters.js');
    const adapter = new AgentFactoryAdapter();

    expect(() =>
      adapter.getAgent('unknown-agent' as ContainerAgentType, 'bad-agent'),
    ).toThrow('Unsupported agent type: unknown-agent');
  });
});
