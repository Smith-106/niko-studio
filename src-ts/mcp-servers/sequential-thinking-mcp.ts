/**
 * sequential-thinking-mcp.ts - Sequential thinking MCP server with multi-session support.
 *
 * Migrated from src/mcp_servers/sequential_thinking.py
 *
 * Wraps the SequentialThinking engine from ../agents/sequential-thinking.ts
 * and exposes MCP-compatible tool functions with session isolation.
 *
 * Tools:
 *   think, branch, switchBranch, revise, backtrack, conclude
 *   getChain, getState, getConclusions, getBestBranch, exportMarkdown
 *   reset, listSessions, deleteSession
 */

import {
  SequentialThinking,
  ThoughtType,
  ThoughtStatus,
  thoughtDataToDict,
  type ThoughtData,
  type Branch,
} from "../agents/sequential-thinking";



// ============================================================
// Session registry
// ============================================================

const engines: Map<string, SequentialThinking> = new Map();
let defaultEngine: SequentialThinking | null = null;

function getEngine(sessionId?: string): SequentialThinking {
  if (sessionId) {
    let engine = engines.get(sessionId);
    if (!engine) {
      engine = new SequentialThinking(
        /* maxDepth */ 15,
        /* maxBranches */ 10,
        /* autoPrune */ true,
      );
      engines.set(sessionId, engine);
    }
    return engine;
  }

  if (!defaultEngine) {
    defaultEngine = new SequentialThinking(15, 10, true);
  }
  return defaultEngine;
}

// ============================================================
// Parse helpers
// ============================================================

function parseThoughtType(raw: string): ThoughtType {
  const values = Object.values(ThoughtType) as string[];
  if (values.includes(raw)) return raw as ThoughtType;
  return ThoughtType.ANALYSIS;
}

// ============================================================
// Core tools
// ============================================================

export function think(params: {
  content: string;
  thoughtType?: string;
  confidence?: number;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const engine = getEngine(params.sessionId);
  const tt = params.thoughtType ? parseThoughtType(params.thoughtType) : ThoughtType.ANALYSIS;
  const thought = engine.think(
    params.content,
    tt,
    params.confidence ?? 1.0,
    params.metadata,
  );
  return thoughtDataToDict(thought);
}

export function branch(params: {
  name: string;
  description: string;
  priority?: number;
  sessionId?: string;
}): Record<string, unknown> {
  const engine = getEngine(params.sessionId);
  const newBranch = engine.branch(params.name, params.description, params.priority ?? 0);
  return {
    id: newBranch.id,
    name: newBranch.name,
    description: newBranch.description,
    forkPointId: newBranch.forkPointId,
    parentBranchId: newBranch.parentBranchId,
    priority: newBranch.priority,
  };
}

export function switchBranch(params: {
  branchId: string;
  sessionId?: string;
}): Record<string, unknown> {
  const engine = getEngine(params.sessionId);
  engine.switchBranch(params.branchId);
  return {
    status: "switched",
    branchId: params.branchId,
    currentThoughtId: engine.currentThoughtId,
  };
}

export function revise(params: {
  targetThoughtId: string;
  newContent: string;
  reason: string;
  sessionId?: string;
}): Record<string, unknown> {
  const engine = getEngine(params.sessionId);
  const revision = engine.revise(params.targetThoughtId, params.newContent, params.reason);
  return thoughtDataToDict(revision);
}

export function backtrack(params: {
  toThoughtId: string;
  sessionId?: string;
}): Record<string, unknown> {
  const engine = getEngine(params.sessionId);
  engine.backtrack(params.toThoughtId);
  return {
    status: "backtracked",
    to: params.toThoughtId,
    currentThoughtId: engine.currentThoughtId,
    currentBranchId: engine.currentBranchId,
  };
}

export function conclude(params: {
  conclusion: string;
  confidence?: number;
  sessionId?: string;
}): Record<string, unknown> {
  const engine = getEngine(params.sessionId);
  const thought = engine.conclude(params.conclusion, params.confidence ?? 1.0);
  return thoughtDataToDict(thought);
}

// ============================================================
// Query tools
// ============================================================

export function getChain(params?: {
  branchId?: string;
  sessionId?: string;
}): Record<string, unknown>[] {
  const engine = getEngine(params?.sessionId);
  const chain = engine.getThoughtChain(params?.branchId);
  return chain.map(thoughtDataToDict);
}

export function getState(params?: {
  sessionId?: string;
}): Record<string, unknown> {
  const engine = getEngine(params?.sessionId);
  const state = engine.toDict();

  return {
    ...state,
    summary: {
      totalThoughts: engine.thoughtCount,
      totalBranches: engine.branchCount,
      activeThoughts: engine.getActiveThoughts().length,
      conclusions: engine.getConclusions().length,
      currentBranch: engine.currentBranchId,
      currentThought: engine.currentThoughtId,
    },
  };
}

export function getConclusions(params?: {
  sessionId?: string;
}): Record<string, unknown>[] {
  const engine = getEngine(params?.sessionId);
  return engine.getConclusions().map(thoughtDataToDict);
}

export function getBestBranch(params?: {
  sessionId?: string;
}): Record<string, unknown> {
  const engine = getEngine(params?.sessionId);
  const best = engine.getBestBranch();
  return {
    id: best.id,
    name: best.name,
    description: best.description,
    priority: best.priority,
    thoughtCount: best.thoughts.length,
  };
}

export function exportMarkdown(params?: {
  sessionId?: string;
}): string {
  const engine = getEngine(params?.sessionId);
  return engine.toMarkdown();
}

// ============================================================
// Management tools
// ============================================================

export function reset(params?: {
  sessionId?: string;
}): { status: string } {
  const engine = getEngine(params?.sessionId);
  engine.reset();
  return { status: "reset" };
}

export function listSessions(): Array<Record<string, unknown>> {
  const sessions: Array<Record<string, unknown>> = [];

  if (defaultEngine) {
    sessions.push({
      id: "default",
      thoughts: defaultEngine.thoughtCount,
      branches: defaultEngine.branchCount,
    });
  }

  for (const [sid, engine] of engines) {
    sessions.push({
      id: sid,
      thoughts: engine.thoughtCount,
      branches: engine.branchCount,
    });
  }

  return sessions;
}

export function deleteSession(params: {
  sessionId: string;
}): { status: string; sessionId: string } {
  if (engines.has(params.sessionId)) {
    engines.delete(params.sessionId);
    return { status: "deleted", sessionId: params.sessionId };
  }
  return { status: "not_found", sessionId: params.sessionId };
}

// ============================================================
// Re-export engine internals for direct usage
// ============================================================

export { SequentialThinking, ThoughtType, ThoughtStatus, thoughtDataToDict };
export type { ThoughtData, Branch };
