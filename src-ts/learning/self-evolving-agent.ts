/**
 * Self-Evolving Agent — CAP-002
 *
 * Generator-Reflector-Curator pattern for writing style evolution.
 * Tracks user feedback as evidence and feeds it to the RuleEvolver.
 */

import {
  LearningCapability,
  PipelineStatus,
  type ILearningPipeline,
  type PipelineInput,
  type PipelineStatusInfo,
  type ExtractionResult,
  type FeedbackEvidence,
  type StyleDriftReport,
} from './learning-types';
import { calculateStyleFeatures } from './extraction-utils';
import type { RuleEvolver } from './rule-evolver';
import type { PreferenceTracker } from './preference-tracker';

export class SelfEvolvingAgent implements ILearningPipeline {
  readonly capability = LearningCapability.SELF_EVOLVING;

  private status: PipelineStatus = PipelineStatus.IDLE;
  private lastRun: string | undefined;
  private itemsProcessed = 0;
  private enabled = true;
  private error: string | undefined;

  private readonly ruleEvolver: RuleEvolver;
  private readonly preferenceTracker: PreferenceTracker;

  constructor(deps: { ruleEvolver: RuleEvolver; preferenceTracker: PreferenceTracker }) {
    this.ruleEvolver = deps.ruleEvolver;
    this.preferenceTracker = deps.preferenceTracker;
  }

  async execute(input: PipelineInput): Promise<ExtractionResult> {
    if (!this.enabled) {
      throw new Error('Self-evolving pipeline is disabled');
    }

    this.status = PipelineStatus.RUNNING;
    this.error = undefined;

    try {
      const content = input.content;
      const styleFeatures = calculateStyleFeatures(content);

      // Collect feedback evidence from input metadata
      const feedback = input.metadata?.feedback as FeedbackEvidence[] | undefined;
      if (feedback) {
        for (const evidence of feedback) {
          this.preferenceTracker.recordFeedback(evidence);
          this.ruleEvolver.addEvidence(evidence);
        }
      }

      // Check for style drift against current rules
      const driftReport = this.ruleEvolver.detectDrift(styleFeatures);

      const result: ExtractionResult = {
        entities: [],
        styleFeatures,
        worldviewElements: [],
        insights: driftReport.suggestions.map(s => ({
          content: s,
          source: 'self-evolving',
          tags: ['style-drift', driftReport.severity],
          confidence: 0.7,
        })),
        metadata: {
          driftReport,
          activeRuleCount: this.ruleEvolver.getActiveRules().length,
          evidenceCount: this.ruleEvolver.getEvidenceCount(),
          processedAt: new Date().toISOString(),
        },
      };

      this.itemsProcessed++;
      this.lastRun = new Date().toISOString();
      this.status = PipelineStatus.COMPLETED;

      return result;
    } catch (err) {
      this.status = PipelineStatus.FAILED;
      this.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  getDriftReport(): StyleDriftReport | null {
    return this.ruleEvolver.getLatestDriftReport();
  }

  getStatus(): PipelineStatusInfo {
    return {
      capability: this.capability,
      status: this.status,
      lastRun: this.lastRun,
      itemsProcessed: this.itemsProcessed,
      enabled: this.enabled,
      error: this.error,
    };
  }

  enable(): void { this.enabled = true; }
  disable(): void { this.enabled = false; }
}
