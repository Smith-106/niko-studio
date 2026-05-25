/**
 * DistillationService - Knowledge Distillation Module
 *
 * TypeScript implementation of IDistillationService interface.
 * Migrated from src/memory/distillation_manager.py.
 *
 * Provides 6 distillation templates for extracting structured knowledge from content.
 * Templates:
 * - SUMMARY: Content summarization
 * - KEY_POINTS: Key points extraction
 * - CHARACTER_TRAITS: Character trait distillation
 * - PLOT_STRUCTURE: Plot structure analysis
 * - WORLD_BUILDING: World-building extraction
 * - STYLE_ELEMENTS: Style element extraction
 */

import type { LLMService } from '../protocols/llm';

import { createLogger } from "../logger/index.js";
const _log = createLogger("svc-distill");

/**
 * Distillation template types
 */
export enum DistillationTemplate {
  SUMMARY = 'summary',
  KEY_POINTS = 'key_points',
  CHARACTER_TRAITS = 'character_traits',
  PLOT_STRUCTURE = 'plot_structure',
  WORLD_BUILDING = 'world_building',
  STYLE_ELEMENTS = 'style_elements',
}

/**
 * Result of a distillation operation
 */
export interface DistillationResult {
  /** Unique identifier for this result */
  resultId: string;
  /** List of source content IDs used for distillation */
  sourceIds: string[];
  /** The template type used */
  template: DistillationTemplate;
  /** The distilled content */
  content: string;
  /** List of citation IDs linking to sources */
  derivedFrom: string[];
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Legacy distillation result format (for backward compatibility)
 */
export interface LegacyDistillationData {
  entities: Array<{
    id: string;
    name: string;
    type: string;
    description?: string;
  }>;
  relations: Array<{
    source: string;
    target: string;
    type: string;
    props?: Record<string, unknown>;
  }>;
  summary?: string;
  events?: unknown[];
  character_arcs?: unknown[];
  plot_points?: unknown[];
}

/**
 * Distillation prompts for each template
 */
const DISTILLATION_PROMPTS: Record<DistillationTemplate, string> = {
  [DistillationTemplate.SUMMARY]: `
PURPOSE: Create a concise summary of the provided content.
TASK: Extract the main narrative arc, key events, and central themes.
MODE: Analysis
CONTEXT: {content}
EXPECTED: A coherent summary in 2-3 paragraphs capturing the essence.
RULES: Focus on the main storyline. Omit minor details.
`.trim(),

  [DistillationTemplate.KEY_POINTS]: `
PURPOSE: Extract key factual information and critical details.
TASK: Identify the most important points that define the narrative.
MODE: Analysis
CONTEXT: {content}
EXPECTED: JSON array of objects: { "point": "description", "importance": "high|medium|low" }
RULES: Prioritize plot-critical information. Be concise and factual.
`.trim(),

  [DistillationTemplate.CHARACTER_TRAITS]: `
PURPOSE: Analyze character personalities, motivations, and relationships.
TASK: Extract character traits, behavioral patterns, and development arcs.
MODE: Analysis
CONTEXT: {content}
EXPECTED: JSON array of objects: { "character": "name", "traits": ["trait1", "trait2"], "motivation": "description" }
RULES: Base traits on explicit evidence in the text. Note character growth.
`.trim(),

  [DistillationTemplate.PLOT_STRUCTURE]: `
PURPOSE: Analyze the narrative structure and plot progression.
TASK: Identify plot beats, turning points, and structural elements.
MODE: Analysis
CONTEXT: {content}
EXPECTED: JSON object with:
  1. **Exposition**: Setup and world-building
  2. **Rising Action**: Key conflicts and challenges
  3. **Climax**: Peak tension and decisive moments
  4. **Falling Action**: Consequences and resolution
  5. **Denouement**: Final state and closure
RULES: Focus on structural elements. Identify turning points.
`.trim(),

  [DistillationTemplate.WORLD_BUILDING]: `
PURPOSE: Extract world-building elements and setting details.
TASK: Identify locations, cultures, systems, and environmental details.
MODE: Analysis
CONTEXT: {content}
EXPECTED: JSON object with:
  1. **Locations**: Named places with descriptions
  2. **Cultures**: Social structures, customs, beliefs
  3. **Systems**: Magic, technology, politics, economics
  4. **History**: Backstory and historical context
  5. **Environment**: Climate, geography, ecology
RULES: Distinguish explicit details from implied elements.
`.trim(),

  [DistillationTemplate.STYLE_ELEMENTS]: `
PURPOSE: Analyze writing style and literary techniques.
TASK: Identify narrative voice, prose style, and literary devices.
MODE: Analysis
CONTEXT: {content}
EXPECTED: JSON object with:
  1. **Narrative Voice**: POV, tense, narrator type
  2. **Prose Style**: Sentence length, vocabulary, descriptive density
  3. **Literary Devices**: Metaphors, similes, foreshadowing
  4. **Motifs & Symbols**: Recurring elements and their significance
  5. **Dialogue Style**: Format, punctuation, voice differentiation
RULES: Provide specific examples from the text.
`.trim(),
};

/**
 * DistillationService - Knowledge Distillation Manager
 *
 * Implements IDistillationService interface with 6 distillation templates.
 * Integrates with LLMService for actual content distillation.
 *
 * Features:
 * - 6 specialized distillation templates
 * - LLM-powered content analysis
 * - Fallback to simple extraction when LLM unavailable
 * - Legacy compatibility methods for DistillService API
 * - Full TypeScript type safety
 */
export class DistillationService {
  private llmClient: LLMService | null;
  private resultsIndex: Map<string, DistillationResult>;
  private templateIndex: Map<DistillationTemplate, string[]>;

