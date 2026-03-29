/**
 * Base Workflow - Workflow lifecycle and execution interface.
 *
 * Migrated from src/workflow/base_workflow.py
 */

import type { BaseState } from './state.js';

export abstract class BaseWorkflow {
  protected config: Record<string, unknown>;

  constructor(config?: Record<string, unknown> | null) {
    this.config = config ?? {};
  }

  /**
   * Execute the workflow.
   */
  abstract run(inputData: unknown): unknown;

  /**
   * Get the current workflow state.
   */
  abstract getState(): BaseState;
}
