/**
 * Dual-engine architecture for Reader Simulation
 *
 * Implements parallel execution of Reader Engine (persona-based reading simulation)
 * and Editor Engine (editorial analysis). Both engines run concurrently via
 * Promise.all without blocking each other.
 *
 * Reader Engine delegates dimension scoring to DimensionAnalyzer.
 * Editor Engine produces structural, style, pacing, and recommendation analysis.
 *
 * Related: T-032
 */

import type { ReaderPersona } from './PersonaDefinition';
import { DimensionAnalyzer } from './DimensionAnalyzer';
import { QualityDimension } from '../quality/types';
import { detectAIFlavor } from './ai-flavor-detector';
import type { AIFlavorResult } from './ai-flavor-detector';

// ============================================================
// Interfaces
// ============================================================

/**
 * Reader reaction produced by Reader Engine
 *
 * Represents how a specific persona would react to the manuscript,
 * including dimension scores and highlighted passages.
 */
export interface ReaderReaction {
  personaId: string;
  personaName: string;
  dimensions: Record<string, number>;
  highlights: Array<{
    text: string;
    position: { chapter: string; paragraph: number };
    reaction: 'positive' | 'negative' | 'neutral';
    comment: string;
    dimension: string;
  }>;
  overallScore: number;
}

/**
 * Editorial analysis produced by Editor Engine
 *
 * Professional editorial perspective on manuscript structure,
 * style, pacing, and actionable recommendations.
 */
export interface EditorialAnalysis {
  structuralIssues: string[];
  styleNotes: string[];
  pacingAssessment: string;
  recommendations: string[];
  aiFlavor?: AIFlavorResult; // Optional AI flavor detection result
}

/**
 * Dual-engine result container
 *
 * Contains parallel outputs from both engines plus timestamp.
 */
export interface DualEngineResult {
  readerReactions: ReaderReaction[];
  editorialAnalysis: EditorialAnalysis;
  timestamp: string;
}

// ============================================================
// Dual Engine Implementation
// ============================================================

/**
 * Dual-engine orchestrator
 *
 * Runs Reader Engine and Editor Engine in parallel,
 * then produces unified result.
 */
export class DualEngine {
  private readonly dimensionAnalyzer: DimensionAnalyzer;

  constructor() {
    this.dimensionAnalyzer = new DimensionAnalyzer();
  }

  /**
   * Analyze manuscript with parallel reader + editor engines
   *
   * Both engines execute concurrently via Promise.all.
   * Neither blocks the other.
   *
   * @param text - Full manuscript content
   * @param personas - Reader personas to simulate
   * @returns Dual engine result with reactions and editorial analysis
   */
  async analyze(
    text: string,
    personas: ReaderPersona[],
  ): Promise<DualEngineResult> {
    const timestamp = new Date().toISOString();

    // Run both engines concurrently
    const [readerReactions, editorialAnalysis] = await Promise.all([
      this.runReaderEngine(text, personas),
      this.runEditorEngine(text),
    ]);

    return {
      readerReactions,
      editorialAnalysis,
      timestamp,
    };
  }

  // ============================================================
  // Reader Engine (Private)
  // ============================================================

  /**
   * Reader Engine: Simulate how each persona reads the manuscript
   *
   * Uses DimensionAnalyzer to produce per-persona dimension scores,
   * then generates highlights and overall score.
   */
  private async runReaderEngine(
    text: string,
    personas: ReaderPersona[],
  ): Promise<ReaderReaction[]> {
    // Simulate async processing
    await this.simulateDelay(10);

    return personas.map((persona) =>
      this.simulateReaderReaction(text, persona),
    );
  }

  /**
   * Simulate reader reaction using DimensionAnalyzer
   *
   * Delegates dimension scoring to DimensionAnalyzer, then
   * converts results into ReaderReaction format.
   */
  private simulateReaderReaction(
    text: string,
    persona: ReaderPersona,
  ): ReaderReaction {
    // Use DimensionAnalyzer for per-persona dimension scoring
    const dimensionScores = this.dimensionAnalyzer.analyzeAllDimensions(text, persona);

    // Build dimensions map: dimension name → score
    const dimensions: Record<string, number> = {};
    for (const ds of dimensionScores) {
      dimensions[ds.dimension] = ds.score;
    }

    // Generate highlights from dimension findings
    const highlights = this.generateHighlights(text, persona, dimensionScores);

    // Calculate overall score (weighted average)
    const overallScore = dimensionScores.reduce((sum, ds) => {
      return sum + ds.score * ds.weight;
    }, 0) / dimensionScores.reduce((sum, ds) => sum + ds.weight, 0);

    return {
      personaId: persona.id,
      personaName: persona.name,
      dimensions,
      highlights,
      overallScore,
    };
  }

