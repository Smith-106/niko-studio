/**
 * Consensus Engine — multi-persona consensus mechanism for Reader Simulation
 *
 * Aggregates reactions from multiple reader personas into a unified consensus
 * report. When personas agree, the signal is stronger; when they disagree,
 * dissent items are surfaced for review.
 *
 * Key behaviors:
 * - Groups findings by dimension + location similarity
 * - Consensus strength = agreeing personas / total personas
 * - Severity escalated when consensus >= 0.8
 *
 * Related: T-034, SME-02
 */

import type { ReaderReaction } from './DualEngine';
import { QualityDimension } from '../quality/types';

// ============================================================
// Interfaces
// ============================================================

export interface ConsensusItem {
  description: string;
  dimension: string;
  agreeingPersonas: string[];
  disagreeingPersonas: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  consensusStrength: number;
  location: { chapter?: string; paragraph?: number };
}

export interface ConsensusReport {
  items: ConsensusItem[];
  overallAssessment: string;
  criticalIssues: ConsensusItem[];
  dissentItems: ConsensusItem[];
  dimensionSummaries: Record<string, { avgScore: number; consensus: number }>;
}

// ============================================================
// Internal Types
// ============================================================

/**
 * Normalized finding extracted from a ReaderReaction highlight.
 * Used for grouping and consensus calculation before producing ConsensusItem.
 */
interface NormalizedFinding {
  description: string;
  dimension: string;
  personaId: string;
  personaName: string;
  reaction: 'positive' | 'negative' | 'neutral';
  location: { chapter?: string; paragraph?: number };
}

/**
 * Grouping key for findings that share the same dimension and nearby location.
 */
interface GroupKey {
  dimension: string;
  chapter: string;
  paragraphRange: string; // "3" or "3-5" for nearby paragraphs
}

// ============================================================
// Consensus Engine
// ============================================================

export class ConsensusEngine {
  /**
   * Build consensus report from multiple persona reactions
   *
   * @param reactions - Array of reader reactions from different personas
   * @returns Unified consensus report with items, summaries, and assessments
   */
  buildConsensus(reactions: ReaderReaction[]): ConsensusReport {
    if (reactions.length === 0) {
      return this.emptyReport();
    }

    const totalPersonas = reactions.length;

    // Step 1: Extract and normalize findings from all reactions
    const allFindings = this.extractFindings(reactions);

    // Step 2: Group findings by dimension + location similarity
    const groups = this.groupFindings(allFindings);

    // Step 3: Build consensus items from groups
    const items = this.buildConsensusItems(groups, totalPersonas);

    // Step 4: Calculate dimension summaries
    const dimensionSummaries = this.calculateDimensionSummaries(reactions);

    // Step 5: Derive critical issues and dissent items
    const criticalIssues = items.filter(
      (item) => item.severity === 'critical' || item.severity === 'high',
    );
    const dissentItems = items.filter(
      (item) => item.disagreeingPersonas.length > 0 && item.consensusStrength < 0.6,
    );

    // Step 6: Generate overall assessment
    const overallAssessment = this.generateOverallAssessment(
      items,
      criticalIssues,
      dissentItems,
      dimensionSummaries,
    );

    return {
      items,
      overallAssessment,
      criticalIssues,
      dissentItems,
      dimensionSummaries,
    };
  }

  // ============================================================
  // Step 1: Extract Findings
  // ============================================================

  /**
   * Extract normalized findings from all reader reactions
   *
   * Converts highlights into a flat list of findings with
   * persona attribution and reaction polarity.
   */
  private extractFindings(reactions: ReaderReaction[]): NormalizedFinding[] {
    const findings: NormalizedFinding[] = [];

    for (const reaction of reactions) {
      for (const highlight of reaction.highlights) {
        findings.push({
          description: highlight.comment || highlight.text.substring(0, 80),
          dimension: highlight.dimension,
          personaId: reaction.personaId,
          personaName: reaction.personaName,
          reaction: highlight.reaction,
          location: {
            chapter: highlight.position.chapter,
            paragraph: highlight.position.paragraph,
          },
        });
      }
    }

    return findings;
  }

  // ============================================================
  // Step 2: Group Findings
  // ============================================================

