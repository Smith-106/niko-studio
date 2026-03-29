/**
 * Resume Strategy - Checkpoint recovery strategies for interrupted sessions
 *
 * Implements three resume modes:
 * - NATIVE: native session restore (using CLI --resume parameter)
 * - PROMPT_CONCAT: prompt concatenation (history context prepended to new prompt)
 * - HYBRID: hybrid mode (try native first, fall back to concat)
 *
 * Migrated from src/workflow/session/resume_strategy.py
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================
// Enums
// ============================================================

export enum ResumeMode {
  NATIVE = 'native',
  PROMPT_CONCAT = 'prompt-concat',
  HYBRID = 'hybrid',
  DISABLED = 'disabled',
}

export enum ContextFormat {
  PLAIN = 'plain',
  YAML = 'yaml',
  JSON = 'json',
}

// ============================================================
// Data interfaces
// ============================================================

export interface ConversationTurn {
  role: string;
  content: string;
  timestamp: string | null;
  tool_calls: Record<string, unknown>[] | null;
  metadata: Record<string, unknown> | null;
}

export interface SessionContext {
  session_id: string;
  history: ConversationTurn[];
  last_state: Record<string, unknown> | null;
  resumed_at: string | null;
  resume_mode: ResumeMode;
  checkpoint_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ResumeDecision {
  strategy: ResumeMode;
  native_session_id?: string | null;
  is_latest: boolean;
  context_turns?: ConversationTurn[] | null;
  primary_conversation_id?: string | null;
  context_format: ContextFormat;
  fallback_strategy?: ResumeMode | null;
  reason?: string | null;
}

export interface CheckpointState {
  checkpoint_id: string;
  session_id: string;
  created_at: string;
  workflow_step: string;
  state_data: Record<string, unknown>;
  history_snapshot: ConversationTurn[];
}

// ============================================================
// Serialization helpers
// ============================================================

export function conversationTurnToDict(turn: ConversationTurn): Record<string, unknown> {
  return {
    role: turn.role,
    content: turn.content,
    timestamp: turn.timestamp,
    tool_calls: turn.tool_calls,
    metadata: turn.metadata,
  };
}

export function conversationTurnFromDict(data: Record<string, unknown>): ConversationTurn {
  return {
    role: data['role'] as string,
    content: data['content'] as string,
    timestamp: (data['timestamp'] as string) ?? null,
    tool_calls: (data['tool_calls'] as Record<string, unknown>[]) ?? null,
    metadata: (data['metadata'] as Record<string, unknown>) ?? null,
  };
}

export function sessionContextToDict(ctx: SessionContext): Record<string, unknown> {
  return {
    session_id: ctx.session_id,
    history: ctx.history.map(conversationTurnToDict),
    last_state: ctx.last_state,
    resumed_at: ctx.resumed_at,
    resume_mode: ctx.resume_mode,
    checkpoint_id: ctx.checkpoint_id,
    metadata: ctx.metadata,
  };
}

export function sessionContextFromDict(data: Record<string, unknown>): SessionContext {
  const resumed = data['resumed_at'] as string | undefined;
  return {
    session_id: data['session_id'] as string,
    history: ((data['history'] as Record<string, unknown>[]) ?? []).map(conversationTurnFromDict),
    last_state: (data['last_state'] as Record<string, unknown>) ?? null,
    resumed_at: resumed ?? null,
    resume_mode: (data['resume_mode'] as ResumeMode) ?? ResumeMode.NATIVE,
    checkpoint_id: (data['checkpoint_id'] as string) ?? null,
    metadata: (data['metadata'] as Record<string, unknown>) ?? null,
  };
}

export function checkpointStateToDict(cp: CheckpointState): Record<string, unknown> {
  return {
    checkpoint_id: cp.checkpoint_id,
    session_id: cp.session_id,
    created_at: cp.created_at,
    workflow_step: cp.workflow_step,
    state_data: cp.state_data,
    history_snapshot: cp.history_snapshot.map(conversationTurnToDict),
  };
}

export function checkpointStateFromDict(data: Record<string, unknown>): CheckpointState {
  return {
    checkpoint_id: data['checkpoint_id'] as string,
    session_id: data['session_id'] as string,
    created_at: data['created_at'] as string,
    workflow_step: data['workflow_step'] as string,
    state_data: data['state_data'] as Record<string, unknown>,
    history_snapshot: ((data['history_snapshot'] as Record<string, unknown>[]) ?? []).map(conversationTurnFromDict),
  };
}

// ============================================================
// Abstract base class
// ============================================================

export abstract class ResumeStrategy {
  protected basePath: string;
  protected checkpointsPath: string;

  constructor(basePath: string = '.writing/sessions') {
    this.basePath = path.resolve(basePath);
    this.checkpointsPath = path.join(this.basePath, '.checkpoints');
    fs.mkdirSync(this.checkpointsPath, { recursive: true });
  }

  abstract canResume(sessionId: string): boolean;
  abstract resume(sessionId: string): SessionContext;
  abstract saveCheckpoint(sessionId: string, state: Record<string, unknown>): string;

  getCheckpointPath(sessionId: string): string {
    return path.join(this.checkpointsPath, `${sessionId}.json`);
  }

  listCheckpoints(sessionId: string): CheckpointState[] {
    const checkpointFile = this.getCheckpointPath(sessionId);
    if (!fs.existsSync(checkpointFile)) return [];

    try {
      const data = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
      const checkpoints = (data['checkpoints'] as Record<string, unknown>[]) ?? [];
      return checkpoints.map(cp => checkpointStateFromDict(cp));
    } catch (e) {
      console.warn(`Failed to load checkpoints for ${sessionId}: ${e}`);
      return [];
    }
  }

  getLatestCheckpoint(sessionId: string): CheckpointState | null {
    const checkpoints = this.listCheckpoints(sessionId);
    if (checkpoints.length === 0) return null;
    return checkpoints[checkpoints.length - 1];
  }
}

// ============================================================
// NativeResumeStrategy
// ============================================================

export class NativeResumeStrategy extends ResumeStrategy {
  static readonly NATIVE_SUPPORTED_TOOLS = new Set(['claude', 'gemini', 'codex']);

  private tool: string;
  private sessionMapping: Record<string, string> = {};

  constructor(basePath: string = '.writing/sessions', tool: string = 'gemini') {
    super(basePath);
    this.tool = tool;
    this._loadMapping();
  }

  private _loadMapping(): void {
    const mappingFile = path.join(this.basePath, '.native_mapping.json');
    if (fs.existsSync(mappingFile)) {
      try {
        this.sessionMapping = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
      } catch (e) {
        console.warn(`Failed to load native mapping: ${e}`);
      }
    }
  }

  private _saveMapping(): void {
    const mappingFile = path.join(this.basePath, '.native_mapping.json');
    fs.mkdirSync(path.dirname(mappingFile), { recursive: true });
    fs.writeFileSync(mappingFile, JSON.stringify(this.sessionMapping, null, 2), 'utf-8');
  }

  registerNativeSession(sessionId: string, nativeId: string): void {
    this.sessionMapping[sessionId] = nativeId;
    this._saveMapping();
  }

  getNativeSessionId(sessionId: string): string | null {
    return this.sessionMapping[sessionId] ?? null;
  }

  supportsNative(): boolean {
    return NativeResumeStrategy.NATIVE_SUPPORTED_TOOLS.has(this.tool.toLowerCase());
  }

  canResume(sessionId: string): boolean {
    if (!this.supportsNative()) return false;
    const nativeId = this.getNativeSessionId(sessionId);
    if (!nativeId) return false;
    return this.getLatestCheckpoint(sessionId) !== null;
  }

  resume(sessionId: string): SessionContext {
    if (!this.canResume(sessionId)) {
      throw new Error(`Cannot resume session ${sessionId} with native strategy`);
    }

    const checkpoint = this.getLatestCheckpoint(sessionId);
    const nativeId = this.getNativeSessionId(sessionId);

    return {
      session_id: sessionId,
      history: checkpoint ? checkpoint.history_snapshot : [],
      last_state: checkpoint ? checkpoint.state_data : null,
      resumed_at: new Date().toISOString(),
      resume_mode: ResumeMode.NATIVE,
      checkpoint_id: checkpoint ? checkpoint.checkpoint_id : null,
      metadata: {
        native_session_id: nativeId,
        tool: this.tool,
        resume_command: `--resume ${nativeId}`,
      },
    };
  }

  saveCheckpoint(sessionId: string, state: Record<string, unknown>): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const checkpointId = `cp-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const checkpoint: CheckpointState = {
      checkpoint_id: checkpointId,
      session_id: sessionId,
      created_at: now.toISOString(),
      workflow_step: (state['current_step'] as string) ?? 'unknown',
      state_data: state,
      history_snapshot: (state['history'] as ConversationTurn[]) ?? [],
    };

    const checkpointFile = this.getCheckpointPath(sessionId);
    let existing: Record<string, unknown> = { checkpoints: [] };
    if (fs.existsSync(checkpointFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
      } catch {
        // keep default
      }
    }

    const checkpoints = (existing['checkpoints'] as unknown[]) ?? [];
    checkpoints.push(checkpointStateToDict(checkpoint));
    existing['checkpoints'] = checkpoints.slice(-10);

    fs.writeFileSync(checkpointFile, JSON.stringify(existing, null, 2), 'utf-8');
    return checkpointId;
  }
}

// ============================================================
// PromptConcatStrategy
// ============================================================

export class PromptConcatStrategy extends ResumeStrategy {
  private defaultFormat: ContextFormat;
  private maxHistoryTurns: number;

  constructor(
    basePath: string = '.writing/sessions',
    defaultFormat: ContextFormat = ContextFormat.YAML,
    maxHistoryTurns: number = 20,
  ) {
    super(basePath);
    this.defaultFormat = defaultFormat;
    this.maxHistoryTurns = maxHistoryTurns;
  }

  canResume(sessionId: string): boolean {
    return this.getLatestCheckpoint(sessionId) !== null;
  }

  resume(sessionId: string): SessionContext {
    const checkpoint = this.getLatestCheckpoint(sessionId);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for session ${sessionId}`);
    }

    const history = checkpoint.history_snapshot.slice(-this.maxHistoryTurns);

    return {
      session_id: sessionId,
      history,
      last_state: checkpoint.state_data,
      resumed_at: new Date().toISOString(),
      resume_mode: ResumeMode.PROMPT_CONCAT,
      checkpoint_id: checkpoint.checkpoint_id,
      metadata: {
        format: this.defaultFormat,
        history_count: history.length,
        truncated: checkpoint.history_snapshot.length > this.maxHistoryTurns,
      },
    };
  }

  saveCheckpoint(sessionId: string, state: Record<string, unknown>): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const checkpointId = `cp-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const historyData = (state['history'] ?? []) as unknown[];
    const history: ConversationTurn[] = historyData.map(item => {
      if (item && typeof item === 'object' && 'role' in (item as Record<string, unknown>)) {
        return conversationTurnFromDict(item as Record<string, unknown>);
      }
      return conversationTurnFromDict(item as Record<string, unknown>);
    });

    const checkpoint: CheckpointState = {
      checkpoint_id: checkpointId,
      session_id: sessionId,
      created_at: now.toISOString(),
      workflow_step: (state['current_step'] as string) ?? 'unknown',
      state_data: state,
      history_snapshot: history,
    };

    const checkpointFile = this.getCheckpointPath(sessionId);
    let existing: Record<string, unknown> = { checkpoints: [] };
    if (fs.existsSync(checkpointFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
      } catch {
        // keep default
      }
    }

    const checkpoints = (existing['checkpoints'] as unknown[]) ?? [];
    checkpoints.push(checkpointStateToDict(checkpoint));
    existing['checkpoints'] = checkpoints.slice(-10);

    fs.writeFileSync(checkpointFile, JSON.stringify(existing, null, 2), 'utf-8');
    return checkpointId;
  }

  buildContextPrefix(ctx: SessionContext, format?: ContextFormat): string {
    const fmt = format ?? this.defaultFormat;
    if (fmt === ContextFormat.PLAIN) return this._buildPlainPrefix(ctx);
    if (fmt === ContextFormat.YAML) return this._buildYamlPrefix(ctx);
    return this._buildJsonPrefix(ctx);
  }

  private _buildPlainPrefix(ctx: SessionContext): string {
    const lines: string[] = ['=== PREVIOUS CONVERSATION ===\n'];
    for (const turn of ctx.history) {
      lines.push(`[${turn.role.toUpperCase()}]:`);
      lines.push(turn.content);
      lines.push('');
    }
    lines.push('=== CONTINUATION ===\n');
    return lines.join('\n');
  }

  private _buildYamlPrefix(ctx: SessionContext): string {
    const historyData = ctx.history.map(turn => {
      const entry: Record<string, unknown> = { role: turn.role, content: turn.content };
      if (turn.timestamp) entry['timestamp'] = turn.timestamp;
      return entry;
    });

    const prefixData = {
      previous_conversation: {
        session_id: ctx.session_id,
        resumed_from: ctx.checkpoint_id,
        turns: historyData,
      },
    };

    // Simple YAML serialization (no external dep)
    const yamlStr = JSON.stringify(prefixData, null, 2)
      .replace(/^"/, '')
      .replace(/"$/, '');

    return `---\n${JSON.stringify(prefixData, null, 2)}\n---\n\n`;
  }

  private _buildJsonPrefix(ctx: SessionContext): string {
    const historyData = ctx.history.map(turn => {
      const entry: Record<string, unknown> = { role: turn.role, content: turn.content };
      if (turn.timestamp) entry['timestamp'] = turn.timestamp;
      return entry;
    });

    const prefixData = {
      previous_conversation: {
        session_id: ctx.session_id,
        resumed_from: ctx.checkpoint_id,
        turns: historyData,
      },
    };

    const jsonStr = JSON.stringify(prefixData, null, 2);
    return `\`\`\`json\n${jsonStr}\n\`\`\`\n\n`;
  }
}

// ============================================================
// HybridStrategy
// ============================================================

export class HybridStrategy extends ResumeStrategy {
  private tool: string;
  private fallbackFormat: ContextFormat;
  private nativeStrategy: NativeResumeStrategy;
  private concatStrategy: PromptConcatStrategy;

  constructor(
    basePath: string = '.writing/sessions',
    tool: string = 'gemini',
    fallbackFormat: ContextFormat = ContextFormat.YAML,
  ) {
    super(basePath);
    this.tool = tool;
    this.fallbackFormat = fallbackFormat;
    this.nativeStrategy = new NativeResumeStrategy(basePath, tool);
    this.concatStrategy = new PromptConcatStrategy(basePath, fallbackFormat);
  }

  canResume(sessionId: string): boolean {
    return this.nativeStrategy.canResume(sessionId) || this.concatStrategy.canResume(sessionId);
  }

  resume(sessionId: string): SessionContext {
    if (this.nativeStrategy.canResume(sessionId)) {
      try {
        const context = this.nativeStrategy.resume(sessionId);
        console.info(`Resumed session ${sessionId} with native strategy`);
        return context;
      } catch (e) {
        console.warn(`Native resume failed for ${sessionId}, falling back to concat: ${e}`);
      }
    }

    if (this.concatStrategy.canResume(sessionId)) {
      const context = this.concatStrategy.resume(sessionId);
      context.metadata = { ...(context.metadata ?? {}), fallback_used: true, original_mode: ResumeMode.NATIVE };
      console.info(`Resumed session ${sessionId} with concat fallback`);
      return context;
    }

    throw new Error(`Cannot resume session ${sessionId} with any strategy`);
  }

  saveCheckpoint(sessionId: string, state: Record<string, unknown>): string {
    return this.concatStrategy.saveCheckpoint(sessionId, state);
  }

  mergeSessions(sessionIds: string[], targetSessionId?: string): SessionContext {
    if (sessionIds.length === 0) {
      throw new Error('No sessions to merge');
    }

    const mergedHistory: ConversationTurn[] = [];
    const mergedState: Record<string, unknown> = {};

    for (const sid of sessionIds) {
      const checkpoint = this.getLatestCheckpoint(sid);
      if (checkpoint) {
        mergedHistory.push(...checkpoint.history_snapshot);
        Object.assign(mergedState, checkpoint.state_data);
      }
    }

    mergedHistory.sort((a, b) => {
      const ta = a.timestamp ?? '';
      const tb = b.timestamp ?? '';
      return ta.localeCompare(tb);
    });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const targetId = targetSessionId ?? `merged-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    return {
      session_id: targetId,
      history: mergedHistory,
      last_state: mergedState,
      resumed_at: now.toISOString(),
      resume_mode: ResumeMode.HYBRID,
      checkpoint_id: null,
      metadata: {
        merged_from: sessionIds,
        merge_count: sessionIds.length,
      },
    };
  }
}

// Aliases for backward compatibility
export class PromptConcatResumeStrategy extends PromptConcatStrategy {}
export class HybridResumeStrategy extends HybridStrategy {}

// ============================================================
// ResumeStrategyResolver
// ============================================================

export class ResumeStrategyResolver {
  private basePath: string;

  constructor(basePath: string = '.writing/sessions') {
    this.basePath = path.resolve(basePath);
  }

  determineStrategy(
    tool: string,
    resumeIds: string[],
    customId?: string | null,
    getNativeSessionId?: ((sid: string) => string | null) | null,
    getConversationTool?: ((sid: string) => string | null) | null,
  ): ResumeDecision {
    if (!resumeIds || resumeIds.length === 0) {
      return { strategy: ResumeMode.DISABLED, is_latest: true, context_format: ContextFormat.YAML, reason: 'No resume IDs provided' };
    }

    const supportsNative = NativeResumeStrategy.NATIVE_SUPPORTED_TOOLS.has(tool.toLowerCase());

    // Scenario 1: single append (no custom_id)
    if (resumeIds.length === 1 && !customId) {
      const sessionId = resumeIds[0];

      // Cross-tool check
      if (getConversationTool) {
        const originalTool = getConversationTool(sessionId);
        if (originalTool && originalTool.toLowerCase() !== tool.toLowerCase()) {
          return {
            strategy: ResumeMode.PROMPT_CONCAT,
            is_latest: true,
            context_format: ContextFormat.YAML,
            reason: `Cross-tool resume: ${originalTool} -> ${tool}`,
          };
        }
      }

      // Native resume check
      if (supportsNative && getNativeSessionId) {
        const nativeId = getNativeSessionId(sessionId);
        if (nativeId) {
          return {
            strategy: ResumeMode.NATIVE,
            native_session_id: nativeId,
            is_latest: true,
            context_format: ContextFormat.YAML,
            reason: 'Single session append with native support',
          };
        }
      }

      return {
        strategy: ResumeMode.PROMPT_CONCAT,
        is_latest: true,
        context_format: ContextFormat.YAML,
        fallback_strategy: supportsNative ? ResumeMode.NATIVE : null,
        reason: 'Native ID not found, using prompt-concat',
      };
    }

    // Scenario 2: Fork (custom_id provided)
    if (customId) {
      return {
        strategy: ResumeMode.PROMPT_CONCAT,
        primary_conversation_id: resumeIds[0],
        is_latest: true,
        context_format: ContextFormat.YAML,
        reason: `Fork scenario: creating new session ${customId}`,
      };
    }

    // Scenario 3: multi-session merge
    if (resumeIds.length > 1) {
      return {
        strategy: ResumeMode.HYBRID,
        primary_conversation_id: resumeIds[0],
        is_latest: true,
        context_format: ContextFormat.YAML,
        reason: `Multi-session merge: ${resumeIds.length} sessions`,
      };
    }

    return {
      strategy: ResumeMode.PROMPT_CONCAT,
      is_latest: true,
      context_format: ContextFormat.YAML,
      reason: 'Default fallback',
    };
  }
}

// ============================================================
// Convenience functions
// ============================================================

export function determineResumeStrategy(
  tool: string,
  resumeIds: string[],
  customId?: string | null,
  getNativeSessionId?: ((sid: string) => string | null) | null,
  getConversationTool?: ((sid: string) => string | null) | null,
): ResumeDecision {
  const resolver = new ResumeStrategyResolver();
  return resolver.determineStrategy(tool, resumeIds, customId, getNativeSessionId, getConversationTool);
}

export function buildContextPrefix(
  contextTurns: ConversationTurn[],
  format: string = 'yaml',
): string {
  const fmt = format === 'yaml' ? ContextFormat.YAML : format === 'json' ? ContextFormat.JSON : ContextFormat.PLAIN;
  const strategy = new PromptConcatStrategy('.writing/sessions', fmt);

  const context: SessionContext = {
    session_id: 'temp',
    history: contextTurns,
    last_state: null,
    resumed_at: new Date().toISOString(),
    resume_mode: ResumeMode.PROMPT_CONCAT,
    checkpoint_id: null,
    metadata: null,
  };

  return strategy.buildContextPrefix(context, fmt);
}

export function createStrategy(
  mode: ResumeMode,
  basePath: string = '.writing/sessions',
  tool: string = 'gemini',
  options?: { format?: ContextFormat; maxHistoryTurns?: number },
): ResumeStrategy {
  if (mode === ResumeMode.NATIVE) {
    return new NativeResumeStrategy(basePath, tool);
  } else if (mode === ResumeMode.PROMPT_CONCAT) {
    return new PromptConcatStrategy(basePath, options?.format ?? ContextFormat.YAML, options?.maxHistoryTurns ?? 20);
  } else if (mode === ResumeMode.HYBRID) {
    return new HybridStrategy(basePath, tool);
  }
  throw new Error(`Unsupported resume mode: ${mode}`);
}
