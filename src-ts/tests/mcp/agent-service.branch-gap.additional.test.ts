import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentType } from '../../container/types';

const containerState = vi.hoisted(() => ({
  getAgent: vi.fn(),
  memory: {
    search: vi.fn(),
  },
  graph: {} as Record<string, unknown>,
  llm: {
    generate: vi.fn(),
    generateJson: vi.fn(),
  },
}));

const writerDepsRef = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const createWriterInputMock = vi.hoisted(() => vi.fn((input) => input));
const writerWriteWithKnowledgeMock = vi.hoisted(() => vi.fn());
const worldGetContextMock = vi.hoisted(() => vi.fn());
const characterGetContextMock = vi.hoisted(() => vi.fn());
const plotGetContextMock = vi.hoisted(() => vi.fn());
const createProjectWikiKnowledgeLayerMock = vi.hoisted(() => vi.fn(() => ({ kind: 'knowledge-layer' })));

vi.mock('../../container/ServiceContainer', () => ({
  getContainer: () => ({
    getAgent: containerState.getAgent,
    memory: containerState.memory,
    graph: containerState.graph,
    llm: containerState.llm,
  }),
}));

vi.mock('../../project/wiki-knowledge-layer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../project/wiki-knowledge-layer.js')>();
  return {
    ...actual,
    createProjectWikiKnowledgeLayer: createProjectWikiKnowledgeLayerMock,
  };
});

vi.mock('../../agents/writer', () => ({
  WriterAgent: class {
    private readonly deps: Record<string, unknown>;

    constructor(deps: Record<string, unknown>) {
      writerDepsRef.current = deps;
      this.deps = deps;
    }

    writeWithKnowledge(input: unknown, allowLlmFallback: boolean) {
      return writerWriteWithKnowledgeMock(this.deps, input, allowLlmFallback);
    }
  },
  createWriterInput: createWriterInputMock,
}));

vi.mock('../../agents/worldbuilding', () => ({
  WorldbuildingAgent: class {
    constructor(private readonly deps: Record<string, unknown>) {}

    getContext(sceneInfo: Record<string, unknown>) {
      return worldGetContextMock(this.deps, sceneInfo);
    }
  },
}));

vi.mock('../../agents/character', () => ({
  CharacterAgent: class {
    constructor(private readonly deps: Record<string, unknown>) {}

    getContext(sceneInfo: Record<string, unknown>) {
      return characterGetContextMock(this.deps, sceneInfo);
    }
  },
}));

vi.mock('../../agents/plot', () => ({
  PlotAgent: class {
    constructor(private readonly deps: Record<string, unknown>) {}

    getContext(sceneInfo: Record<string, unknown>) {
      return plotGetContextMock(this.deps, sceneInfo);
    }
  },
}));

function buildWorkspaceContext() {
  return {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      projectName: 'Atlas',
      workspaceRoot: '/tmp/atlas',
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: null,
      chapterTitle: null,
      chapterNumber: null,
    },
    storyBible: {
      storyBibleId: null,
      draftId: null,
      version: null,
      storage: 'workspace' as const,
    },
    knowledge: {
      focusEntityId: null,
      graphEntityIds: [],
      memoryEntryIds: [],
    },
    authority: {
      recordSetId: null,
      activeSceneId: null,
      activeEventId: null,
      activeTimelineId: null,
      consistencyRunId: null,
    },
    workflow: {
      sessionId: 'session-branch-gap',
      planId: null,
      level: null,
    },
    chat: {
      conversationId: null,
      comparisonEnabled: null,
    },
    compatibility: {
      additiveContract: true as const,
      migratedLegacyFields: [],
      notes: [],
    },
  };
}

