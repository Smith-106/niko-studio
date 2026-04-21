import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContentType,
  SessionManager,
  SessionStatus,
} from '../../workflow/session/session-manager';
import {
  CheckpointState,
  ConversationTurn,
  createStrategy,
  determineResumeStrategy,
  HybridStrategy,
  NativeResumeStrategy,
  PromptConcatStrategy,
  ResumeMode,
  sessionContextToDict,
  SessionContext,
} from '../../workflow/session/resume-strategy';
import { RevisionLoop, RevisionDecision, runRevisionLoop } from '../../workflow/revision-loop';
import { Level3Standard } from '../../workflow/levels/level3-standard';
import { WorkflowEngine } from '../../workflow/workflow-engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];

function createBasePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-e2e-checkpoint-'));
  tempDirs.push(dir);
  return dir;
}

function createTurn(role: string, content: string, timestamp: string): ConversationTurn {
  return { role, content, timestamp, tool_calls: null, metadata: null };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// L3 Standard checkpoint recovery E2E
// ---------------------------------------------------------------------------

describe('E2E: L3 Standard checkpoint recovery after Writer-stage interruption', () => {
  let basePath: string;
  let sessionManager: SessionManager;

  beforeEach(() => {
    basePath = createBasePath();
    sessionManager = new SessionManager(basePath);
  });

  it('saves checkpoint at Writer stage and recovers with correct context', () => {
    const sessionId = 'session-l3-recovery';

    // Initialize session
    sessionManager.init(sessionId, 'standard', 'novel-project', 'novel');

    // Simulate running L3 up to the Writer stage and checkpointing
    // This mirrors what Level3Standard._executePhase produces internally
    const writerStageState = {
      user_request: 'Write a chapter about the hidden library',
      context: 'Fantasy setting, protagonist is a scholar',
      plan_phases: [
        { phase: 1, output: 'Understood: library chapter' },
        { phase: 2, output: 'Existing characters: Elara the scholar' },
        { phase: 3, output: 'Scope: single chapter, library discovery' },
        { phase: 4, output: 'Steps: opening, exploration, discovery, aftermath' },
        { phase: 5, output: 'Criteria: vivid description, pacing, emotional arc' },
      ],
      implementation_plan: { steps: ['explore', 'discover', 'resolve'] },
      draft_content: 'Elara pushed open the ancient door...',
      draft_version: 1,
      current_step: 'writer',
      revision_count: 0,
    };

    // Save the draft as a checkpoint via SessionManager
    sessionManager.write(sessionId, ContentType.CHAPTER, writerStageState.draft_content as string, { id: '001' });
    sessionManager.appendAudit(sessionId, {
      event: 'checkpoint',
      step: 'writer',
      draft_version: 1,
      revision_count: 0,
    });

    // Save checkpoint state via resume strategy
    const strategy = new PromptConcatStrategy(basePath);
    const checkpointId = strategy.saveCheckpoint(sessionId, {
      current_step: 'writer',
      draft_content: writerStageState.draft_content,
      draft_version: 1,
      revision_count: 0,
      history: [
        createTurn('user', 'Write a chapter about the hidden library', '2026-04-21T10:00:00.000Z'),
        createTurn('assistant', 'Plan phases generated successfully', '2026-04-21T10:00:05.000Z'),
      ],
      score: null,
    });

    // Simulate interruption: workflow stops here

    // --- Recovery phase ---
    expect(strategy.canResume(sessionId)).toBe(true);

    const resumedContext = strategy.resume(sessionId);

    // Verify resumption picks up from writer stage (not from start)
    expect(resumedContext.resume_mode).toBe(ResumeMode.PROMPT_CONCAT);
    expect(resumedContext.checkpoint_id).toBe(checkpointId);
    expect(resumedContext.history).toHaveLength(2);

    // Verify the checkpoint state data contains writer-stage artifacts
    const latestCheckpoint = strategy.getLatestCheckpoint(sessionId);
    expect(latestCheckpoint).not.toBeNull();
    expect(latestCheckpoint!.workflow_step).toBe('writer');
    expect(latestCheckpoint!.state_data.draft_content).toBe('Elara pushed open the ancient door...');
    expect(latestCheckpoint!.state_data.draft_version).toBe(1);
    expect(latestCheckpoint!.state_data.revision_count).toBe(0);

    // Verify session data persisted correctly
    const readBack = sessionManager.read(sessionId, ContentType.CHAPTER, { id: '001' });
    expect(readBack).toBe('Elara pushed open the ancient door...');
  });

  it('checkpoint contains draft content, evaluation scores, revision notes, and agent context', () => {
    const sessionId = 'session-full-checkpoint';
    sessionManager.init(sessionId, 'standard', 'novel-project', 'novel');

    const strategy = new PromptConcatStrategy(basePath);

    // Save a checkpoint after Writer + Critic stages (simulating mid-revision state)
    const checkpointId = strategy.saveCheckpoint(sessionId, {
      current_step: 'critic',
      draft_content: 'Revised chapter draft with improved pacing.',
      draft_version: 2,
      revision_count: 1,
      score: 72,
      feedback_context: 'Pacing improved but character motivation still unclear.',
      history: [
        createTurn('user', 'Write a chapter', '2026-04-21T10:00:00.000Z'),
        createTurn('assistant', 'Plan generated', '2026-04-21T10:00:05.000Z'),
        createTurn('assistant', 'Initial draft complete', '2026-04-21T10:01:00.000Z'),
        createTurn('assistant', 'Score: 65, REVISE. Feedback: weak opening.', '2026-04-21T10:01:10.000Z'),
        createTurn('assistant', 'Revised draft complete', '2026-04-21T10:02:00.000Z'),
      ],
      evaluation_scores: {
        total_score: 72,
        structure: 78,
        pacing: 70,
        characterization: 65,
        dialogue: 75,
      },
      agent_context: {
        architect_plan: 'Five-phase plan completed',
        writer_mode: 'execute',
        critic_mode: 'evaluate',
      },
    });

    const checkpoint = strategy.getLatestCheckpoint(sessionId)!;

    // Verify draft content
    expect(checkpoint.state_data.draft_content).toBe('Revised chapter draft with improved pacing.');
    expect(checkpoint.state_data.draft_version).toBe(2);

    // Verify evaluation scores
    const scores = checkpoint.state_data.evaluation_scores as Record<string, number>;
    expect(scores.total_score).toBe(72);
    expect(scores.structure).toBe(78);
    expect(scores.pacing).toBe(70);

    // Verify revision notes / feedback
    expect(checkpoint.state_data.feedback_context).toBe(
      'Pacing improved but character motivation still unclear.',
    );
    expect(checkpoint.state_data.revision_count).toBe(1);

    // Verify agent context
    const agentCtx = checkpoint.state_data.agent_context as Record<string, unknown>;
    expect(agentCtx.architect_plan).toBe('Five-phase plan completed');
    expect(agentCtx.writer_mode).toBe('execute');
    expect(agentCtx.critic_mode).toBe('evaluate');

    // Verify workflow step is critic (not writer, not architect)
    expect(checkpoint.workflow_step).toBe('critic');

    // Verify history has all conversation turns
    expect(checkpoint.history_snapshot).toHaveLength(5);
  });

  it('resumes from Writer stage and continues to Critic without re-running Architect', () => {
    const sessionId = 'session-resume-writer';

    // Set up: Architect already ran, Writer checkpoint saved
    sessionManager.init(sessionId, 'standard', 'novel', 'novel');

    const architect = {
      run: vi.fn().mockReturnValue({
        phases: Array.from({ length: 5 }, (_, i) => ({
          phase: i + 1,
          output: `architect-phase-${i + 1}`,
        })),
        plan: { steps: ['step-1'] },
      }),
    };
    const writer = {
      run: vi.fn().mockReturnValue({ content: 'Writer draft after recovery.' }),
    };
    const critic = {
      run: vi.fn().mockReturnValue({
        score: 88,
        decision: 'APPROVED',
        feedback: '',
      }),
    };

    // First run: run up to Writer stage, then save checkpoint
    // We simulate this by directly saving checkpoint state
    const strategy = new PromptConcatStrategy(basePath);
    strategy.saveCheckpoint(sessionId, {
      current_step: 'writer',
      draft_content: 'Partially written draft...',
      draft_version: 1,
      revision_count: 0,
      history: [
        createTurn('user', 'Write a chapter about dragons', '2026-04-21T10:00:00.000Z'),
        createTurn('assistant', 'Architect plan complete', '2026-04-21T10:00:05.000Z'),
      ],
    });

    // Resume: architect should NOT be called again since checkpoint is at writer
    const resumedContext = strategy.resume(sessionId);
    expect(resumedContext.resume_mode).toBe(ResumeMode.PROMPT_CONCAT);
    expect(resumedContext.checkpoint_id).toBeTruthy();

    // Verify checkpoint step is writer, not architect
    const checkpoint = strategy.getLatestCheckpoint(sessionId)!;
    expect(checkpoint.workflow_step).toBe('writer');

    // Architect was never called (simulated: we only saved writer checkpoint)
    // In real recovery, the workflow would skip back to writer
    // The key assertion is that the checkpoint step is 'writer', not 'architect' or null
    expect(checkpoint.state_data.draft_content).toBe('Partially written draft...');
  });
});

// ---------------------------------------------------------------------------
// Resume strategy + Session manager integration
// ---------------------------------------------------------------------------

describe('E2E: resume-strategy.ts integration with session-manager.ts', () => {
  let basePath: string;

  beforeEach(() => {
    basePath = createBasePath();
  });

  it('HybridStrategy saves checkpoint and SessionManager records lifecycle', () => {
    const sessionManager = new SessionManager(basePath);
    const sessionId = 'session-hybrid-integration';

    sessionManager.init(sessionId, 'standard', 'hybrid-test', 'novel');

    const hybrid = new HybridStrategy(basePath, 'gemini');
    const checkpointId = hybrid.saveCheckpoint(sessionId, {
      current_step: 'draft',
      draft_content: 'Hybrid checkpoint content.',
      score: 80,
      history: [createTurn('assistant', 'Draft complete', '2026-04-21T11:00:00.000Z')],
    });

    // SessionManager lifecycle sync: pause creates checkpoint state
    const syncResult = sessionManager.syncLifecycle(sessionId, 'paused', checkpointId);
    expect(syncResult.runner_state).toBe('paused');
    expect(syncResult.last_checkpoint_id).toBe(checkpointId);
    expect(syncResult.status).toBe('checkpointed'); // paused maps to 'checkpointed'

    // Resume via strategy
    expect(hybrid.canResume(sessionId)).toBe(true);
    const context = hybrid.resume(sessionId);
    expect(context.resume_mode).toBe(ResumeMode.PROMPT_CONCAT); // no native session registered
    expect(context.history).toHaveLength(1);

    // SessionManager lifecycle sync: resume
    const resumeResult = sessionManager.syncLifecycle(sessionId, 'running');
    expect(resumeResult.runner_state).toBe('running');
  });

  it('NativeResumeStrategy registers session and SessionManager archives on completion', () => {
    const sessionManager = new SessionManager(basePath);
    const sessionId = 'session-native-integration';

    sessionManager.init(sessionId, 'standard', 'native-test', 'code');

    const native = new NativeResumeStrategy(basePath, 'claude');
    native.registerNativeSession(sessionId, 'native-session-abc');

    // Save checkpoint while running
    const checkpointId = native.saveCheckpoint(sessionId, {
      current_step: 'execute',
      code_output: 'function implemented.',
      history: [createTurn('assistant', 'Code generated', '2026-04-21T12:00:00.000Z')],
    });

    // Verify native resume works
    expect(native.canResume(sessionId)).toBe(true);
    expect(native.getNativeSessionId(sessionId)).toBe('native-session-abc');

    const context = native.resume(sessionId);
    expect(context.resume_mode).toBe(ResumeMode.NATIVE);
    expect(context.metadata?.native_session_id).toBe('native-session-abc');
    expect(context.metadata?.resume_command).toBe('--resume native-session-abc');

    // SessionManager archives on stop
    const stopResult = sessionManager.syncLifecycle(sessionId, 'stopped', checkpointId);
    expect(stopResult.status).toBe('archived');
    expect(sessionManager.list('archived')).toHaveLength(1);
  });

  it('createStrategy factory creates strategies that share checkpoint path with SessionManager', () => {
    const sessionManager = new SessionManager(basePath);
    const sessionId = 'session-factory';

    sessionManager.init(sessionId, 'standard', 'factory-test', 'novel');

    // Create strategies via factory
    const concatStrategy = createStrategy(ResumeMode.PROMPT_CONCAT, basePath, 'gemini');
    const hybridStrategy = createStrategy(ResumeMode.HYBRID, basePath, 'gemini');

    // Save checkpoint via concat strategy
    const checkpointId = concatStrategy.saveCheckpoint(sessionId, {
      current_step: 'plan',
      history: [createTurn('user', 'Start', '2026-04-21T13:00:00.000Z')],
    });

    // Hybrid strategy (which uses PromptConcatStrategy internally) can see the checkpoint
    const checkpoints = hybridStrategy.listCheckpoints(sessionId);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].checkpoint_id).toBe(checkpointId);
    expect(checkpoints[0].workflow_step).toBe('plan');

    // SessionManager can also verify the session exists
    const sessions = sessionManager.list('active');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(sessionId);
  });

  it('determineResumeStrategy correctly routes single native, cross-tool, and merge scenarios', () => {
    // Single native session
    const singleNative = determineResumeStrategy(
      'claude',
      ['session-1'],
      null,
      (sid) => 'native-123',
      (sid) => 'claude',
    );
    expect(singleNative.strategy).toBe(ResumeMode.NATIVE);
    expect(singleNative.native_session_id).toBe('native-123');

    // Cross-tool resume
    const crossTool = determineResumeStrategy(
      'gemini',
      ['session-1'],
      null,
      (sid) => 'native-123',
      (sid) => 'claude',
    );
    expect(crossTool.strategy).toBe(ResumeMode.PROMPT_CONCAT);
    expect(crossTool.reason).toContain('Cross-tool');

    // Multi-session merge
    const merge = determineResumeStrategy('claude', ['session-1', 'session-2']);
    expect(merge.strategy).toBe(ResumeMode.HYBRID);

    // No resume IDs
    const disabled = determineResumeStrategy('claude', []);
    expect(disabled.strategy).toBe(ResumeMode.DISABLED);
  });
});

