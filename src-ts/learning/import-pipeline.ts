/**
 * Import Learning Pipeline — CAP-001
 *
 * Processes imported documents through the full extraction chain:
 * parse → segment → extract entities/style/worldview → distill → store in knowledge graph.
 */

import {
  LearningCapability,
  PipelineStatus,
  type ILearningPipeline,
  type PipelineInput,
  type PipelineStatusInfo,
  type ExtractionResult,
  type EntityExtraction,
  type Insight,
} from './learning-types';
import {
  parseDocument,
  segmentText,
  extractEntities,
  calculateStyleFeatures,
  detectWorldviewElements,
  extractBasicInsights,
  type Segment,
} from './extraction-utils';
import type { IKnowledgeService, IGraphEngine } from '../container/types';

export class ImportLearningPipeline implements ILearningPipeline {
  readonly capability = LearningCapability.IMPORT;

  private status: PipelineStatus = PipelineStatus.IDLE;
  private lastRun: string | undefined;
  private itemsProcessed = 0;
  private enabled = true;
  private error: string | undefined;

  private readonly knowledgeService: IKnowledgeService;
  private readonly graphEngine: IGraphEngine;

  constructor(deps: { knowledgeService: IKnowledgeService; graphEngine: IGraphEngine }) {
    this.knowledgeService = deps.knowledgeService;
    this.graphEngine = deps.graphEngine;
  }

  async execute(input: PipelineInput): Promise<ExtractionResult> {
    if (!this.enabled) {
      throw new Error('Import learning pipeline is disabled');
    }

    this.status = PipelineStatus.RUNNING;
    this.error = undefined;

    try {
      const format = (input.metadata?.format as string) ?? 'txt';
      const content = parseDocument(input.content, format);
      const mode = (input.options?.segmentMode as 'paragraph' | 'chapter') ?? 'chapter';
      const segments = segmentText(content, mode);

      const allEntities: EntityExtraction[] = [];
      const allInsights: Insight[] = [];

      for (const seg of segments) {
        const segEntities = extractEntities(seg.content);
        allEntities.push(...segEntities);

        const segInsights = extractBasicInsights(
          seg.content,
          (input.metadata?.source as string) ?? 'import',
          seg.label,
        );
        allInsights.push(...segInsights);
      }

      const styleFeatures = calculateStyleFeatures(content);
      const worldviewElements = detectWorldviewElements(content);

      // Deduplicate entities by name
      const entityMap = new Map<string, EntityExtraction>();
      for (const e of allEntities) {
        const existing = entityMap.get(e.name);
        if (existing) {
          existing.mentions += e.mentions;
          existing.confidence = Math.max(existing.confidence, e.confidence);
        } else {
          entityMap.set(e.name, { ...e });
        }
      }
      const entities = [...entityMap.values()];

      // Deduplicate insights by content
      const insightSet = new Set<string>();
      const insights = allInsights.filter(i => {
        if (insightSet.has(i.content)) return false;
        insightSet.add(i.content);
        return true;
      });

      const result: ExtractionResult = {
        entities,
        styleFeatures,
        worldviewElements,
        insights,
        metadata: {
          source: input.metadata?.source ?? 'import',
          format,
          segmentCount: segments.length,
          segmentMode: mode,
          processedAt: new Date().toISOString(),
        },
      };

      await this.persistResults(result);

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

  private async persistResults(result: ExtractionResult): Promise<void> {
    const source = result.metadata.source as string;

    await this.knowledgeService.addDocument(
      `import-${source}-${Date.now()}`,
      result.styleFeatures.summary,
      { type: 'import-learning', ...result.metadata },
    );

    for (const entity of result.entities) {
      await this.knowledgeService.addEntity({
        name: entity.name,
        type: entity.type,
        confidence: entity.confidence,
        attributes: entity.attributes,
        source,
      });
    }

    for (const insight of result.insights) {
      await this.knowledgeService.addDocument(
        `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        insight.content,
        { type: 'insight', tags: insight.tags, source: insight.source },
      );
    }
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
