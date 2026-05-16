/**
 * base.ts - Base agent with token budget management and CCW prompt protocol.
 *
 * Migrated from src/agents/base.py
 */

import { createLogger } from '../logger/index.js';

// ============================================================
// Enums
// ============================================================

export enum ModelProvider {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
  GOOGLE = "google",
  LOCAL = "local",
}

export enum AgentType {
  COMMANDER = "commander",
  ARCHITECT = "architect",
  WRITER = "writer",
  CRITIC = "critic",
  PLOT = "plot",
}

// ============================================================
// Interfaces (Python dataclasses -> TS interfaces)
// ============================================================

export interface ModelPricing {
  /** Input token cost ($/1M tokens) */
  inputCost: number;
  /** Output token cost ($/1M tokens) */
  outputCost: number;
  provider: ModelProvider;
  /** Default context window size */
  contextWindow: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
}

export interface BudgetConfig {
  maxCostPerRequest: number;
  maxCostPerSession: number;
  maxTokensPerRequest: number;
  warnThreshold: number;
}

// ============================================================
// BudgetExceededError
// ============================================================

export class BudgetExceededError extends Error {
  public readonly currentCost: number;
  public readonly limit: number;

  constructor(message: string, currentCost: number, limit: number) {
    super(message);
    this.name = "BudgetExceededError";
    this.currentCost = currentCost;
    this.limit = limit;
  }
}

// ============================================================
// Service interfaces used by agent subclasses
// ============================================================

export interface IAgentLLMService {
  generate(
    userPrompt: string,
    options?: { systemPrompt?: string; temperature?: number },
  ): Promise<string>;
  generateJson<T>(
    userPrompt: string,
    options?: { systemPrompt?: string; temperature?: number },
  ): Promise<T>;
}

export interface IAgentGraphEngine {
  query(cypherOrQuery: string): Promise<Record<string, unknown>[]>;
}

export interface IAgentMemoryEngine {
  search(
    query: string,
    options?: { limit?: number },
  ): Promise<Record<string, unknown>[]>;
}

// ============================================================
// MODEL_PRICING constant
// ============================================================

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o": { inputCost: 2.5, outputCost: 10.0, provider: ModelProvider.OPENAI, contextWindow: 128000 },
  "gpt-4o-mini": { inputCost: 0.15, outputCost: 0.6, provider: ModelProvider.OPENAI, contextWindow: 128000 },
  "gpt-4-turbo": { inputCost: 10.0, outputCost: 30.0, provider: ModelProvider.OPENAI, contextWindow: 128000 },
  "gpt-3.5-turbo": { inputCost: 0.5, outputCost: 1.5, provider: ModelProvider.OPENAI, contextWindow: 16385 },
  // Anthropic
  "claude-3-opus": { inputCost: 15.0, outputCost: 75.0, provider: ModelProvider.ANTHROPIC, contextWindow: 200000 },
  "claude-3-sonnet": { inputCost: 3.0, outputCost: 15.0, provider: ModelProvider.ANTHROPIC, contextWindow: 200000 },
  "claude-3-haiku": { inputCost: 0.25, outputCost: 1.25, provider: ModelProvider.ANTHROPIC, contextWindow: 200000 },
  "claude-3.5-sonnet": { inputCost: 3.0, outputCost: 15.0, provider: ModelProvider.ANTHROPIC, contextWindow: 200000 },
  // Google
  "gemini-1.5-pro": { inputCost: 1.25, outputCost: 5.0, provider: ModelProvider.GOOGLE, contextWindow: 1000000 },
  "gemini-1.5-flash": { inputCost: 0.075, outputCost: 0.3, provider: ModelProvider.GOOGLE, contextWindow: 1000000 },
  // Local (no cost)
  "local": { inputCost: 0.0, outputCost: 0.0, provider: ModelProvider.LOCAL, contextWindow: 32000 },
};