  /**
   * Group findings by dimension + location similarity
   *
   * Findings in the same dimension and nearby paragraphs (within 2 paragraphs)
   * are grouped together for consensus calculation.
   */
  private groupFindings(
    findings: NormalizedFinding[],
  ): Map<GroupKey, NormalizedFinding[]> {
    const groups = new Map<GroupKey, NormalizedFinding[]>();

    for (const finding of findings) {
      const key = this.makeGroupKey(finding);
      const existing = groups.get(key);
      if (existing) {
        existing.push(finding);
      } else {
        groups.set(key, [finding]);
      }
    }

    return groups;
  }

  /**
   * Create a grouping key from a finding's dimension and location
   *
   * Paragraphs within a 2-paragraph range are considered "nearby"
   * and grouped together (e.g., paragraphs 3-5 share the same key).
   */
  private makeGroupKey(finding: NormalizedFinding): GroupKey {
    const paragraph = finding.location.paragraph ?? 0;
    const rangeSize = 2;
    const rangeStart = Math.floor(paragraph / rangeSize) * rangeSize;
    const rangeEnd = rangeStart + rangeSize - 1;

    return {
      dimension: finding.dimension,
      chapter: finding.location.chapter ?? 'unknown',
      paragraphRange: `${rangeStart}-${rangeEnd}`,
    };
  }

  // ============================================================
  // Step 3: Build Consensus Items
  // ============================================================

