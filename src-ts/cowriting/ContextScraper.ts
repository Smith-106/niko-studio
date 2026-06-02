/**
 * Context Scraper — assembles SB + session + chapter context for the Co-Writing Engine
 *
 * Gathers context from three sources:
 * 1. Story Bible entities (characters, world rules, plot threads, timeline events)
 * 2. Session intelligence (recent edits, writing style, current chapter, cursor position)
 * 3. Chapter context (surrounding text, chapter summary)
 *
 * When the assembled context exceeds a configurable token budget, the Shrink Ray
 * summarization pipeline progressively reduces less-relevant content:
 *   - Drop low-relevance world rules first
 *   - Summarize timeline events to key points
 *   - Truncate character details to essential fields
 *
 * @module cowriting/ContextScraper
 */

import type {
  CharacterProfile,
  WorldRule,
  PlotThread,
  TimelineEvent,
} from '../knowledge/entities/story-bible-types';
import {
  CharacterArchetype,
} from '../knowledge/entities/story-bible-types';
import type { CompletenessReport } from '../knowledge/StoryBibleCompleteness';
import { StoryBibleCompleteness } from '../knowledge/StoryBibleCompleteness';
import { createLogger } from '../logger';

const _log = createLogger('context-scraper');

// ============================================================
// ScrapedContext Interface
// ============================================================

export interface ScrapedContext {
  storyBible: {
    characters: CharacterProfile[];
    worldRules: WorldRule[];
    plotThreads: PlotThread[];
    timelineEvents: TimelineEvent[];
    completeness: CompletenessReport;
  };
  sessionContext: {
    recentEdits: string[];
    writingStyle: string;
    currentChapter: string;
    cursorPosition: number;
  };
  chapterContext: {
    precedingText: string;
    succeedingText: string;
    chapterSummary: string;
  };
  totalTokenEstimate: number;
}

// ============================================================
// Input Interfaces
// ============================================================

export interface StoryBibleInput {
  characters: CharacterProfile[];
  worldRules: WorldRule[];
  plotThreads: PlotThread[];
  timelineEvents: TimelineEvent[];
}

export interface SessionInput {
  recentEdits: string[];
  writingStyle: string;
  currentChapter: string;
  cursorPosition: number;
}

export interface ChapterInput {
  fullText: string;
  cursorPosition: number;
  chapterSummary: string;
}

export interface ContextScraperConfig {
  /** Maximum token budget (default: 8000) */
  maxTokens: number;
  /** Characters of preceding text to include (default: 2000) */
  precedingTextChars: number;
  /** Characters of succeeding text to include (default: 500) */
  succeedingTextChars: number;
  /** Maximum recent edits to include (default: 10) */
  maxRecentEdits: number;
}

// ============================================================
// Token Estimation
// ============================================================

/**
 * Estimate token count for mixed Chinese/English text.
 * Rough heuristic: 1 token ~ 4 chars for English, ~ 2 chars for Chinese.
 * Detects CJK characters and applies the appropriate ratio.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let cjkCount = 0;
  let otherCount = 0;

  for (const ch of text) {
    // CJK Unified Ideographs + CJK Extension A + common CJK punctuation
    const code = ch.codePointAt(0)!;
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3000 && code <= 0x303f) ||  // CJK punctuation
      (code >= 0xff00 && code <= 0xffef)       // fullwidth forms
    ) {
      cjkCount++;
    } else {
      otherCount++;
    }
  }

  const cjkTokens = Math.ceil(cjkCount / 2);
  const otherTokens = Math.ceil(otherCount / 4);

  return cjkTokens + otherTokens;
}

/**
 * Estimate tokens for a serializable object by JSON-ifying it.
 * Used for Story Bible entities where we need the full serialized form.
 */
function estimateObjectTokens(obj: unknown): number {
  return estimateTokens(JSON.stringify(obj));
}

// ============================================================
// Shrink Ray — Context Summarization
// ============================================================

/**
 * Relevance score for a world rule.
 * Global scope > regional > local. Rules with related entities are more relevant.
 */
function worldRuleRelevance(rule: WorldRule): number {
  let score = 0;
  switch (rule.impactScope) {
    case 'global': score += 3; break;
    case 'regional': score += 2; break;
    case 'local': score += 1; break;
  }
  score += Math.min(rule.relatedEntities.length, 3);
  score += rule.completenessScore;
  return score;
}

/**
 * Relevance score for a character.
 * Protagonist > deuteragonist > antagonist > mentor > supporting > narrator.
 * Higher completeness and POV affinity boost relevance.
 */
