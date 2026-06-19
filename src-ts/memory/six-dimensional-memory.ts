/**
 * Six-Dimensional Memory System
 *
 * Implements IDimensionProcessor interface with 6 dimension processors:
 * - TimelineProcessor: Event timeline and temporal sequences
 * - ContextProcessor: Story context and narrative flow
 * - CharacterProcessor: Character identity and development
 * - WorldviewProcessor: World settings and rules
 * - PreferenceProcessor: Creative preferences and style
 * - ExperienceProcessor: Writing experience and learned patterns
 *
 * Each dimension classifies and processes content specific to its domain.
 */

import { createLogger } from "../logger/index.js";

const _log = createLogger("sixd");

/** Six memory dimensions for content classification. */
export enum DimensionType {
  TIMELINE = "timeline", // Event timeline
  CONTEXT = "context", // Story context
  CHARACTER = "character", // Character identity
  WORLDVIEW = "worldview", // World settings
  PREFERENCE = "preference", // Creative preferences
  EXPERIENCE = "experience", // Writing experience
}

/** Score for a dimension classification. */
export class DimensionScore {
  dimension: DimensionType;
  score: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  keywordsMatched: string[];

  constructor(params: {
    dimension: DimensionType;
    score?: number;
    confidence?: number;
    keywordsMatched?: string[];
  }) {
    this.dimension = params.dimension;
    this.score = params.score ?? 0.0;
    this.confidence = params.confidence ?? 0.0;
    this.keywordsMatched = params.keywordsMatched ?? [];
  }
}

/** Result of content classification across dimensions. */
export class ClassificationResult {
  content: string;
  primaryDimension: DimensionType;
  scores: DimensionScore[];
  multiDimensional: boolean;
  extractedEntities: string[];
  timestamp: Date;

  constructor(params: {
    content: string;
    primaryDimension: DimensionType;
    scores: DimensionScore[];
    multiDimensional?: boolean;
    extractedEntities?: string[];
    timestamp?: Date;
  }) {
    this.content = params.content;
    this.primaryDimension = params.primaryDimension;
    this.scores = params.scores;
    this.multiDimensional = params.multiDimensional ?? false;
    this.extractedEntities = params.extractedEntities ?? [];
    this.timestamp = params.timestamp ?? new Date();
  }

  /** Get score for a specific dimension. */
  getScore(dimension: DimensionType): number {
    for (const score of this.scores) {
      if (score.dimension === dimension) {
        return score.score;
      }
    }
    return 0.0;
  }
}

/** Content processed by a dimension processor. */
export class ProcessedContent {
  original: string;
  processed: string;
  dimension: DimensionType;
  extractedData: Record<string, unknown>;
  tags: string[];
  importance: number;
  metadata: Record<string, unknown>;

  constructor(params: {
    original: string;
    processed: string;
    dimension: DimensionType;
    extractedData?: Record<string, unknown>;
    tags?: string[];
    importance?: number;
    metadata?: Record<string, unknown>;
  }) {
    this.original = params.original;
    this.processed = params.processed;
    this.dimension = params.dimension;
    this.extractedData = params.extractedData ?? {};
    this.tags = params.tags ?? [];
    this.importance = params.importance ?? 0.5;
    this.metadata = params.metadata ?? {};
  }
}

/**
 * Interface for dimension processors.
 *
 * Each processor handles content classification and extraction
 * for its specific dimension.
 */
export interface IDimensionProcessor {
  /** Get the dimension type. */
  readonly dimension: DimensionType;

  /**
   * Classify content for this dimension.
   *
   * @param content - Content to classify.
   * @returns DimensionScore with classification result.
   */
  classify(content: string): DimensionScore;

  /**
   * Process content for this dimension.
   *
   * @param content - Content to process.
   * @returns ProcessedContent with extracted data.
   */
  process(content: string): ProcessedContent;