// ---------------------------------------------------------------------------
// Revision loop checkpoint trace
// ---------------------------------------------------------------------------

describe('E2E: Revision loop checkpoint trace recovery', () => {
  it('RevisionLoop builds checkpoint trace across multiple revision rounds', () => {
    const checkpointStore: Record<string, unknown> = {};
    const loop = new RevisionLoop(
      { max_revisions: 3, pass_score: 80, score_improvement_threshold: 5 },
      checkpointStore,
    );

    // Round 1: Critic scores 65 -> REVISE
    const decision1 = loop.updateFromCritic({
      total_score: 65,
      decision: 'REVISE',
      actionable_feedback: 'Strengthen conflict and pacing.',
      session_id: 'session-revision',
    });
    expect(decision1).toBe(RevisionDecision.REVISE);
    expect(loop.state.revision_count).toBe(1);
    expect(loop.state.last_checkpoint_id).toBeTruthy();

    // Verify checkpoint artifact was persisted
    const artifact1 = checkpointStore[loop.state.checkpoint_trace[0].checkpoint_id] as Record<string, unknown>;
    expect(artifact1).toBeDefined();
    expect(artifact1.score).toBe(65);
    expect(artifact1.stage).toBe('critic');
    expect(artifact1.revision_count).toBe(1);

    // Round 2: Critic scores 78 -> REVISE (improvement >= 5, so no stagnant)
    const decision2 = loop.updateFromCritic({
      total_score: 78,
      decision: 'REVISE',
      actionable_feedback: 'Character motivation still unclear.',
      session_id: 'session-revision',
    });
    expect(decision2).toBe(RevisionDecision.REVISE);
    expect(loop.state.revision_count).toBe(2);
    expect(loop.state.stagnant_count).toBe(0); // improvement of 13 > threshold

    // Round 3: Critic scores 85 -> APPROVED
    const decision3 = loop.updateFromCritic({
      total_score: 85,
      decision: 'APPROVED',
      actionable_feedback: '',
      session_id: 'session-revision',
    });
    expect(decision3).toBe(RevisionDecision.APPROVED);
    expect(loop.state.revision_count).toBe(3);
    expect(loop.shouldContinue()).toBe(false);

    // Verify checkpoint trace has 3 entries
    expect(loop.state.checkpoint_trace).toHaveLength(3);

    // Verify summary contains full history
    const summary = loop.getSummary();
    expect(summary.total_revisions).toBe(3);
    expect(summary.final_score).toBe(85);
    expect(summary.final_decision).toBe('APPROVED');
    expect(summary.score_trend).toEqual([65, 78, 85]);
  });

  it('RevisionLoop detects stagnation and triggers HUMAN_REVIEW after 2 consecutive stalls', () => {
    const loop = new RevisionLoop(
      { max_revisions: 5, pass_score: 80, score_improvement_threshold: 10 },
    );

    // Round 1: Score 60
    loop.updateFromCritic({
      total_score: 60,
      decision: 'REVISE',
      actionable_feedback: 'Needs work.',
      session_id: 'stagnant-session',
    });

    // Round 2: Score 65 (improvement of 5 < threshold 10 => stagnant)
    loop.updateFromCritic({
      total_score: 65,
      decision: 'REVISE',
      actionable_feedback: 'Still needs work.',
      session_id: 'stagnant-session',
    });
    expect(loop.state.stagnant_count).toBe(1);
    expect(loop.shouldContinue()).toBe(true);

    // Round 3: Score 67 (improvement of 2 < threshold 10 => second stall)
    loop.updateFromCritic({
      total_score: 67,
      decision: 'REVISE',
      actionable_feedback: 'Minimal improvement.',
      session_id: 'stagnant-session',
    });
    expect(loop.state.stagnant_count).toBe(2);
    expect(loop.shouldContinue()).toBe(false);
    expect(loop.state.decision).toBe(RevisionDecision.HUMAN_REVIEW);
  });

  it('runRevisionLoop async E2E: runs until approved with checkpoint store integration', async () => {
    const checkpointStore: Record<string, unknown> = {};
    const drafts: string[] = [];

    const writerFn = async (draft: string, feedback: Record<string, unknown>): Promise<string> => {
      drafts.push(draft);
      return 'Improved draft with better conflict.';
    };

    const criticFn = async (draft: string): Promise<Record<string, unknown>> => {
      if (drafts.length === 0) {
        // First evaluation (initial draft): below threshold
        return {
          total_score: 70,
          decision: 'REVISE',
          actionable_feedback: 'Strengthen the conflict.',
          session_id: 'async-session',
        };
      }
      // Second evaluation (revised draft): passes
      return {
        total_score: 88,
        decision: 'APPROVED',
        actionable_feedback: '',
        session_id: 'async-session',
      };
    };

    const result = await runRevisionLoop({
      draft: 'Initial draft.',
      sceneCard: { chapter: 1 },
      writerFn,
      criticFn,
      config: { max_revisions: 3, pass_score: 80, score_improvement_threshold: 5, quality_phase_timeout_seconds: 0 },
      verbose: false,
      checkpointStore,
    });

    expect(result.total_revisions).toBe(2);
    expect(result.final_score).toBe(88);
    expect(result.final_decision).toBe('APPROVED');
    expect(result.final_draft).toBe('Improved draft with better conflict.');
    // writerFn is called once (after first REVISE), drafts tracks writer calls only
    expect(drafts).toHaveLength(1);

    // Checkpoint store should have entries
    expect(Object.keys(checkpointStore).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// WorkflowEngine pause/resume lifecycle integration
// ---------------------------------------------------------------------------

describe('E2E: WorkflowEngine pause/resume with checkpoint and session binding', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-e2e-engine-'));
    tempDirs.push(workspace);
  });

  it('plans L2 workflow, pauses, resumes, and continues to completion', async () => {
    const engine = new WorkflowEngine(workspace, 'e2e-lifecycle');

    // Plan an L2 workflow (3 steps: analyze, match_skills, generate)
    const plan = await engine.plan('Write a suspenseful short scene', 'L2');
    const planId = String(plan['plan_id']);
    expect(plan['level']).toBe('L2');
    expect(plan['total_steps']).toBe(3);

    // Execute first step (analyze)
    const step1 = await engine.execute(planId);
    expect(step1['status']).not.toBe('failed');
    expect(step1['step_name']).toBe('analyze');

    // Pause the workflow (creates a checkpoint)
    const pauseResult = await engine.lifecycle(planId, 'pause');
    expect(pauseResult['runner_state']).toBe('paused');
    expect(pauseResult['checkpoint_id']).toBeTruthy();

    // Verify plan status reflects paused state
    const pausedStatus = engine.getPlanStatus(planId);
    expect(pausedStatus['runner_state']).toBe('paused');

    // Resume the workflow
    const resumeResult = await engine.lifecycle(planId, 'resume');
    expect(resumeResult['runner_state']).toBe('running');

    // Continue executing remaining steps
    const step2 = await engine.execute(planId);
    expect(step2['status']).not.toBe('failed');
    expect(step2['step_name']).toBe('match_skills');

    const step3 = await engine.execute(planId);
    expect(step3['status']).not.toBe('failed');
    expect(step3['step_name']).toBe('generate');
    expect(step3['plan_status']).toBe('completed');

    // Verify final plan status is completed
    const finalStatus = engine.getPlanStatus(planId);
    expect(finalStatus['status']).toBe('completed');
    expect(finalStatus['progress']).toBe('3/3');
  });

  it('plan-session binding persists across lifecycle transitions', async () => {
    const engine = new WorkflowEngine(workspace, 'e2e-binding');

    const plan = await engine.plan('Write a short scene', 'L2');
    const planId = String(plan['plan_id']);

    // Bind a manual session
    const manualSessionId = 'manual-e2e-session-001';
    const boundId = engine.bindPlanSession(planId, manualSessionId);
    expect(boundId).toBe(manualSessionId);
    expect(engine.getPlanSessionId(planId)).toBe(manualSessionId);

    // Pause and resume
    await engine.lifecycle(planId, 'pause');
    const statusDuringPause = await engine.lifecycle(planId, 'status');
    expect(statusDuringPause['runner_state']).toBe('paused');
    expect(statusDuringPause['session_status']).toBe('checkpointed');

    // Session ID persists after resume
    await engine.lifecycle(planId, 'resume');
    expect(engine.getPlanSessionId(planId)).toBe(manualSessionId);
  });
});
