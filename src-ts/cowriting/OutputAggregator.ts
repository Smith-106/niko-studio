/**
 * Output Aggregator — post-processes raw AI output for the Co-Writing Engine
 *
 * Cleans and formats LLM output according to co-writing mode:
 * - Auto: strip artifacts, return cleaned continuation text
 * - Guided: parse 3 options with scores, return GuidedOption[]
 * - Directed: return text with instruction compliance check
 *
 * Post-processing pipeline:
 * 1. Strip system/instruction artifacts from raw output
 * 2. Apply mode-specific formatting
 * 3. Tag with quality metadata (model, timestamp, tokens, confidence)
 *
 * @module cowriting/OutputAggregator
 */

import type { ModelConfig } from './ModelRouter';
import { estimateTokens } from './ContextScraper';
import { createLogger } from '../logger';

const _log = createLogger('output-aggregator');

// ============================================================
// Public Interfaces
// ============================================================

export interface GuidedOption {
  text: string;
  scores: { coherence: number; creativity: number; styleMatch: number };
  overallScore: number;
  index: number;
}

export interface AggregatedOutput {
  mode: 'auto' | 'guided' | 'directed';
  text: string;
  options?: GuidedOption[];
  metadata: {
    model: string;
    generatedAt: string;
    tokenCount: number;
    confidence: number;
  };
}

// ============================================================
// Artifact Stripping
// ============================================================

/**
 * Patterns that indicate system/instruction artifacts leaked into output.
 * These are common when LLMs echo back parts of the prompt or add
 * meta-commentary about their own generation.
 */
const ARTIFACT_PATTERNS: RegExp[] = [
  // System prompt echoes
  /^##?\s*(quality constraints?|instructions?|story bible|writing style|chapter context|creativity spectrum)/im,
  // Role definition echoes
  /^you are a\s+(seamless co-writer|creative writing consultant|precision writing assistant)/im,
  // Meta-commentary
  /^(here(?:'s| is) (?:the |my )?(?:continuation|response|output|text)|i(?:'ll| will) (?:now |continue |provide ))/im,
  // Closing meta-commentary
  /^(let me know|hope this helps|feel free to|would you like me to)/im,
  // XML/HTML-like tags sometimes used in structured output
  /^<\/?(system|instructions?|context|output|response)>/im,
];

/**
 * Strip system/instruction artifacts from raw AI output.
 *
 * Removes lines that match known artifact patterns, preserving
 * the actual content. Handles both line-by-line artifacts and
 * multi-line blocks that start with an artifact pattern.
 */
function stripArtifacts(raw: string): string {
  const lines = raw.split('\n');
  const cleaned: string[] = [];
  let skipBlock = false;

  for (const line of lines) {
    // Check if this line starts an artifact block
    const isArtifactStart = ARTIFACT_PATTERNS.some(p => p.test(line));

    if (isArtifactStart) {
      skipBlock = true;
      continue;
    }

    // A non-empty line that doesn't look like a continuation of an artifact
    // ends the skip block
    if (skipBlock && line.trim().length > 0) {
      // Check if this line is itself a new artifact
      const isNewArtifact = ARTIFACT_PATTERNS.some(p => p.test(line));
      if (isNewArtifact) {
        continue;
      }
      skipBlock = false;
    }

    if (!skipBlock) {
      cleaned.push(line);
    }
  }

  // Trim leading/trailing blank lines but preserve internal structure
  return cleaned.join('\n').replace(/^\n+/, '').replace(/\n+$/, '\n');
}

// ============================================================
// Auto Mode Formatting
// ============================================================

/**
 * Format output for auto mode: clean continuation text.
 *
 * Strips artifacts and ensures the text reads as a natural
 * continuation without any meta-commentary.
 */
function formatAutoOutput(cleaned: string): string {
  // Remove any remaining numbered prefixes that might leak from
  // the LLM treating this as a list (e.g., "1. The door opened...")
  const text = cleaned.replace(/^(\d+)\.\s+/gm, '');

  return text.trim();
}

// ============================================================
// Guided Mode Parsing
// ============================================================

/**
 * Score extraction pattern — matches various score formats:
 * - "coherence: 85" / "coherence: 85/100" / "coherence: 0.85"
 * - "Coherence: 85" / "Coherence Score: 85"
 */
function extractScore(text: string, dimension: string): number {
  const patterns = [
    // "dimension: 85/100" or "dimension: 85"
    new RegExp(`${dimension}[^\\d]*(\\d{1,3})(?:\\/100)?`, 'i'),
    // "dimension: 0.85" (0-1 scale)
    new RegExp(`${dimension}[^\\d]*(0\\.\\d{1,2})`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      // Normalize to 0-100 scale
      return value <= 1 ? Math.round(value * 100) : Math.min(100, Math.round(value));
    }
  }

  return 50; // default mid-range score
}