describe('mcp agent service branch gap additional coverage', () => {
  beforeEach(() => {
    containerState.getAgent.mockReset();
    containerState.memory.search.mockReset();
    containerState.llm.generate.mockReset();
    containerState.llm.generateJson.mockReset();
    containerState.graph = {};
    writerDepsRef.current = null;
    createWriterInputMock.mockClear();
    writerWriteWithKnowledgeMock.mockReset();
    worldGetContextMock.mockReset();
    characterGetContextMock.mockReset();
    plotGetContextMock.mockReset();
    createProjectWikiKnowledgeLayerMock.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('defaults revise fallback fields when writer output omits content and wordcount', async () => {
    const executeMock = vi.fn().mockResolvedValue({
      forbidden_words_found: [null, 'banned-word', 7],
    });
    containerState.getAgent.mockReturnValueOnce({ execute: executeMock });

    const { agentRevise } = await import('../../mcp/services/agent.js?revise-default-branches');
    const result = await agentRevise({
      draft: 'fallback draft',
      feedback: { issue: 'tense drift' },
    });

    expect(containerState.getAgent).toHaveBeenCalledWith(AgentType.Writer, 'Writer');
    expect(executeMock).toHaveBeenCalledWith('', {
      mode: 'revise',
      draft: 'fallback draft',
      feedback: { issue: 'tense drift' },
      allow_llm_fallback: true,
      quality_goals: undefined,
    });
    expect(result).toEqual({
      content: 'fallback draft',
      wordcount: 'fallback draft'.length,
      forbidden_words_found: ['banned-word'],
    });
  });

  it('defaults workspace writer options and sparse scene-card fields to safe values', async () => {
    const workspace = buildWorkspaceContext();
    writerWriteWithKnowledgeMock.mockImplementationOnce(async (_deps, input, allowLlmFallback) => ({
      input,
      allowLlmFallback,
      sensory_types: ['auditory'],
      sections_needing_review: ['bridge'],
    }));

    const { agentWrite } = await import('../../mcp/services/agent.js?workspace-default-branches');
    const result = await agentWrite({
      scene_card: {
        scene_id: 17,
        chapter_num: '7',
        objective: false,
        outcome: 42,
        plot_beat: { id: 'beat' },
        world_settings: null,
      },
      workspace,
    });

    expect(createProjectWikiKnowledgeLayerMock).toHaveBeenCalledWith(workspace);
    expect(createWriterInputMock).toHaveBeenCalledWith(expect.objectContaining({
      scene_id: undefined,
      chapter_num: undefined,
      objective: undefined,
      outcome: undefined,
      plot_beat: undefined,
      world_settings: {},
    }));
    expect(writerWriteWithKnowledgeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeLayer: { kind: 'knowledge-layer' },
        workspace,
      }),
      expect.any(Object),
      true,
    );
    expect(result).toMatchObject({
      content: '',
      wordcount: 0,
      sensory_types: ['auditory'],
      sections_needing_review: ['bridge'],
      writer_metadata: {
        workspace_context: workspace,
        narrative_authority: {
          sessionId: 'session-branch-gap',
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
    });
  });

  it('defaults memory adapter search limit to 10 when world context omits search options', async () => {
    const queryMock = vi.fn().mockResolvedValue([null, { id: 'graph-record' }]);
    containerState.graph = {
      query: queryMock,
    };
    containerState.memory.search.mockResolvedValueOnce([null, { id: 'memory-record' }]);
    worldGetContextMock.mockImplementationOnce(async (deps) => ({
      graph: await (deps['graphEngine'] as { query(query: string): Promise<unknown[]> }).query('world-query'),
      memory: await (deps['memoryEngine'] as {
        search(query: string, options?: { limit?: number }): Promise<unknown[]>;
      }).search('world-memory'),
    }));

    const { agentGetContext } = await import('../../mcp/services/agent.js?memory-limit-default');
    const result = await agentGetContext({ location: 'bridge' }, ['world']);

    expect(queryMock).toHaveBeenCalledWith('world-query');
    expect(containerState.memory.search).toHaveBeenCalledWith({
      query: 'world-memory',
      limit: 10,
    });
    expect(result).toEqual({
      world: {
        graph: [{ id: 'graph-record' }],
        memory: [{ id: 'memory-record' }],
      },
    });
  });

  it('preserves numeric and string scene-card fields when they are valid', async () => {
    const workspace = buildWorkspaceContext();
    writerWriteWithKnowledgeMock.mockImplementationOnce(async (_deps, input) => ({
      input,
    }));

    const { agentWrite } = await import('../../mcp/services/agent.js?scene-card-typed-fields');
    await agentWrite({
      scene_card: {
        scene_id: 'SC-typed',
        chapter_num: 9,
        outcome: 'Gate holds',
        plot_beat: 'turning-point',
      },
      workspace,
    });

    expect(createWriterInputMock).toHaveBeenCalledWith(expect.objectContaining({
      scene_id: 'SC-typed',
      chapter_num: 9,
      outcome: 'Gate holds',
      plot_beat: 'turning-point',
    }));
  });
});
