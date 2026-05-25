/**
 * DistillationManager - Knowledge Distillation Module
 *
 * Provides 6 distillation templates for extracting structured knowledge
 * from content. Integrates with CitationManager for DerivedFrom tracking.
 *
 * Templates:
 * - SUMMARY: Content summarization
 * - KEY_POINTS: Key points extraction
 * - CHARACTER_TRAITS: Character trait distillation
 * - PLOT_STRUCTURE: Plot structure analysis
 * - WORLD_BUILDING: World-building extraction
 * - STYLE_ELEMENTS: Style element extraction
 */

import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { CitationManager, PersistedCitation } from "./citation-manager";
import { createLogger } from "../logger/index.js";

const _log = createLogger("distillation");

// ---------------------------------------------------------------------------
// DistillationTemplate enum
// ---------------------------------------------------------------------------

export enum DistillationTemplate {
  SUMMARY = "summary",
  KEY_POINTS = "key_points",
  CHARACTER_TRAITS = "character_traits",
  PLOT_STRUCTURE = "plot_structure",
  WORLD_BUILDING = "world_building",
  STYLE_ELEMENTS = "style_elements",
}

// ---------------------------------------------------------------------------
// DistillationResult
// ---------------------------------------------------------------------------

export class DistillationResult {
  resultId: string;
  sourceIds: string[];
  template: DistillationTemplate;
  content: string;
  derivedFrom: string[];
  createdAt: string;
  metadata: Record<string, unknown>;

