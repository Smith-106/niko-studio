/**
 * ArtifactContract — typed interface over workflow stage artifact passing
 *
 * Each workflow stage (analyze, plan, execute, verify, review) declares
 * the artifacts it consumes (inputSchema) and produces (outputSchema).
 * ArtifactResolver matches declared schemas against the state.json artifacts
 * array and resolves concrete file paths.
 *
 * This is a utility module — import and use directly. No DI registration needed.
 */

import * as path from 'path';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Declares the artifact contract for a single workflow stage.
 *
 * `inputSchema` maps a semantic key to the expected filename/path pattern
 * (e.g. `{ conclusions: 'conclusions.json' }`).
 *
 * `outputSchema` maps a semantic key to the filename or glob-like pattern
 * this stage produces (e.g. `{ summaries: '.summaries/TASK-*-summary.md' }`).
 */
export interface IArtifactContract {
  /** Which workflow stage this contract belongs to (e.g. 'analyze', 'plan', 'execute', 'verify', 'review') */
  stage: string;
  /** Maps artifact type to expected file extension/path pattern consumed by this stage */
  inputSchema: Record<string, string>;
  /** Maps artifact type to what this stage produces */
  outputSchema: Record<string, string>;
}

// ---------------------------------------------------------------------------
// State.json artifact shape
// ---------------------------------------------------------------------------

/**
 * Minimal shape of an artifact entry from state.json.
 * The full state.json may contain additional fields — we only read what we need.
 */
export interface StateArtifact {
  type: string;
  path: string;
  phase?: string | null;
  milestone?: string | null;
  id?: string;
  scope?: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves IArtifactContract schemas against a state.json artifacts array.
 *
 * Constructor takes the artifacts array directly (not read from disk) so the
 * resolver can be used in tests and in-memory scenarios without filesystem
 * coupling.
 */
export class ArtifactResolver {
  private artifacts: ReadonlyArray<StateArtifact>;

  /**
   * @param artifacts — the artifacts array from state.json (passed in, not read from disk)
   */
  constructor(artifacts: ReadonlyArray<StateArtifact>) {
    this.artifacts = artifacts;
  }

  /**
   * For each input key in the contract, find the matching artifact in state.json
   * and return its path. Matching is by filename suffix: the schema value
   * (e.g. 'conclusions.json') must be the trailing portion of the artifact path.
   *
   * Returns a Map where missing inputs are represented by an empty string value.
   */
  resolveInput(contract: IArtifactContract): Map<string, string> {
    const result = new Map<string, string>();

    for (const [key, pattern] of Object.entries(contract.inputSchema)) {
      const matched = this.findArtifactByPattern(pattern);
      result.set(key, matched?.path ?? '');
    }

    return result;
  }

  /**
   * For each output key in the contract, construct the expected output path
   * inside the scratch directory. The scratchDir is typically something like
   * `.workflow/scratch/20260528-execute-my-task`.
   *
   * The output path is simply `path.join(scratchDir, pattern)`.
   */
  resolveOutput(contract: IArtifactContract, scratchDir: string): Map<string, string> {
    const result = new Map<string, string>();

    for (const [key, pattern] of Object.entries(contract.outputSchema)) {
      result.set(key, path.join(scratchDir, pattern));
    }

    return result;
  }

  /**
   * Validate a contract: check which required input artifacts exist in the
   * state.json artifacts array, and which expected output artifacts exist on disk.
   *
   * - missingInputs: input keys whose pattern was not found in any state.json artifact
   * - missingOutputs: output keys whose file does not exist on disk under scratchDir
   */
  validate(
    contract: IArtifactContract,
    scratchDir: string,
  ): { missingInputs: string[]; missingOutputs: string[] } {
    const missingInputs: string[] = [];

    for (const [key, pattern] of Object.entries(contract.inputSchema)) {
      const matched = this.findArtifactByPattern(pattern);
      if (!matched) {
        missingInputs.push(key);
      }
    }

    const missingOutputs: string[] = [];

    for (const [key, pattern] of Object.entries(contract.outputSchema)) {
      const fullPath = path.join(scratchDir, pattern);

      // For glob-like patterns (containing '*'), check if the parent directory exists
      if (pattern.includes('*')) {
        const parentDir = path.dirname(fullPath);
        if (!fs.existsSync(parentDir)) {
          missingOutputs.push(key);
        }
      } else {
        if (!fs.existsSync(fullPath)) {
          missingOutputs.push(key);
        }
      }
    }

    return { missingInputs, missingOutputs };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Find an artifact whose path ends with the given pattern.
   * For directory patterns (ending with '/'), match any artifact whose path
   * starts with the pattern prefix.
   */
  private findArtifactByPattern(pattern: string): StateArtifact | undefined {
    // Directory pattern — match any artifact under that directory
    if (pattern.endsWith('/')) {
      return this.artifacts.find((a) => a.path.endsWith(pattern) || a.path.includes(pattern));
    }

    // Filename suffix match — artifact path ends with the pattern
    return this.artifacts.find((a) => a.path.endsWith(pattern));
  }
}

// ---------------------------------------------------------------------------
// Predefined stage contracts
// ---------------------------------------------------------------------------

/**
 * Predefined contracts for each workflow stage.
 *
 * These encode the existing conventions:
 * - analyze: produces conclusions.json
 * - plan: consumes conclusions.json, produces plan.json
 * - execute: consumes plan.json, produces task summaries
 * - verify: consumes summaries, produces verification.json
 * - review: consumes verification.json, produces review.json
 */
export const STAGE_CONTRACTS: Record<string, IArtifactContract> = {
  analyze: {
    stage: 'analyze',
    inputSchema: {
      macroAnalyze: 'conclusions.json',
    },
    outputSchema: {
      conclusions: 'conclusions.json',
    },
  },

  plan: {
    stage: 'plan',
    inputSchema: {
      analyzeConclusions: 'conclusions.json',
    },
    outputSchema: {
      plan: 'plan.json',
    },
  },

  execute: {
    stage: 'execute',
    inputSchema: {
      plan: 'plan.json',
    },
    outputSchema: {
      summaries: '.summaries/TASK-*-summary.md',
    },
  },

  verify: {
    stage: 'verify',
    inputSchema: {
      summaries: '.summaries/',
    },
    outputSchema: {
      verification: 'verification.json',
    },
  },

  review: {
    stage: 'review',
    inputSchema: {
      verification: 'verification.json',
    },
    outputSchema: {
      review: 'review.json',
    },
  },
};
