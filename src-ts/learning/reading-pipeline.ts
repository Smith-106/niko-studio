/**
 * Reading Learning Pipeline — CAP-003
 *
 * Session-tracked, spoiler-gated reading pipeline:
 * SessionTracker → SpoilerGate → Light/HeavyExtractor → InsightDistiller → CrossReference
 */

import {
  LearningCapability,
  PipelineStatus,
  ExtractionTier,
  type ILearningPipeline,
  type PipelineInput,
  type PipelineStatusInfo,
  type ExtractionResult,
  type ReadingSession,
  type Insight,
  type CrossReference,
} from './learning-types';
import {
  extractEntities,
  calculateStyleFeatures,
  detectWorldviewElements,
  extractBasicInsights,
} from './extraction-utils';
import { determineExtractionTier } from './spoiler-gate';
import { distillInsights } from './insight-distiller';
import type { IKnowledgeService, IGraphEngine } from '../container/types';

export class ReadingLearningPipeline implements ILearningPipeline {
  readonly capability = LearningCapability.READING;

  private status: PipelineStatus = PipelineStatus.IDLE;
  private lastRun: string | undefined;
  private itemsProcessed = 0;
  private enabled = true;
  private error: string | undefined;

  private readonly knowledgeService: IKnowledgeService;
  private readonly graphEngine: IGraphEngine;
  private sessions = new Map<string, ReadingSession>();

  constructor(deps: { knowledgeService: IKnowledgeService; graphEngine: IGraphEngine }) {
    this.knowledgeService = deps.knowledgeService;
    this.graphEngine = deps.graphEngine;
  }

  async execute(input: PipelineInput): Promise<ExtractionResult> {
    if (!this.enabled) {
      throw new Error('Reading learning pipeline is disabled');
    }

    this.status = PipelineStatus.RUNNING;
    this.error = undefined;

    try {
      const session = input.metadata?.session as ReadingSession | undefined;
      const bookId = input.metadata?.bookId as string ?? session?.bookId ?? 'unknown';

      // Update or create reading session
      if (session) {
        this.sessions.set(bookId, {
          ...session,
          updatedAt: new Date().toISOString(),
        });
      }

      const currentSession = this.sessions.get(bookId);

      // Determine extraction tier via spoiler gate
      let tier: ExtractionTier = ExtractionTier.HEAVY;
      let tierReason = 'No active session — full extraction';
      let allowedCategories: string[] = [];

      if (currentSession) {
        const gateResult = determineExtractionTier(currentSession);
        tier = gateResult.tier;
        tierReason = gateResult.reason;
        allowedCategories = gateResult.allowedCategories;
      }

      // Extract based on tier
      const entities = tier !== ExtractionTier.BLOCKED ? extractEntities(input.content) : [];
      const styleFeatures = calculateStyleFeatures(input.content);
      const worldviewElements = tier === ExtractionTier.HEAVY
        ? detectWorldviewElements(input.content)
        : [];

      let insights: Insight[] = [];
      if (tier !== ExtractionTier.BLOCKED) {
        insights = extractBasicInsights(
          input.content,
          bookId,
          currentSession ? `ch${currentSession.currentChapter}` : undefined,
        );
      }

      // Distill insights through 6-stage pipeline
      const distilled = distillInsights(insights);

      // Extract cross-references (lightweight heuristic)
      const crossRefs = this.findCrossReferences(bookId, entities.map(e => e.name));

      const result: ExtractionResult = {
        entities,
        styleFeatures,
        worldviewElements,
        insights,
        metadata: {
          bookId,
          tier,
          tierReason,
          allowedCategories,
          distilledCount: distilled.length,
          crossReferences: crossRefs,
          processedAt: new Date().toISOString(),
        },
      };

      // Persist extracted knowledge
      if (tier !== ExtractionTier.BLOCKED) {
        await this.persistResults(result, bookId);
      }

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

  private findCrossReferences(bookId: string, entityNames: string[]): CrossReference[] {
    const refs: CrossReference[] = [];
    // Heuristic: check if entity names appear in other books' sessions
    for (const [otherBookId] of this.sessions) {
      if (otherBookId === bookId) continue;
      // In a real implementation this would query the knowledge graph
      // for shared entities across books
    }
    return refs;
  }

  private async persistResults(result: ExtractionResult, bookId: string): Promise<void> {
    for (const entity of result.entities) {
      await this.knowledgeService.addEntity({
        name: entity.name,
        type: entity.type,
        confidence: entity.confidence,
        attributes: { ...entity.attributes, bookId, mentions: entity.mentions },
        source: bookId,
      });
    }

    if (result.insights.length > 0) {
      await this.knowledgeService.addDocument(
        `reading-${bookId}-${Date.now()}`,
        result.insights.map(i => i.content).join('\n'),
        { type: 'reading-insights', bookId },
      );
    }
  }

  getSession(bookId: string): ReadingSession | undefined {
    return this.sessions.get(bookId);
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
