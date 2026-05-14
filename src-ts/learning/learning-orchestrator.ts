/**
 * LearningOrchestrator — Coordinates all learning pipelines
 *
 * Manages pipeline lifecycle (enable/disable per capability), provides unified
 * status reporting, and coordinates with KnowledgeService + GraphEngine.
 */

import type { interfaces } from 'inversify';
import {
  LearningCapability,
  type ILearningPipeline,
  type PipelineStatusInfo,
  type LearningConfig,
  PipelineStatus,
} from './learning-types';
import type { IKnowledgeService, IGraphEngine } from '../container/types';

const DEFAULT_CONFIG: LearningConfig = {
  enabledCapabilities: [LearningCapability.IMPORT, LearningCapability.SELF_EVOLVING, LearningCapability.READING],
  evidenceThreshold: 3,
  driftThreshold: 0.3,
  maxConcurrentPipelines: 3,
  distillationTemplate: 'summary',
};

export interface LearningOrchestratorDeps {
  knowledgeService: IKnowledgeService;
  graphEngine: IGraphEngine;
  config?: Partial<LearningConfig>;
}

export class LearningOrchestrator {
  private pipelines = new Map<LearningCapability, ILearningPipeline>();
  private enabledCapabilities: Set<LearningCapability>;
  private readonly config: LearningConfig;
  private readonly knowledgeService: IKnowledgeService;
  private readonly graphEngine: IGraphEngine;

  constructor(deps: LearningOrchestratorDeps) {
    this.knowledgeService = deps.knowledgeService;
    this.graphEngine = deps.graphEngine;
    this.config = { ...DEFAULT_CONFIG, ...deps.config };
    this.enabledCapabilities = new Set(this.config.enabledCapabilities);
  }

  registerPipeline(pipeline: ILearningPipeline): void {
    this.pipelines.set(pipeline.capability, pipeline);
    if (!this.enabledCapabilities.has(pipeline.capability)) {
      pipeline.disable();
    }
  }

  getPipeline(capability: LearningCapability): ILearningPipeline | undefined {
    return this.pipelines.get(capability);
  }

  enable(capability: LearningCapability): void {
    this.enabledCapabilities.add(capability);
    const pipeline = this.pipelines.get(capability);
    if (pipeline) pipeline.enable();
  }

  disable(capability: LearningCapability): void {
    this.enabledCapabilities.delete(capability);
    const pipeline = this.pipelines.get(capability);
    if (pipeline) pipeline.disable();
  }

  isEnabled(capability: LearningCapability): boolean {
    return this.enabledCapabilities.has(capability);
  }

  getStatus(): Record<LearningCapability, PipelineStatusInfo | null> {
    const result: Record<string, PipelineStatusInfo | null> = {};
    for (const cap of Object.values(LearningCapability)) {
      const pipeline = this.pipelines.get(cap as LearningCapability);
      result[cap] = pipeline ? pipeline.getStatus() : null;
    }
    return result as Record<LearningCapability, PipelineStatusInfo | null>;
  }

  getStatusSummary(): { totalPipelines: number; activePipelines: number; runningPipelines: number } {
    let activePipelines = 0;
    let runningPipelines = 0;
    for (const [cap, pipeline] of this.pipelines) {
      if (this.enabledCapabilities.has(cap)) {
        activePipelines++;
        if (pipeline.getStatus().status === PipelineStatus.RUNNING) {
          runningPipelines++;
        }
      }
    }
    return {
      totalPipelines: this.pipelines.size,
      activePipelines,
      runningPipelines,
    };
  }

  getKnowledgeService(): IKnowledgeService {
    return this.knowledgeService;
  }

  getGraphEngine(): IGraphEngine {
    return this.graphEngine;
  }

  getConfig(): LearningConfig {
    return { ...this.config };
  }
}
