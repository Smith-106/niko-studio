/**
 * Dialogue Quality Analyzer
 *
 * Based on McKee dialogue theory + getDialogueRulesCatalog() from craft-catalog:
 * - Three-function rule: each line should serve at least 2 of (plot, character, theme, conflict)
 * - Subtext detection: is dialogue saying what characters really mean?
 * - Voice differentiation: do different characters sound distinct?
 */

import { getDialogueRulesCatalog } from './writing-craft/craft-catalog';

// ============================================================
// Enums
// ============================================================

export enum DialogueQuality {
  SUBTEXT_RICH = 'subtext_rich',
  ON_THE_NOSE = 'on_the_nose',
  EXPOSITION = 'exposition',
  CONFLICT_DRIVEN = 'conflict_driven',
  VOICE_DISTINCT = 'voice_distinct',
}

export interface DialogueLine {
  speaker: string;
  content: string;
  charPosition: number;
}

export interface DialogueQualityScore {
  dimension: DialogueQuality;
  label: string;
  score: number;
  evidence: string[];
}

export interface DialogueAnalysisResult {
  lines: DialogueLine[];
  qualityScores: DialogueQualityScore[];
  overallScore: number;
  subtextRatio: number;
  voiceDistinctness: number;
  suggestions: string[];
}

// ============================================================
// Patterns
// ============================================================

const SUBTEXT_INDICATORS = [
  '沉默', '停顿', '欲言又止', '眼神', '叹气', '冷笑', '苦笑',
  '别过脸', '低下头', '移开视线', '抿嘴', '紧抿', '嘴角抽搐',
];

const CONFLICT_INDICATORS = [
  '你不明白', '我不同意', '凭什么', '你怎么能', '不可能',
  '胡说', '别装了', '少来', '你想多了', '省省吧',
];

const EXPOSITION_MARKERS = [
  '众所周知', '你知道吗', '让我告诉你', '也就是说',
  '换句话说', '说白了', '总的来说', '简单来说',
];

const VOICE_PATTERNS: Array<{ pattern: string; label: string }> = [
  { pattern: '老子', label: '粗犷' },
  { pattern: '人家', label: '娇柔' },
  { pattern: '咱', label: '乡土' },
  { pattern: '鄙人', label: '古雅' },
  { pattern: '本座', label: '霸气' },
  { pattern: '吾', label: '文言' },
  { pattern: '奴家', label: '谦卑' },
  { pattern: '小的', label: '卑微' },
];

// ============================================================
// DialogueAnalyzer
// ============================================================

export class DialogueAnalyzer {
  analyzeDialogue(text: string): DialogueAnalysisResult {
    const lines = this.extractDialogueLines(text);
    const qualityScores = this.assessQuality(text, lines);
    const subtextRatio = this.computeSubtextRatio(lines);
    const voiceDistinctness = this.computeVoiceDistinctness(lines);

    const overallScore = Math.round((qualityScores.reduce((s, q) => s + q.score, 0) / qualityScores.length) * 10) / 10;

    const suggestions = this.generateSuggestions(qualityScores, subtextRatio, voiceDistinctness);

    return { lines, qualityScores, overallScore, subtextRatio, voiceDistinctness, suggestions };
  }

  private extractDialogueLines(text: string): DialogueLine[] {
    const lines: DialogueLine[] = [];
    const dialogueRegex = /[""「」『』]([^""「」『』]{1,200})[""「」『』]/g;
    let match: RegExpExecArray | null;

    while ((match = dialogueRegex.exec(text)) !== null) {
      const before = text.slice(Math.max(0, match.index - 30), match.index);
      const speakerMatch = before.match(/([^\s，。！？:;""]{1,10})[说道喊笑叫回答问吼道]$/);

      lines.push({
        speaker: speakerMatch?.[1] ?? '未知',
        content: match[1],
        charPosition: match.index,
      });
    }

    return lines;
  }

  private assessQuality(text: string, lines: DialogueLine[]): DialogueQualityScore[] {
    const scores: DialogueQualityScore[] = [];

    const subtextHits = SUBTEXT_INDICATORS.filter((kw) => text.includes(kw));
    scores.push({
      dimension: DialogueQuality.SUBTEXT_RICH,
      label: '潜台词丰富度',
      score: Math.min(10, subtextHits.length * 1.5),
      evidence: subtextHits,
    });

    const onTheNose = getDialogueRulesCatalog().showDontTell.badPatterns.filter((p) => text.includes(p));
    scores.push({
      dimension: DialogueQuality.ON_THE_NOSE,
      label: '直白对话',
      score: Math.max(0, 10 - onTheNose.length * 2),
      evidence: onTheNose,
    });

    const expositionHits = EXPOSITION_MARKERS.filter((p) => text.includes(p));
    scores.push({
      dimension: DialogueQuality.EXPOSITION,
      label: '说明性对话',
      score: Math.max(0, 10 - expositionHits.length * 2),
      evidence: expositionHits,
    });

    const conflictHits = CONFLICT_INDICATORS.filter((p) => text.includes(p));
    scores.push({
      dimension: DialogueQuality.CONFLICT_DRIVEN,
      label: '冲突驱动',
      score: Math.min(10, conflictHits.length * 2),
      evidence: conflictHits,
    });

    const voiceHits = VOICE_PATTERNS.filter((v) => text.includes(v.pattern));
    scores.push({
      dimension: DialogueQuality.VOICE_DISTINCT,
      label: '角色声音区分',
      score: Math.min(10, voiceHits.length * 2),
      evidence: voiceHits.map((v) => v.label),
    });

    return scores;
  }

  private computeSubtextRatio(lines: DialogueLine[]): number {
    if (lines.length === 0) return 0;
    const subtextLines = lines.filter((l) =>
      SUBTEXT_INDICATORS.some((ind) => l.content.includes(ind)),
    );
    return Math.round((subtextLines.length / lines.length) * 100) / 100;
  }

  private computeVoiceDistinctness(lines: DialogueLine[]): number {
    if (lines.length === 0) return 0;
    const speakers = new Set(lines.map((l) => l.speaker).filter((s) => s !== '未知'));
    return Math.min(1, speakers.size / 3);
  }

  private generateSuggestions(
    scores: DialogueQualityScore[],
    subtextRatio: number,
    voiceDistinctness: number,
  ): string[] {
    const suggestions: string[] = [];

    const subtext = scores.find((s) => s.dimension === DialogueQuality.SUBTEXT_RICH);
    if (subtext && subtext.score < 4) {
      suggestions.push('对话缺少潜台词，建议通过沉默、动作、语气变化传达真实情感');
    }

    const onTheNose = scores.find((s) => s.dimension === DialogueQuality.ON_THE_NOSE);
    if (onTheNose && onTheNose.score < 6) {
      suggestions.push(`检测到${onTheNose.evidence.length}处直白情感表达，用行动和暗示替代`);
    }

    const conflict = scores.find((s) => s.dimension === DialogueQuality.CONFLICT_DRIVEN);
    if (conflict && conflict.score < 3) {
      suggestions.push('对话缺少冲突张力，让角色在对话中产生分歧和对抗');
    }

    if (voiceDistinctness < 0.3) {
      suggestions.push('角色声音区分度低，给每个角色独特的说话方式');
    }

    if (subtextRatio < 0.2 && scores.length > 0) {
      suggestions.push('潜台词比例低，尝试让角色说的和想的不一样');
    }

    return suggestions;
  }
}
