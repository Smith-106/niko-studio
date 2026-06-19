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
      chapterId: 'CH-7',
      chapterTitle: 'The Watchtower',
      chapterNumber: 7,
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
      sessionId: 'session-extra',
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

describe('mcp agent service additional coverage', () => {
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

  it('defaults route metadata when commander output omits a task assignment array', async () => {
    const executeMock = vi.fn().mockResolvedValue({
      workflowLevel: 'not-a-number',
      taskAssignments: 'bad-shape',
    });
    containerState.getAgent.mockReturnValueOnce({ execute: executeMock });

    const { agentRoute } = await import('../../mcp/services/agent.js?route-defaults');
    const result = await agentRoute('route malformed payload');

    expect(containerState.getAgent).toHaveBeenCalledWith(AgentType.Commander, 'Commander');
    expect(result).toEqual({
      workflow_level: 'L3',
      workflow_level_slug: 'standard',
      scene_type: 'dialogue',
      dispatched_skills: [],
      task_assignments: [],
    });
  });

  it('ignores malformed route assignments while preserving valid dispatched skills', async () => {
    const executeMock = vi.fn().mockResolvedValue({
      workflowLevel: 2,
      taskAssignments: [
        null,
        { sceneType: '', skills: 'bad-shape' },
        { sceneType: 7, skills: [1, 'tone-pass', '', null] },
      ],
    });
    containerState.getAgent.mockReturnValueOnce({ execute: executeMock });

    const { agentRoute } = await import('../../mcp/services/agent.js?route-assignment-filter');
    const result = await agentRoute('route helper branches');

    expect(result).toEqual({
      workflow_level: 'L2',
      workflow_level_slug: 'lite',
      scene_type: 'dialogue',
      dispatched_skills: ['tone-pass'],
      task_assignments: [
        null,
        { sceneType: '', skills: 'bad-shape' },
        { sceneType: 7, skills: [1, 'tone-pass', '', null] },
      ],
    });
  });

  it('returns an empty context payload when no supported context types are requested', async () => {
    const { agentGetContext } = await import('../../mcp/services/agent.js?context-empty');
    const result = await agentGetContext({ location: 'dock' }, ['invalid', 'ignored'] as string[]);

    expect(result).toEqual({});
    expect(worldGetContextMock).not.toHaveBeenCalled();
    expect(characterGetContextMock).not.toHaveBeenCalled();
    expect(plotGetContextMock).not.toHaveBeenCalled();
  });

  it('normalizes sparse workspace write payloads and exposes workspace metadata on the result', async () => {
    containerState.llm.generate.mockResolvedValueOnce('llm-generated-text');
    containerState.llm.generateJson.mockResolvedValueOnce({ structured: true });
    writerWriteWithKnowledgeMock.mockImplementationOnce(async (deps, input, allowLlmFallback) => {
      const llmService = deps['llmService'] as {
        generate(prompt: string): Promise<string>;
        generateJson(prompt: string): Promise<unknown>;
      };
      await llmService.generate('writer-plain');
      await llmService.generateJson('writer-json');
      return {
        content: 'workspace draft',
        wordcount: 456,
        metadata: {},
        allowLlmFallback,
        input,
      };
    });

    const workspace = buildWorkspaceContext();
    const { agentWrite } = await import('../../mcp/services/agent.js?workspace-write-normalization');
    const result = await agentWrite({
      scene_card: {
        scene_id: 'SC-11',
        objective: 'Hold the gate',
        emotional_arc: 42,
        sensory_guidance: null,
        character_profiles: [{ name: 'Aster' }],
        world_settings: null,
        foreshadows_to_plant: ['bell', 'torch'],
        foreshadows_to_harvest: ['ledger'],
      },
      skills: ['tone-pass', 7 as never, '' as never],
      word_target: 333,
      allow_llm_fallback: false,
      workspace,
    });

    expect(createProjectWikiKnowledgeLayerMock).toHaveBeenCalledWith(workspace);
    expect(createWriterInputMock).toHaveBeenCalledWith(expect.objectContaining({
      scene_id: 'SC-11',
      objective: 'Hold the gate',
      emotional_arc: undefined,
      sensory_guidance: undefined,
      character_profiles: [{ name: 'Aster' }],
      world_settings: { recommended_skills: ['tone-pass'] },
      foreshadows_to_plant: ['bell', 'torch'],
      foreshadows_to_harvest: ['ledger'],
      word_target: 333,
    }));
    expect(writerWriteWithKnowledgeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeLayer: { kind: 'knowledge-layer' },
        workspace,
      }),
      expect.any(Object),
      false,
    );
    expect(containerState.llm.generate).toHaveBeenCalledWith('writer-plain', undefined);
    expect(containerState.llm.generateJson).toHaveBeenCalledWith('writer-json', undefined);
    expect(result).toMatchObject({
      content: 'workspace draft',
      wordcount: 456,
      writer_metadata: {
        workspace_context: workspace,
        narrative_authority: {
          sessionId: 'session-extra',
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
    });
  });

  it('preserves writer metadata without workspace context for plain writer execution', async () => {
    const executeMock = vi.fn().mockResolvedValue({
      content: 'plain draft',
      wordcount: 128,
      metadata: {
        draft_id: 'draft-plain',
        retrieval_mode: 'container',
      },
      sensory_types_used: ['visual'],
      forbidden_words_found: [],
      sections_needing_review: [],
    });
    containerState.getAgent.mockReturnValueOnce({ execute: executeMock });

    const { agentWrite } = await import('../../mcp/services/agent.js?writer-metadata-no-workspace');
    const result = await agentWrite({
      scene_card: {
        scene_id: 'SC-12',
        objective: 'Hold the line',
      },
      skills: ['tone-pass'],
      word_target: 128,
    });

    expect(result).toEqual({
      content: 'plain draft',
      wordcount: 128,
      sensory_types: ['visual'],
      forbidden_words_found: [],
      sections_needing_review: [],
      writer_metadata: {
        draft_id: 'draft-plain',
        retrieval_mode: 'container',
      },
    });
  });

  it('uses graph.query and memory.search adapters that filter non-record results', async () => {
    const queryMock = vi.fn().mockResolvedValue([
      null,
      { id: 'graph-record' },
      'skip-me',
    ]);
    containerState.graph = {
      query: queryMock,
    };
    containerState.memory.search.mockResolvedValueOnce([
      null,
      { id: 'memory-record' },
      'skip-me',
    ]);

    worldGetContextMock.mockImplementationOnce(async (deps) => ({
      graph: await (deps['graphEngine'] as { query(query: string): Promise<unknown[]> }).query('world-query'),
      memory: await (deps['memoryEngine'] as {
        search(query: string, options?: { limit?: number }): Promise<unknown[]>;
      }).search('world-memory', { limit: 2 }),
    }));

    const { agentGetContext } = await import('../../mcp/services/agent.js?graph-query-branch');
    const result = await agentGetContext({ location: 'watchtower' }, ['world']);

    expect(queryMock).toHaveBeenCalledWith('world-query');
    expect(containerState.memory.search).toHaveBeenCalledWith({
      query: 'world-memory',
      limit: 2,
    });
    expect(result).toEqual({
      world: {
        graph: [{ id: 'graph-record' }],
        memory: [{ id: 'memory-record' }],
      },
    });
  });

  it('falls back to empty graph query results when no graph query function is available', async () => {
    containerState.graph = {};
    characterGetContextMock.mockImplementationOnce(async (deps) => {
      return (deps['graphEngine'] as { query(query: string): Promise<unknown[]> }).query('character-query');
    });

    const { agentGetContext } = await import('../../mcp/services/agent.js?graph-empty-fallback');
    const result = await agentGetContext({ character: 'Aster' }, ['character']);

    expect(result).toEqual({
      character: [],
    });
  });
});