  constructor(llmClient?: LLMService) {
    this.llmClient = llmClient || null;
    this.resultsIndex = new Map();
    this.templateIndex = new Map();
  }

  /**
   * Set LLM client for distillation
   */
  setLLMClient(llmClient: LLMService): void {
    this.llmClient = llmClient;
  }

  // ============================================================
  // IDistillationService Implementation
  // ============================================================

  /**
   * Get the prompt template for a distillation type
   *
   * @param template - Template type or string value
   * @returns Prompt template string
   */
  getPrompt(template: DistillationTemplate | string): string {
    const templateEnum =
      typeof template === 'string'
        ? Object.values(DistillationTemplate).find((t) => t === template) ||
          DistillationTemplate.SUMMARY
        : template;

    return (
      DISTILLATION_PROMPTS[templateEnum] ||
      DISTILLATION_PROMPTS[DistillationTemplate.SUMMARY]
    );
  }

  /**
   * Perform distillation on source content
   *
   * @param sources - List of source content strings to distill
   * @param template - Distillation template to use
   * @param sourceIds - Optional list of source identifiers
   * @param metadata - Additional metadata
   * @returns DistillationResult with distilled content
   */
  async distill(
    sources: string[],
    template: DistillationTemplate | string,
    sourceIds?: string[],
    metadata?: Record<string, unknown>
  ): Promise<DistillationResult> {
    const templateEnum =
      typeof template === 'string'
        ? Object.values(DistillationTemplate).find((t) => t === template) ||
          DistillationTemplate.SUMMARY
        : template;

    // Combine sources
    const combinedContent = sources.join('\n\n---\n\n');

    // Get prompt template
    const prompt = this.getPrompt(templateEnum);
    const fullPrompt = prompt.replace('{content}', combinedContent);

    // Perform distillation (via LLM or fallback)
    let distilledContent: string;
    if (this.llmClient) {
      distilledContent = await this.callLLM(fullPrompt);
    } else {
      // Fallback: simple extraction based on template
      distilledContent = this.simpleDistill(combinedContent, templateEnum);
    }

    // Generate result ID
    const resultId = this.generateResultId();

    // Create result
    const result: DistillationResult = {
      resultId,
      sourceIds: sourceIds || [],
      template: templateEnum,
      content: distilledContent,
      derivedFrom: [], // CitationManager integration would go here
      createdAt: new Date().toISOString(),
      metadata: metadata || {},
    };

    // Index result
    this.resultsIndex.set(resultId, result);
    if (!this.templateIndex.has(templateEnum)) {
      this.templateIndex.set(templateEnum, []);
    }
    this.templateIndex.get(templateEnum)!.push(resultId);

    return result;
  }

  /**
   * Get distillation result by ID
   *
   * @param resultId - Result identifier
   * @returns DistillationResult or undefined
   */
  getResult(resultId: string): DistillationResult | undefined {
    return this.resultsIndex.get(resultId);
  }

