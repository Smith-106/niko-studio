/**
 * Dimension Analyzer — persona-weighted quality dimension analysis
 *
 * Implements per-persona analysis across 4 quality dimensions (SME-01):
 * - Plot Coherence: narrative consistency, foreshadowing payoff, logical progression
 * - Character Consistency: in-character behavior, speech patterns, motivation alignment
 * - Style Consistency: tone uniformity, vocabulary level, sentence rhythm
 * - Pacing/Tension: paragraph length variation, tension curve, scene rhythm
 *
 * Each dimension is weighted by persona parameters and flagged based on tolerance threshold.
 */

import type { ReaderPersona } from './PersonaDefinition';
import { QualityDimension } from '../quality/types';

// ============================================================
// Types
// ============================================================

export interface DimensionFinding {
  description: string;
  severity: 'low' | 'medium' | 'high';
  location: {
    chapter?: string;
    paragraph?: number;
  };
  suggestion: string;
}

export interface DimensionScore {
  dimension: QualityDimension;
  score: number; // 0-1
  weight: number; // persona's weight for this dimension
  flagged: boolean; // score < toleranceThreshold * weight
  findings: DimensionFinding[];
}

// ============================================================
// Dimension Analyzer
// ============================================================

export class DimensionAnalyzer {
  /**
   * Analyze a single dimension with persona-weighted scoring
   *
   * @param text - narrative text to analyze
   * @param dimension - quality dimension to evaluate
   * @param persona - reader persona providing weights and thresholds
   * @returns dimension score with findings and flag status
   */
  analyzeDimension(
    text: string,
    dimension: QualityDimension,
    persona: ReaderPersona,
  ): DimensionScore {
    const weight = this.getWeightForDimension(dimension, persona);
    const toleranceThreshold = persona.parameters.toleranceThreshold;

    // Perform heuristic analysis (placeholder for LLM-powered analysis)
    const rawScore = this.performHeuristicAnalysis(text, dimension);
    const findings = this.extractFindings(text, dimension);

    // Apply persona weight to scoring sensitivity
    // Higher weight = more sensitive to issues (lower effective score when issues present)
    const weightedScore = this.applyWeightedSensitivity(rawScore, weight, findings);

    // Flag if score falls below tolerance threshold adjusted by weight
    const flagged = weightedScore < toleranceThreshold * weight;

    return {
      dimension,
      score: weightedScore,
      weight,
      flagged,
      findings,
    };
  }

  /**
   * Analyze all 4 quality dimensions for a persona
   *
   * @param text - narrative text to analyze
   * @param persona - reader persona providing weights and thresholds
   * @returns array of dimension scores for all 4 dimensions
   */
  analyzeAllDimensions(text: string, persona: ReaderPersona): DimensionScore[] {
    return [
      this.analyzeDimension(text, QualityDimension.PLOT_COHERENCE, persona),
      this.analyzeDimension(text, QualityDimension.CHARACTER_CONSISTENCY, persona),
      this.analyzeDimension(text, QualityDimension.STYLE_CONSISTENCY, persona),
      this.analyzeDimension(text, QualityDimension.PACING_TENSION, persona),
    ];
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private getWeightForDimension(
    dimension: QualityDimension,
    persona: ReaderPersona,
  ): number {
    const weightMap: Record<QualityDimension, number> = {
      [QualityDimension.PLOT_COHERENCE]: persona.parameters.plotWeight,
      [QualityDimension.CHARACTER_CONSISTENCY]: persona.parameters.characterWeight,
      [QualityDimension.STYLE_CONSISTENCY]: persona.parameters.styleWeight,
      [QualityDimension.PACING_TENSION]: persona.parameters.pacingWeight,
    };
    return weightMap[dimension];
  }

  /**
   * Heuristic analysis placeholder
   *
   * In production, this would be replaced by LLM-powered analysis.
   * Current implementation uses simple text metrics as placeholders.
   */
  private performHeuristicAnalysis(text: string, dimension: QualityDimension): number {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    switch (dimension) {
      case QualityDimension.PLOT_COHERENCE:
        return this.analyzePlotCoherence(paragraphs);

      case QualityDimension.CHARACTER_CONSISTENCY:
        return this.analyzeCharacterConsistency(paragraphs);

      case QualityDimension.STYLE_CONSISTENCY:
        return this.analyzeStyleConsistency(paragraphs);

      case QualityDimension.PACING_TENSION:
        return this.analyzePacingTension(paragraphs);

      default:
        return 0.5; // neutral score for unknown dimensions
    }
  }

  private analyzePlotCoherence(paragraphs: string[]): number {
    // Placeholder: check for transition words, paragraph count, logical flow indicators
    const transitionWords = ['therefore', 'however', 'meanwhile', 'consequently', 'thus', 'then'];
    let transitionCount = 0;

    for (const para of paragraphs) {
      const lower = para.toLowerCase();
      for (const word of transitionWords) {
        if (lower.includes(word)) {
          transitionCount++;
        }
      }
    }

    // More transitions = better coherence (simplified heuristic)
    const transitionDensity = transitionCount / Math.max(paragraphs.length, 1);
    return Math.min(1, 0.5 + transitionDensity * 2);
  }

  private analyzeCharacterConsistency(paragraphs: string[]): number {
    // Placeholder: check for dialogue markers, character action consistency
    const dialogueMarkers = ['said', 'asked', 'replied', 'whispered', 'shouted'];
    let dialogueCount = 0;

    for (const para of paragraphs) {
      const lower = para.toLowerCase();
      for (const marker of dialogueMarkers) {
        if (lower.includes(marker)) {
          dialogueCount++;
        }
      }
    }

    // Presence of dialogue suggests character interaction
    const dialogueDensity = dialogueCount / Math.max(paragraphs.length, 1);
    return Math.min(1, 0.5 + dialogueDensity);
  }

  private analyzeStyleConsistency(paragraphs: string[]): number {
    // Placeholder: check sentence length variation, vocabulary diversity
    const sentenceLengths: number[] = [];

    for (const para of paragraphs) {
      const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 0);
      for (const sentence of sentences) {
        sentenceLengths.push(sentence.trim().split(/\s+/).length);
      }
    }

    if (sentenceLengths.length === 0) return 0.5;

    // Calculate coefficient of variation for sentence lengths
    const mean = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / sentenceLengths.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / Math.max(mean, 1);

    // Moderate variation is good (0.3-0.5), too high or too low is less ideal
    const idealCV = 0.4;
    const deviation = Math.abs(cv - idealCV);
    return Math.max(0, 1 - deviation);
  }

