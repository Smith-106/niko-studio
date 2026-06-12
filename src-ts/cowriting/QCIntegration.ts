/**
 * QC Integration — hard constraint enforcement for Co-Writing output
 *
 * Enforces hard constraints from Craft Analysis Services on co-writing output.
 * Mode-specific enforcement per C-003 cross-role resolution:
 *   - Auto/Guided: Hard constraint violations are BLOCKING — output is rejected
 *   - Directed: Hard constraint violations are ADVISORY — warnings attached, output allowed
 *
 * Current implementation uses basic heuristic checks as placeholder for real CAS integration.
 * Future: Wire to actual CAS via MCP endpoint.
 *
 * @module cowriting/QCIntegration
 */

import type { CowritingResult } from './AutoMode';
import type { GuidedCowritingResult } from './GuidedMode';
import type {
  CreativitySpectrumConfig,
  HardConstraintViolation,
  HardConstraintResult,
  HardConstraintReport,
  QCEnforcementResult,
} from '../quality/types';
import {
  QualityDimension,
  ConstraintSeverity,
  QCEforcementMode,
} from '../quality/types';
import { createLogger } from '../logger';

const _log = createLogger('qc-integration');

// ============================================================
// Public Interfaces
// ============================================================

export interface QCIntegratedResult {
  output: CowritingResult | GuidedCowritingResult;
  qcResult: QCEnforcementResult;
  passed: boolean;
  blockedReasons: string[];
}

// ============================================================
// Heuristic Checkers (CAS Placeholder)
// ============================================================

/**
 * Check plot coherence via character name consistency.
 * Extracts character names from text and checks for consistency.
 */
function checkPlotCoherence(
  text: string,
  _characterNames: string[],
): HardConstraintResult {
  const violations: HardConstraintViolation[] = [];

  // Placeholder: Check for repeated character references
  // In real CAS, this would check against story bible character names
  // and detect inconsistencies like wrong names, missing references, etc.

  // Simple heuristic: Check for pronoun overuse (he/she/they appearing too frequently)
  const pronounPattern = /\b(he|she|they|him|her|them|his|hers|theirs)\b/gi;
  const pronounMatches = text.match(pronounPattern) || [];
  const wordCount = text.split(/\s+/).length;
  const pronounDensity = pronounMatches.length / Math.max(wordCount, 1);

  if (pronounDensity > 0.08) {
    violations.push({
      dimension: QualityDimension.PLOT_COHERENCE,
      severity: ConstraintSeverity.MEDIUM,
      message: 'High pronoun density may indicate unclear character references',
      location: {},
      evidence: `Found ${pronounMatches.length} pronouns in ${wordCount} words (${(pronounDensity * 100).toFixed(1)}%)`,
      suggestedFix: 'Replace some pronouns with character names for clarity',
    });
  }

  const score = Math.max(0, 1 - violations.length * 0.2);

  return {
    dimension: QualityDimension.PLOT_COHERENCE,
    score,
    violations,
    passed: violations.length === 0,
  };
}

/**
 * Check style consistency via sentence length variance.
 */
function checkStyleConsistency(text: string): HardConstraintResult {
  const violations: HardConstraintViolation[] = [];

  // Split into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length < 2) {
    return {
      dimension: QualityDimension.STYLE_CONSISTENCY,
      score: 1,
      violations: [],
      passed: true,
    };
  }

  // Calculate sentence lengths
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) /
    lengths.length;
  const stdDev = Math.sqrt(variance);

  // Check for extreme variance (sentences too varied in length)
  if (stdDev > 20) {
    violations.push({
      dimension: QualityDimension.STYLE_CONSISTENCY,
      severity: ConstraintSeverity.MEDIUM,
      message: 'High sentence length variance detected',
      location: {},
      evidence: `Standard deviation: ${stdDev.toFixed(1)} words, average: ${avgLength.toFixed(1)} words`,
      suggestedFix: 'Consider smoothing sentence rhythm for better flow',
    });
  }

  // Check for monotonous sentence length (all sentences similar)
  if (stdDev < 3 && sentences.length > 5) {
    violations.push({
      dimension: QualityDimension.STYLE_CONSISTENCY,
      severity: ConstraintSeverity.LOW,
      message: 'Low sentence length variance may create monotonous rhythm',
      location: {},
      evidence: `Standard deviation: ${stdDev.toFixed(1)} words across ${sentences.length} sentences`,
      suggestedFix: 'Vary sentence length for more dynamic prose',
    });
  }

  const score = Math.max(0, 1 - violations.length * 0.15);

  return {
    dimension: QualityDimension.STYLE_CONSISTENCY,
    score,
    violations,
    passed: violations.filter(v => v.severity !== ConstraintSeverity.LOW).length === 0,
  };
}

/**
 * Check pacing via paragraph length distribution.
 */
