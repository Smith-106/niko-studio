/**
 * Plan-Act Mode - Structured Plan-Execute-Review workflow pattern.
 *
 * Supports multi-phase execution, checkpoint management, and iterative refinement.
 *
 * Migrated from src/workflow/modes/plan_act.py
 */

import { createLogger } from '../../logger/index.js';

const _log = createLogger('workflow-plan-act');

// ============================================================
// WorkflowPhase enum
// ============================================================

export enum WorkflowPhase {
  PLAN = 'plan',
  ACT = 'act',
  REVIEW = 'review',
  REVISE = 'revise',
  COMPLETE = 'complete',
}

// ============================================================
// PhaseResult
// ============================================================

export interface PhaseResult {
  phase: WorkflowPhase;
  success: boolean;
  output: unknown;
  metadata: Record<string, unknown>;
  error: Error | null;
  durationMs: number;
  nextPhase: WorkflowPhase | null;
}

function okPhaseResult(
  phase: WorkflowPhase,
  output: unknown,
  nextPhase: WorkflowPhase | null = null,
  metadata?: Record<string, unknown>,
  durationMs = 0,
): PhaseResult {
  return {
    phase,
    success: true,
    output,
    metadata: metadata ?? {},
    error: null,
    durationMs,
    nextPhase,
  };
}

function failPhaseResult(
  phase: WorkflowPhase,
  error: Error,
): PhaseResult {
  return {
    phase,
    success: false,
    output: null,
    metadata: {},
    error,
    durationMs: 0,
    nextPhase: null,
  };
}

// ============================================================
// Checkpoint
// ============================================================

export interface Checkpoint {
  phase: WorkflowPhase;
  timestamp: string;
  state: Record<string, unknown>;
  iteration: number;
}

function checkpointToDict(cp: Checkpoint): Record<string, unknown> {
  return {
    phase: cp.phase,
    timestamp: cp.timestamp,
    state: cp.state,
    iteration: cp.iteration,
  };
}

// ============================================================
// PlanActState
// ============================================================

export class PlanActState {
  sessionId: string;
  currentPhase: WorkflowPhase;
  iteration: number;
  maxIterations: number;
  plan: Record<string, unknown> | null;
  output: string | null;
  reviewFeedback: Record<string, unknown> | null;
  checkpoints: Checkpoint[];
  phaseHistory: PhaseResult[];

  constructor(sessionId: string, maxIterations = 3) {
    this.sessionId = sessionId;
    this.currentPhase = WorkflowPhase.PLAN;
    this.iteration = 0;
    this.maxIterations = maxIterations;
    this.plan = null;
    this.output = null;
    this.reviewFeedback = null;
    this.checkpoints = [];
    this.phaseHistory = [];
  }

