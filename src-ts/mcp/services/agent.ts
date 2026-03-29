/**
 * MCP Agent Service
 *
 * Agent service module with 4 tools for agent operations.
 * Ported from src/mcp/services/agent.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';

// ---------------------------------------------------------------
// Engine accessors (lazy, delegated to container)
// ---------------------------------------------------------------

function getCommanderAgent(): unknown {
  // Delegates to container; placeholder until full wiring
  const { getContainer } = require('../../container/ContainerModule') as { getContainer: () => { commander: unknown } };
  return getContainer().commander;
}

function getWriterAgent(): unknown {
  const { getContainer } = require('../../container/ContainerModule') as { getContainer: () => { writer: unknown } };
  return getContainer().writer;
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
  // Placeholder: full implementation requires workflow level types
  return {
    workflow_level: 'L3',
    workflow_level_slug: 'standard',
    scene_type: 'dialogue',
    dispatched_skills: [],
    task_assignments: [],
  };
}

export interface AgentWriteParams {
  scene_card: Record<string, unknown>;
  skills?: string[];
  word_target?: number;
  allow_llm_fallback?: boolean;
  quality_goals?: Record<string, unknown>;
}

export interface AgentWriteResult {
  content: string;
  wordcount: number;
  sensory_types: string[];
  forbidden_words_found: string[];
  sections_needing_review: string[];
}

export async function agentWrite(params: AgentWriteParams): Promise<AgentWriteResult> {
  // Placeholder: full implementation requires WriterAgent
  return {
    content: '',
    wordcount: 0,
    sensory_types: [],
    forbidden_words_found: [],
    sections_needing_review: [],
  };
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
  // Placeholder: full implementation requires WriterAgent.revise
  return {
    content: params.draft,
    wordcount: params.draft.length,
    forbidden_words_found: [],
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
  const types = contextTypes ?? ['world', 'character', 'plot'];
  const result: AgentGetContextResult = {};

  // Placeholder: full implementation requires WorldbuildingAgent, CharacterAgent, PlotAgent
  for (const t of types) {
    (result as Record<string, unknown>)[t] = {};
  }

  return result;
}
