/**
 * Writing Hooks - Hook system for writing operations
 *
 * Provides lifecycle hooks for writing operations with pre/post/error handling.
 */

import { createLogger } from '../logger/index.js';

const _log = createLogger('writing-hooks');

// ============================================================
// Enums
// ============================================================

export enum HookType {
  PRE_WRITE = 'pre_write',
  POST_WRITE = 'post_write',
  ON_ERROR = 'on_error',
  PRE_EVALUATE = 'pre_evaluate',
  POST_EVALUATE = 'post_evaluate',
  // Workflow lifecycle
  BEFORE_WORKFLOW_START = 'before_workflow_start',
  AFTER_WORKFLOW_STEP = 'after_workflow_step',
  ON_WORKFLOW_ERROR = 'on_workflow_error',
  AFTER_WORKFLOW_COMPLETE = 'after_workflow_complete',
  // Memory lifecycle
  BEFORE_MEMORY_ADD = 'before_memory_add',
  AFTER_MEMORY_SEARCH = 'after_memory_search',
  // LLM lifecycle
  BEFORE_LLM_CALL = 'before_llm_call',
  AFTER_LLM_CALL = 'after_llm_call',
}

export enum HookPriority {
  CRITICAL = 0,
  HIGH = 10,
  NORMAL = 50,
  LOW = 100,
}

// ============================================================
// Data Classes
// ============================================================

export interface HookResult {
  success: boolean;
  modifiedContent: string | null;
  metadata: Record<string, unknown>;
  error: Error | null;
  shouldContinue: boolean;
}

export function hookOk(content?: string | null, metadata?: Record<string, unknown>): HookResult {
  return {
    success: true,
    modifiedContent: content ?? null,
    metadata: metadata ?? {},
    error: null,
    shouldContinue: true,
  };
}

export function hookFail(error: Error, shouldContinue = false): HookResult {
  return { success: false, modifiedContent: null, metadata: {}, error, shouldContinue };
}

export function hookSkip(): HookResult {
  return { success: true, modifiedContent: null, metadata: {}, error: null, shouldContinue: true };
}

export interface HookContext {
  content: string;
  skillId: string | null;
  agentId: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  error: Error | null;
}

export function createHookContext(params: {
  content: string;
  skillId?: string | null;
  agentId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
  error?: Error | null;
}): HookContext {
  return {
    content: params.content,
    skillId: params.skillId ?? null,
    agentId: params.agentId ?? null,
    sessionId: params.sessionId ?? null,
    metadata: params.metadata ?? {},
    error: params.error ?? null,
  };
}

export function withContent(ctx: HookContext, newContent: string): HookContext {
  return {
    content: newContent,
    skillId: ctx.skillId,
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    metadata: { ...ctx.metadata },
    error: ctx.error,
  };
}

// ============================================================
// Hook Function Types
// ============================================================

export type SyncHookFunc = (ctx: HookContext) => HookResult;
export type AsyncHookFunc = (ctx: HookContext) => Promise<HookResult>;
export type HookFunc = SyncHookFunc | AsyncHookFunc;

// ============================================================
// Hook Interface & Implementation
// ============================================================

export interface IHook {
  readonly name: string;
  readonly hookType: HookType;
  readonly priority: HookPriority;
  execute(context: HookContext): Promise<HookResult>;
}

export class Hook implements IHook {
  readonly name: string;
  readonly hookType: HookType;
  readonly func: HookFunc;
  readonly priority: HookPriority;
  enabled: boolean;

  constructor(params: {
    name: string;
    hookType: HookType;
    func: HookFunc;
    priority?: HookPriority;
    enabled?: boolean;
  }) {
    this.name = params.name;
    this.hookType = params.hookType;
    this.func = params.func;
    this.priority = params.priority ?? HookPriority.NORMAL;
    this.enabled = params.enabled ?? true;
  }

  async execute(context: HookContext): Promise<HookResult> {
    if (!this.enabled) return hookSkip();
    try {
      const result = this.func(context);
      if (result instanceof Promise) return await result;
      return result;
    } catch (e) {
      return hookFail(e as Error, true);
    }
  }
}

// ============================================================
// Hook Registry
// ============================================================

export class HookRegistry {
  private _hooks: Map<HookType, Hook[]> = new Map();

  constructor() {
    for (const t of Object.values(HookType)) {
      this._hooks.set(t, []);
    }
  }

  register(
    hookType: HookType,
    priority: HookPriority = HookPriority.NORMAL,
    name?: string,
  ): (func: HookFunc) => HookFunc {
    return (func: HookFunc) => {
      const hookName = name ?? func.name ?? 'anonymous';
      const hook = new Hook({ name: hookName, hookType, func, priority });
      this.addHook(hook);
      return func;
    };
  }

  addHook(hook: Hook): void {
    const hooks = this._hooks.get(hook.hookType) ?? [];
    hooks.push(hook);
    hooks.sort((a, b) => a.priority - b.priority);
    this._hooks.set(hook.hookType, hooks);
  }

