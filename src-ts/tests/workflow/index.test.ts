import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as workflow from '../../workflow';
import { AdapterRegistry as DirectAdapterRegistry } from '../../workflow/adapters/base-adapter';
import { DEFAULT_NOVEL_CONFIG as directDefaultNovelConfig } from '../../workflow/novel-state';
import {
  LEVEL_DIMENSION_MULTIPLIER as directLevelMultiplier,
  QUALITY_CONTRACT_KEYS as directQualityContractKeys,
  evaluateNovelQuality as directEvaluateNovelQuality,
} from '../../workflow/novel-quality';
import {
  BaseLevel as DirectBaseLevel,
} from '../../workflow/levels/base-level';
import { PlanActMode as DirectPlanActMode, WorkflowPhase } from '../../workflow/modes/plan-act';
import { WorkflowLevel } from '../../workflow/types';

describe('workflow/index barrel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T13:05:00.000Z'));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('workflow-barrel-session');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('re-exports representative workflow runtime helpers through the public entrypoint', () => {
    expect(workflow.DEFAULT_NOVEL_CONFIG).toBe(directDefaultNovelConfig);
    expect(workflow.LEVEL_DIMENSION_MULTIPLIER).toBe(directLevelMultiplier);
    expect(workflow.QUALITY_CONTRACT_KEYS).toBe(directQualityContractKeys);
    expect(workflow.evaluateNovelQuality).toBe(directEvaluateNovelQuality);
    expect(workflow.AdapterRegistry).toBe(DirectAdapterRegistry);
    expect(workflow.BaseLevel).toBe(DirectBaseLevel);

    const state = workflow.createInitialState('写一个回归测试故事');
    const quality = workflow.evaluateNovelQuality('她走进剧院，发现了旧钟表与隐藏线索。');
    const mode = workflow.getDefaultPlanActMode();

    expect(state).toMatchObject({
      user_idea: '写一个回归测试故事',
      session_id: 'workflow-barrel-session',
      created_at: '2026-04-04T13:05:00.000Z',
    });
    expect(quality.metrics.quality_level_used).toBe('high');
    expect(mode).toBeInstanceOf(DirectPlanActMode);
  });

  it('re-exports foundational enums and classes that consumers depend on', () => {
    class BarrelLevel extends workflow.BaseLevel {
      async execute(inputData: unknown): Promise<unknown> {
        return {
          inputData,
          level: this.level,
        };
      }

      validate(output: unknown): boolean {
        return Boolean(
          output &&
            typeof output === 'object' &&
            'level' in output &&
            output['level'] === this.level,
        );
      }
    }

    const level = new BarrelLevel({
      level: WorkflowLevel.L1_RAPID,
      requiredAgents: ['writer'],
      optionalAgents: [],
      maxRevisions: 1,
      passScore: 70,
      timeoutSeconds: 60,
      persistState: false,
      persistArtifacts: false,
      checkpointEnabled: false,
      parallelExecution: false,
      maxParallelTasks: 1,
      humanReviewThreshold: 60,
      autoApprove: true,
      verbose: false,
      saveIntermediate: false,
    });

    expect(workflow.WorkflowLevel.L5_COORDINATOR).toBe(5);
    expect(workflow.WorkflowPhase.REVIEW).toBe(WorkflowPhase.REVIEW);
    expect(level.level).toBe(WorkflowLevel.L1_RAPID);
    expect(level.validate({ level: WorkflowLevel.L1_RAPID })).toBe(true);
  });
});