// ============================================================
// Helpers for TokenUsage serialisation
// ============================================================

export function tokenUsageToDict(u: TokenUsage): Record<string, unknown> {
  return {
    input_tokens: u.inputTokens,
    output_tokens: u.outputTokens,
    total_tokens: u.totalTokens,
    estimated_cost: u.estimatedCost,
    timestamp: u.timestamp.toISOString(),
  };
}

// ============================================================
// BaseAgent abstract class
// ============================================================

import { LifecycleStage, type AgentLifecycleHook, type AgentContext, LifecycleHookRegistry } from './lifecycle-hooks';
import type { Logger } from '../logger/index.js';

export abstract class BaseAgent {
  public readonly name: string;
  public readonly config: Record<string, unknown>;

  protected _modelName: string;
  protected _usageHistory: TokenUsage[];
  protected _sessionCost: number;
  protected _budgetConfig: BudgetConfig;
  protected _hookRegistry: LifecycleHookRegistry;
  protected _logger: Logger;

  constructor(name: string, config?: Record<string, unknown>) {
    this.name = name;
    this.config = config ?? {};

    this._modelName = (this.config["model"] as string) ?? "gpt-4o";
    this._usageHistory = [];
    this._sessionCost = 0.0;
    this._hookRegistry = new LifecycleHookRegistry();
    this._logger = createLogger(`agent/${name}`);
    this._budgetConfig = {
      maxCostPerRequest: (this.config["max_cost_per_request"] as number) ?? 1.0,
      maxCostPerSession: (this.config["max_cost_per_session"] as number) ?? 10.0,
      maxTokensPerRequest: (this.config["max_tokens_per_request"] as number) ?? 100000,
      warnThreshold: (this.config["budget_warn_threshold"] as number) ?? 0.8,
    };
  }

  // ---------- Token counting (character-based approximation) ----------

  /**
   * Count tokens using character-based approximation (4 chars ~ 1 token).
   */
  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // ---------- Cost estimation ----------