function characterRelevance(char: CharacterProfile): number {
  let score = 0;
  switch (char.archetype) {
    case CharacterArchetype.PROTAGONIST: score += 5; break;
    case CharacterArchetype.DEUTERAGONIST: score += 4; break;
    case CharacterArchetype.ANTAGONIST: score += 3; break;
    case CharacterArchetype.MENTOR: score += 2; break;
    case CharacterArchetype.SUPPORTING: score += 1; break;
    case CharacterArchetype.NARRATOR: score += 1; break;
  }
  score += char.completenessScore * 2;
  score += char.povAffinity;
  return score;
}

/**
 * Relevance score for a timeline event.
 * Critical > high > medium > low emotional impact.
 */
function timelineEventRelevance(event: TimelineEvent): number {
  switch (event.emotionalImpact) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

/**
 * Truncate a character to essential fields only, reducing token usage.
 * Keeps: name, archetype, motivations, arcStage, and a summary of traits.
 * Drops: backstory, speechPatterns, full relationships, full traits.
 */
function truncateCharacter(char: CharacterProfile): CharacterProfile {
  const traitSummary = char.traits.length > 0
    ? char.traits.slice(0, 3).map(t => t.trait).join(', ')
    : '';

  return {
    ...char,
    backstory: '',
    speechPatterns: [],
    relationships: char.relationships.slice(0, 2),
    traits: traitSummary
      ? [{ trait: traitSummary, intensity: 0.5, evidence: '' }]
      : [],
  };
}

/**
 * Summarize a timeline event to its key points only.
 * Keeps: name, eventType, emotionalImpact, and a truncated description.
 * Drops: participants, consequences, plotThreadRefs, full description.
 */
function summarizeTimelineEvent(event: TimelineEvent): TimelineEvent {
  return {
    ...event,
    description: event.description.length > 60
      ? event.description.slice(0, 57) + '...'
      : event.description,
    participants: [],
    consequences: [],
    plotThreadRefs: [],
  };
}

// ============================================================
// ContextScraper Class
// ============================================================

const DEFAULT_CONFIG: ContextScraperConfig = {
  maxTokens: 8000,
  precedingTextChars: 2000,
  succeedingTextChars: 500,
  maxRecentEdits: 10,
};

export class ContextScraper {
  private readonly config: ContextScraperConfig;
  private readonly completenessGate: StoryBibleCompleteness;

  constructor(config?: Partial<ContextScraperConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.completenessGate = new StoryBibleCompleteness();
  }

  /**
   * Assemble context from all three sources.
   * Applies Shrink Ray summarization if the result exceeds maxTokens.
   */
  assembleContext(
    storyBible: StoryBibleInput,
    session: SessionInput,
    chapter: ChapterInput,
  ): ScrapedContext {
    // 1. Build chapter context from full text + cursor position
    const precedingText = chapter.fullText.slice(
      Math.max(0, chapter.cursorPosition - this.config.precedingTextChars),
      chapter.cursorPosition,
    );
    const succeedingText = chapter.fullText.slice(
      chapter.cursorPosition,
      chapter.cursorPosition + this.config.succeedingTextChars,
    );

    // 2. Build session context
    const recentEdits = session.recentEdits.slice(-this.config.maxRecentEdits);

    // 3. Build Story Bible context with completeness report
    const allEntities = [
      ...storyBible.characters,
      ...storyBible.worldRules,
      ...storyBible.plotThreads,
      ...storyBible.timelineEvents,
    ];
    const completeness = this.completenessGate.calculateOverallScore(allEntities);

    const context: ScrapedContext = {
      storyBible: {
        characters: [...storyBible.characters],
        worldRules: [...storyBible.worldRules],
        plotThreads: [...storyBible.plotThreads],
        timelineEvents: [...storyBible.timelineEvents],
        completeness,
      },
      sessionContext: {
        recentEdits,
        writingStyle: session.writingStyle,
        currentChapter: session.currentChapter,
        cursorPosition: session.cursorPosition,
      },
      chapterContext: {
        precedingText,
        succeedingText,
        chapterSummary: chapter.chapterSummary,
      },
      totalTokenEstimate: 0,
    };

    // 4. Estimate tokens and apply Shrink Ray if needed
    context.totalTokenEstimate = this.estimateTotalTokens(context);

    if (context.totalTokenEstimate > this.config.maxTokens) {
      this.applyShrinkRay(context);
    }

    return context;
  }

  /**
   * Estimate total tokens for a ScrapedContext.
   */
  private estimateTotalTokens(context: ScrapedContext): number {
    let total = 0;

    // Story Bible entities
    for (const char of context.storyBible.characters) {
      total += estimateObjectTokens(char);
    }
    for (const rule of context.storyBible.worldRules) {
      total += estimateObjectTokens(rule);
    }
    for (const thread of context.storyBible.plotThreads) {
      total += estimateObjectTokens(thread);
    }
    for (const event of context.storyBible.timelineEvents) {
      total += estimateObjectTokens(event);
    }

    // Completeness report (lightweight)
    total += estimateObjectTokens({
      overallScore: context.storyBible.completeness.overallScore,
      level: context.storyBible.completeness.level,
      missingFields: context.storyBible.completeness.missingFields,
      recommendations: context.storyBible.completeness.recommendations,
    });

    // Session context
    total += estimateTokens(context.sessionContext.writingStyle);
    total += estimateTokens(context.sessionContext.currentChapter);
    for (const edit of context.sessionContext.recentEdits) {
      total += estimateTokens(edit);
    }

    // Chapter context
    total += estimateTokens(context.chapterContext.precedingText);
    total += estimateTokens(context.chapterContext.succeedingText);
    total += estimateTokens(context.chapterContext.chapterSummary);

    return total;
  }

  /**
   * Shrink Ray — progressively reduce context to fit within maxTokens.
   *
   * Strategy (in order):
   * 1. Drop low-relevance world rules
   * 2. Summarize timeline events to key points
   * 3. Truncate character details to essential fields
   */
  private applyShrinkRay(context: ScrapedContext): void {
    const target = this.config.maxTokens;
    _log.info('Shrink Ray activated', {
      currentTokens: context.totalTokenEstimate,
      targetTokens: target,
    });

    // Phase 1: Drop low-relevance world rules
    if (context.totalTokenEstimate > target && context.storyBible.worldRules.length > 0) {
      const sorted = [...context.storyBible.worldRules]
        .sort((a, b) => worldRuleRelevance(b) - worldRuleRelevance(a));

      // Keep dropping the least relevant until under budget or only 1 rule left
      while (
        context.totalTokenEstimate > target &&
        sorted.length > 1
      ) {
        const dropped = sorted.pop()!;
        context.storyBible.worldRules = sorted.map(r => r);
        context.totalTokenEstimate = this.estimateTotalTokens(context);
        _log.debug('Shrink Ray: dropped world rule', {
          name: dropped.name,
          relevance: worldRuleRelevance(dropped),
          newTokenEstimate: context.totalTokenEstimate,
        });
      }
    }

    // Phase 2: Summarize timeline events to key points
    if (context.totalTokenEstimate > target && context.storyBible.timelineEvents.length > 0) {
      // Sort by relevance, keep critical/high events as-is, summarize medium/low
      const sorted = [...context.storyBible.timelineEvents]
        .sort((a, b) => timelineEventRelevance(b) - timelineEventRelevance(a));

      // First, summarize all medium/low events
      let summarized = sorted.map(event =>
        event.emotionalImpact === 'critical' || event.emotionalImpact === 'high'
          ? event
          : summarizeTimelineEvent(event),
      );
      context.storyBible.timelineEvents = summarized;
      context.totalTokenEstimate = this.estimateTotalTokens(context);

      // If still over budget, start dropping the least relevant events
      while (context.totalTokenEstimate > target && summarized.length > 1) {
        summarized = summarized.slice(0, -1);
        context.storyBible.timelineEvents = summarized;
        context.totalTokenEstimate = this.estimateTotalTokens(context);
      }

      _log.debug('Shrink Ray: summarized timeline events', {
        remaining: context.storyBible.timelineEvents.length,
        newTokenEstimate: context.totalTokenEstimate,
      });
    }

    // Phase 3: Truncate character details to essential fields
    if (context.totalTokenEstimate > target && context.storyBible.characters.length > 0) {
      // Sort by relevance — keep protagonist and high-relevance characters intact
      const sorted = [...context.storyBible.characters]
        .sort((a, b) => characterRelevance(b) - characterRelevance(a));

      // Truncate all non-protagonist characters first
      let truncated = sorted.map(char =>
        char.archetype === CharacterArchetype.PROTAGONIST
          ? char
          : truncateCharacter(char),
      );
      context.storyBible.characters = truncated;
      context.totalTokenEstimate = this.estimateTotalTokens(context);

      // If still over budget, truncate protagonist too
      if (context.totalTokenEstimate > target) {
        truncated = truncated.map(char => truncateCharacter(char));
        context.storyBible.characters = truncated;
        context.totalTokenEstimate = this.estimateTotalTokens(context);
      }

      // Last resort: drop the least relevant characters
      while (context.totalTokenEstimate > target && truncated.length > 1) {
        truncated = truncated.slice(0, -1);
        context.storyBible.characters = truncated;
        context.totalTokenEstimate = this.estimateTotalTokens(context);
      }

      _log.debug('Shrink Ray: truncated characters', {
        remaining: context.storyBible.characters.length,
        newTokenEstimate: context.totalTokenEstimate,
      });
    }

    _log.info('Shrink Ray completed', {
      finalTokenEstimate: context.totalTokenEstimate,
      withinBudget: context.totalTokenEstimate <= target,
    });
  }
}

// ============================================================
// Factory
// ============================================================

export function createContextScraper(config?: Partial<ContextScraperConfig>): ContextScraper {
  return new ContextScraper(config);
}