  /**
   * Extract dimension-specific entities from content.
   *
   * @param content - Content to extract from.
   * @returns List of extracted entity strings.
   */
  extractEntities(content: string): string[];
}

/**
 * Base implementation for dimension processors.
 */
export class BaseDimensionProcessor implements IDimensionProcessor {
  protected _dimension: DimensionType;
  protected _keywords: Set<string>;

  constructor(dimension: DimensionType, keywords: string[]) {
    this._dimension = dimension;
    this._keywords = new Set(keywords.map((kw) => kw.toLowerCase()));
  }

  get dimension(): DimensionType {
    return this._dimension;
  }

  classify(content: string): DimensionScore {
    const contentLower = content.toLowerCase();
    const matched: string[] = [];
    for (const kw of this._keywords) {
      if (contentLower.includes(kw)) {
        matched.push(kw);
      }
    }

    // Calculate score based on keyword density
    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    if (wordCount === 0) {
      return new DimensionScore({
        dimension: this._dimension,
        score: 0.0,
        confidence: 0.0,
        keywordsMatched: [],
      });
    }

    const score = Math.min(1.0, matched.length / Math.max(5, wordCount * 0.1));
    const confidence = matched.length > 0 ? Math.min(1.0, matched.length / 3) : 0.0;

    return new DimensionScore({
      dimension: this._dimension,
      score,
      confidence,
      keywordsMatched: matched,
    });
  }

  process(content: string): ProcessedContent {
    const entities = this.extractEntities(content);
    const tags = this._generateTags(content);

    return new ProcessedContent({
      original: content,
      processed: content,
      dimension: this._dimension,
      extractedData: { entities },
      tags,
      importance: this._calculateImportance(content),
    });
  }

  extractEntities(_content: string): string[] {
    return [];
  }

  protected _generateTags(content: string): string[] {
    const contentLower = content.toLowerCase();
    const tags: string[] = [];
    for (const kw of this._keywords) {
      if (contentLower.includes(kw)) {
        tags.push(kw);
        if (tags.length >= 5) break;
      }
    }
    return tags;
  }

  protected _calculateImportance(content: string): number {
    const wordCount = content.split(/\s+/).length;
    const contentLower = content.toLowerCase();
    let matched = 0;
    for (const kw of this._keywords) {
      if (contentLower.includes(kw)) {
        matched += 1;
      }
    }

    const lengthFactor = Math.min(1.0, wordCount / 100);
    const keywordFactor = Math.min(1.0, matched / 5);

    return 0.3 + lengthFactor * 0.3 + keywordFactor * 0.4;
  }
}

/**
 * Timeline dimension processor.
 *
 * Handles event sequences, temporal markers, and chronological data.
 */
export class TimelineProcessor extends BaseDimensionProcessor {
  static readonly TIMELINE_KEYWORDS = [
    "before", "after", "when", "then", "first", "last", "next",
    "previous", "later", "earlier", "during", "while", "since",
    "until", "year", "month", "day", "hour", "minute", "time",
    "past", "present", "future", "history", "event", "happened",
    "occurred", "began", "ended", "started", "finished", "sequence",
  ];

  constructor() {
    super(DimensionType.TIMELINE, TimelineProcessor.TIMELINE_KEYWORDS);
  }

  extractEntities(content: string): string[] {
    const entities: string[] = [];

    // Extract date patterns
    const datePatterns = [
      /\d{4}[-/]\d{1,2}[-/]\d{1,2}/, // YYYY-MM-DD
      /\d{1,2}[-/]\d{1,2}[-/]\d{4}/, // DD-MM-YYYY
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/i,
    ];

    for (const pattern of datePatterns) {
      const matches = content.match(new RegExp(pattern.source, "gi")) ?? [];
      entities.push(...matches);
    }

    // Extract time references
    const timeRefs = content.match(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\b/gi) ?? [];
    entities.push(...timeRefs);

    return [...new Set(entities)];
  }