  removeHook(hookType: HookType, name: string): boolean {
    const hooks = this._hooks.get(hookType) ?? [];
    const idx = hooks.findIndex(h => h.name === name);
    if (idx >= 0) { hooks.splice(idx, 1); return true; }
    return false;
  }

  enableHook(hookType: HookType, name: string, enabled = true): boolean {
    const hook = (this._hooks.get(hookType) ?? []).find(h => h.name === name);
    if (hook) { hook.enabled = enabled; return true; }
    return false;
  }

  async execute(hookType: HookType, context: HookContext): Promise<HookResult> {
    const hooks = this._hooks.get(hookType) ?? [];
    let currentContext = context;
    const allMetadata: Record<string, unknown> = {};

    for (const hook of hooks) {
      if (!hook.enabled) continue;
      const result = await hook.execute(currentContext);
      Object.assign(allMetadata, result.metadata);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          metadata: allMetadata,
          modifiedContent: currentContext.content,
          shouldContinue: false,
        };
      }

      if (result.modifiedContent !== null) {
        currentContext = withContent(currentContext, result.modifiedContent);
      }
      if (!result.shouldContinue) break;
    }

    return hookOk(currentContext.content, allMetadata);
  }

  listHooks(hookType?: HookType): string[] {
    if (hookType) return (this._hooks.get(hookType) ?? []).map(h => h.name);
    const names: string[] = [];
    for (const hooks of this._hooks.values()) {
      names.push(...hooks.map(h => h.name));
    }
    return names;
  }

  clear(hookType?: HookType): void {
    if (hookType) { this._hooks.set(hookType, []); }
    else { for (const t of Object.values(HookType)) this._hooks.set(t, []); }
  }
}

// ============================================================
// Writing Hooks Manager
// ============================================================

export class WritingHooks {
  readonly registry: HookRegistry;

  constructor(registry?: HookRegistry) {
    this.registry = registry ?? new HookRegistry();
  }

  async preWrite(
    content: string,
    skillId?: string | null,
    agentId?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<HookResult> {
    const ctx = createHookContext({ content, skillId, agentId, metadata });
    return this.registry.execute(HookType.PRE_WRITE, ctx);
  }

  async postWrite(
    content: string,
    skillId?: string | null,
    agentId?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<HookResult> {
    const ctx = createHookContext({ content, skillId, agentId, metadata });
    return this.registry.execute(HookType.POST_WRITE, ctx);
  }

  async onError(
    error: Error,
    content = '',
    skillId?: string | null,
    agentId?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<HookResult> {
    const ctx = createHookContext({ content, skillId, agentId, metadata, error });
    return this.registry.execute(HookType.ON_ERROR, ctx);
  }

  async preEvaluate(content: string, metadata?: Record<string, unknown>): Promise<HookResult> {
    const ctx = createHookContext({ content, metadata });
    return this.registry.execute(HookType.PRE_EVALUATE, ctx);
  }

  async postEvaluate(
    content: string,
    scores?: Record<string, number> | null,
    metadata?: Record<string, unknown>,
  ): Promise<HookResult> {
    const meta = { ...metadata };
    if (scores) meta.scores = scores;
    const ctx = createHookContext({ content, metadata: meta });
    return this.registry.execute(HookType.POST_EVALUATE, ctx);
  }
}

// ============================================================
// Default Hooks
// ============================================================

function createContentLengthHook(): Hook {
  return new Hook({
    name: 'content_length_check',
    hookType: HookType.PRE_WRITE,
    priority: HookPriority.HIGH,
    func: (ctx: HookContext): HookResult => {
      if (ctx.content.length < 10) return hookFail(new Error('Content too short (min 10 chars)'));
      if (ctx.content.length > 100000) return hookFail(new Error('Content too long (max 100000 chars)'));
      return hookOk();
    },
  });
}

function createEncodingHook(): Hook {
  return new Hook({
    name: 'encoding_check',
    hookType: HookType.PRE_WRITE,
    priority: HookPriority.CRITICAL,
    func: (ctx: HookContext): HookResult => {
      try { Buffer.from(ctx.content, 'utf-8'); return hookOk(); }
      catch (e) { return hookFail(e as Error); }
    },
  });
}

function createErrorLoggingHook(): Hook {
  return new Hook({
    name: 'error_logging',
    hookType: HookType.ON_ERROR,
    priority: HookPriority.CRITICAL,
    func: (ctx: HookContext): HookResult => {
      if (ctx.error) _log.error(`Writing error in skill=${ctx.skillId}, agent=${ctx.agentId}`, { detail: ctx.error });
      return hookOk();
    },
  });
}

export function getDefaultWritingHooks(): WritingHooks {
  const registry = new HookRegistry();
  registry.addHook(createContentLengthHook());
  registry.addHook(createEncodingHook());
  registry.addHook(createErrorLoggingHook());
  return new WritingHooks(registry);
}
