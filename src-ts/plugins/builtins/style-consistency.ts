import type { WritingPlugin, PluginResult } from '../plugin-engine';

export const styleConsistency: WritingPlugin = {
  id: 'builtin-style-consistency',
  name: '风格一致性检测器',
  version: '1.0.0',
  description: '检测文本风格一致性，评估人称、时态、语气的统一程度',
  dimension: 'emotion',

  detect(text: string): PluginResult {
    const evidence: string[] = [];
    const suggestions: string[] = [];
    const details: Record<string, unknown> = {};

    // 人称一致性检测
    const firstPerson = countMatches(text, /我[的们]*/g);
    const secondPerson = countMatches(text, /你[的们]*/g);
    const thirdPerson = countMatches(text, /[他她它][的们]*/g);

    const personCounts = [
      { label: '第一人称', count: firstPerson },
      { label: '第二人称', count: secondPerson },
      { label: '第三人称', count: thirdPerson },
    ];

    const dominantPerson = personCounts.reduce((a, b) => (a.count > b.count ? a : b));
    const totalPersonRefs = firstPerson + secondPerson + thirdPerson;

    if (totalPersonRefs > 5) {
      const allNonDominant = personCounts.filter((p) => p.label !== dominantPerson.label && p.count > 0);
      if (allNonDominant.length > 0) {
        const nonDominantTotal = allNonDominant.reduce((s, p) => s + p.count, 0);
        if (nonDominantTotal / totalPersonRefs > 0.2) {
          evidence.push(`人称混用：以${dominantPerson.label}为主，但混入${allNonDominant.map((p) => `${p.label}(${p.count}次)`).join('、')}`);
          suggestions.push('保持人称一致，避免第一人称和第三人称混用');
        } else {
          evidence.push(`人称基本统一（${dominantPerson.label}为主）`);
        }
      }
    }

    // 句式多样性
    const sentences = text.split(/[。！？；]/).filter((s) => s.trim().length > 5);
    if (sentences.length > 3) {
      const avgSentLen = sentences.reduce((s, sen) => s + sen.length, 0) / sentences.length;
      const shortSent = sentences.filter((s) => s.length < avgSentLen * 0.5).length;
      const longSent = sentences.filter((s) => s.length > avgSentLen * 1.5).length;

      if (shortSent === 0 && longSent === 0) {
        suggestions.push('句式长度过于均匀，尝试长短句交替');
      } else {
        evidence.push(`句式有变化（短句${shortSent}个，长句${longSent}个）`);
      }

      details.avgSentenceLength = Math.round(avgSentLen);
      details.sentenceCount = sentences.length;
    }

    // 感叹号密度
    const exclamations = (text.match(/[！!]/g) ?? []).length;
    const exclRatio = exclamations / Math.max(text.length, 1) * 100;
    if (exclRatio > 2) {
      evidence.push(`感叹号密度偏高（${exclRatio.toFixed(1)}个/百字）`);
      suggestions.push('减少感叹号使用，用描写代替感叹');
    }

    const personScore = totalPersonRefs > 0 ? (dominantPerson.count / totalPersonRefs > 0.7 ? 3 : 1) : 2;
    const sentenceScore = sentences.length > 3 ? 3 : 1;
    const exclamationScore = exclRatio <= 2 ? 3 : 1;

    const score = Math.min(10, personScore + sentenceScore + exclamationScore + 1);

    return {
      pluginId: this.id,
      pluginName: this.name,
      score,
      maxScore: 10,
      evidence,
      suggestions,
      details,
    };
  },
};

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}