/**
 * Split raw output into option blocks for guided mode.
 *
 * Recognized delimiters:
 * - "Option 1:" / "Option 2:" / "Option 3:"
 * - "1." / "2." / "3." at the start of a line (with optional bold/formatting)
 * - "**Option 1**" / "**1.**" markdown bold
 */
function splitIntoOptions(raw: string): string[] {
  // Try "Option N" pattern first (most explicit)
  const optionPattern = /(?:^|\n)(?:\*{0,2})Option\s+(\d+)(?:\*{0,2})\s*[:：]\s*/gi;
  const optionSplits = splitByPattern(raw, optionPattern);

  if (optionSplits.length >= 2) {
    return optionSplits;
  }

  // Fallback: numbered markers "1." / "2." / "3." at line start
  const numberedPattern = /(?:^|\n)(?:\*{0,2})(\d+)(?:\.\*{0,2})\s+/g;
  const numberedSplits = splitByPattern(raw, numberedPattern);

  if (numberedSplits.length >= 2) {
    return numberedSplits;
  }

  // Last resort: return the whole text as a single option
  return [raw];
}

/**
 * Split text by a pattern, returning the captured segments.
 * Each segment is the text following a pattern match.
 */
function splitByPattern(text: string, pattern: RegExp): string[] {
  const segments: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset pattern state
  pattern.lastIndex = 0;

  const matchPositions: { start: number; end: number }[] = [];

  while ((match = pattern.exec(text)) !== null) {
    // Only accept matches for options 1-3
    const optionNum = parseInt(match[1], 10);
    if (optionNum >= 1 && optionNum <= 3) {
      matchPositions.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  if (matchPositions.length === 0) {
    return [text];
  }

  for (let i = 0; i < matchPositions.length; i++) {
    const start = matchPositions[i].end;
    const end = i + 1 < matchPositions.length ? matchPositions[i + 1].start : text.length;
    segments.push(text.slice(start, end).trim());
  }

  return segments;
}

/**
 * Parse a single option block into a GuidedOption.
 *
 * Extracts the continuation text and scores from the option block.
 * Scores are extracted from trailing score lines or inline score annotations.
 */
function parseOption(optionText: string, index: number): GuidedOption {
  // Extract scores from the option text
  const coherence = extractScore(optionText, 'coherence');
  const creativity = extractScore(optionText, 'creativity');
  const styleMatch = extractScore(optionText, 'style(?:[- ]?match)?');

  const overallScore = Math.round((coherence + creativity + styleMatch) / 3);

  // Clean the option text: remove score lines and rationale lines
  const cleanedLines = optionText.split('\n').filter(line => {
    const trimmed = line.trim();
    // Remove lines that are purely score annotations
    if (/^(coherence|creativity|style[- ]?match|overall)\s*[:：]/i.test(trimmed)) {
      return false;
    }
    // Remove lines that are purely rationale annotations
    if (/^rationale\s*[:：]/i.test(trimmed)) {
      return false;
    }
    // Remove lines that are just a score like "85/100"
    if (/^\d{1,3}\/100$/.test(trimmed)) {
      return false;
    }
    return true;
  });

  const text = cleanedLines.join('\n').trim();

  return {
    text,
    scores: { coherence, creativity, styleMatch },
    overallScore,
    index,
  };
}

/**
 * Format output for guided mode: parse 3 options with scores.
 *
 * Splits the output by option markers, extracts scores for each,
 * and returns up to 3 GuidedOption objects.
 */
function formatGuidedOutput(cleaned: string): GuidedOption[] {
  const rawOptions = splitIntoOptions(cleaned);

  const options: GuidedOption[] = rawOptions
    .slice(0, 3)
    .map((raw, i) => parseOption(raw, i));

  // If we got fewer than 3 options, pad with empty options
  while (options.length < 3) {
    const idx = options.length;
    options.push({
      text: '',
      scores: { coherence: 0, creativity: 0, styleMatch: 0 },
      overallScore: 0,
      index: idx,
    });
  }

  return options;
}

// ============================================================
// Directed Mode Formatting
// ============================================================

/**
 * Instruction compliance markers that LLMs sometimes emit
 * when they had to adapt the instruction to fit quality constraints.
 */
const COMPLIANCE_PATTERNS = {
  adaptation: /(?:note:|adaptation:|adjusted:|modified:)\s*(?:the |instruction )?(?:was|has been|is) (?:adjusted|modified|adapted)/i,
  conflict: /(?:conflicts?|violates?|contradicts?) (?:with )?(?:quality|constraint|established|character|plot)/i,
  followed: /(?:followed|executed|carried out) (?:the |your )?instruction/i,
};

/**
 * Format output for directed mode: text with instruction compliance check.
 *
 * Checks whether the output indicates the instruction was followed
 * directly or adapted due to quality constraints, and appends a
 * compliance note to the text.
 */
function formatDirectedOutput(cleaned: string, rawOutput: string): string {
  let complianceNote = '';

  if (COMPLIANCE_PATTERNS.adaptation.test(rawOutput)) {
    complianceNote = '\n\n[Instruction adapted to maintain quality constraints]';
  } else if (COMPLIANCE_PATTERNS.conflict.test(rawOutput)) {
    complianceNote = '\n\n[Instruction partially adapted due to quality constraint conflict]';
  }

  // Remove compliance/adaptation notes from the body text
  const text = cleaned
    .replace(/\[?(?:note|adaptation|adjusted|modified):[^\n]+\]?/gi, '')
    .replace(/\[?(?:the instruction was|has been|is) (?:adjusted|modified|adapted)[^\n]*\]?/gi, '')
    .trim();

  return text + complianceNote;
}

// ============================================================
// Confidence Estimation
// ============================================================

/**
 * Estimate confidence based on output characteristics.
 *
 * Factors:
 * - Output length (very short = low confidence)
 * - Presence of hedging language ("maybe", "perhaps", "might")
 * - Score consistency for guided mode
 */
function estimateConfidence(
  text: string,
  mode: 'auto' | 'guided' | 'directed',
  options?: GuidedOption[],
): number {
  // Base confidence from output length
  const tokenEstimate = estimateTokens(text);
  let confidence: number;

  if (tokenEstimate < 20) {
    confidence = 0.3;
  } else if (tokenEstimate < 50) {
    confidence = 0.5;
  } else if (tokenEstimate < 200) {
    confidence = 0.7;
  } else {
    confidence = 0.8;
  }

  // Penalize hedging language
  const hedgingWords = ['maybe', 'perhaps', 'might', 'could possibly', 'it seems', 'i think'];
  const lowerText = text.toLowerCase();
  const hedgingCount = hedgingWords.filter(w => lowerText.includes(w)).length;
  confidence -= hedgingCount * 0.05;

  // Guided mode: boost confidence if options have high, consistent scores
  if (mode === 'guided' && options) {
    const validOptions = options.filter(o => o.overallScore > 0);
    if (validOptions.length === 3) {
      const avgScore = validOptions.reduce((sum, o) => sum + o.overallScore, 0) / 3;
      if (avgScore > 70) {
        confidence += 0.1;
      }
    }
  }

  // Directed mode: boost confidence if no compliance adaptation was needed
  if (mode === 'directed' && !text.includes('[Instruction adapted')) {
    confidence += 0.05;
  }

  return Math.max(0, Math.min(1, confidence));
}

// ============================================================
// OutputAggregator Class
// ============================================================

export class OutputAggregator {
  /**
   * Post-process raw AI output into a mode-specific AggregatedOutput.
   *
   * Pipeline:
   * 1. Strip system/instruction artifacts
   * 2. Apply mode-specific formatting
   * 3. Tag with quality metadata
   *
   * @param rawOutput - Raw text from the LLM
   * @param mode - Co-writing mode: 'auto' | 'guided' | 'directed'
   * @param modelConfig - Model configuration used for generation
   * @returns AggregatedOutput with formatted content and metadata
   */
  aggregate(rawOutput: string, mode: string, modelConfig: ModelConfig): AggregatedOutput {
    _log.info('Aggregating output', { mode, modelId: modelConfig.id, rawLength: rawOutput.length });

    // Step 1: Strip artifacts
    const cleaned = stripArtifacts(rawOutput);

    // Step 2: Mode-specific formatting
    let text: string;
    let options: GuidedOption[] | undefined;
    const validMode = this.validateMode(mode);

    switch (validMode) {
      case 'auto':
        text = formatAutoOutput(cleaned);
        break;

      case 'guided':
        options = formatGuidedOutput(cleaned);
        // Primary text is the highest-scoring option
        text = options.reduce((best, opt) =>
          opt.overallScore > best.overallScore ? opt : best,
        ).text;
        break;

      case 'directed':
        text = formatDirectedOutput(cleaned, rawOutput);
        break;
    }

    // Step 3: Quality metadata
    const tokenCount = estimateTokens(text);
    const confidence = estimateConfidence(text, validMode, options);

    const result: AggregatedOutput = {
      mode: validMode,
      text,
      ...(options && { options }),
      metadata: {
        model: modelConfig.id,
        generatedAt: new Date().toISOString(),
        tokenCount,
        confidence: Math.round(confidence * 100) / 100,
      },
    };

    _log.info('Output aggregated', {
      mode: validMode,
      tokenCount,
      confidence: result.metadata.confidence,
      hasOptions: !!options,
    });

    return result;
  }

  /**
   * Validate and normalize co-writing mode.
   * Falls back to 'auto' for unknown modes.
   */
  private validateMode(mode: string): 'auto' | 'guided' | 'directed' {
    if (mode === 'auto' || mode === 'guided' || mode === 'directed') {
      return mode;
    }
    _log.warn('Unknown co-writing mode, falling back to auto', { mode });
    return 'auto';
  }
}

// ============================================================
// Factory
// ============================================================

export function createOutputAggregator(): OutputAggregator {
  return new OutputAggregator();
}