  /** Save current state as a checkpoint. */
  saveCheckpoint(): Checkpoint {
    const checkpoint: Checkpoint = {
      phase: this.currentPhase,
      timestamp: new Date().toISOString(),
      state: {
        plan: this.plan,
        output: this.output,
        review_feedback: this.reviewFeedback,
      },
      iteration: this.iteration,
    };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  /** Restore state from a checkpoint. */
  restoreCheckpoint(checkpoint: Checkpoint): void {
    this.currentPhase = checkpoint.phase;
    this.iteration = checkpoint.iteration;
    this.plan = (checkpoint.state['plan'] as Record<string, unknown>) ?? null;
    this.output = (checkpoint.state['output'] as string) ?? null;
    this.reviewFeedback = (checkpoint.state['review_feedback'] as Record<string, unknown>) ?? null;
  }
}

// ============================================================
// IPhaseExecutor interface (replaces Python Protocol)
// ============================================================

export interface IPhaseExecutor {
  execute(state: PlanActState, context: Record<string, unknown>): Promise<PhaseResult>;
}

// ============================================================
// Agent interfaces (duck-typed, matching Python hasattr checks)
// ============================================================

export interface IArchitectAgent {
  plan?(task: string, requirements: unknown[], context: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface IWriterAgent {
  write?(task: string, plan: Record<string, unknown>, context: Record<string, unknown>, previousFeedback: Record<string, unknown> | null): Promise<string>;
  revise?(content: string, feedback: Record<string, unknown>, context: Record<string, unknown>): Promise<string>;
}

export interface ICriticAgent {
  evaluate?(content: string, context: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// ============================================================
// PlanPhaseExecutor
// ============================================================

export class PlanPhaseExecutor implements IPhaseExecutor {
  private _architect: IArchitectAgent | null;

  constructor(architectAgent?: IArchitectAgent | null) {
    this._architect = architectAgent ?? null;
  }

  async execute(state: PlanActState, context: Record<string, unknown>): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      const task = String(context['task'] ?? '');
      const requirements = context['requirements'] as unknown[] ?? [];

      let plan: Record<string, unknown>;

      if (this._architect && typeof this._architect.plan === 'function') {
        plan = await this._architect.plan(task, requirements, context);
      } else {
        // Default plan structure
        plan = {
          task,
          steps: [
            { step: 1, action: 'analyze_requirements', description: 'Analyze task requirements' },
            { step: 2, action: 'generate_content', description: 'Generate initial content' },
            { step: 3, action: 'refine_output', description: 'Refine and polish output' },
          ],
          estimated_tokens: 2000,
          skills_required: context['skills'] ?? [],
        };
      }

      state.plan = plan;
      const duration = Date.now() - startTime;

      return okPhaseResult(
        WorkflowPhase.PLAN,
        plan,
        WorkflowPhase.ACT,
        { duration_ms: duration },
        duration,
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      _log.error(`Plan phase failed: ${error.message}`);
      return failPhaseResult(WorkflowPhase.PLAN, error);
    }
  }
}

// ============================================================
// ActPhaseExecutor
// ============================================================

export class ActPhaseExecutor implements IPhaseExecutor {
  private _writer: IWriterAgent | null;

  constructor(writerAgent?: IWriterAgent | null) {
    this._writer = writerAgent ?? null;
  }

  async execute(state: PlanActState, context: Record<string, unknown>): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      if (state.plan === null) {
        throw new Error('No plan available for execution');
      }

      const plan = state.plan;
      const task = String(context['task'] ?? '');

      let output: string;

      if (this._writer && typeof this._writer.write === 'function') {
        output = await this._writer.write(task, plan, context, state.reviewFeedback);
      } else {
        const steps = plan['steps'] as Array<Record<string, unknown>> ?? [];
        const stepsDesc = steps.map(s => `- ${s['description']}`).join('\n');
        output = `[Generated content for: ${task}]\n\nExecuted steps:\n${stepsDesc}`;
      }

      state.output = output;
      const duration = Date.now() - startTime;

      return okPhaseResult(
        WorkflowPhase.ACT,
        output,
        WorkflowPhase.REVIEW,
        { duration_ms: duration },
        duration,
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      _log.error(`Act phase failed: ${error.message}`);
      return failPhaseResult(WorkflowPhase.ACT, error);
    }
  }
}

// ============================================================
// ReviewPhaseExecutor
// ============================================================

export class ReviewPhaseExecutor implements IPhaseExecutor {
  private _critic: ICriticAgent | null;
  private _qualityThreshold: number;

  constructor(criticAgent?: ICriticAgent | null, qualityThreshold = 0.7) {
    this._critic = criticAgent ?? null;
    this._qualityThreshold = qualityThreshold;
  }

  async execute(state: PlanActState, context: Record<string, unknown>): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      if (state.output === null) {
        throw new Error('No output to review');
      }

      let feedback: Record<string, unknown>;

      if (this._critic && typeof this._critic.evaluate === 'function') {
        feedback = await this._critic.evaluate(state.output, context);
      } else {
        feedback = {
          overall_score: 0.75,
          dimensions: {
            coherence: 0.8,
            engagement: 0.7,
            style: 0.75,
          },
          issues: [],
          suggestions: [],
        };
      }

      state.reviewFeedback = feedback;
      const duration = Date.now() - startTime;

      // Determine next phase
      const overallScore = typeof feedback['overall_score'] === 'number'
        ? feedback['overall_score'] as number
        : 0;
      let nextPhase: WorkflowPhase;
      if (overallScore >= this._qualityThreshold) {
        nextPhase = WorkflowPhase.COMPLETE;
      } else if (state.iteration < state.maxIterations) {
        nextPhase = WorkflowPhase.REVISE;
      } else {
        nextPhase = WorkflowPhase.COMPLETE;
        _log.warn(`Max iterations reached, accepting output with score ${overallScore}`);
      }

      return okPhaseResult(
        WorkflowPhase.REVIEW,
        feedback,
        nextPhase,
        { duration_ms: duration, quality_score: overallScore },
        duration,
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      _log.error(`Review phase failed: ${error.message}`);
      return failPhaseResult(WorkflowPhase.REVIEW, error);
    }
  }
}

// ============================================================
// RevisePhaseExecutor
// ============================================================

export class RevisePhaseExecutor implements IPhaseExecutor {
  private _writer: IWriterAgent | null;

  constructor(writerAgent?: IWriterAgent | null) {
    this._writer = writerAgent ?? null;
  }

