/**
 * TokenService - Token estimation and cost control
 *
 * Migrated from src/services/token_service.py.
 * Provides local token estimation, cost calculation, and budget control.
 */

import Database from 'better-sqlite3';
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Model pricing table ($/1M tokens)
// ---------------------------------------------------------------------------

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI Models
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'o1-preview': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },

  // Anthropic Models
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku': { input: 0.80, output: 4.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },

  // Google Models
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },

  // Default
  default: { input: 1.00, output: 3.00 },
};

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface TokenUsageRecord {
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}

export interface BudgetStatus {
  sessionId: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  budget: number;
  remaining: number;
  usagePercent: number;
  requestCount: number;
}

// ---------------------------------------------------------------------------
// TokenService
// ---------------------------------------------------------------------------

export class TokenService {
  private readonly _dbPath: string;
  private _db: Database.Database | null = null;
  private readonly _defaultBudget: number;

  constructor(dbPath?: string, config?: { maxCostPerSession?: number }) {
    this._dbPath = resolve(dbPath ?? '.writing/token_usage.db');
    mkdirSync(join(this._dbPath, '..'), { recursive: true });
    this._defaultBudget = config?.maxCostPerSession ?? 10.0;
    this._initDb();
  }

  // -----------------------------------------------------------------
  // Token estimation
  // -----------------------------------------------------------------

  /**
   * Estimate the number of tokens in text.
   * Uses approximate counting (no tiktoken in Node.js).
   * Chinese: ~1.5 chars/token, English: ~4 chars/token.
   */
  estimateTokens(text: string, _model = 'gpt-4o'): number {
    if (!text) return 0;

    let chineseChars = 0;
    for (const c of text) {
      if (c >= '\u4e00' && c <= '\u9fff') chineseChars++;
    }
    const otherChars = text.length - chineseChars;
    return Math.floor(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * Estimate tokens for a messages array (OpenAI format)
   */
  estimateMessages(messages: Array<Record<string, unknown>>, model = 'gpt-4o'): number {
    let totalTokens = 0;
    const tokensPerMessage = 3;
    const tokensPerName = 1;

    for (const message of messages) {
      totalTokens += tokensPerMessage;

      const content = message.content;
      if (typeof content === 'string') {
        totalTokens += this.estimateTokens(content, model);
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part === 'object' && part !== null && 'text' in part) {
            totalTokens += this.estimateTokens((part as { text: string }).text, model);
          } else if (typeof part === 'object' && part !== null && 'image_url' in part) {
            totalTokens += 85; // Low-res base value
          }
        }
      }

      if ('name' in message && typeof message.name === 'string') {
        totalTokens += tokensPerName;
        totalTokens += this.estimateTokens(message.name, model);
      }
    }

    totalTokens += 3; // Conversation end tokens
    return totalTokens;
  }

  // -----------------------------------------------------------------
  // Cost analysis
  // -----------------------------------------------------------------

  estimateCost(inputTokens: number, outputTokens: number, model: string): number {
    const pricing = this.getModelPricing(model);
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }

  getModelPricing(model: string): { input: number; output: number } {
    if (model in MODEL_PRICING) {
      return MODEL_PRICING[model];
    }
    // Try prefix match
    for (const key of Object.keys(MODEL_PRICING)) {
      if (model.startsWith(key)) {
        return MODEL_PRICING[key];
      }
    }
    return MODEL_PRICING['default'];
  }