  process(content: string): ProcessedContent {
    const result = super.process(content);

    // Extract temporal sequence
    const temporalMarkers: string[] = [];
    const markers = ["first", "then", "next", "finally", "later", "before", "after"];
    const contentLower = content.toLowerCase();
    for (const word of markers) {
      if (contentLower.includes(word)) {
        temporalMarkers.push(word);
      }
    }

    result.extractedData["temporal_markers"] = temporalMarkers;
    result.extractedData["has_sequence"] = temporalMarkers.length > 1;

    return result;
  }
}

/**
 * Context dimension processor.
 *
 * Handles story context, narrative flow, and scene information.
 */
export class ContextProcessor extends BaseDimensionProcessor {
  static readonly CONTEXT_KEYWORDS = [
    "scene", "chapter", "story", "narrative", "plot", "setting",
    "situation", "background", "circumstance", "environment",
    "atmosphere", "mood", "tone", "perspective", "viewpoint",
    "pov", "narrator", "conflict", "tension", "resolution",
    "climax", "beginning", "middle", "end", "transition",
  ];

  constructor() {
    super(DimensionType.CONTEXT, ContextProcessor.CONTEXT_KEYWORDS);
  }

  extractEntities(content: string): string[] {
    const entities: string[] = [];

    // Extract chapter/scene references
    const chapterRefs = content.match(/(?:Chapter|Scene|Part|Section)\s*\d+/gi) ?? [];
    entities.push(...chapterRefs);

    // Extract POV markers
    const povMarkers = content.match(/(?:first-person|third-person|omniscient|limited)/gi) ?? [];
    entities.push(...povMarkers);

    return [...new Set(entities)];
  }
}

/**
 * Character dimension processor.
 *
 * Handles character identity, traits, relationships, and development.
 */
export class CharacterProcessor extends BaseDimensionProcessor {
  static readonly CHARACTER_KEYWORDS = [
    "character", "protagonist", "antagonist", "hero", "villain",
    "trait", "personality", "motivation", "goal", "desire",
    "fear", "flaw", "strength", "weakness", "relationship",
    "friend", "enemy", "ally", "rival", "family", "love",
    "hate", "trust", "betray", "arc", "development", "growth",
    "backstory", "origin", "appearance", "voice", "dialogue",
  ];

  constructor() {
    super(DimensionType.CHARACTER, CharacterProcessor.CHARACTER_KEYWORDS);
  }

  extractEntities(content: string): string[] {
    const entities: string[] = [];

    // Extract capitalized names (potential character names)
    // Pattern: Capitalized word not at sentence start
    const namePattern = /(?<=[.!?]\s)([A-Z][a-z]+)|(?<=\s)([A-Z][a-z]+)(?=\s(?:said|asked|replied|thought|felt|looked))/g;
    let match: RegExpExecArray | null;
    while ((match = namePattern.exec(content)) !== null) {
      const name = match[1] || match[2];
      if (name && name.length > 1) {
        entities.push(name);
      }
    }

    // Extract quoted dialogue speakers
    const dialoguePattern = /"[^"]+"\s+(?:said|asked|replied|whispered|shouted)\s+([A-Z][a-z]+)/g;
    while ((match = dialoguePattern.exec(content)) !== null) {
      entities.push(match[1]);
    }

    return [...new Set(entities)];
  }

  process(content: string): ProcessedContent {
    const result = super.process(content);

    // Extract trait mentions
    const traitKeywords = ["brave", "coward", "kind", "cruel", "smart", "wise", "naive", "cunning"];
    const contentLower = content.toLowerCase();
    const foundTraits = traitKeywords.filter((t) => contentLower.includes(t));
    result.extractedData["traits"] = foundTraits;

    // Check for relationship indicators
    const relationshipWords = ["love", "hate", "friend", "enemy", "trust", "betray"];
    const hasRelationships = relationshipWords.some((w) => contentLower.includes(w));
    result.extractedData["has_relationships"] = hasRelationships;

    return result;
  }
}