  private analyzePacingTension(paragraphs: string[]): number {
    // Placeholder: check paragraph length variation, tension words
    const tensionWords = ['suddenly', 'urgent', 'danger', 'fear', 'raced', 'heart pounded'];
    let tensionCount = 0;
    const paragraphLengths = paragraphs.map(p => p.trim().split(/\s+/).length);

    for (const para of paragraphs) {
      const lower = para.toLowerCase();
      for (const word of tensionWords) {
        if (lower.includes(word)) {
          tensionCount++;
        }
      }
    }

    // Check paragraph length variation (shorter paragraphs = faster pacing)
    if (paragraphLengths.length < 2) return 0.5;

    const lengthVariation = Math.max(...paragraphLengths) - Math.min(...paragraphLengths);
    const variationScore = Math.min(1, lengthVariation / 50);

    // Combine tension word density and length variation
    const tensionDensity = tensionCount / Math.max(paragraphs.length, 1);
    return Math.min(1, 0.4 + tensionDensity * 0.3 + variationScore * 0.3);
  }

  /**
   * Apply persona weight to scoring sensitivity
   *
   * Higher weight = persona cares more = more sensitive to issues
   * When findings exist, higher weight reduces score more
   */
  private applyWeightedSensitivity(
    rawScore: number,
    weight: number,
    findings: DimensionFinding[],
  ): number {
    if (findings.length === 0) {
      return rawScore;
    }

    // Calculate penalty based on finding severity
    const severityPenalty = findings.reduce((penalty, finding) => {
      const penaltyMap = { low: 0.05, medium: 0.1, high: 0.2 };
      return penalty + penaltyMap[finding.severity];
    }, 0);

    // Higher weight = apply penalty more strongly
    const weightedPenalty = severityPenalty * weight;
    return Math.max(0, rawScore - weightedPenalty);
  }

  /**
   * Extract findings from text (placeholder for LLM-powered extraction)
   */
  private extractFindings(text: string, dimension: QualityDimension): DimensionFinding[] {
    // Placeholder: return empty findings for now
    // In production, this would use LLM to identify specific issues
    const findings: DimensionFinding[] = [];

    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    // Simple heuristic: flag very long paragraphs for pacing
    if (dimension === QualityDimension.PACING_TENSION) {
      paragraphs.forEach((para, index) => {
        const wordCount = para.trim().split(/\s+/).length;
        if (wordCount > 150) {
          findings.push({
            description: `段落过长 (${wordCount} 词)，可能影响节奏`,
            severity: 'medium',
            location: { paragraph: index + 1 },
            suggestion: '考虑拆分为多个短段落以改善节奏',
          });
        }
      });
    }

    // Simple heuristic: flag repeated words for style consistency
    if (dimension === QualityDimension.STYLE_CONSISTENCY) {
      const wordFreq = new Map<string, number>();
      const lowerText = text.toLowerCase();
      const words = lowerText.split(/\s+/).filter(w => w.length > 5);

      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });

      wordFreq.forEach((count, word) => {
        if (count > 5) {
          findings.push({
            description: `词汇 "${word}" 重复使用 ${count} 次`,
            severity: 'low',
            location: {},
            suggestion: '考虑使用同义词以增加词汇多样性',
          });
        }
      });
    }

    return findings;
  }
}

// ============================================================
// Factory Function
// ============================================================

export function createDimensionAnalyzer(): DimensionAnalyzer {
  return new DimensionAnalyzer();
}
