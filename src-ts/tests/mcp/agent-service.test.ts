import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentType } from '../../container/types';
import type { HttpRequest } from '../../mcp/http-types';

const getAgentMock = vi.fn();
const memorySearchMock = vi.fn();
const graphExecuteCypherMock = vi.fn();
const llmGenerateMock = vi.fn();
const llmGenerateJsonMock = vi.fn();
const createProjectWikiKnowledgeLayerMock = vi.fn();
const searchEntitiesMock = vi.fn();
const getRelatedEntitiesMock = vi.fn();
const searchMemoriesMock = vi.fn();
const containerMock = {
  getAgent: getAgentMock,
  memory: {
    search: memorySearchMock,
  },
  graph: {
    executeCypher: graphExecuteCypherMock,
  },
  llm: {
    generate: llmGenerateMock,
    generateJson: llmGenerateJsonMock,
  },
};

vi.mock('../../container/ServiceContainer', () => ({
  getContainer: vi.fn(() => containerMock),
}));

vi.mock('../../project/wiki-knowledge-layer.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../project/wiki-knowledge-layer.js')>();
  return {
    ...actual,
    createProjectWikiKnowledgeLayer: createProjectWikiKnowledgeLayerMock,
  };
});

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/agent/write',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

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
      chapterId: 'CH-2',
      chapterTitle: 'The Dock',
      chapterNumber: 2,
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
      sessionId: 'session-1',
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

