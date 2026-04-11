/**
 * MCP Agent Service
 *
 * Agent service module with 4 tools for agent operations.
 * Ported from src/mcp/services/agent.py
 */

import { getContainer } from '../../container/ServiceContainer';
import {
  AgentType,
  type IAgent,
  type IMemoryEngine,
  type IGraphEngine,
  type ILLMService,
} from '../../container/types';
import type { IAgentGraphEngine, IAgentLLMService, IAgentMemoryEngine } from '../../agents/base';
import { WriterAgent, createWriterInput } from '../../agents/writer';
import { WorldbuildingAgent } from '../../agents/worldbuilding';
import { CharacterAgent } from '../../agents/character';
import { PlotAgent } from '../../agents/plot';
import type { ProjectWorkspaceContext } from '../../project/workspace-model.js';
import { createProjectWikiKnowledgeLayer } from '../../project/wiki-knowledge-layer.js';
import { toWorkflowLabel, toWorkflowSlug } from '../../workflow/types';

// ---------------------------------------------------------------
// Engine accessors (lazy, delegated to container)
// ---------------------------------------------------------------

function getCommanderAgent(): IAgent {
  return getContainer().getAgent(AgentType.Commander, 'Commander');
}

function getWriterAgent(): IAgent {
  return getContainer().getAgent(AgentType.Writer, 'Writer');
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export interface AgentRouteResult {
  workflow_level: string;
  workflow_level_slug: string;
  scene_type: string;
  dispatched_skills: string[];
  task_assignments: unknown[];
}

export async function agentRoute(task: string): Promise<AgentRouteResult> {
  const result = await getCommanderAgent().execute(task);
  const output = asRecord(result);
  const workflowLevel = output['workflowLevel'];
  const taskAssignments = Array.isArray(output['taskAssignments'])
    ? (output['taskAssignments'] as unknown[])
    : [];
  const sceneType = getPrimarySceneType(taskAssignments);

  return {
    workflow_level: toWorkflowLabel(resolveWorkflowLevel(workflowLevel)),
    workflow_level_slug: toWorkflowSlug(resolveWorkflowLevel(workflowLevel)),
    scene_type: sceneType,
    dispatched_skills: collectDispatchedSkills(taskAssignments),
    task_assignments: taskAssignments,
  };
}

export interface AgentWriteParams {
  scene_card: Record<string, unknown>;
  skills?: string[];
  word_target?: number;
  allow_llm_fallback?: boolean;
  quality_goals?: Record<string, unknown>;
  workspace?: ProjectWorkspaceContext | null;
}

export interface AgentWriteResult {
  content: string;
  wordcount: number;
  sensory_types: string[];
  forbidden_words_found: string[];
  sections_needing_review: string[];
  writer_metadata?: Record<string, unknown>;
}

export async function agentWrite(params: AgentWriteParams): Promise<AgentWriteResult> {
  if (params.workspace) {
    const output = await executeWorkspaceAwareWrite(params.workspace, params);
    return toAgentWriteResult(asRecord(output), params.workspace);
  }

  const result = await getWriterAgent().execute('', {
    mode: 'write',
    scene_card: params.scene_card,
    skills: params.skills,
    word_target: params.word_target,
    allow_llm_fallback: params.allow_llm_fallback ?? true,
    quality_goals: params.quality_goals,
  });
  return toAgentWriteResult(asRecord(result));
}

export interface AgentReviseParams {
  draft: string;
  feedback: Record<string, unknown>;
  allow_llm_fallback?: boolean;
  quality_goals?: Record<string, unknown>;
}

export interface AgentReviseResult {
  content: string;
  wordcount: number;
  forbidden_words_found: string[];
}

export async function agentRevise(params: AgentReviseParams): Promise<AgentReviseResult> {
  const result = await getWriterAgent().execute('', {
    mode: 'revise',
    draft: params.draft,
    feedback: params.feedback,
    allow_llm_fallback: params.allow_llm_fallback ?? true,
    quality_goals: params.quality_goals,
  });
  const output = asRecord(result);

  return {
    content: typeof output['content'] === 'string' ? output['content'] : params.draft,
    wordcount: typeof output['wordcount'] === 'number' ? output['wordcount'] : params.draft.length,
    forbidden_words_found: toStringArray(output['forbidden_words_found']),
  };
}

export interface AgentGetContextResult {
  world?: unknown;
  character?: unknown;
  plot?: unknown;
}

export async function agentGetContext(
  sceneInfo: Record<string, unknown>,
  contextTypes?: string[]
): Promise<AgentGetContextResult> {
  const types = normalizeContextTypes(contextTypes);
  const result: AgentGetContextResult = {};

  if (types.length === 0) {
    return result;
  }

  const container = getContainer();
  const memoryAdapter = createAgentMemoryAdapter(container.memory);
  const graphAdapter = createAgentGraphAdapter(container.graph);

  await Promise.all(
    types.map(async (type) => {
      if (type === 'world') {
        result.world = await new WorldbuildingAgent({
          memoryEngine: memoryAdapter,
          graphEngine: graphAdapter,
        }).getContext(sceneInfo);
        return;
      }

      if (type === 'character') {
        result.character = await new CharacterAgent({
          graphEngine: graphAdapter,
        }).getContext(sceneInfo);
        return;
      }

      if (type === 'plot') {
        result.plot = await new PlotAgent({
          memoryEngine: memoryAdapter,
          graphEngine: graphAdapter,
        }).getContext(sceneInfo);
      }
    }),
  );

  return result;
}

function resolveWorkflowLevel(value: unknown): number {
  return typeof value === 'number' ? value : 3;
}

function adaptAgentLlmService(llm: ILLMService): IAgentLLMService {
  return {
    generate: (prompt, options) => llm.generate(prompt, options),
    generateJson: async <T>(prompt: string, options?: { systemPrompt?: string; temperature?: number }) =>
      (await llm.generateJson(prompt, options)) as T,
  };
}

async function executeWorkspaceAwareWrite(
  workspace: ProjectWorkspaceContext,
  params: AgentWriteParams,
): Promise<unknown> {
  const container = getContainer();
  const writerAgent = new WriterAgent({
    llmService: adaptAgentLlmService(container.llm),
    knowledgeLayer: createProjectWikiKnowledgeLayer(workspace),
  });

  return writerAgent.writeWithKnowledge(
    createWriterInput(resolveWriterInput(params)),
    params.allow_llm_fallback ?? true,
  );
}

function resolveWriterInput(
  params: AgentWriteParams,
): Partial<ReturnType<typeof createWriterInput>> & { scene_card?: Record<string, unknown> } {
  const sceneCard = asRecord(params.scene_card);
  const skills = toStringArray(params.skills);
  const worldSettingsBase = asRecord(sceneCard['world_settings']);
  const worldSettings =
    skills.length > 0
      ? { ...worldSettingsBase, recommended_skills: skills }
      : worldSettingsBase;

  return {
    scene_card: sceneCard,
    scene_id: typeof sceneCard['scene_id'] === 'string' ? String(sceneCard['scene_id']) : undefined,
    chapter_num:
      typeof sceneCard['chapter_num'] === 'number' ? (sceneCard['chapter_num'] as number) : undefined,
    pov_character:
      typeof sceneCard['pov_character'] === 'string' ? String(sceneCard['pov_character']) : undefined,
    objective: typeof sceneCard['objective'] === 'string' ? String(sceneCard['objective']) : undefined,
    conflict: typeof sceneCard['conflict'] === 'string' ? String(sceneCard['conflict']) : undefined,
    outcome: typeof sceneCard['outcome'] === 'string' ? String(sceneCard['outcome']) : undefined,
    plot_beat: typeof sceneCard['plot_beat'] === 'string' ? String(sceneCard['plot_beat']) : undefined,
    emotional_arc:
      typeof sceneCard['emotional_arc'] === 'string'
        ? String(sceneCard['emotional_arc'])
        : undefined,
    sensory_guidance:
      typeof sceneCard['sensory_guidance'] === 'object' && sceneCard['sensory_guidance'] !== null
        ? (sceneCard['sensory_guidance'] as Record<string, string>)
        : undefined,
    character_profiles: Array.isArray(sceneCard['character_profiles'])
      ? (sceneCard['character_profiles'] as Record<string, unknown>[])
      : [],
    world_settings: worldSettings,
    foreshadows_to_plant: Array.isArray(sceneCard['foreshadows_to_plant'])
      ? (sceneCard['foreshadows_to_plant'] as string[])
      : [],
    foreshadows_to_harvest: Array.isArray(sceneCard['foreshadows_to_harvest'])
      ? (sceneCard['foreshadows_to_harvest'] as string[])
      : [],
    word_target: params.word_target,
  };
}

function getPrimarySceneType(taskAssignments: unknown[]): string {
  for (const assignment of taskAssignments) {
    if (typeof assignment !== 'object' || assignment === null) {
      continue;
    }

    const sceneType = (assignment as Record<string, unknown>)['sceneType'];
    if (typeof sceneType === 'string' && sceneType.length > 0) {
      return sceneType;
    }
  }

  return 'dialogue';
}

function collectDispatchedSkills(taskAssignments: unknown[]): string[] {
  const seen = new Set<string>();

  for (const assignment of taskAssignments) {
    if (typeof assignment !== 'object' || assignment === null) {
      continue;
    }

    const skills = (assignment as Record<string, unknown>)['skills'];
    if (!Array.isArray(skills)) {
      continue;
    }

    for (const skill of skills) {
      if (typeof skill === 'string' && skill.length > 0) {
        seen.add(skill);
      }
    }
  }

  return [...seen];
}

function toAgentWriteResult(
  output: Record<string, unknown>,
  workspace?: ProjectWorkspaceContext | null,
): AgentWriteResult {
  const result: AgentWriteResult = {
    content: typeof output['content'] === 'string' ? output['content'] : '',
    wordcount: typeof output['wordcount'] === 'number' ? output['wordcount'] : 0,
    sensory_types: toStringArray(output['sensory_types_used'] ?? output['sensory_types']),
    forbidden_words_found: toStringArray(output['forbidden_words_found']),
    sections_needing_review: toStringArray(output['sections_needing_review']),
  };

  const metadata = asRecord(output['metadata']);
  if (metadata && (Object.keys(metadata).length > 0 || Boolean(workspace))) {
    result.writer_metadata = {
      ...metadata,
      ...(workspace ? { workspace_context: workspace } : {}),
    };
  }

  return result;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeContextTypes(contextTypes?: string[]): Array<'world' | 'character' | 'plot'> {
  const requested = contextTypes ?? ['world', 'character', 'plot'];
  const normalized: Array<'world' | 'character' | 'plot'> = [];
  const seen = new Set<string>();

  for (const type of requested) {
    if ((type === 'world' || type === 'character' || type === 'plot') && !seen.has(type)) {
      seen.add(type);
      normalized.push(type);
    }
  }

  return normalized;
}

function createAgentMemoryAdapter(memory: IMemoryEngine): IAgentMemoryEngine {
  return {
    search: async (query: string, options?: { limit?: number }) => {
      const results = await memory.search({
        query,
        limit: options?.limit ?? 10,
      });
      return results
        .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null);
    },
  };
}

function createAgentGraphAdapter(graph: IGraphEngine): IAgentGraphEngine {
  return {
    query: async (cypherOrQuery: string) => {
      const graphRecord = graph as IGraphEngine & {
        query?: (query: string) => Promise<unknown[]>;
        executeCypher?: (query: string) => Promise<unknown[]>;
      };

      const results =
        typeof graphRecord.query === 'function'
          ? await graphRecord.query(cypherOrQuery)
          : typeof graphRecord.executeCypher === 'function'
            ? await graphRecord.executeCypher(cypherOrQuery)
            : [];

      return results
        .filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null);
    },
  };
}
