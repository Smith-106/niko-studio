/**
 * level1-rapid.ts - L1 Rapid mode
 *
 * Stateless, no artifacts, direct output.
 * Suitable for: typo fixes, format adjustments, quick polish, simple Q&A.
 *
 * Migrated from src/workflow/levels/level1_rapid.py
 */

import type { BaseState } from '../state.js';
import { AgentType } from '../../agents/base.js';

// ============================================================
// Container interface (lazy-loaded DI)
// ============================================================

export interface IServiceContainer {
  getAgent(type: AgentType, options?: { name?: string }): {
    run(input: Record<string, unknown>): Record<string, unknown>;
  };
}

// ============================================================
// Level1Rapid
// ============================================================

export class Level1Rapid {
  readonly level = 1;
  readonly name = 'rapid';
  readonly description = '快速模式 - 無狀態、無工件、直接輸出';

  protected config: Record<string, unknown>;
  protected _container: IServiceContainer | null;
  private _writer: { run(input: Record<string, unknown>): Record<string, unknown> } | null;

  constructor(
    config?: Record<string, unknown> | null,
    container?: IServiceContainer | null,
    writer?: { run(input: Record<string, unknown>): Record<string, unknown> } | null,
  ) {
    this.config = (config as Record<string, unknown>) ?? {};
    this._container = container ?? null;
    this._writer = writer ?? null;
  }

  protected get container(): IServiceContainer {
    if (this._container == null) {
      throw new Error('ServiceContainer not available. Ensure container is provided or getContainer() is configured.');
    }
    return this._container;
  }

  private _getWriter(): { run(input: Record<string, unknown>): Record<string, unknown> } {
    if (this._writer == null) {
      this._writer = this.container.getAgent(AgentType.WRITER);
    }
    return this._writer;
  }

  execute(state: BaseState): BaseState {
    const userRequest = state.user_request ?? '';
    const context = state.context ?? '';

    const prompt = this._buildPrompt(userRequest, context);

    try {
      const writer = this._getWriter();
      const result = writer.run({ prompt, mode: 'rapid' });

      state.final_output = (result.content as string) ?? '';
      state.decision = 'APPROVED';
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      state.errors = [...(state.errors ?? []), errorMsg];
      state.decision = 'FAILED';
    }

    return state;
  }

  getRequiredAgents(): string[] {
    return ['writer'];
  }

  getDefaultConfig(): Record<string, unknown> {
    return {
      max_revisions: 0,
      pass_score: 0,
      verbose: false,
    };
  }

  private _buildPrompt(request: string, context?: string): string {
    let prompt = `任務: ${request}\n`;
    if (context) {
      prompt += `\n上下文:\n${context}\n`;
    }
    prompt += '\n請直接給出結果，無需詳細解釋。';
    return prompt;
  }
}