  estimateCost(
    inputText: string,
    estimatedOutputTokens?: number,
    model?: string,
  ): TokenUsage {
    const modelName = model ?? this._modelName;
    const pricing = MODEL_PRICING[modelName] ?? MODEL_PRICING["gpt-4o"];

    const inputTokens = this.countTokens(inputText);
    const outputTokens = estimatedOutputTokens ?? Math.max(Math.floor(inputTokens / 2), 500);
    const totalTokens = inputTokens + outputTokens;

    // Pricing is per 1M tokens
    const inputCost = (inputTokens / 1_000_000) * pricing.inputCost;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputCost;
    const totalCost = inputCost + outputCost;

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: totalCost,
      timestamp: new Date(),
    };
  }

  // ---------- Budget checking ----------

  checkBudget(
    estimatedUsage: TokenUsage,
    raiseOnExceed: boolean = true,
  ): [boolean, string | null] {
    // Per-request cost limit
    if (estimatedUsage.estimatedCost > this._budgetConfig.maxCostPerRequest) {
      const msg = `Request cost $${estimatedUsage.estimatedCost.toFixed(4)} exceeds limit $${this._budgetConfig.maxCostPerRequest}`;
      if (raiseOnExceed) {
        throw new BudgetExceededError(msg, estimatedUsage.estimatedCost, this._budgetConfig.maxCostPerRequest);
      }
      return [false, msg];
    }

    // Session cost limit
    const projectedSessionCost = this._sessionCost + estimatedUsage.estimatedCost;
    if (projectedSessionCost > this._budgetConfig.maxCostPerSession) {
      const msg = `Session cost $${projectedSessionCost.toFixed(4)} would exceed limit $${this._budgetConfig.maxCostPerSession}`;
      if (raiseOnExceed) {
        throw new BudgetExceededError(msg, projectedSessionCost, this._budgetConfig.maxCostPerSession);
      }
      return [false, msg];
    }

    // Token count limit
    if (estimatedUsage.totalTokens > this._budgetConfig.maxTokensPerRequest) {
      const msg = `Token count ${estimatedUsage.totalTokens} exceeds limit ${this._budgetConfig.maxTokensPerRequest}`;
      if (raiseOnExceed) {
        throw new BudgetExceededError(msg, estimatedUsage.totalTokens, this._budgetConfig.maxTokensPerRequest);
      }
      return [false, msg];
    }

    // Warning threshold checks
    const warnings: string[] = [];
    const wt = this._budgetConfig.warnThreshold;

    if (estimatedUsage.estimatedCost > this._budgetConfig.maxCostPerRequest * wt) {
      warnings.push(`Request approaching cost limit (${estimatedUsage.estimatedCost.toFixed(4)}/${this._budgetConfig.maxCostPerRequest})`);
    }

    if (projectedSessionCost > this._budgetConfig.maxCostPerSession * wt) {
      warnings.push(`Session approaching cost limit (${projectedSessionCost.toFixed(4)}/${this._budgetConfig.maxCostPerSession})`);
    }

    const warningMsg = warnings.length > 0 ? warnings.join("; ") : null;
    if (warningMsg) {
      this._logger.warn(warningMsg);
    }

    return [true, warningMsg];
  }

  // ---------- Usage recording ----------

  recordUsage(usage: TokenUsage): void {
    this._usageHistory.push(usage);
    this._sessionCost += usage.estimatedCost;
    this._logger.debug(
      `Token usage recorded: ${usage.totalTokens} tokens, ` +
      `$${usage.estimatedCost.toFixed(4)}, session total: $${this._sessionCost.toFixed(4)}`,
    );
  }

  getUsageSummary(): Record<string, unknown> {
    const totalInput = this._usageHistory.reduce((s, u) => s + u.inputTokens, 0);
    const totalOutput = this._usageHistory.reduce((s, u) => s + u.outputTokens, 0);

    return {
      agent_name: this.name,
      model: this._modelName,
      request_count: this._usageHistory.length,
      total_input_tokens: totalInput,
      total_output_tokens: totalOutput,
      total_tokens: totalInput + totalOutput,
      total_cost: this._sessionCost,
      budget_remaining: this._budgetConfig.maxCostPerSession - this._sessionCost,
      history: this._usageHistory.slice(-10).map(tokenUsageToDict),
    };
  }

  resetSession(): void {
    this._usageHistory.length = 0;
    this._sessionCost = 0.0;
    this._logger.info("Session usage reset");
  }

  // ---------- CCW 6-Field Prompt Protocol ----------

  constructPrompt(
    purpose: string,
    task: string,
    mode: string,
    context: string,
    expected: string,
    rules: string,
  ): string {
    return (
      `\nPURPOSE: ${purpose}\n` +
      `TASK: ${task}\n` +
      `MODE: ${mode}\n` +
      `CONTEXT: ${context}\n` +
      `EXPECTED: ${expected}\n` +
      `RULES: ${rules}\n`
    );
  }

  // ---------- Lifecycle hooks ----------

  addHook(stage: LifecycleStage, handler: AgentLifecycleHook): void {
    this._hookRegistry.register(stage, handler);
  }

  protected async runLifecycle(
    stage: LifecycleStage,
    context: AgentContext,
  ): Promise<AgentContext> {
    return this._hookRegistry.execute(stage, context);
  }

  // ---------- Abstract run method ----------

  abstract run(inputData: unknown): unknown;

  // ---------- Logging helper ----------

  logActivity(message: string, level: "INFO" | "WARNING" | "ERROR" | "DEBUG" = "INFO"): void {
    switch (level) {
      case "WARNING":
        this._logger.warn(message);
        break;
      case "ERROR":
        this._logger.error(message);
        break;
      case "DEBUG":
        this._logger.debug(message);
        break;
      default:
        this._logger.info(message);
        break;
    }
  }
}