  constructor(params: {
    resultId: string;
    sourceIds: string[];
    template: DistillationTemplate;
    content: string;
    derivedFrom?: string[];
    createdAt?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.resultId = params.resultId;
    this.sourceIds = params.sourceIds;
    this.template = params.template;
    this.content = params.content;
    this.derivedFrom = params.derivedFrom ?? [];
    this.createdAt = params.createdAt ?? new Date().toISOString();
    this.metadata = params.metadata ?? {};
  }

  /** Convert to plain object. */
  toDict(): Record<string, unknown> {
    return {
      resultId: this.resultId,
      sourceIds: this.sourceIds,
      template: this.template,
      content: this.content,
      derivedFrom: this.derivedFrom,
      createdAt: this.createdAt,
      metadata: this.metadata,
    };
  }

  /** Create from plain object. */
  static fromDict(data: Record<string, any>): DistillationResult {
    const raw = data.template ?? "summary";
    const template =
      typeof raw === "string" ? (raw as DistillationTemplate) : raw;

    return new DistillationResult({
      resultId: data.resultId,
      sourceIds: data.sourceIds ?? [],
      template,
      content: data.content ?? "",
      derivedFrom: data.derivedFrom ?? data.derived_from ?? [],
      createdAt: data.createdAt ?? data.created_at ?? new Date().toISOString(),
      metadata: data.metadata ?? {},
    });
  }
}

// ---------------------------------------------------------------------------
// Distillation Prompt Templates
// ---------------------------------------------------------------------------

export const DISTILLATION_PROMPTS: Record<DistillationTemplate, string> = {
  [DistillationTemplate.SUMMARY]: `PURPOSE: Create a concise summary of the provided content.

TASK:
- Extract the main theme and central ideas
- Preserve key information while reducing length
- Maintain logical flow and coherence
- Keep the summary to 20-30% of original length

CONTEXT:
{content}

OUTPUT FORMAT:
Provide a clear, well-structured summary that captures the essence of the content.
Focus on: Main themes, key events, important decisions, and outcomes.`,

  [DistillationTemplate.KEY_POINTS]: `PURPOSE: Extract key points and important details from the content.

TASK:
- Identify the most important facts and insights
- List actionable items or decisions
- Highlight notable quotes or statements
- Prioritize by importance

CONTEXT:
{content}

OUTPUT FORMAT:
Return a structured list of key points:
1. [Category]: Point description
2. [Category]: Point description
...

Categories: Facts, Insights, Decisions, Actions, Quotes`,

  [DistillationTemplate.CHARACTER_TRAITS]: `PURPOSE: Distill character traits, personalities, and development arcs.

TASK:
- Identify character names and roles
- Extract personality traits and motivations
- Note character relationships
- Track character development and changes
- Identify key dialogue patterns

CONTEXT:
{content}

OUTPUT FORMAT:
For each character:
**[Character Name]**
- Role: [protagonist/antagonist/supporting]
- Traits: [list of personality traits]
- Motivation: [primary driving force]
- Relationships: [connections to other characters]
- Development: [character arc or changes]
- Speech Pattern: [distinctive dialogue characteristics]`,

  [DistillationTemplate.PLOT_STRUCTURE]: `PURPOSE: Analyze and extract plot structure elements.

TASK:
- Identify the narrative structure (three-act, hero's journey, etc.)
- Extract major plot points and turning points
- Note conflicts (internal/external)
- Identify subplots and their connections
- Track pacing and tension progression

CONTEXT:
{content}

OUTPUT FORMAT:
**Plot Structure Analysis**

1. **Opening/Setup**
   - Initial situation
   - Key characters introduced

2. **Inciting Incident**
   - Event that starts the main conflict

3. **Rising Action**
   - Key events building tension
   - Complications and obstacles

4. **Climax**
   - Highest point of tension
   - Critical decision or confrontation

5. **Resolution**
   - Outcome of the conflict
   - Character states at end

**Subplots**: [list of secondary storylines]
**Themes**: [underlying themes explored]`,

  [DistillationTemplate.WORLD_BUILDING]: `PURPOSE: Extract world-building elements and settings.

TASK:
- Identify locations and their characteristics
- Extract rules of the world (magic systems, technology, society)
- Note cultural elements and customs
- Identify historical background
- Extract environmental and atmospheric details

CONTEXT:
{content}

OUTPUT FORMAT:
**World-Building Elements**

1. **Geography & Locations**
   - [Location]: Description and significance

2. **Systems & Rules**
   - [System Type]: How it works

3. **Society & Culture**
   - Social structure
   - Customs and traditions
   - Political systems

4. **History & Lore**
   - Key historical events
   - Legends or myths

5. **Atmosphere**
   - Tone and mood
   - Environmental details`,

  [DistillationTemplate.STYLE_ELEMENTS]: `PURPOSE: Extract writing style elements and literary techniques.

TASK:
- Identify narrative voice and point of view
- Note prose style (sparse, ornate, conversational, etc.)
- Extract recurring motifs and symbols
- Identify literary devices used
- Analyze sentence structure and rhythm
- Note dialogue style and format

CONTEXT:
{content}

OUTPUT FORMAT:
**Style Analysis**

1. **Narrative Voice**
   - POV: [first/second/third person]
   - Tense: [past/present]
   - Tone: [description]

2. **Prose Style**
   - Sentence length: [short/medium/long/varied]
   - Vocabulary: [simple/complex/technical]
   - Descriptive density: [sparse/moderate/rich]

3. **Literary Devices**
   - [Device]: Example from text

4. **Motifs & Symbols**
   - [Motif]: Significance

5. **Dialogue Style**
   - Format and punctuation
   - Character voice differentiation`,
};

// ---------------------------------------------------------------------------
// LLM Client type
// ---------------------------------------------------------------------------

export type LLMClient = {
  generate?(prompt: string): string | Promise<string>;
  complete?(prompt: string): string | Promise<string>;
  [key: string]: unknown;
} | ((prompt: string) => string | Promise<string>) | null;

// ---------------------------------------------------------------------------
// MemoryManager-like type for distillation integration
// ---------------------------------------------------------------------------

export type MemoryManagerForDistillation = {
  add(params: {
    content: string;
    topics: string[];
    source: string;
    importance: number;
    metadata: Record<string, unknown>;
  }): { id: string };
};

// ---------------------------------------------------------------------------
// DistillationManager
// ---------------------------------------------------------------------------

export class DistillationManager {
  basePath: string;
  distillationDir: string;
  private _citationManager: CitationManager | null;
  private _memoryManager: MemoryManagerForDistillation | null;
  private _llmClient: LLMClient;
  private _resultsIndex: Map<string, DistillationResult>;
  private _templateIndex: Map<DistillationTemplate, string[]>;