  /**
   * Build consensus items from grouped findings
   *
   * For each group, determine agreeing/disagreeing personas,
   * calculate consensus strength, and assign severity.
   */
  private buildConsensusItems(
    groups: Map<GroupKey, NormalizedFinding[]>,
    totalPersonas: number,
  ): ConsensusItem[] {
    const items: ConsensusItem[] = [];

    for (const [key, groupFindings] of groups) {
      // Separate agreeing (negative/neutral reaction = found an issue)
      // and disagreeing (positive reaction = no issue found) personas
      const agreeingSet = new Set<string>();
      const disagreeingSet = new Set<string>();

      for (const finding of groupFindings) {
        if (finding.reaction === 'negative' || finding.reaction === 'neutral') {
          agreeingSet.add(finding.personaId);
        } else {
          disagreeingSet.add(finding.personaId);
        }
      }

      const agreeingPersonas = Array.from(agreeingSet);
      const disagreeingPersonas = Array.from(disagreeingSet);

      // Consensus strength = agreeing / total personas
      // Uses totalPersonas (not just involved) so that silence = implicit disagreement
      const consensusStrength = agreeingPersonas.length / totalPersonas;

      // Determine severity with escalation
      const baseSeverity = this.calculateBaseSeverity(groupFindings);
      const severity = this.escalateSeverity(baseSeverity, consensusStrength);

      // Use the first finding's location as representative
      const representative = groupFindings[0];

      // Build a merged description
      const description = this.mergeDescriptions(groupFindings);

      items.push({
        description,
        dimension: key.dimension,
        agreeingPersonas,
        disagreeingPersonas,
        severity,
        consensusStrength,
        location: representative.location,
      });
    }

    // Sort by consensus strength descending, then severity
    return items.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.consensusStrength - a.consensusStrength;
    });
  }

  /**
   * Calculate base severity from findings in a group
   *
   * Uses the most severe reaction pattern in the group.
   */
  private calculateBaseSeverity(
    findings: NormalizedFinding[],
  ): 'low' | 'medium' | 'high' | 'critical' {
    let hasNegative = false;
    let negativeCount = 0;

    for (const finding of findings) {
      if (finding.reaction === 'negative') {
        hasNegative = true;
        negativeCount++;
      }
    }

    // Multiple negative reactions in a group suggest higher severity
    if (negativeCount >= 3) return 'high';
    if (negativeCount >= 2) return 'medium';
    if (hasNegative) return 'low';
    return 'low';
  }

  /**
   * Escalate severity when consensus is strong (>= 0.8)
   *
   * Strong consensus means most personas agree there's an issue,
   * which warrants severity escalation.
   */
  private escalateSeverity(
    base: 'low' | 'medium' | 'high' | 'critical',
    consensusStrength: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (consensusStrength < 0.8) return base;

    const escalation: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      low: 'medium',
      medium: 'high',
      high: 'critical',
      critical: 'critical',
    };

    return escalation[base];
  }

  /**
   * Merge descriptions from multiple findings into a single summary
   */
  private mergeDescriptions(findings: NormalizedFinding[]): string {
    const uniqueDescriptions = new Set(
      findings.map((f) => f.description).filter((d) => d.length > 0),
    );

    if (uniqueDescriptions.size === 0) return '未描述的问题';
    if (uniqueDescriptions.size === 1) return Array.from(uniqueDescriptions)[0]!;

    // Multiple descriptions: join with semicolons, limit to 3
    const descriptions = Array.from(uniqueDescriptions).slice(0, 3);
    return descriptions.join('; ');
  }

  // ============================================================
  // Step 4: Dimension Summaries
  // ============================================================

  /**
   * Calculate per-dimension average scores and consensus levels
   *
   * Consensus for a dimension = 1 - (standard deviation of scores / max possible std dev)
   * Higher consensus means personas agree on the score for that dimension.
   */
  private calculateDimensionSummaries(
    reactions: ReaderReaction[],
  ): Record<string, { avgScore: number; consensus: number }> {
    const dimensionMap: Record<string, string> = {
      plotCoherence: QualityDimension.PLOT_COHERENCE,
      characterConsistency: QualityDimension.CHARACTER_CONSISTENCY,
      styleConsistency: QualityDimension.STYLE_CONSISTENCY,
      pacingTension: QualityDimension.PACING_TENSION,
    };

    const summaries: Record<string, { avgScore: number; consensus: number }> = {};

    for (const [dimKey, dimName] of Object.entries(dimensionMap)) {
      const scores = reactions.map((r) => r.dimensions[dimKey as keyof typeof r.dimensions]);

      if (scores.length === 0) {
        summaries[dimName] = { avgScore: 0, consensus: 0 };
        continue;
      }

      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Consensus = 1 - normalized standard deviation
      // std dev ranges from 0 (perfect agreement) to ~0.5 (max disagreement for 0-1 scores)
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      const maxStdDev = 0.5; // theoretical max for 0-1 range
      const consensus = Math.max(0, 1 - stdDev / maxStdDev);

      summaries[dimName] = {
        avgScore: Math.round(avgScore * 1000) / 1000,
        consensus: Math.round(consensus * 1000) / 1000,
      };
    }

    return summaries;
  }

  // ============================================================
  // Step 5: Overall Assessment
  // ============================================================

  /**
   * Generate a human-readable overall assessment
   */
  private generateOverallAssessment(
    items: ConsensusItem[],
    criticalIssues: ConsensusItem[],
    dissentItems: ConsensusItem[],
    dimensionSummaries: Record<string, { avgScore: number; consensus: number }>,
  ): string {
    if (items.length === 0) {
      return '所有读者角色均未发现显著问题，稿件质量良好。';
    }

    const parts: string[] = [];

    // Critical issues summary
    if (criticalIssues.length > 0) {
      const criticalCount = criticalIssues.filter((i) => i.severity === 'critical').length;
      const highCount = criticalIssues.filter((i) => i.severity === 'high').length;
      const severityParts: string[] = [];
      if (criticalCount > 0) severityParts.push(`${criticalCount} 个严重问题`);
      if (highCount > 0) severityParts.push(`${highCount} 个高优先级问题`);
      parts.push(`发现 ${severityParts.join('和')}，需要优先处理。`);
    }

    // Dimension quality overview
    const weakDimensions = Object.entries(dimensionSummaries)
      .filter(([, summary]) => summary.avgScore < 0.6)
      .map(([dim]) => dim);

    if (weakDimensions.length > 0) {
      parts.push(`较弱维度: ${weakDimensions.join(', ')}。`);
    }

    // Dissent note
    if (dissentItems.length > 0) {
      parts.push(`${dissentItems.length} 个问题存在角色分歧，建议进一步评估。`);
    }

    // General quality statement
    const avgAllScores = Object.values(dimensionSummaries).reduce(
      (sum, s) => sum + s.avgScore,
      0,
    ) / Math.max(Object.keys(dimensionSummaries).length, 1);

    if (avgAllScores >= 0.8) {
      parts.push('整体质量较高，读者反馈积极。');
    } else if (avgAllScores >= 0.6) {
      parts.push('整体质量中等，部分维度需要改进。');
    } else {
      parts.push('整体质量偏低，建议全面修订。');
    }

    return parts.join('');
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Empty report for zero-reaction input
   */
  private emptyReport(): ConsensusReport {
    return {
      items: [],
      overallAssessment: '无读者反应数据，无法生成共识报告。',
      criticalIssues: [],
      dissentItems: [],
      dimensionSummaries: {},
    };
  }
}

// ============================================================
// Factory Function
// ============================================================

export function createConsensusEngine(): ConsensusEngine {
  return new ConsensusEngine();
}
