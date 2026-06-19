/**
 * Context Summarizer — Shrink Ray summarization for the Co-Writing Engine
 *
 * Provides extractive and hierarchical summarization strategies for text that
 * exceeds token limits. Extracted from ContextScraper's inline Shrink Ray logic
 * into a standalone, reusable module.
 *
 * Strategies:
 *   - Truncation: Simple cutoff at token limit
 *   - Extractive: Select most important sentences by keyword density + position
 *   - Hierarchical: Weight chapters by recency (recent chapters retained more)
 *
 * @module cowriting/ContextSummarizer
 */

import { estimateTokens } from './ContextScraper';
import { createLogger } from '../logger';

const _log = createLogger('context-summarizer');

// ============================================================
// Interfaces
// ============================================================

export interface SummarizationRequest {
  /** The text to summarize */
  text: string;
  /** Target token count for the output */
  targetTokens: number;
  /** Summarization strategy to apply */
  strategy: 'truncation' | 'extractive' | 'hierarchical';
  /** Optional keywords that boost sentence importance in extractive mode */
  importanceKeywords?: string[];
}

export interface SummarizationResult {
  /** The summarized text */
  summary: string;
  /** Token count of the original text */
  originalTokens: number;
  /** Token count of the summarized text */
  summaryTokens: number;
  /** Ratio of summaryTokens / originalTokens (0..1) */
  compressionRatio: number;
  /** Which strategy was applied */
  strategy: string;
}

// ============================================================
// Hierarchical Strategy — Recency Weights
// ============================================================

/**
 * Retention weights by chapter recency offset.
 *   - Most recent chapter (offset 0): 100%
 *   - Previous chapter (offset 1):     60%
 *   - 2 chapters back (offset 2):      30%
 *   - 3+ chapters back (offset 3+):    15%
 */
const RECENCY_WEIGHTS: Record<number, number> = {
  0: 1.0,
  1: 0.6,
  2: 0.3,
};

function recencyWeight(chapterOffset: number): number {
  if (chapterOffset in RECENCY_WEIGHTS) {
    return RECENCY_WEIGHTS[chapterOffset];
  }
  return 0.15;
}

// ============================================================
// Sentence Splitting
// ============================================================

/**
 * Split text into sentences. Handles CJK and Western punctuation.
 * Preserves the delimiter at the end of each sentence for reconstruction.
 */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string.
  // Covers: 。！？.!? and their fullwidth variants.
  const parts = text.split(/((?:[。！？.!?][」』"')\]]*(?:\s+|$)))/u);

  const sentences: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const content = parts[i];
    const delimiter = parts[i + 1] ?? '';
    const combined = content + delimiter;
    if (combined.trim()) {
      sentences.push(combined);
    }
  }

  return sentences;
}

// ============================================================
// Sentence Scoring (Extractive Strategy)
// ============================================================

interface ScoredSentence {
  index: number;
  text: string;
  score: number;
}

/**
 * Score a sentence for extractive summarization.
 * Factors:
 *   - Position: first and last sentences get a boost
 *   - Keyword density: sentences containing importance keywords score higher
 *   - Length: very short sentences (< 10 tokens) get a penalty
 */
function scoreSentence(
  sentence: string,
  index: number,
  totalSentences: number,
  keywords: string[],
): number {
  let score = 1.0;

  // Position boost — opening and closing sentences carry more weight
  if (index === 0) {
    score += 2.0;
  } else if (index === totalSentences - 1) {
    score += 1.0;
  } else if (index < 3) {
    score += 0.5;
  }

  // Keyword density
  if (keywords.length > 0) {
    const lower = sentence.toLowerCase();
    let keywordHits = 0;
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      // Count occurrences of keyword in sentence
      let pos = 0;
      while ((pos = lower.indexOf(kwLower, pos)) !== -1) {
        keywordHits++;
        pos += kwLower.length;
      }
    }
    // Normalize by sentence token estimate to get density
    const tokens = estimateTokens(sentence);
    score += (keywordHits / tokens) * 10;
  }

  // Length penalty — very short sentences are less informative
  const tokenCount = estimateTokens(sentence);
  if (tokenCount < 5) {
    score *= 0.3;
  } else if (tokenCount < 10) {
    score *= 0.7;
  }

  return score;
}

// ============================================================
// Strategy Implementations
// ============================================================

/**
 * Truncation strategy — simple cutoff at the target token limit.
 * Cuts at the last sentence boundary that fits within the budget.
 */
function summarizeTruncation(text: string, targetTokens: number): string {
  // Try to cut at a sentence boundary
  const sentences = splitSentences(text);
  let accumulated = '';
  let accumulatedTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);
    if (accumulatedTokens + sentenceTokens > targetTokens) {
      break;
    }
    accumulated += sentence;
    accumulatedTokens += sentenceTokens;
  }

  // If no complete sentence fits, do a hard character cutoff
  if (!accumulated) {
    // Rough inverse of estimateTokens: assume ~3 chars per token as average
    const charBudget = targetTokens * 3;
    accumulated = text.slice(0, charBudget);
  }

  return accumulated;
}

/**
 * Extractive strategy — select the most important sentences based on
 * keyword density and position, then reassemble in original order.
 */