  async execute(state: PlanActState, context: Record<string, unknown>): Promise<PhaseResult> {
    const startTime = Date.now();

    try {
      if (state.output === null || state.reviewFeedback === null) {
        throw new Error('Missing output or feedback for revision');
      }

      let revised: string;

      if (this._writer && typeof this._writer.revise === 'function') {
        revised = await this._writer.revise(state.output, state.reviewFeedback, context);
      } else {
        const issues = state.reviewFeedback['issues'] as unknown[] ?? [];
        revised = state.output;
        if (issues.length > 0) {
          revised += `\n\n[Revision notes: Addressed ${issues.length} issues]`;
        }
      }

      state.output = revised;
      state.iteration += 1;
      const duration = Date.now() - startTime;

      return okPhaseResult(
        WorkflowPhase.REVISE,
        revised,
        WorkflowPhase.REVIEW,
        { duration_ms: duration, iteration: state.iteration },
        duration,
      );
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      _log.error(`Revise phase failed: ${error.message}`);
      return failPhaseResult(WorkflowPhase.REVISE, error);
    }
  }
}

// ============================================================
// PlanActMode - Orchestrator
// ============================================================

export class PlanActMode {
  private _planExecutor: PlanPhaseExecutor;
  private _actExecutor: ActPhaseExecutor;
  private _reviewExecutor: ReviewPhaseExecutor;
  private _reviseExecutor: RevisePhaseExecutor;

  private _executors: Map<WorkflowPhase, IPhaseExecutor>;
  private _maxIterations: number;
  private _states: Map<string, PlanActState>;

  constructor(
    options?: {
      architectAgent?: IArchitectAgent;
      writerAgent?: IWriterAgent;
      criticAgent?: ICriticAgent;
      qualityThreshold?: number;
      maxIterations?: number;
    },
  ) {
    this._planExecutor = new PlanPhaseExecutor(options?.architectAgent);
    this._actExecutor = new ActPhaseExecutor(options?.writerAgent);
    this._reviewExecutor = new ReviewPhaseExecutor(options?.criticAgent, options?.qualityThreshold ?? 0.7);
    this._reviseExecutor = new RevisePhaseExecutor(options?.writerAgent);

    this._executors = new Map<WorkflowPhase, IPhaseExecutor>([
      [WorkflowPhase.PLAN, this._planExecutor],
      [WorkflowPhase.ACT, this._actExecutor],
      [WorkflowPhase.REVIEW, this._reviewExecutor],
      [WorkflowPhase.REVISE, this._reviseExecutor],
    ]);

    this._maxIterations = options?.maxIterations ?? 3;
    this._states = new Map();
  }

  /**
   * Execute the Plan-Act workflow.
   *
   * Flow:
   * 1. Plan: ArchitectAgent generates execution plan
   * 2. Act: WriterAgent executes plan and generates content
   * 3. Review: CriticAgent evaluates quality
   * 4. Revise (optional): If quality is insufficient, revise
   * 5. Complete: Return final output
   */
  async execute(
    sessionId: string,
    task: string,
    context?: Record<string, unknown>,
    resumeFromCheckpoint = false,
  ): Promise<PhaseResult> {
    // Get or create state
    let state: PlanActState;
    if (this._states.has(sessionId) && resumeFromCheckpoint) {
      state = this._states.get(sessionId)!;
      if (state.checkpoints.length > 0) {
        state.restoreCheckpoint(state.checkpoints[state.checkpoints.length - 1]);
      }
    } else {
      state = new PlanActState(sessionId, this._maxIterations);
      this._states.set(sessionId, state);
    }

    // Merge context
    const fullContext: Record<string, unknown> = { task };
    if (context) {
      Object.assign(fullContext, context);
    }

    // Execute workflow loop
    while (state.currentPhase !== WorkflowPhase.COMPLETE) {
      const executor = this._executors.get(state.currentPhase);

      if (!executor) {
        _log.error(`No executor for phase: ${state.currentPhase}`);
        break;
      }

      // Save checkpoint
      state.saveCheckpoint();

      // Execute phase
      const result = await executor.execute(state, fullContext);
      state.phaseHistory.push(result);

      if (!result.success) {
        _log.error(`Phase ${state.currentPhase} failed: ${result.error?.message}`);
        return result;
      }

      // Transition to next phase
      if (result.nextPhase != null) {
        state.currentPhase = result.nextPhase;
      } else {
        break;
      }
    }

    // Return final result
    return okPhaseResult(
      WorkflowPhase.COMPLETE,
      state.output,
      null,
      {
        plan: state.plan,
        review_feedback: state.reviewFeedback,
        iterations: state.iteration,
        phase_count: state.phaseHistory.length,
      },
    );
  }

  /** Get the state for a session. */
  getState(sessionId: string): PlanActState | undefined {
    return this._states.get(sessionId);
  }

  /** Clear a session's state. */
  clearState(sessionId: string): boolean {
    return this._states.delete(sessionId);
  }

  /** List all session IDs. */
  listSessions(): string[] {
    return Array.from(this._states.keys());
  }
}

// ============================================================
// Convenience factory
// ============================================================

export function getDefaultPlanActMode(
  architectAgent?: IArchitectAgent,
  writerAgent?: IWriterAgent,
  criticAgent?: ICriticAgent,
): PlanActMode {
  return new PlanActMode({
    architectAgent,
    writerAgent,
    criticAgent,
    qualityThreshold: 0.7,
    maxIterations: 3,
  });
}