  /**
   * List all results by template
   *
   * @param template - Template type to filter by
   * @returns Array of DistillationResults
   */
  listByTemplate(template: DistillationTemplate): DistillationResult[] {
    const ids = this.templateIndex.get(template) || [];
    return ids
      .map((id) => this.resultsIndex.get(id))
      .filter((r): r is DistillationResult => r !== undefined);
  }

  // ============================================================
  // Legacy Compatibility (DistillService interface)
  // ============================================================

  /**
   * Legacy compatibility method for DistillService.distill_chapter()
   *
   * @param content - Chapter content to distill
   * @returns Dict with entities and relations (DistillService format)
   */
  async distillChapter(content: string): Promise<LegacyDistillationData> {
    const result = await this.distill([content], DistillationTemplate.SUMMARY);
    return {
      entities: [],
      relations: [],
      summary: result.content,
      events: [],
      character_arcs: [],
      plot_points: [],
    };
  }

  /**
   * Legacy compatibility method for DistillService.apply_to_graph()
   *
   * @param knowledgeLayer - AgentKnowledgeLayer instance (typed as any for flexibility)
   * @param distilledData - Distilled data dict
   */
  applyToGraph(
    knowledgeLayer: {
      addEntity?: (
        id: string,
        name: string,
        type: string,
        description: string
      ) => void;
      addRelation?: (
        source: string,
        target: string,
        type: string,
        props?: Record<string, unknown>
      ) => void;
    },
    distilledData: LegacyDistillationData
  ): void {
    // Apply entities
    for (const ent of distilledData.entities || []) {
      if (knowledgeLayer.addEntity) {
        knowledgeLayer.addEntity(
          ent.id,
          ent.name,
          ent.type,
          ent.description || ''
        );
      }
    }

    // Apply relations
    for (const rel of distilledData.relations || []) {
      if (knowledgeLayer.addRelation) {
        knowledgeLayer.addRelation(rel.source, rel.target, rel.type, rel.props);
      }
    }
  }

  /**
   * Legacy compatibility method for DistillService.get_distillation_prompt()
   *
   * @param taskType - Prompt type string
   * @param content - Content to include in prompt (optional)
   * @returns Prompt string
   */
  getDistillationPrompt(taskType: string, content: string = ''): string {
    const templateMap: Record<string, DistillationTemplate> = {
      'extract-facts': DistillationTemplate.KEY_POINTS,
      'extract-relationships': DistillationTemplate.CHARACTER_TRAITS,
      insight: DistillationTemplate.SUMMARY,
    };

    const template = templateMap[taskType] || DistillationTemplate.SUMMARY;
    const prompt = this.getPrompt(template);

    if (content) {
      return prompt.replace('{content}', content.slice(0, 2000));
    }
    return prompt;
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Generate unique result ID
   */
  private generateResultId(): string {
    return `dist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Call LLM for distillation
   *
   * @param prompt - Full prompt with content
   * @returns LLM response
   */
  private async callLLM(prompt: string): Promise<string> {
    if (!this.llmClient) {
      return this.simpleDistill(prompt, DistillationTemplate.SUMMARY);
    }

    try {
      return await this.llmClient.generate(prompt);
    } catch (error) {
      _log.error('LLM call failed', { error });
      return this.simpleDistill(prompt, DistillationTemplate.SUMMARY);
    }
  }

  /**
   * Simple fallback distillation without LLM
   *
   * @param content - Content to distill
   * @param template - Template type
   * @returns Simple extracted content
   */
  private simpleDistill(
    content: string,
    template: DistillationTemplate
  ): string {
    // Split content into sentences
    const sentences = content
      .replace(/\n/g, ' ')
      .split('.')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (template === DistillationTemplate.SUMMARY) {
      // Take first 30% of sentences
      const count = Math.max(1, Math.floor(sentences.length / 3));
      return sentences.slice(0, count).join('. ') + '.';
    } else if (template === DistillationTemplate.KEY_POINTS) {
      // Take first 5 sentences as key points
      return sentences.slice(0, 5).join('. ') + '.';
    } else {
      // Default: return first 3 sentences
      return sentences.slice(0, 3).join('. ') + '.';
    }
  }
}