  listModels(): Array<{ model: string; inputPrice: number; outputPrice: number; encoding: string }> {
    const results: Array<{ model: string; inputPrice: number; outputPrice: number; encoding: string }> = [];
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      if (model === 'default') continue;
      results.push({
        model,
        inputPrice: pricing.input,
        outputPrice: pricing.output,
        encoding: 'cl100k_base',
      });
    }
    return results;
  }

  // -----------------------------------------------------------------
  // Budget control
  // -----------------------------------------------------------------

  setBudget(sessionId: string, budget: number): void {
    const db = this._getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO budgets (session_id, budget, created_at, updated_at)
      VALUES (?, ?, COALESCE(
        (SELECT created_at FROM budgets WHERE session_id = ?),
        ?
      ), ?)
    `).run(sessionId, budget, sessionId, now, now);
  }

  getBudget(sessionId: string): number {
    const db = this._getDb();
    const row = db.prepare('SELECT budget FROM budgets WHERE session_id = ?').get(sessionId) as { budget: number } | undefined;
    return row?.budget ?? this._defaultBudget;
  }

  checkBudget(estimatedCost: number, budget?: number, sessionId?: string): boolean {
    const limit = budget ?? this._defaultBudget;

    if (sessionId) {
      const status = this.getBudgetStatus(sessionId);
      return estimatedCost <= status.remaining;
    }

    return estimatedCost <= limit;
  }

  getBudgetStatus(sessionId?: string): BudgetStatus {
    const sid = sessionId ?? 'default';
    const db = this._getDb();

    const budget = this.getBudget(sid);

    const row = db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as total_input,
        COALESCE(SUM(output_tokens), 0) as total_output,
        COALESCE(SUM(cost), 0) as total_cost,
        COUNT(*) as request_count
      FROM token_usage
      WHERE session_id = ?
    `).get(sid) as { total_input: number; total_output: number; total_cost: number; request_count: number };

    const totalCost = row.total_cost;
    const remaining = Math.max(0, budget - totalCost);
    const usagePercent = budget > 0 ? (totalCost / budget) * 100 : 0;

    return {
      sessionId: sid,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
      totalInputTokens: row.total_input,
      totalOutputTokens: row.total_output,
      budget,
      remaining: Math.round(remaining * 1_000_000) / 1_000_000,
      usagePercent: Math.round(usagePercent * 100) / 100,
      requestCount: row.request_count,
    };
  }

  // -----------------------------------------------------------------
  // Usage tracking
  // -----------------------------------------------------------------

  recordUsage(
    tokens: number,
    cost: number,
    model: string,
    sessionId?: string,
    inputTokens?: number,
    outputTokens?: number,
  ): void {
    const sid = sessionId ?? 'default';

    let inp = inputTokens;
    let out = outputTokens;
    if (inp == null && out == null) {
      inp = Math.floor(tokens * 0.7);
      out = tokens - inp;
    }

    const db = this._getDb();
    db.prepare(`
      INSERT INTO token_usage (session_id, model, input_tokens, output_tokens, cost, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sid, model, inp ?? 0, out ?? 0, cost, new Date().toISOString());
  }

  getUsageHistory(sessionId?: string, limit = 100): TokenUsageRecord[] {
    const db = this._getDb();

    let rows: Array<Record<string, unknown>>;
    if (sessionId) {
      rows = db.prepare(
        'SELECT * FROM token_usage WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?',
      ).all(sessionId, limit) as Array<Record<string, unknown>>;
    } else {
      rows = db.prepare(
        'SELECT * FROM token_usage ORDER BY timestamp DESC LIMIT ?',
      ).all(limit) as Array<Record<string, unknown>>;
    }

    return rows.map((row) => ({
      sessionId: row.session_id as string,
      model: row.model as string,
      inputTokens: row.input_tokens as number,
      outputTokens: row.output_tokens as number,
      cost: row.cost as number,
      timestamp: new Date(row.timestamp as string),
    }));
  }

  getUsageSummary(
    sessionId?: string,
    groupBy: 'model' | 'day' | 'session' = 'model',
  ): Array<Record<string, unknown>> {
    const db = this._getDb();

    let groupCol: string;
    if (groupBy === 'model') {
      groupCol = 'model';
    } else if (groupBy === 'day') {
      groupCol = "DATE(timestamp)";
    } else {
      groupCol = 'session_id';
    }

    let sql = `
      SELECT
        ${groupCol} as group_key,
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        SUM(cost) as total_cost,
        COUNT(*) as request_count
      FROM token_usage
    `;

    const params: unknown[] = [];
    if (sessionId) {
      sql += ' WHERE session_id = ?';
      params.push(sessionId);
    }

    sql += ` GROUP BY ${groupCol} ORDER BY total_cost DESC`;

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      [groupBy]: row.group_key,
      input_tokens: row.total_input,
      output_tokens: row.total_output,
      total_cost: Math.round((row.total_cost as number) * 1_000_000) / 1_000_000,
      request_count: row.request_count,
    }));
  }

  clearSessionUsage(sessionId: string): number {
    const db = this._getDb();
    const result = db.prepare('DELETE FROM token_usage WHERE session_id = ?').run(sessionId);
    return result.changes;
  }

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------

  close(): void {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  // -----------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------

  private _getDb(): Database.Database {
    if (!this._db) {
      this._db = new Database(this._dbPath);
      this._db.pragma('journal_mode = WAL');
    }
    return this._db;
  }

  private _initDb(): void {
    const db = this._getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0.0,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS budgets (
        session_id TEXT PRIMARY KEY,
        budget REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_usage_session ON token_usage(session_id);
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON token_usage(timestamp);
    `);
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: TokenService | null = null;

export function getTokenService(dbPath?: string, config?: unknown): TokenService {
  if (!_instance) {
    _instance = new TokenService(dbPath, config as { maxCostPerSession?: number } | undefined);
  }
  return _instance;
}

export function resetTokenService(): void {
  if (_instance) {
    _instance.close();
  }
  _instance = null;
}
