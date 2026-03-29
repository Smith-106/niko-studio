/**
 * Base Level - Abstract base class for workflow levels.
 *
 * Migrated from src/workflow/base_level.py
 * (Original Python file did not exist; this provides the interface
 *  expected by the level system in types.ts)
 */

import type { LevelConfig, WorkflowLevelValue } from '../types.js';

export abstract class BaseLevel {
  protected config: LevelConfig;

  constructor(config: LevelConfig) {
    this.config = config;
  }

  /** The numeric level value (1-5). */
  get level(): WorkflowLevelValue {
    return this.config.level;
  }

  /**
   * Execute a single step within this level.
   */
  abstract execute(inputData: unknown): Promise<unknown>;

  /**
   * Validate whether the level's output meets quality thresholds.
   */
  abstract validate(output: unknown): boolean;
}
