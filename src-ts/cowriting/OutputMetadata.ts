/**
 * Output Metadata — AI-generated text tagging for the Co-Writing Engine
 *
 * Every piece of AI-generated text is tagged with structured metadata
 * indicating generation mode, confidence, constraint violations, source
 * model, and timestamp. This enables traceability, quality filtering,
 * and user-facing confidence badges.
 *
 * @module cowriting/OutputMetadata
 */

import type { CowritingResult } from './AutoMode';
import type { GuidedCowritingResult } from './GuidedMode';
import type { HardConstraintViolation } from '../quality/types';
import { ConstraintSeverity } from '../quality/types';

// ============================================================
// Public Interface
// ============================================================

export interface GenerationMetadata {
  id: string;
  mode: 'auto' | 'guided' | 'directed';
  model: string;
  confidence: number;
  generatedAt: string;
  tokenCount: number;
  creativityLevel: number;
  violations: HardConstraintViolation[];
  tags: string[];
}

// ============================================================
// Helpers
// ============================================================

let _idCounter = 0;

/**
 * Generate a unique metadata ID.
 * Format: `gen-{timestamp}-{counter}` — monotonic within a process.
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  _idCounter += 1;
  return `gen-${timestamp}-${_idCounter.toString(36)}`;
}

/**
 * Derive auto-tags from metadata fields.
 * Tags are lowercase, hyphenated strings suitable for filtering.
 */
function deriveTags(
  mode: GenerationMetadata['mode'],
  confidence: number,
  violations: HardConstraintViolation[],
): string[] {
  const tags: string[] = [mode];

  if (confidence >= 0.9) {
    tags.push('high-confidence');
  } else if (confidence >= 0.7) {
    tags.push('medium-confidence');
  } else {
    tags.push('low-confidence');
  }

  if (violations.length > 0) {
    tags.push('has-violations');
    const severities = Array.from(new Set(violations.map((v) => v.severity)));
    for (const sev of severities) {
      tags.push(`violation-${sev}`);
    }
  }

  return tags;
}

// ============================================================
// Public Functions
// ============================================================

/**
 * Tag an AI output with structured generation metadata.
 *
 * Accepts either a CowritingResult (auto mode) or a
 * GuidedCowritingResult (guided mode) and produces a
 * GenerationMetadata record with all traceability fields.
 *
 * @param output - The co-writing result to tag
 * @param violations - Optional hard constraint violations detected during generation
 * @returns GenerationMetadata with all fields populated
 */
export function tagOutput(
  output: CowritingResult | GuidedCowritingResult,
  violations: HardConstraintViolation[] = [],
): GenerationMetadata {
  const mode = output.mode;
  const model = output.metadata.model;
  const confidence = 'confidence' in output.metadata
    ? (output.metadata as CowritingResult['metadata']).confidence
    : 0.8; // guided mode defaults to 0.8 when no per-option confidence is available
  const generatedAt = output.metadata.generatedAt;
  const tokenCount = output.metadata.tokenCount;
  const creativityLevel = output.metadata.creativityLevel;

  const tags = deriveTags(mode, confidence, violations);

  return {
    id: generateId(),
    mode,
    model,
    confidence,
    generatedAt,
    tokenCount,
    creativityLevel,
    violations,
    tags,
  };
}

/**
 * Format a GenerationMetadata into a human-readable badge string.
 *
 * Example output: "[Auto | 0.85 confidence | claude-sonnet-4-6]"
 *
 * @param metadata - The generation metadata to format
 * @returns A concise, bracketed summary string
 */
export function formatMetadataBadge(metadata: GenerationMetadata): string {
  const modeLabel = metadata.mode.charAt(0).toUpperCase() + metadata.mode.slice(1);
  const confidenceStr = metadata.confidence.toFixed(2);
  const violationSuffix = metadata.violations.length > 0
    ? ` | ${metadata.violations.length} violation${metadata.violations.length > 1 ? 's' : ''}`
    : '';
  return `[${modeLabel} | ${confidenceStr} confidence | ${metadata.model}${violationSuffix}]`;
}

/**
 * Determine whether a generation result qualifies as high confidence.
 *
 * A result is high confidence when:
 * - confidence >= 0.7
 * - no critical-severity violations are present
 *
 * @param metadata - The generation metadata to evaluate
 * @returns true if the output meets high-confidence criteria
 */
export function isHighConfidence(metadata: GenerationMetadata): boolean {
  const hasCriticalViolation = metadata.violations.some(
    (v) => v.severity === ConstraintSeverity.CRITICAL,
  );
  return metadata.confidence >= 0.7 && !hasCriticalViolation;
}
