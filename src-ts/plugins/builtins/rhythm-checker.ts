import type { WritingPlugin, PluginResult } from '../plugin-engine';

export const rhythmChecker: WritingPlugin = {
  id: 'builtin-rhythm-checker',
  name: '节奏检测器',
  version: '1.0.0',
  description: '检测文本段落的节奏变化，评估长短句交替和段落密度',
  dimension: 'structure',

  detect(text: string): PluginResult {
    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
    if (paragraphs.length === 0) {
      return emptyResult(this);
    }

    const lengths = paragraphs.map((p) => p.length);
    const avgLen = lengths.reduce((s, l) => s + l, 0) / lengths.length;
    const variance = lengths.reduce((s, l) => s + Math.pow(l - avgLen, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    const variationRatio = avgLen > 0 ? stdDev / avgLen : 0;

    const evidence: string[] = [];
    const suggestions: string[] = [];

    if (variationRatio < 0.3) {
      evidence.push(`段落长度变化不足（变异系数 ${variationRatio.toFixed(2)}）`);
      suggestions.push('尝试交替使用长短段落制造节奏变化');
    } else if (variationRatio > 0.8) {
      evidence.push(`段落长度变化剧烈（变异系数 ${variationRatio.toFixed(2)}）`);
      suggestions.push('段落长度差异过大，考虑适当平衡');
    } else {
      evidence.push(`段落节奏合理（变异系数 ${variationRatio.toFixed(2)}）`);
    }

    const longParagraphs = paragraphs.filter((p) => p.length > avgLen * 1.5).length;
    const shortParagraphs = paragraphs.filter((p) => p.length < avgLen * 0.5).length;

    if (longParagraphs > paragraphs.length * 0.5) {
      suggestions.push('长段落过多，适当拆分提升阅读节奏');
    }
    if (shortParagraphs > paragraphs.length * 0.5) {
      suggestions.push('短段落过多，适当合并增加信息密度');
    }

    const score = Math.min(10, Math.round((0.3 + Math.min(variationRatio, 0.6)) * 10));

    return {
      pluginId: this.id,
      pluginName: this.name,
      score,
      maxScore: 10,
      evidence,
      suggestions,
      details: { variationRatio, avgLength: Math.round(avgLen), paragraphCount: paragraphs.length },
    };
  },
};

function emptyResult(plugin: WritingPlugin): PluginResult {
  return {
    pluginId: plugin.id,
    pluginName: plugin.name,
    score: 0,
    maxScore: 10,
    evidence: [],
    suggestions: ['文本内容不足，无法进行节奏分析'],
    details: {},
  };
}