/**
 * Worldview dimension processor.
 *
 * Handles world settings, rules, magic systems, and lore.
 */
export class WorldviewProcessor extends BaseDimensionProcessor {
  static readonly WORLDVIEW_KEYWORDS = [
    "world", "universe", "realm", "kingdom", "empire", "nation",
    "magic", "technology", "power", "system", "rule", "law",
    "culture", "tradition", "custom", "religion", "belief",
    "history", "legend", "myth", "lore", "geography", "map",
    "species", "race", "faction", "organization", "government",
    "economy", "society", "class", "hierarchy", "politics",
  ];

  constructor() {
    super(DimensionType.WORLDVIEW, WorldviewProcessor.WORLDVIEW_KEYWORDS);
  }

  extractEntities(content: string): string[] {
    const entities: string[] = [];

    // Extract place names (capitalized multi-word phrases)
    const placePattern = /(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Kingdom|Empire|Realm|Land|City|Town|Village|Forest|Mountain|River|Sea|Ocean)/g;
    let match: RegExpExecArray | null;
    while ((match = placePattern.exec(content)) !== null) {
      entities.push(match[1]);
    }

    // Extract system names
    const systemPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:System|Magic|Power|Force)/g;
    while ((match = systemPattern.exec(content)) !== null) {
      entities.push(match[1]);
    }

    return [...new Set(entities)];
  }
}

/**
 * Preference dimension processor.
 *
 * Handles creative preferences, style choices, and authorial intent.
 */
export class PreferenceProcessor extends BaseDimensionProcessor {
  static readonly PREFERENCE_KEYWORDS = [
    "prefer", "like", "dislike", "favorite", "style", "tone",
    "genre", "theme", "mood", "approach", "technique", "method",
    "always", "never", "usually", "often", "avoid", "include",
    "emphasis", "focus", "priority", "important", "essential",
    "optional", "required", "mandatory", "forbidden", "allowed",
  ];

  constructor() {
    super(DimensionType.PREFERENCE, PreferenceProcessor.PREFERENCE_KEYWORDS);
  }

  extractEntities(content: string): string[] {
    const entities: string[] = [];

    // Extract preference statements
    const prefPattern = /(?:I\s+)?(?:prefer|like|want|need)\s+([^,.]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = prefPattern.exec(content)) !== null) {
      const pref = match[1].trim();
      if (pref.length > 3) {
        entities.push(pref);
      }
    }

    // Extract avoidance statements
    const avoidPattern = /(?:avoid|don't|never)\s+([^,.]+)/gi;
    while ((match = avoidPattern.exec(content)) !== null) {
      const avoidance = match[1].trim();
      if (avoidance.length > 3) {
        entities.push(`avoid: ${avoidance}`);
      }
    }

    return [...new Set(entities)];
  }
}

/**
 * Experience dimension processor.
 *
 * Handles writing experience, learned patterns, and accumulated knowledge.
 */
export class ExperienceProcessor extends BaseDimensionProcessor {
  static readonly EXPERIENCE_KEYWORDS = [
    "learned", "discovered", "realized", "understood", "figured",
    "pattern", "technique", "trick", "tip", "advice", "lesson",
    "mistake", "error", "success", "failure", "improvement",
    "practice", "exercise", "example", "template", "model",
    "feedback", "review", "critique", "revision", "edit",
  ];

  constructor() {
    super(DimensionType.EXPERIENCE, ExperienceProcessor.EXPERIENCE_KEYWORDS);
  }

  extractEntities(content: string): string[] {
    const entities: string[] = [];

    // Extract learning statements
    const learnPattern = /(?:learned|discovered|realized|found)\s+(?:that\s+)?([^,.]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = learnPattern.exec(content)) !== null) {
      const learning = match[1].trim();
      if (learning.length > 5) {
        entities.push(learning);
      }
    }

