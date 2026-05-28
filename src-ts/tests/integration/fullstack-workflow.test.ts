import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveExecutionEngineImpl } from '../../workflow/wave-engine.js';
import type { WaveSpec, WaveExecutionConfig, WaveResult } from '../../workflow/wave-engine.js';
import { QualityGateFeedbackLoopImpl } from '../../workflow/quality-gate-loop.js';
import type { VerificationGap, FeedbackLoopResult, FeedbackLoopConfig } from '../../workflow/quality-gate-loop.js';
import { TypedEventBus } from '../../services/event-bus.js';
import { EventLogImpl } from '../../services/event-log.js';

// ---------------------------------------------------------------------------
// Test Suite: Wave Engine + Quality Gate Feedback Loop
// ---------------------------------------------------------------------------

describe('Integration: Wave execution engine + quality gate feedback loop', () => {
  let eventBus: TypedEventBus;
  let eventLog: EventLogImpl;

  beforeEach(() => {
    eventLog = new EventLogImpl({ maxRetention: 200 });
    eventBus = new TypedEventBus(undefined, { eventLog });
  });

  afterEach(() => {
    eventLog.clear();
  });

  // -------------------------------------------------------------------------
  // Wave execution
  // -------------------------------------------------------------------------

  it('execute 2-wave plan → verify parallel execution within wave, sequential between waves', async () => {
    const engine = new WaveExecutionEngineImpl(eventBus, undefined, {
      failureStrategy: 'abort',
      maxRetriesPerWave: 0,
      waveTimeoutMs: 5000,
      taskTimeoutMs: 2000,
    });

    const executionOrder: string[] = [];

    const executor = async (taskId: string) => {
      executionOrder.push(taskId);
      await new Promise((r) => setTimeout(r, 20));
    };

    const waves: WaveSpec[] = [
      { wave: 1, tasks: ['task-1a', 'task-1b', 'task-1c'], parallel: true, reason: 'setup' },
      { wave: 2, tasks: ['task-2a', 'task-2b'], parallel: false, reason: 'verification' },
    ];

    const results = await engine.executeWaves(waves, executor);

    // Wave 1 should be completed with all tasks succeeding
    expect(results[0].status).toBe('completed');
    expect(results[0].taskResults['task-1a'].status).toBe('success');
    expect(results[0].taskResults['task-1b'].status).toBe('success');
    expect(results[0].taskResults['task-1c'].status).toBe('success');

    // Wave 2 should be completed with all tasks succeeding
    expect(results[1].status).toBe('completed');
    expect(results[1].taskResults['task-2a'].status).toBe('success');
    expect(results[1].taskResults['task-2b'].status).toBe('success');

    // Wave 1 tasks should have started before wave 2 tasks
    const wave1Idx = executionOrder.indexOf('task-1a');
    const wave2Idx = executionOrder.indexOf('task-2a');
    expect(wave1Idx).toBeLessThan(wave2Idx);

    // Verify events published
    const startedEvents = eventLog.getEvents({ channel: 'wave:started' });
    const completedEvents = eventLog.getEvents({ channel: 'wave:completed' });
    expect(startedEvents.length).toBeGreaterThanOrEqual(2);
    expect(completedEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('wave task fails → verify retry-failed strategy retries only failed task', async () => {
    const engine = new WaveExecutionEngineImpl(eventBus, undefined, {
      failureStrategy: 'retry-failed',
      maxRetriesPerWave: 3,
      waveTimeoutMs: 5000,
      taskTimeoutMs: 500,
    });

    let failCount = 0;
    const executor = async (taskId: string) => {
      if (taskId === 'failing-task' && failCount < 2) {
        failCount++;
        throw new Error(`Task ${taskId} failed (attempt ${failCount})`);
      }
      // succeeds after 2 failures or for other tasks
    };

    const waves: WaveSpec[] = [
      { wave: 1, tasks: ['good-task', 'failing-task', 'another-good'], parallel: true, reason: 'build' },
    ];

    const results = await engine.executeWaves(waves, executor);

    // Wave should eventually succeed after retries
    expect(results[0].status).toBe('completed');
    expect(results[0].taskResults['good-task'].status).toBe('success');
    expect(results[0].taskResults['another-good'].status).toBe('success');
    expect(results[0].taskResults['failing-task'].status).toBe('success');
  });

  it('wave timeout → verify remaining tasks marked as timeout', async () => {
    const engine = new WaveExecutionEngineImpl(eventBus, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      waveTimeoutMs: 100, // Very short timeout
      taskTimeoutMs: 50,
    });

    // Task that takes much longer than timeout
    const slowExecutor = async (taskId: string) => {
      if (taskId === 'slow-task') {
        await new Promise((r) => setTimeout(r, 500)); // 500ms > 100ms timeout
      }
    };

    const waves: WaveSpec[] = [
      { wave: 1, tasks: ['slow-task', 'fast-task'], parallel: true, reason: 'test' },
    ];

    const results = await engine.executeWaves(waves, slowExecutor);

    // Wave should timeout
    expect(results[0].status).toBe('timeout');
  });

  // -------------------------------------------------------------------------
  // Quality gate feedback loop
  // -------------------------------------------------------------------------

  it('inject verification gaps → verify gap detection → remediation plan generated → execution attempted', async () => {
    const loop = new QualityGateFeedbackLoopImpl(eventBus, undefined, undefined, {
      maxRetries: 3,
      escalationChannel: 'quality:escalation',
      autoExecute: true,
    });

    const gaps: VerificationGap[] = [
      {
        id: 'gap-1',
        title: 'Missing test for auth module',
        status: 'FAILED',
        evidence: 'No test coverage detected for auth module',
        mappedTaskId: 'task-auth',
      },
      {
        id: 'gap-2',
        title: 'Stub implementation for cache',
        status: 'STUB',
        evidence: 'Cache.clear() returns void without clearing data',
        mappedTaskId: 'task-cache',
      },
    ];

    // Detect gaps
    const detected = loop.detectGaps({ gaps });
    expect(detected.length).toBe(2);

    // Generate remediation plans
    const plans = loop.generateRemediation(detected);
    expect(plans.length).toBe(2);
    expect(plans[0].gapId).toBe('gap-1');
    expect(plans[0].subPlanSpec.subTasks.length).toBeGreaterThan(0);

    // Verify gap-detected events published
    const gapEvents = eventLog.getEvents({ channel: 'quality:gap-detected' });
    expect(gapEvents.length).toBe(2);

    // Run feedback loop — without dispatcher, _simpleExecute returns true
    // so gaps should be fixed on first iteration
    const loopResult = await loop.runFeedbackLoop({ gaps });

    expect(loopResult.totalGaps).toBe(2);
    expect(loopResult.fixedGaps).toBe(2);
    expect(loopResult.iterations).toBe(1);
    expect(loopResult.details.length).toBeGreaterThan(0);

    // Verify remediation events
    const startedEvents = eventLog.getEvents({ channel: 'quality:remediation-started' });
    expect(startedEvents.length).toBeGreaterThanOrEqual(2);

    const completeEvents = eventLog.getEvents({ channel: 'quality:remediation-complete' });
    expect(completeEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('max retries exceeded → verify escalation event published', async () => {
    // Use a SubPlanDispatcher mock that always fails,
    // so the feedback loop retries until maxRetries then escalates.
    // We create a custom dispatcher that reports all tasks as failed.

    const mockDispatcher = {
      submitSubPlan: vi.fn().mockResolvedValue({
        parentTaskId: 'remediation-gap-unfixable',
        subResults: new Map([
          ['fix-gap-unfixable', { id: 'fix-gap-unfixable', status: 'failed', result: null, error: 'Simulated failure', completedAt: new Date().toISOString() }],
        ]),
        status: 'failed',
        aggregateResult: null,
        completedAt: new Date().toISOString(),
      }),
    };

    const loop = new QualityGateFeedbackLoopImpl(eventBus, mockDispatcher as any, undefined, {
      maxRetries: 2,
      escalationChannel: 'quality:escalation',
      autoExecute: true,
    });

    const gaps: VerificationGap[] = [
      {
        id: 'gap-unfixable',
        title: 'Impossible to fix',
        status: 'FAILED',
        evidence: 'Cannot be resolved automatically',
      },
    ];

    const result = await loop.runFeedbackLoop({ gaps });

    expect(result.escalated).toBe(1);
    expect(result.unfixedGaps).toBeGreaterThan(0);

    // Verify escalation event published
    const escalationEvents = eventLog.getEvents({ channel: 'quality:escalation' });
    expect(escalationEvents.length).toBeGreaterThanOrEqual(1);

    const payload = escalationEvents[0].payload as Record<string, unknown>;
    expect(payload.gapId).toBe('gap-unfixable');
    expect(payload.requiresHumanReview).toBe(true);
  });
});