function checkPacing(text: string): HardConstraintResult {
  const violations: HardConstraintViolation[] = [];

  // Split into paragraphs
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length < 2) {
    return {
      dimension: QualityDimension.PACING_TENSION,
      score: 1,
      violations: [],
      passed: true,
    };
  }

  // Calculate paragraph lengths
  const lengths = paragraphs.map(p => p.split(/\s+/).length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  // Check for overly long paragraphs (pacing drag)
  const longParagraphs = lengths.filter(l => l > 150).length;
  if (longParagraphs > 0) {
    violations.push({
      dimension: QualityDimension.PACING_TENSION,
      severity: ConstraintSeverity.MEDIUM,
      message: 'Overly long paragraphs may slow pacing',
      location: {},
      evidence: `${longParagraphs} paragraph(s) exceed 150 words`,
      suggestedFix: 'Consider breaking long paragraphs for better pacing',
    });
  }

  // Check for overly short paragraphs (rushed pacing)
  const shortParagraphs = lengths.filter(l => l < 20).length;
  const shortRatio = shortParagraphs / paragraphs.length;
  if (shortRatio > 0.5 && paragraphs.length > 4) {
    violations.push({
      dimension: QualityDimension.PACING_TENSION,
      severity: ConstraintSeverity.LOW,
      message: 'Many short paragraphs may create rushed pacing',
      location: {},
      evidence: `${shortParagraphs}/${paragraphs.length} paragraphs under 20 words`,
      suggestedFix: 'Consider combining some short paragraphs for better rhythm',
    });
  }

  const score = Math.max(0, 1 - violations.length * 0.15);

  return {
    dimension: QualityDimension.PACING_TENSION,
    score,
    violations,
    passed: violations.filter(v => v.severity !== ConstraintSeverity.LOW).length === 0,
  };
}

/**
 * Run all heuristic checks and produce a HardConstraintReport.
 */
function runHeuristicChecks(
  text: string,
  characterNames: string[],
): HardConstraintReport {
  const dimensionResults: HardConstraintResult[] = [
    checkPlotCoherence(text, characterNames),
    checkStyleConsistency(text),
    checkPacing(text),
  ];

  const allViolations = dimensionResults.flatMap(r => r.violations);
  const blockingViolations = allViolations.filter(
    v => v.severity === ConstraintSeverity.CRITICAL || v.severity === ConstraintSeverity.HIGH,
  );

  const overallScore =
    dimensionResults.reduce((sum, r) => sum + r.score, 0) / dimensionResults.length;

  return {
    overallScore,
    dimensionResults,
    allViolations,
    blockingViolations,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// QCIntegration Class
// ============================================================

export class QCIntegration {
  /**
   * Enforce hard constraints on co-writing output.
   *
   * Mode-specific enforcement (C-003):
   *   - Auto/Guided: BLOCKING — violations reject output
   *   - Directed: ADVISORY — violations produce warnings, output allowed
   *
   * @param output - CowritingResult or GuidedCowritingResult to check
   * @param mode - Co-writing mode: 'auto', 'guided', or 'directed'
   * @param creativityConfig - Creativity spectrum configuration
   * @param characterNames - Known character names for coherence checks
   * @returns QCIntegratedResult with enforcement decision
   */
  enforce(
    output: CowritingResult | GuidedCowritingResult,
    mode: string,
    creativityConfig: CreativitySpectrumConfig,
    characterNames: string[] = [],
  ): QCIntegratedResult {
    _log.info('Enforcing QC constraints', {
      mode,
      creativityLevel: creativityConfig.value,
      characterCount: characterNames.length,
    });

    // Determine enforcement mode (C-003)
    const qcMode: QCEforcementMode =
      mode === 'directed' ? QCEforcementMode.ADVISORY : QCEforcementMode.BLOCKING;

    // Extract text to check
    const textToCheck = this.extractText(output);

    // Run heuristic checks (placeholder for CAS)
    const report = runHeuristicChecks(textToCheck, characterNames);
    const blockedViolations =
      qcMode === QCEforcementMode.BLOCKING
        ? report.allViolations
        : [];

    _log.debug('QC check complete', {
      overallScore: report.overallScore,
      violationCount: report.allViolations.length,
      blockingCount: blockedViolations.length,
    });

    // Determine if output passes
    const passed =
      qcMode === QCEforcementMode.ADVISORY
        ? true // Advisory mode always allows output
        : blockedViolations.length === 0; // Blocking mode rejects any hard-constraint violation

    // Build enforcement result
    const qcResult: QCEnforcementResult = {
      mode: qcMode,
      allowed: passed,
      warnings:
        qcMode === QCEforcementMode.ADVISORY ? report.allViolations : [],
      blocked:
        blockedViolations,
      creativityConfig,
    };

    // Build blocked reasons
    const blockedReasons: string[] = passed
      ? []
      : blockedViolations.map(
          v => `[${v.dimension}] ${v.message}: ${v.evidence}`,
        );

    if (!passed) {
      _log.warn('Output blocked by QC', {
        mode,
        blockedReasons: blockedReasons.length,
        violations: blockedViolations.map(v => v.message),
      });
    } else if (report.allViolations.length > 0) {
      _log.info('Output passed with warnings', {
        mode,
        warningCount: report.allViolations.length,
      });
    }

    return {
      output,
      qcResult,
      passed,
      blockedReasons,
    };
  }

  /**
   * Extract text from CowritingResult or GuidedCowritingResult.
   */
  private extractText(
    output: CowritingResult | GuidedCowritingResult,
  ): string {
    if (output.mode === 'auto') {
      return (output as CowritingResult).text;
    } else if (output.mode === 'guided') {
      // For guided mode, concatenate all option texts
      const guided = output as GuidedCowritingResult;
      return guided.options.map(o => o.text).join('\n\n');
    }
    return '';
  }
}

// ============================================================
// Factory
// ============================================================

export function createQCIntegration(): QCIntegration {
  return new QCIntegration();
}