describe('mcp agent service', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('delegates routing to the commander agent and normalizes the route contract', async () => {
    const executeMock = vi.fn().mockResolvedValue({
      workflowLevel: 4,
      taskAssignments: [
        { sceneType: 'suspense', skills: ['foreshadowing-craft', 'tension-scene'] },
        { sceneType: 'suspense', skills: ['tension-scene'] },
      ],
    });
    getAgentMock.mockReturnValueOnce({ execute: executeMock });

    const { agentRoute } = await import('../../mcp/services/agent.js');
    const result = await agentRoute('设计悬疑场景');

    expect(getAgentMock).toHaveBeenCalledWith(AgentType.Commander, 'Commander');
    expect(executeMock).toHaveBeenCalledWith('设计悬疑场景');
    expect(result).toEqual({
      workflow_level: 'L4',
      workflow_level_slug: 'brainstorm',
      scene_type: 'suspense',
      dispatched_skills: ['foreshadowing-craft', 'tension-scene'],
      task_assignments: [
        { sceneType: 'suspense', skills: ['foreshadowing-craft', 'tension-scene'] },
        { sceneType: 'suspense', skills: ['tension-scene'] },
      ],
    });
  });

  it('delegates write and revise through the writer container contract', async () => {
    const executeMock = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'scene draft',
        wordcount: 321,
        sensory_types_used: ['visual', 'auditory'],
        forbidden_words_found: ['suddenly'],
        sections_needing_review: ['trim opening'],
      })
      .mockResolvedValueOnce({
        content: 'scene revised',
        wordcount: 299,
        forbidden_words_found: [],
      });
    getAgentMock.mockReturnValue({ execute: executeMock });

    const { agentWrite, agentRevise } = await import('../../mcp/services/agent.js');

    const writeResult = await agentWrite({
      scene_card: { scene_id: 'SC-2', objective: 'Find clue' },
      skills: ['tension-scene'],
      word_target: 900,
      allow_llm_fallback: false,
      quality_goals: { coherence: 80 },
    });
    const reviseResult = await agentRevise({
      draft: 'old draft',
      feedback: { issues: ['weak tension'] },
      allow_llm_fallback: false,
      quality_goals: { coherence: 80 },
    });

    expect(getAgentMock).toHaveBeenNthCalledWith(1, AgentType.Writer, 'Writer');
    expect(getAgentMock).toHaveBeenNthCalledWith(2, AgentType.Writer, 'Writer');
    expect(executeMock).toHaveBeenNthCalledWith(1, '', {
      mode: 'write',
      scene_card: { scene_id: 'SC-2', objective: 'Find clue' },
      skills: ['tension-scene'],
      word_target: 900,
      allow_llm_fallback: false,
      quality_goals: { coherence: 80 },
    });
    expect(executeMock).toHaveBeenNthCalledWith(2, '', {
      mode: 'revise',
      draft: 'old draft',
      feedback: { issues: ['weak tension'] },
      allow_llm_fallback: false,
      quality_goals: { coherence: 80 },
    });
    expect(writeResult).toEqual({
      content: 'scene draft',
      wordcount: 321,
      sensory_types: ['visual', 'auditory'],
      forbidden_words_found: ['suddenly'],
      sections_needing_review: ['trim opening'],
    });
    expect(reviseResult).toEqual({
      content: 'scene revised',
      wordcount: 299,
      forbidden_words_found: [],
    });
  });

  it('uses the canon-aware wiki knowledge layer for workspace-backed writes', async () => {
    llmGenerateMock.mockResolvedValue(
      'Aster saw the lamp glow, heard the carriage, felt the cold stone, and smelled the rain.'
    );
    llmGenerateJsonMock.mockResolvedValue({});
    searchEntitiesMock.mockResolvedValue([
      {
        authority: {
          workspaceId: 'atlas-workspace',
          scopeAuthority: 'workspace',
          canonAuthority: 'canon-page',
          projectionAuthority: 'derived',
          promotion: 'manual',
          promotedFrom: 'manual',
          status: 'active',
        },
        id: 'char-aster',
        name: 'Aster',
        type: 'character',
        description: 'A detective who knows the dock ledger by heart.',
        filePath: 'characters/aster.md',
        origin: 'wiki-canon',
        pageId: 'page-aster',
        score: 0.94,
        slug: 'characters/aster',
      },
      {
        authority: {
          workspaceId: 'atlas-workspace',
          scopeAuthority: 'workspace',
          canonAuthority: 'canon-page',
          projectionAuthority: 'derived',
          promotion: 'manual',
          promotedFrom: 'manual',
          status: 'active',
        },
        id: 'loc-old-dock',
        name: 'Old Dock',
        type: 'location',
        description: 'A fog-bound harbor lined with rusted cranes.',
        filePath: 'locations/old-dock.md',
        origin: 'wiki-canon',
        pageId: 'page-old-dock',
        score: 0.88,
        slug: 'locations/old-dock',
      },
    ]);
    getRelatedEntitiesMock.mockResolvedValue([
      {
        canonAuthority: 'canon-page',
        id: 'rel-aster-dock',
        origin: 'wiki-projection-graph',
        pageId: 'page-aster',
        projectionAuthority: 'derived',
        projectionId: 'graph:page-aster',
        source: 'Aster',
        sourceId: 'char-aster',
        target: 'Old Dock',
        targetId: 'loc-old-dock',
        type: 'visits',
        workspaceId: 'atlas-workspace',
      },
    ]);
    searchMemoriesMock.mockResolvedValue([
      {
        authority: {
          workspaceId: 'atlas-workspace',
          scopeAuthority: 'workspace',
          canonAuthority: 'canon-page',
          projectionAuthority: 'derived',
          promotion: 'manual',
          promotedFrom: 'manual',
          status: 'active',
        },
        content: 'Aster once lost a witness at Old Dock during a midnight handoff.',
        id: 'memory-aster-dock',
        origin: 'wiki-canon',
        pageId: 'page-aster',
        score: 0.79,
        title: 'Old Dock Witness',
      },
    ]);
    createProjectWikiKnowledgeLayerMock.mockReturnValue({
      search_entities: searchEntitiesMock,
      get_related_entities: getRelatedEntitiesMock,
      search_memories: searchMemoriesMock,
    });

    const { agentWrite } = await import('../../mcp/services/agent.js');
    const workspace = buildWorkspaceContext();
    const result = await agentWrite({
      scene_card: {
        scene_id: 'SC-9',
        pov_character: 'Aster',
        objective: 'Find the ledger',
        conflict: 'Evade the dock watch',
        emotional_arc: 'calm->tense',
        sensory_guidance: {
          location: 'Old Dock',
          time: 'midnight',
          atmosphere: 'fog-bound',
        },
      },
      skills: ['tension-scene'],
      word_target: 450,
      allow_llm_fallback: false,
      workspace,
    });

    expect(getAgentMock).not.toHaveBeenCalled();
    expect(createProjectWikiKnowledgeLayerMock).toHaveBeenCalledWith(workspace);
    expect(searchEntitiesMock).toHaveBeenCalledWith('Aster Find the ledger Evade the dock watch', {
      limit: 10,
    });
    expect(getRelatedEntitiesMock).toHaveBeenCalledWith('char-aster');
    expect(getRelatedEntitiesMock).toHaveBeenCalledWith('loc-old-dock');
    expect(searchMemoriesMock).toHaveBeenCalledWith('Aster Find the ledger Evade the dock watch', {
      limit: 10,
    });
    expect(llmGenerateMock).toHaveBeenCalledTimes(4);
    expect(result.content).toContain('Aster');
    expect(result.wordcount).toBeGreaterThan(0);
    expect(result.writer_metadata).toMatchObject({
      knowledge_retrieved: {
        entities_count: 2,
        relations_count: 2,
        memories_count: 1,
      },
      retrieval_packet: {
        schemaVersion: '2026-04-25',
        query: 'Aster Find the ledger Evade the dock watch',
        workspaceId: 'atlas-workspace',
        counts: {
          entities: 2,
          relations: 2,
          memories: 1,
          total: 5,
        },
      },
      workspace_context: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
      narrative_authority: {
        sessionId: 'session-1',
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
      },
    });
    expect((result.writer_metadata?.['retrieval_packet'] as { packets: Array<Record<string, unknown>> }).packets)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'entity',
          title: 'Aster',
          pageId: 'page-aster',
        }),
        expect.objectContaining({
          kind: 'memory',
          title: 'Old Dock Witness',
          pageId: 'page-aster',
        }),
      ]));
  });

  it('normalizes explicit workspace payloads before invoking the write endpoint', async () => {
    llmGenerateMock.mockResolvedValue(
      'Aster saw the lamp glow, heard the carriage, felt the cold stone, and smelled the rain.'
    );
    llmGenerateJsonMock.mockResolvedValue({});
    searchEntitiesMock.mockResolvedValue([]);
    getRelatedEntitiesMock.mockResolvedValue([]);
    searchMemoriesMock.mockResolvedValue([]);
    createProjectWikiKnowledgeLayerMock.mockReturnValue({
      search_entities: searchEntitiesMock,
      get_related_entities: getRelatedEntitiesMock,
      search_memories: searchMemoriesMock,
    });

    const { agentWriteEndpoint } = await import('../../mcp/endpoints/agent.js');
    const response = await agentWriteEndpoint(
      makeRequest({
        scene_card: {
          scene_id: 'SC-10',
          pov_character: 'Aster',
          objective: 'Secure the ledger',
          conflict: 'Outrun the dock watch',
          emotional_arc: 'calm->tense',
          sensory_guidance: {
            location: 'Old Dock',
            time: 'midnight',
            atmosphere: 'fog-bound',
          },
        },
        workspace: {
          identity: {
            workspaceId: 'atlas-workspace',
            projectId: 'atlas-project',
            projectName: 'Atlas',
            workspaceRoot: '/tmp/atlas',
          },
          workflow: {
            sessionId: 'session-10',
          },
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(createProjectWikiKnowledgeLayerMock).toHaveBeenCalledTimes(1);
    expect(
      (
        createProjectWikiKnowledgeLayerMock.mock.calls[0]?.[0] as {
          identity: { workspaceId: string; projectId: string };
          workflow: { sessionId: string | null };
        }
      ).identity,
    ).toMatchObject({
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
    });
    expect(
      (
        createProjectWikiKnowledgeLayerMock.mock.calls[0]?.[0] as {
          workflow: { sessionId: string | null };
        }
      ).workflow.sessionId,
    ).toBe('session-10');
    expect(response.body).toMatchObject({
      content: expect.any(String),
      writer_metadata: {
        retrieval_packet: {
          counts: {
            entities: 0,
            relations: 0,
            memories: 0,
            total: 0,
          },
          workspaceId: 'atlas-workspace',
        },
        workspace_context: {
          identity: {
            workspaceId: 'atlas-workspace',
            projectId: 'atlas-project',
          },
        },
        narrative_authority: {
          sessionId: 'session-10',
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
    });
  });

  it('aggregates world, character, and plot context through container-backed runtime adapters', async () => {
    graphExecuteCypherMock.mockImplementation(async (query: string) => {
      if (query.includes("MATCH (l:Location")) {
        return [
          {
            l: {
              description: '古老而黑暗的旧城区',
              rules: ['夜间禁止出行'],
            },
            nearby: ['钟楼'],
            inhabitants: ['林岚'],
          },
        ];
      }

      if (query.includes("MATCH (c:Character {name: '林岚'})")) {
        return [
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
            relationships: [{ type: 'FRIEND', target: '周谨' }],
          },
        ];
      }

      if (query.includes("MATCH (c:Character {name: '周谨'})")) {
        return [
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
        ];
      }

      if (query.includes('MATCH (f:Foreshadow)')) {
        return [
          {
            f: {
              id: 'foreshadow-1',
              description: '旧怀表',
              planted_at: 'CH01-SC01',
              harvested_at: '',
              status: 'planted',
              importance: 'high',
              characters: ['林岚'],
              hints: ['CH01-SC02'],
            },
          },
        ];
      }

      return [];
    });
    memorySearchMock.mockImplementation(async ({ query }: { query: string }) => {
      if (query === 'world rules 旧城区') {
        return [{ content: 'world rules 旧城区: 夜间禁止出行' }];
      }

      if (query === 'world rules 深夜') {
        return [{ content: 'world rules 深夜: 灯火稀少' }];
      }

      if (query === 'key event chapter before 2') {
        return [
          {
            id: 'event-1',
            content: '主角得知怀表的来历',
            scene_id: 'CH01-SC01',
            characters: ['林岚'],
            is_key: true,
          },
        ];
      }

      if (query === 'planned event after CH02-SC03') {
        return [{ content: '最终揭晓真凶' }];
      }

      return [];
    });

    const { agentGetContext } = await import('../../mcp/services/agent.js');
    const result = await agentGetContext({
      location: '旧城区',
      time: '深夜',
      pov_character: '林岚',
      characters: ['林岚', '周谨'],
      scene_id: 'CH02-SC03',
      structural_function: 'Rising',
      foreshadows_to_plant: ['异常细节'],
      foreshadows_to_harvest: ['旧怀表'],
    });

    expect(memorySearchMock.mock.calls).toEqual(
      expect.arrayContaining([
        [{ query: 'world rules 旧城区', limit: 5 }],
        [{ query: 'world rules 深夜', limit: 3 }],
        [{ query: 'key event chapter before 2', limit: 10 }],
        [{ query: 'planned event after CH02-SC03', limit: 5 }],
      ]),
    );
    expect(graphExecuteCypherMock).toHaveBeenCalledTimes(4);
    expect(result.world).toMatchObject({
      settings: [
        {
          category: 'geography',
          name: '旧城区',
          relatedLocations: ['钟楼'],
          relatedCharacters: ['林岚'],
        },
      ],
      activeRules: ['world rules 旧城区: 夜间禁止出行', 'world rules 深夜: 灯火稀少'],
      timePeriod: '深夜',
    });
    expect(result.character).toMatchObject({
      mainCharacter: {
        name: '林岚',
        role: 'protagonist',
      },
      presentCharacters: [
        {
          name: '周谨',
          role: 'ally',
        },
      ],
    });
    expect(result.plot).toMatchObject({
      currentPosition: 'CH02-SC03',
      structuralFunction: 'Rising',
      foreshadowsToPlant: ['异常细节'],
      foreshadowsToHarvest: ['旧怀表'],
      upcomingEvents: ['最终揭晓真凶'],
    });
  });
});