    return [...new Set(entities)];
  }
}

/**
 * Routes content to appropriate dimension processors.
 *
 * Provides automatic classification and multi-dimensional processing.
 */
export class DimensionRouter {
  private _processors: Map<DimensionType, BaseDimensionProcessor>;

  constructor() {
    this._processors = new Map([
      [DimensionType.TIMELINE, new TimelineProcessor()],
      [DimensionType.CONTEXT, new ContextProcessor()],
      [DimensionType.CHARACTER, new CharacterProcessor()],
      [DimensionType.WORLDVIEW, new WorldviewProcessor()],
      [DimensionType.PREFERENCE, new PreferenceProcessor()],
      [DimensionType.EXPERIENCE, new ExperienceProcessor()],
    ]);
    _log.info("DimensionRouter initialized with all processors");
  }

  /** Get a specific dimension processor. */
  getProcessor(dimension: DimensionType): BaseDimensionProcessor {
    const processor = this._processors.get(dimension);
    if (!processor) {
      throw new Error(`Unknown dimension: ${dimension}`);
    }
    return processor;
  }

  /**
   * Classify content across all dimensions.
   *
   * @param content - Content to classify.
   * @returns ClassificationResult with scores for all dimensions.
   */
  classify(content: string): ClassificationResult {
    const scores: DimensionScore[] = [];
    const allEntities: string[] = [];

    for (const [, processor] of this._processors) {
      const score = processor.classify(content);
      scores.push(score);

      if (score.score > 0.3) {
        const entities = processor.extractEntities(content);
        allEntities.push(...entities);
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Determine primary dimension
    const primary =
      scores.length > 0 && scores[0].score > 0
        ? scores[0].dimension
        : DimensionType.CONTEXT;

    // Check if multi-dimensional
    const highScores = scores.filter((s) => s.score > 0.3);
    const multiDimensional = highScores.length > 1;

    return new ClassificationResult({
      content,
      primaryDimension: primary,
      scores,
      multiDimensional,
      extractedEntities: [...new Set(allEntities)],
    });
  }

  /**
   * Process content for a dimension.
   *
   * If dimension is null/undefined, auto-classifies and uses primary dimension.
   */
  process(content: string, dimension?: DimensionType | null): ProcessedContent {
    let resolvedDimension = dimension ?? null;
    if (resolvedDimension === null) {
      const result = this.classify(content);
      resolvedDimension = result.primaryDimension;
    }

    const processor = this._processors.get(resolvedDimension);
    if (!processor) {
      throw new Error(`Unknown dimension: ${resolvedDimension}`);
    }
    return processor.process(content);
  }

  /**
   * Process content for all dimensions.
   *
   * @returns Map of dimension to processed content.
   */
  processAll(content: string): Map<DimensionType, ProcessedContent> {
    const results = new Map<DimensionType, ProcessedContent>();
    for (const [dimension, processor] of this._processors) {
      results.set(dimension, processor.process(content));
    }
    return results;
  }

  /**
   * Get dimensions relevant to content.
   *
   * @param content - Content to analyze.
   * @param threshold - Minimum score threshold.
   * @returns List of relevant dimensions.
   */
  getRelevantDimensions(
    content: string,
    threshold: number = 0.3
  ): DimensionType[] {
    const result = this.classify(content);
    return result.scores
      .filter((s) => s.score >= threshold)
      .map((s) => s.dimension);
  }
}

// Singleton instance
let _dimensionRouter: DimensionRouter | null = null;

/** Get or create DimensionRouter singleton. */
export function getDimensionRouter(): DimensionRouter {
  if (_dimensionRouter === null) {
    _dimensionRouter = new DimensionRouter();
  }
  return _dimensionRouter;
}

/** Reset DimensionRouter singleton (for testing). */
export function resetDimensionRouter(): void {
  _dimensionRouter = null;
}