function summarizeExtractive(
  text: string,
  targetTokens: number,
  keywords: string[],
): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return text;
  }

  // Score each sentence
  const scored: ScoredSentence[] = sentences.map((s, i) => ({
    index: i,
    text: s,
    score: scoreSentence(s, i, sentences.length, keywords),
  }));

  // Sort by score descending, pick sentences until budget is met
  const ranked = [...scored].sort((a, b) => b.score - a.score);

  const selected = new Set<number>();
  let usedTokens = 0;

  for (const item of ranked) {
    const sentenceTokens = estimateTokens(item.text);
    if (usedTokens + sentenceTokens <= targetTokens) {
      selected.add(item.index);
      usedTokens += sentenceTokens;
    }
    // Once we can't fit any more, stop trying (list is sorted by score)
    // But continue in case a shorter high-score sentence still fits
  }

  // Reassemble in original order for coherence
  const result = sentences
    .filter((_, i) => selected.has(i))
    .join('');

  return result || text.slice(0, targetTokens * 3);
}

/**
 * Hierarchical strategy — weight text by chapter recency.
 * Expects text to be pre-split into chapters separated by a delimiter,
 * or treats paragraphs as chapter proxies.
 *
 * Chapter delimiter: `\n\n---\n\n` or falls back to double-newline paragraphs.
 *
 * Retention weights:
 *   - Most recent chapter: 100%
 *   - Previous chapter:     60%
 *   - 2 chapters back:      30%
 *   - 3+ chapters back:     15%
 */
function summarizeHierarchical(
  text: string,
  targetTokens: number,
  keywords: string[],
): string {
  // Split into chapters — try explicit delimiter first, then paragraphs
  let chapters: string[];
  if (text.includes('\n\n---\n\n')) {
    chapters = text.split('\n\n---\n\n').filter(c => c.trim());
  } else {
    // Treat double-newline blocks as chapter proxies
    chapters = text.split(/\n\n+/).filter(c => c.trim());
  }

  if (chapters.length <= 1) {
    // Single chapter — fall back to extractive
    return summarizeExtractive(text, targetTokens, keywords);
  }

  // Assign target token budgets per chapter based on recency
  // Last chapter = most recent (offset 0), first chapter = oldest
  const totalChapters = chapters.length;
  const chapterBudgets: number[] = [];
  let totalWeightedBudget = 0;

  for (let i = 0; i < totalChapters; i++) {
    const offset = totalChapters - 1 - i; // i=last → offset=0 (most recent)
    const weight = recencyWeight(offset);
    const chapterTokens = estimateTokens(chapters[i]);
    const budget = Math.ceil(chapterTokens * weight);
    chapterBudgets.push(budget);
    totalWeightedBudget += budget;
  }

  // Scale budgets proportionally to fit within targetTokens
  const scaleFactor = totalWeightedBudget > targetTokens
    ? targetTokens / totalWeightedBudget
    : 1.0;

  const scaledBudgets = chapterBudgets.map(b => Math.ceil(b * scaleFactor));

  // Apply extractive summarization within each chapter's budget
  const summarizedChapters = chapters.map((chapter, i) => {
    const budget = scaledBudgets[i];
    const chapterTokens = estimateTokens(chapter);

    if (chapterTokens <= budget) {
      return chapter;
    }

    // Use extractive summarization within the chapter
    return summarizeExtractive(chapter, budget, keywords);
  });

  // Rejoin with the same delimiter
  const delimiter = text.includes('\n\n---\n\n') ? '\n\n---\n\n' : '\n\n';
  return summarizedChapters.join(delimiter);
}

// ============================================================
// ContextSummarizer Class
// ============================================================

export class ContextSummarizer {
  /**
   * Summarize text according to the specified strategy and token budget.
   *
   * @param request - Summarization request with text, target tokens, strategy, and optional keywords
   * @returns Summarization result with summary text and compression metrics
   */
  summarize(request: SummarizationRequest): SummarizationResult {
    const { text, targetTokens, strategy, importanceKeywords = [] } = request;

    const originalTokens = estimateTokens(text);

    // If already within budget, return as-is
    if (originalTokens <= targetTokens) {
      return {
        summary: text,
        originalTokens,
        summaryTokens: originalTokens,
        compressionRatio: 1.0,
        strategy,
      };
    }

    let summary: string;

    switch (strategy) {
      case 'truncation':
        summary = summarizeTruncation(text, targetTokens);
        break;

      case 'extractive':
        summary = summarizeExtractive(text, targetTokens, importanceKeywords);
        break;

      case 'hierarchical':
        summary = summarizeHierarchical(text, targetTokens, importanceKeywords);
        break;

      default:
        _log.warn('Unknown summarization strategy, falling back to truncation', { strategy });
        summary = summarizeTruncation(text, targetTokens);
        break;
    }

    const summaryTokens = estimateTokens(summary);
    const compressionRatio = originalTokens > 0
      ? Math.round((summaryTokens / originalTokens) * 1000) / 1000
      : 0;

    _log.info('Summarization complete', {
      strategy,
      originalTokens,
      targetTokens,
      summaryTokens,
      compressionRatio,
    });

    return {
      summary,
      originalTokens,
      summaryTokens,
      compressionRatio,
      strategy,
    };
  }
}

// ============================================================
// Factory
// ============================================================

export function createContextSummarizer(): ContextSummarizer {
  return new ContextSummarizer();
}

/** Alias for createContextSummarizer — matches the task spec naming convention */
export function createDefaultContextSummarizer(): ContextSummarizer {
  return new ContextSummarizer();
}