  constructor(
    basePath: string = ".writing",
    citationManager?: CitationManager | null,
    memoryManager?: MemoryManagerForDistillation | null,
    llmClient?: LLMClient,
  ) {
    this.basePath = basePath;
    this.distillationDir = path.join(basePath, "distillations");
    fs.mkdirSync(this.distillationDir, { recursive: true });

    this._citationManager = citationManager ?? null;
    this._memoryManager = memoryManager ?? null;
    this._llmClient = llmClient ?? null;

    this._resultsIndex = new Map();
    this._templateIndex = new Map();
    for (const t of Object.values(DistillationTemplate)) {
      this._templateIndex.set(t, []);
    }

    this._loadIndex();
    _log.info(`DistillationManager initialized at ${this.distillationDir}`);
  }

  /** Set CitationManager for DerivedFrom tracking. */
  setCitationManager(citationManager: CitationManager): void {
    this._citationManager = citationManager;
  }

  /** Set MemoryManager for storing distilled content. */
  setMemoryManager(memoryManager: MemoryManagerForDistillation): void {
    this._memoryManager = memoryManager;
  }

  /** Set LLM client for distillation. */
  setLLMClient(llmClient: LLMClient): void {
    this._llmClient = llmClient;
  }

  // ============================================================
  // IDistillationService Implementation
  // ============================================================

  /** Get the prompt template for a distillation type. */
  getPrompt(template: DistillationTemplate | string): string {
    const resolved = this._resolveTemplate(template);
    return DISTILLATION_PROMPTS[resolved] ?? DISTILLATION_PROMPTS[DistillationTemplate.SUMMARY];
  }

  /**
   * Perform distillation on source content.
   */
  distill(
    sources: string[],
    template: DistillationTemplate | string,
    sourceIds?: string[] | null,
    metadata?: Record<string, unknown> | null,
  ): DistillationResult {
    const resolvedTemplate = this._resolveTemplate(template);

    const combinedContent = sources.join("\n\n---\n\n");
    const promptTemplate = this.getPrompt(resolvedTemplate);
    const fullPrompt = promptTemplate.replace("{content}", combinedContent);

    let distilledContent: string;
    if (this._llmClient) {
      distilledContent = this._callLLM(fullPrompt);
    } else {
      distilledContent = this._simpleDistill(combinedContent, resolvedTemplate);
    }

    const resultId = this._generateResultId();

    let derivedFrom: string[] = [];
    if (this._citationManager && sourceIds && sourceIds.length > 0) {
      derivedFrom = this._createDerivedFromCitations(sources, sourceIds);
    }

    const result = new DistillationResult({
      resultId,
      sourceIds: sourceIds ?? [],
      template: resolvedTemplate,
      content: distilledContent,
      derivedFrom,
      metadata: metadata ?? {},
    });

    this._saveResult(result);

    this._resultsIndex.set(resultId, result);
    if (!this._templateIndex.has(resolvedTemplate)) {
      this._templateIndex.set(resolvedTemplate, []);
    }
    this._templateIndex.get(resolvedTemplate)!.push(resultId);

    _log.info(`Created distillation result: ${resultId} (template=${resolvedTemplate})`);
    return result;
  }

  /**
   * Get DerivedFrom citations for a distillation result.
   */
  getDerivedFrom(resultId: string): PersistedCitation[] {
    const result = this.getResult(resultId);
    if (!result) return [];

    if (!this._citationManager) {
      _log.warn("CitationManager not configured");
      return [];
    }

    const citations: PersistedCitation[] = [];
    for (const citationId of result.derivedFrom) {
      const citation = this._citationManager.getCitation(citationId);
      if (citation) citations.push(citation);
    }

    return citations;
  }

