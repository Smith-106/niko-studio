import { describe, expect, it, vi } from 'vitest';

import { LearningOrchestrator } from '../../learning/learning-orchestrator';
import {
  LearningCapability,
  PipelineStatus,
  type ExtractionResult,
  type ILearningPipeline,
  type PipelineInput,
  type PipelineStatusInfo,
} from '../../learning/learning-types';

function makeExtractionResult(): ExtractionResult {
  return {
    entities: [],
    styleFeatures: { dimensions: {}, summary: 'ok', confidence: 1 },
    worldviewElements: [],
    insights: [],
    metadata: {},
  };
}

function createPipeline(
  capability: LearningCapability,
  status: PipelineStatus = PipelineStatus.IDLE,
): ILearningPipeline & {
  enable: ReturnType<typeof vi.fn>;
  disable: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
} {
  const statusInfo: PipelineStatusInfo = {
    capability,
    status,
    itemsProcessed: 0,
    enabled: true,
  };

  return {
    capability,
    execute: vi.fn(async (_input: PipelineInput) => makeExtractionResult()),
    getStatus: vi.fn(() => ({ ...statusInfo })),
    enable: vi.fn(() => {
      statusInfo.enabled = true;
    }),
    disable: vi.fn(() => {
      statusInfo.enabled = false;
    }),
  };
}

describe('learning orchestrator additional coverage', () => {
  it('disables pipelines excluded by config and keeps service dependencies accessible', () => {
    const knowledgeService = { id: 'knowledge' };
    const graphEngine = { id: 'graph' };
    const orchestrator = new LearningOrchestrator({
      knowledgeService: knowledgeService as never,
      graphEngine: graphEngine as never,
      config: {
        enabledCapabilities: [LearningCapability.READING],
        evidenceThreshold: 9,
      },
    });
    const importPipeline = createPipeline(LearningCapability.IMPORT);

    orchestrator.registerPipeline(importPipeline);

    expect(importPipeline.disable).toHaveBeenCalledTimes(1);
    expect(orchestrator.isEnabled(LearningCapability.IMPORT)).toBe(false);
    expect(orchestrator.isEnabled(LearningCapability.READING)).toBe(true);
    expect(orchestrator.getKnowledgeService()).toBe(knowledgeService);
    expect(orchestrator.getGraphEngine()).toBe(graphEngine);

    const config = orchestrator.getConfig();
    expect(config).toMatchObject({
      evidenceThreshold: 9,
      driftThreshold: 0.3,
      maxConcurrentPipelines: 3,
      distillationTemplate: 'summary',
    });

    config.evidenceThreshold = 99;
    expect(orchestrator.getConfig().evidenceThreshold).toBe(9);
  });

  it('reports null status for unregistered capabilities and counts only enabled running pipelines', () => {
    const orchestrator = new LearningOrchestrator({
      knowledgeService: {} as never,
      graphEngine: {} as never,
      config: {
        enabledCapabilities: [LearningCapability.IMPORT, LearningCapability.SELF_EVOLVING],
      },
    });
    const importPipeline = createPipeline(LearningCapability.IMPORT, PipelineStatus.RUNNING);
    const readingPipeline = createPipeline(LearningCapability.READING, PipelineStatus.RUNNING);

    orchestrator.registerPipeline(importPipeline);
    orchestrator.registerPipeline(readingPipeline);

    const status = orchestrator.getStatus();
    expect(status[LearningCapability.IMPORT]?.status).toBe(PipelineStatus.RUNNING);
    expect(status[LearningCapability.READING]?.status).toBe(PipelineStatus.RUNNING);
    expect(status[LearningCapability.SELF_EVOLVING]).toBeNull();

    expect(orchestrator.getStatusSummary()).toEqual({
      totalPipelines: 2,
      activePipelines: 1,
      runningPipelines: 1,
    });
  });

  it('delegates enable and disable calls to registered pipelines and tolerates missing ones', () => {
    const orchestrator = new LearningOrchestrator({
      knowledgeService: {} as never,
      graphEngine: {} as never,
    });
    const selfPipeline = createPipeline(LearningCapability.SELF_EVOLVING);

    orchestrator.registerPipeline(selfPipeline);
    expect(orchestrator.getPipeline(LearningCapability.SELF_EVOLVING)).toBe(selfPipeline);

    orchestrator.disable(LearningCapability.SELF_EVOLVING);
    orchestrator.enable(LearningCapability.SELF_EVOLVING);
    orchestrator.enable(LearningCapability.IMPORT);

    expect(selfPipeline.disable).toHaveBeenCalledTimes(1);
    expect(selfPipeline.enable).toHaveBeenCalledTimes(1);
    expect(orchestrator.isEnabled(LearningCapability.IMPORT)).toBe(true);
  });
});
