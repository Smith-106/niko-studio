/**
 * Writing Craft — Unreliable Narrator Detection (不可靠叙述者检测)
 *
 * Detects signs of unreliable narration:
 * - Memory contradictions
 * - Selective omission markers
 * - Self-contradictory statements
 * - Narrative manipulation indicators
 */

export interface NarratorReliabilityResult {
  reliabilityScore: number; // 0-100, 100 = fully reliable
  contradictions: NarratorContradiction[];
  manipulationSigns: string[];
  suggestions: string[];
}

export interface NarratorContradiction {
  type: 'memory' | 'statement' | 'omission' | 'perspective';
  evidence: string;
  description: string;
}

// Patterns suggesting unreliable narration
const UNRELIABLE_SIGNALS = {
  memory: [
    '好像', '似乎', '大概', '应该', '也许', '记不清', '忘了', '不记得',
    '也许不是', '可能', '不太确定', '模糊的记忆', '记不太清',
  ],
  selfContradiction: [
    '之前说', '但后来', '然而事实', '其实并非', '之前以为',
    '实际上', '后来才知道', '后来才明白',
  ],
  selectiveOmission: [
    '这些就不说了', '不用提', '省略', '不方便说', '这里跳过',
    '总之', '总之结果', '过程不重要',
  ],
  perspective: [
    '在我看来', '我觉得', '我以为', '据我所知', '就我而言',
    '从我的角度', '如果我没记错',
  ],
} as const;

// Contradiction pair patterns
const CONTRADICTION_PAIRS: Array<{ first: string; second: string; description: string }> = [
  { first: '从不', second: '有一次', description: '绝对否定与具体例外矛盾' },
  { first: '总是', second: '但这次', description: '全称肯定与特例矛盾' },
  { first: '我确定', second: '但后来', description: '确定性与后续修正矛盾' },
  { first: '永远不会', second: '直到那天', description: '永久否定被打破' },
  { first: '我亲眼', second: '也许', description: '目击证词与不确定并存' },
];

export function detectUnreliableNarrator(
  chapters: Array<{ content: string; chapterIndex: number }>,
): NarratorReliabilityResult {
  const allText = chapters.map((c) => c.content).join('\n');
  const contradictions: NarratorContradiction[] = [];
  const manipulationSigns: string[] = [];

  // Detect memory uncertainty
  for (const signal of UNRELIABLE_SIGNALS.memory) {
    if (allText.includes(signal)) {
      manipulationSigns.push(`记忆不确定信号: "${signal}"`);
    }
  }

  // Detect self-contradiction
  for (const signal of UNRELIABLE_SIGNALS.selfContradiction) {
    if (allText.includes(signal)) {
      contradictions.push({
        type: 'statement',
        evidence: signal,
        description: `自相矛盾信号: "${signal}"`,
      });
    }
  }

  // Detect selective omission
  for (const signal of UNRELIABLE_SIGNALS.selectiveOmission) {
    if (allText.includes(signal)) {
      contradictions.push({
        type: 'omission',
        evidence: signal,
        description: `选择性省略: "${signal}"`,
      });
    }
  }

  // Detect perspective hedging
  let perspectiveHedges = 0;
  for (const signal of UNRELIABLE_SIGNALS.perspective) {
    if (allText.includes(signal)) {
      perspectiveHedges++;
    }
  }
  if (perspectiveHedges >= 3) {
    contradictions.push({
      type: 'perspective',
      evidence: `${perspectiveHedges}处视角限定`,
      description: '大量视角限定词暗示主观叙述',
    });
  }

  // Detect contradiction pairs
  for (const pair of CONTRADICTION_PAIRS) {
    if (allText.includes(pair.first) && allText.includes(pair.second)) {
      contradictions.push({
        type: 'statement',
        evidence: `"${pair.first}".../"${pair.second}"`,
        description: pair.description,
      });
    }
  }

  // Calculate reliability score
  const deduction = Math.min(80, contradictions.length * 15 + Math.min(manipulationSigns.length * 5, 30));
  const reliabilityScore = Math.max(0, 100 - deduction);

  const suggestions: string[] = [];
  if (reliabilityScore < 40) {
    suggestions.push('叙述者高度不可靠，存在明显的记忆偏差和叙事矛盾');
    suggestions.push('如果是有意设计，确保读者能识别不可靠性并有线索推理真相');
  } else if (reliabilityScore < 70) {
    suggestions.push('叙述者存在一定不可靠性，注意保持一致性的同时设计合理矛盾');
  }
  if (contradictions.length === 0 && manipulationSigns.length === 0) {
    suggestions.push('未检测到不可靠叙述者特征，叙述者表现可靠');
  }

  return { reliabilityScore, contradictions, manipulationSigns, suggestions };
}