  /**
   * Generate highlights from DimensionAnalyzer findings
   *
   * Converts dimension findings into highlight format with
   * text excerpts, positions, and reaction types.
   */
  private generateHighlights(
    text: string,
    persona: ReaderPersona,
    dimensionScores: Array<{ dimension: QualityDimension; score: number; findings: Array<{ description: string; severity: 'low' | 'medium' | 'high'; location: { chapter?: string; paragraph?: number }; suggestion: string }> }>,
  ): ReaderReaction['highlights'] {
    const highlights: ReaderReaction['highlights'] = [];
    const segments = text.split(/\n\n+/).slice(0, 5);

    for (const ds of dimensionScores) {
      // Only generate highlights for flagged or low-scoring dimensions
      if (ds.score >= 0.7 && ds.findings.length === 0) continue;

      const dimensionName = ds.dimension;

      for (const finding of ds.findings) {
        const paragraphIndex = finding.location.paragraph ?? 0;
        const segment = segments[paragraphIndex] ?? segments[0];

        if (segment && segment.length > 20) {
          highlights.push({
            text: segment.substring(0, 100),
            position: {
              chapter: finding.location.chapter ?? 'chapter-1',
              paragraph: paragraphIndex,
            },
            reaction: ds.score < 0.5 ? 'negative' : 'neutral',
            comment: `${persona.name}: ${finding.description}`,
            dimension: dimensionName,
          });
        }
      }

      // If no findings but low score, add a generic highlight
      if (ds.findings.length === 0 && ds.score < 0.5 && segments.length > 0) {
        const segment = segments[0];
        if (segment && segment.length > 20) {
          highlights.push({
            text: segment.substring(0, 100),
            position: { chapter: 'chapter-1', paragraph: 0 },
            reaction: 'negative',
            comment: `${persona.name} 对 ${dimensionName} 维度评分较低`,
            dimension: dimensionName,
          });
        }
      }
    }

    return highlights;
  }

  // ============================================================
  // Editor Engine (Private)
  // ============================================================

  /**
   * Editor Engine: Run editorial analysis on manuscript
   *
   * For now, uses heuristic-based analysis as placeholder.
   * Will be replaced with LLM-powered editorial analysis.
   * Optionally includes AI flavor detection result.
   */
  private async runEditorEngine(
    text: string,
  ): Promise<EditorialAnalysis> {
    // Simulate async processing
    await this.simulateDelay(10);

    // Heuristic analysis (placeholder)
    const wordCount = text.split(/\s+/).length;
    const paragraphCount = text.split(/\n\n+/).length;

    const structuralIssues: string[] = [];
    const styleNotes: string[] = [];
    const recommendations: string[] = [];

    // Simple heuristics
    if (paragraphCount < 10) {
      structuralIssues.push('段落数量较少，可能需要扩展内容');
    }

    if (wordCount < 1000) {
      structuralIssues.push('文本长度较短，建议增加细节描写');
    }

    const avgParagraphLength = wordCount / Math.max(1, paragraphCount);
    if (avgParagraphLength > 200) {
      styleNotes.push('部分段落过长，建议适当分段以提高可读性');
    }

    if (avgParagraphLength < 50) {
      styleNotes.push('部分段落过短，可能影响叙事连贯性');
    }

    // Pacing assessment
    let pacingAssessment = '节奏适中';
    if (avgParagraphLength > 150) {
      pacingAssessment = '节奏较慢，建议增加场景切换或对话';
    } else if (avgParagraphLength < 80) {
      pacingAssessment = '节奏较快，建议增加描写以平衡叙事';
    }

    // Generic recommendations
    if (structuralIssues.length > 0) {
      recommendations.push('优先解决结构性问题');
    }
    if (styleNotes.length > 0) {
      recommendations.push('优化文风以提升阅读体验');
    }
    recommendations.push('建议进行多轮修订以打磨细节');

    // Optional: AI flavor detection (non-blocking, doesn't affect existing analysis)
    const aiFlavor = text.trim().length > 0 ? detectAIFlavor(text) : undefined;

    return {
      structuralIssues,
      styleNotes,
      pacingAssessment,
      recommendations,
      aiFlavor,
    };
  }

  // ============================================================
  // Utilities
  // ============================================================

  /**
   * Simulate async delay (for placeholder implementation)
   */
  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