  /**
   * List distillation results by template type.
   */
  listByTemplate(
    template: DistillationTemplate | string,
    limit: number = 100,
  ): DistillationResult[] {
    const resolved = this._resolveTemplate(template);
    const resultIds = this._templateIndex.get(resolved) ?? [];
    const results: DistillationResult[] = [];

    for (const rid of resultIds.slice(0, limit)) {
      const result = this.getResult(rid);
      if (result) results.push(result);
    }

    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return results;
  }

  /**
   * Get a distillation result by ID.
   */
  getResult(resultId: string): DistillationResult | null {
    if (this._resultsIndex.has(resultId)) {
      return this._resultsIndex.get(resultId)!;
    }

    const filePath = this._getResultPath(resultId);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const result = DistillationResult.fromDict(data);
        this._resultsIndex.set(resultId, result);
        return result;
      } catch (e) {
        _log.warn(`Failed to load result ${resultId}: ${e}`);
      }
    }

    return null;
  }

  /**
   * Delete a distillation result.
   */
  deleteResult(resultId: string): boolean {
    const result = this.getResult(resultId);
    if (!result) return false;

    this._resultsIndex.delete(resultId);

    const templateList = this._templateIndex.get(result.template);
    if (templateList) {
      const idx = templateList.indexOf(resultId);
      if (idx !== -1) templateList.splice(idx, 1);
    }

    const filePath = this._getResultPath(resultId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    _log.info(`Deleted distillation result: ${resultId}`);
    return true;
  }

  // ============================================================
  // Extended Methods
  // ============================================================

  /**
   * Create a memory entry from distillation content.
   */
  createMemoryFromDistillation(
    content: string,
    promptType: string,
    sourceCitations?: string[] | null,
    tags?: string[] | null,
    topics?: string[] | null,
  ): string | null {
    if (!this._memoryManager) {
      _log.warn("MemoryManager not configured");
      return null;
    }

    const entry = this._memoryManager.add({
      content,
      topics: topics ?? tags ?? [promptType],
      source: "distill",
      importance: 0.7,
      metadata: {
        distillationType: promptType,
        derivedFrom: sourceCitations ?? [],
      },
    });

    _log.info(`Created memory from distillation: ${entry.id}`);
    return entry.id;
  }

  /**
   * Perform distillation with all templates.
   */
  batchDistill(
    sources: string[],
    sourceIds?: string[] | null,
  ): Map<DistillationTemplate, DistillationResult> {
    const results = new Map<DistillationTemplate, DistillationResult>();

    for (const t of Object.values(DistillationTemplate)) {
      try {
        const result = this.distill(sources, t, sourceIds);
        results.set(t, result);
      } catch (e) {
        _log.warn(`Batch distill failed for ${t}: ${e}`);
      }
    }

    return results;
  }

  // ============================================================
  // Statistics
  // ============================================================

  /** Get distillation statistics. */
  stats(): Record<string, unknown> {
    const byTemplate: Record<string, number> = {};
    for (const [t, ids] of this._templateIndex) {
      byTemplate[t] = ids.length;
    }

    return {
      totalResults: this._resultsIndex.size,
      byTemplate,
      distillationDir: this.distillationDir,
    };
  }

  /** List all available templates with descriptions. */
  listTemplates(): Array<{ name: string; description: string }> {
    return Object.values(DistillationTemplate).map((t) => ({
      name: t,
      description: DISTILLATION_PROMPTS[t].split("\n")[0].replace("PURPOSE:", "").trim(),
    }));
  }

  // ============================================================
  // Legacy Compatibility (DistillService interface)
  // ============================================================

  /**
   * Legacy compatibility: distill chapter content.
   */
  distillChapter(content: string): Record<string, unknown> {
    const result = this.distill([content], DistillationTemplate.SUMMARY);
    return {
      entities: [],
      relations: [],
      summary: result.content,
      events: [],
      characterArcs: [],
      plotPoints: [],
    };
  }

  /**
   * Legacy compatibility: apply distilled data to knowledge layer.
   */
  applyToGraph(
    knowledgeLayer: Record<string, any>,
    distilledData: Record<string, any>,
  ): void {
    for (const ent of distilledData.entities ?? []) {
      if (typeof knowledgeLayer.addEntity === "function") {
        knowledgeLayer.addEntity(ent.id ?? "", ent.name ?? "", ent.type ?? "", ent.description ?? "");
      }
    }

    for (const rel of distilledData.relations ?? []) {
      if (typeof knowledgeLayer.addRelation === "function") {
        knowledgeLayer.addRelation(rel.source ?? "", rel.target ?? "", rel.type ?? "", rel.props);
      }
    }
  }

  /**
   * Legacy compatibility: get distillation prompt.
   */
  getDistillationPrompt(taskType: string, content: string = ""): string {
    const templateMap: Record<string, DistillationTemplate> = {
      "extract-facts": DistillationTemplate.KEY_POINTS,
      "extract-relationships": DistillationTemplate.CHARACTER_TRAITS,
      insight: DistillationTemplate.SUMMARY,
    };
    const template = templateMap[taskType] ?? DistillationTemplate.SUMMARY;
    const prompt = this.getPrompt(template);
    if (content) return prompt.replace("{content}", content.substring(0, 2000));
    return prompt;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /** Resolve template from string or enum value. */
  private _resolveTemplate(template: DistillationTemplate | string): DistillationTemplate {
    if (typeof template === "string") {
      return template as DistillationTemplate;
    }
    return template;
  }

  /** Generate unique result ID. */
  private _generateResultId(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
    const uniqueSuffix = randomUUID().replace(/-/g, "").substring(0, 8);
    return `dist-${timestamp}-${uniqueSuffix}`;
  }

  /** Get file path for a result ID. */
  private _getResultPath(resultId: string): string {
    return path.join(this.distillationDir, `${resultId}.json`);
  }

  /** Save result to disk. */
  private _saveResult(result: DistillationResult): void {
    const filePath = this._getResultPath(result.resultId);
    fs.writeFileSync(filePath, JSON.stringify(result.toDict(), null, 2), "utf-8");
  }

  /** Load existing results into index. */
  private _loadIndex(): void {
    if (!fs.existsSync(this.distillationDir)) return;

    const files = fs.readdirSync(this.distillationDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.distillationDir, file), "utf-8"));
        const result = DistillationResult.fromDict(data);
        this._resultsIndex.set(result.resultId, result);

        if (!this._templateIndex.has(result.template)) {
          this._templateIndex.set(result.template, []);
        }
        this._templateIndex.get(result.template)!.push(result.resultId);
      } catch (e) {
        _log.warn(`Failed to load ${file}: ${e}`);
      }
    }
  }

  /**
   * Create DerivedFrom citations linking distillation to sources.
   */
  private _createDerivedFromCitations(sources: string[], sourceIds: string[]): string[] {
    const citationIds: string[] = [];

    for (let i = 0; i < sources.length && i < sourceIds.length; i++) {
      const source = sources[i];
      const sourceId = sourceIds[i];

      const truncatedSource = source.length > 500 ? source.substring(0, 500) : source;

      const transient = this._citationManager!.createTransientCitation(
        truncatedSource,
        {
          surface: "distillation_source",
          path: sourceId,
          loc: { kind: "full", index: i },
        },
        null,
        { metadata: { relation: "DerivedFrom" } },
      );

      const persisted = this._citationManager!.makeCitation(transient, "durable", [
        "derived_from",
        "distillation",
      ]);

      citationIds.push(persisted.citationId);
    }

    return citationIds;
  }

  /**
   * Call LLM for distillation.
   */
  private _callLLM(prompt: string): string {
    try {
      const client = this._llmClient;
      if (!client) return this._simpleDistill(prompt, DistillationTemplate.SUMMARY);

      if (typeof client === "function") return client(prompt) as string;

      if (typeof client.generate === "function") return client.generate(prompt) as string;
      if (typeof client.complete === "function") return client.complete(prompt) as string;

      _log.warn("LLM client interface not recognized");
      return this._simpleDistill(prompt, DistillationTemplate.SUMMARY);
    } catch (e) {
      _log.error(`LLM call failed: ${e}`);
      return this._simpleDistill(prompt, DistillationTemplate.SUMMARY);
    }
  }

  /**
   * Simple fallback distillation without LLM.
   */
  private _simpleDistill(content: string, template: DistillationTemplate): string {
    const sentences = content
      .replace(/\n/g, " ")
      .split(".")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    switch (template) {
      case DistillationTemplate.SUMMARY: {
        const count = Math.max(1, Math.floor(sentences.length / 3));
        return sentences.slice(0, count).join(". ") + ".";
      }

      case DistillationTemplate.KEY_POINTS: {
        const paragraphs = content.split("\n\n").map((p) => p.trim()).filter((p) => p.length > 0);
        const points: string[] = [];
        for (let i = 0; i < Math.min(paragraphs.length, 10); i++) {
          const firstSentence = paragraphs[i].split(".")[0].trim();
          if (firstSentence) points.push(`${i + 1}. ${firstSentence}`);
        }
        return points.length > 0 ? points.join("\n") : content.substring(0, 500);
      }

      case DistillationTemplate.CHARACTER_TRAITS: {
        let result = "**Character Analysis (Simple Extraction)**\n\n";
        result += "Note: Full character analysis requires LLM integration.\n\n";
        result += "Content preview:\n" + content.substring(0, 500) + "...";
        return result;
      }

      case DistillationTemplate.PLOT_STRUCTURE: {
        const third = Math.floor(content.length / 3);
        let result = "**Plot Structure (Simple Extraction)**\n\n";
        result += "Note: Full plot analysis requires LLM integration.\n\n";
        result += `**Beginning**: ${content.substring(0, 200)}...\n\n`;
        result += `**Middle**: ${content.substring(third, third + 200)}...\n\n`;
        result += `**End**: ${content.substring(content.length - 200)}...`;
        return result;
      }

      case DistillationTemplate.WORLD_BUILDING: {
        let result = "**World-Building (Simple Extraction)**\n\n";
        result += "Note: Full world-building analysis requires LLM integration.\n\n";
        result += "Content preview:\n" + content.substring(0, 500) + "...";
        return result;
      }

      case DistillationTemplate.STYLE_ELEMENTS: {
        const wordCount = content.split(/\s+/).length;
        const sentenceCount = sentences.length;
        const avgSentenceLength = wordCount / Math.max(1, sentenceCount);

        let result = "**Style Analysis (Simple Metrics)**\n\n";
        result += `- Word count: ${wordCount}\n`;
        result += `- Sentence count: ${sentenceCount}\n`;
        result += `- Average sentence length: ${avgSentenceLength.toFixed(1)} words\n\n`;
        result += "Note: Full style analysis requires LLM integration.";
        return result;
      }

      default:
        return content.substring(0, 500) + "...";
    }
  }
}

// ---------------------------------------------------------------------------
// Factory Functions (singleton)
// ---------------------------------------------------------------------------

let _distillationManager: DistillationManager | null = null;

/**
 * Get or create DistillationManager singleton.
 */
export function getDistillationManager(
  basePath: string = ".writing",
  citationManager?: CitationManager | null,
  memoryManager?: MemoryManagerForDistillation | null,
): DistillationManager {
  if (_distillationManager === null) {
    _distillationManager = new DistillationManager(basePath, citationManager, memoryManager);
  } else {
    if (citationManager && !_distillationManager["_citationManager"]) {
      _distillationManager.setCitationManager(citationManager);
    }
    if (memoryManager && !_distillationManager["_memoryManager"]) {
      _distillationManager.setMemoryManager(memoryManager);
    }
  }
  return _distillationManager;
}

/** Reset DistillationManager singleton (for testing). */
export function resetDistillationManager(): void {
  _distillationManager = null;
}
