/**
 * AI Flavor Detector — rule-based detection of AI-generated prose patterns
 *
 * Detects common AI writing signatures without LLM calls:
 * - Template expressions (formulaic Chinese AI phrases)
 * - Style drift (uniform paragraph length, repetitive sentence patterns)
 * - Sensory gap (over-reliance on visual, missing other senses)
 *
 * Output: AIFlavorResult with score, indicators, confidence, evidence, suggestions.
 *
 * Related: R-M26-003, TASK-004
 */

// ============================================================
// Types
// ============================================================

export type AIFlavorIndicatorType =
  | 'template_expression'
  | 'style_drift'
  | 'sensory_gap'
  | 'repetitive_structure'
  | 'generic_transition';

export interface AIFlavorIndicator {
  type: AIFlavorIndicatorType;
  description: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string[];
}

export interface AIFlavorResult {
  aiFlavorScore: number; // 0-1, higher = more AI-like
  indicators: AIFlavorIndicator[];
  confidence: number; // 0-1, based on text length and match strength
  evidence: string[]; // flat list of all evidence snippets
  suggestions: string[]; // actionable improvement suggestions
}

// ============================================================
// Rule Definitions
// ============================================================

/**
 * Chinese AI template expressions — commonly overused by LLMs
 */
const AI_TEMPLATE_PATTERNS: Array<{ pattern: RegExp; label: string; weight: number }> = [
  { pattern: /值得注意的是/g, label: '值得注意的是', weight: 1.0 },
  { pattern: /让我们/g, label: '让我们', weight: 0.8 },
  { pattern: /综上所述/g, label: '综上所述', weight: 1.0 },
  { pattern: /首先[，,]/g, label: '首先，', weight: 0.6 },
  { pattern: /其次[，,]/g, label: '其次，', weight: 0.6 },
  { pattern: /最后[，,]/g, label: '最后，', weight: 0.6 },
  { pattern: /总而言之/g, label: '总而言之', weight: 1.0 },
  { pattern: /不可否认/g, label: '不可否认', weight: 0.9 },
  { pattern: /毫无疑问/g, label: '毫无疑问', weight: 0.9 },
  { pattern: /显而易见/g, label: '显而易见', weight: 0.9 },
  { pattern: /从某种意义来说/g, label: '从某种意义来说', weight: 0.8 },
  { pattern: /在一定程度上/g, label: '在一定程度上', weight: 0.8 },
  { pattern: /不难发现/g, label: '不难发现', weight: 0.9 },
  { pattern: /由此可见/g, label: '由此可见', weight: 0.9 },
  { pattern: /一言以蔽之/g, label: '一言以蔽之', weight: 1.0 },
  { pattern: /更有甚者/g, label: '更有甚者', weight: 0.8 },
  { pattern: /退一步说/g, label: '退一步说', weight: 0.8 },
  { pattern: /平心而论/g, label: '平心而论', weight: 0.9 },
  { pattern: /众所周知/g, label: '众所周知', weight: 0.9 },
  { pattern: /换言之/g, label: '换言之', weight: 0.7 },
  { pattern: /追根溯源/g, label: '追根溯源', weight: 0.8 },
  { pattern: /归根结底/g, label: '归根结底', weight: 0.9 },
  { pattern: /一言蔽之/g, label: '一言蔽之', weight: 1.0 },
  { pattern: /无独有偶/g, label: '无独有偶', weight: 0.8 },
  { pattern: /更有甚者/g, label: '更有甚者', weight: 0.8 },
  { pattern: /无独有偶/g, label: '无独有偶', weight: 0.8 },
  { pattern: /退一步讲/g, label: '退一步讲', weight: 0.8 },
  { pattern: /退一步说/g, label: '退一步说', weight: 0.8 },
  { pattern: /退一步来看/g, label: '退一步来看', weight: 0.8 },
  { pattern: /值得注意的是/g, label: '值得注意的是', weight: 1.0 },
  { pattern: /需要指出的是/g, label: '需要指出的是', weight: 0.9 },
  { pattern: /必须承认/g, label: '必须承认', weight: 0.9 },
  { pattern: /不得不承认/g, label: '不得不承认', weight: 0.9 },
  { pattern: /应当指出/g, label: '应当指出', weight: 0.9 },
  { pattern: /需要强调/g, label: '需要强调', weight: 0.9 },
  { pattern: /有必要说明/g, label: '有必要说明', weight: 0.9 },
  { pattern: /特别需要/g, label: '特别需要', weight: 0.8 },
  { pattern: /特别值得一提的是/g, label: '特别值得一提的是', weight: 0.9 },
  { pattern: /特别值得注意的是/g, label: '特别值得注意的是', weight: 0.9 },
  { pattern: /更加重要的是/g, label: '更加重要的是', weight: 0.8 },
  { pattern: /更为重要的是/g, label: '更为重要的是', weight: 0.8 },
  { pattern: /更重要的是/g, label: '更重要的是', weight: 0.8 },
  { pattern: /更加重要的是/g, label: '更加重要的是', weight: 0.8 },
  { pattern: /更为重要的是/g, label: '更为重要的是', weight: 0.8 },
  { pattern: /更重要的是/g, label: '更重要的是', weight: 0.8 },
  { pattern: /更加重要的是/g, label: '更加重要的是', weight: 0.8 },
  { pattern: /更为重要的是/g, label: '更为重要的是', weight: 0.8 },
  { pattern: /更重要的是/g, label: '更重要的是', weight: 0.8 },
  { pattern: /更加重要的是/g, label: '更加重要的是', weight: 0.8 },
  { pattern: /更为重要的是/g, label: '更为重要的是', weight: 0.8 },
  { pattern: /更重要的是/g, label: '更重要的是', weight: 0.8 },
];

/**
 * English AI template expressions
 */
const AI_TEMPLATE_PATTERNS_EN: Array<{ pattern: RegExp; label: string; weight: number }> = [
  { pattern: /it is important to note that/gi, label: 'it is important to note that', weight: 0.9 },
  { pattern: /it should be noted that/gi, label: 'it should be noted that', weight: 0.9 },
  { pattern: /in conclusion/gi, label: 'in conclusion', weight: 1.0 },
  { pattern: /to summarize/gi, label: 'to summarize', weight: 0.9 },
  { pattern: /in summary/gi, label: 'in summary', weight: 0.9 },
  { pattern: /furthermore/gi, label: 'furthermore', weight: 0.7 },
  { pattern: /moreover/gi, label: 'moreover', weight: 0.7 },
  { pattern: /additionally/gi, label: 'additionally', weight: 0.6 },
  { pattern: /consequently/gi, label: 'consequently', weight: 0.7 },
  { pattern: /therefore/gi, label: 'therefore', weight: 0.6 },
  { pattern: /thus/gi, label: 'thus', weight: 0.6 },
  { pattern: /however/gi, label: 'however', weight: 0.5 },
  { pattern: /nevertheless/gi, label: 'nevertheless', weight: 0.7 },
  { pattern: /on the other hand/gi, label: 'on the other hand', weight: 0.7 },
  { pattern: /it is worth noting/gi, label: 'it is worth noting', weight: 0.9 },
  { pattern: /it is worth mentioning/gi, label: 'it is worth mentioning', weight: 0.9 },
  { pattern: /delve into/gi, label: 'delve into', weight: 0.8 },
  { pattern: /navigate the complexities of/gi, label: 'navigate the complexities of', weight: 1.0 },
  { pattern: /in the realm of/gi, label: 'in the realm of', weight: 0.9 },
  { pattern: /a myriad of/gi, label: 'a myriad of', weight: 0.8 },
  { pattern: /tapestry of/gi, label: 'tapestry of', weight: 0.9 },
  { pattern: /landscape of/gi, label: 'landscape of', weight: 0.8 },
  { pattern: /multifaceted/gi, label: 'multifaceted', weight: 0.8 },
  { pattern: /underscores the importance of/gi, label: 'underscores the importance of', weight: 0.9 },
  { pattern: /highlights the need for/gi, label: 'highlights the need for', weight: 0.9 },
  { pattern: /serves as a testament to/gi, label: 'serves as a testament to', weight: 1.0 },
  { pattern: /sheds light on/gi, label: 'sheds light on', weight: 0.8 },
  { pattern: /paves the way for/gi, label: 'paves the way for', weight: 0.9 },
  { pattern: /opens the door to/gi, label: 'opens the door to', weight: 0.8 },
  { pattern: /at the end of the day/gi, label: 'at the end of the day', weight: 0.8 },
  { pattern: /when it comes to/gi, label: 'when it comes to', weight: 0.7 },
  { pattern: /in terms of/gi, label: 'in terms of', weight: 0.6 },
  { pattern: /with respect to/gi, label: 'with respect to', weight: 0.7 },
  { pattern: /in the context of/gi, label: 'in the context of', weight: 0.7 },
  { pattern: /it goes without saying/gi, label: 'it goes without saying', weight: 0.9 },
  { pattern: /needless to say/gi, label: 'needless to say', weight: 0.9 },
  { pattern: /as a matter of fact/gi, label: 'as a matter of fact', weight: 0.8 },
  { pattern: /to put it simply/gi, label: 'to put it simply', weight: 0.8 },
  { pattern: /in other words/gi, label: 'in other words', weight: 0.6 },
  { pattern: /for instance/gi, label: 'for instance', weight: 0.5 },
  { pattern: /for example/gi, label: 'for example', weight: 0.4 },
];

/**
 * Sensory vocabulary categories
 */
const SENSORY_WORDS: Record<string, string[]> = {
  visual: [
    '看', '看见', '看到', '望', '望见', '瞧', '瞥', '扫视', '注视', '凝视', '盯', '瞄',
    'see', 'saw', 'seen', 'look', 'looked', 'gaze', 'stare', 'glance', 'watch', 'watched',
    'observe', 'observed', 'notice', 'noticed', 'spot', 'spotted', 'view', 'viewed',
  ],
  auditory: [
    '听', '听到', '听见', '闻', '声响', '声音', '噪音', '寂静', '喧嚣',
    'hear', 'heard', 'listen', 'listened', 'sound', 'noise', 'silent', 'silence',
    'whisper', 'whispered', 'shout', 'shouted', 'cry', 'cried', 'scream', 'screamed',
    'murmur', 'murmured', 'mumble', 'mumbled', 'roar', 'roared', 'echo', 'echoed',
  ],
  tactile: [
    '摸', '触摸', '感觉', '感到', '温暖', '寒冷', '冰冷', '粗糙', '光滑', '柔软', '坚硬',
    'touch', 'touched', 'feel', 'felt', 'warm', 'cold', 'cool', 'hot', 'rough', 'smooth',
    'soft', 'hard', 'texture', 'textured', 'pressure', 'press', 'pressed', 'grasp', 'grasped',
  ],
  olfactory: [
    '闻', '闻到', '气味', '香味', '臭味', '芬芳', '刺鼻',
    'smell', 'smelled', 'smelt', 'scent', 'scented', 'odor', 'fragrance', 'aroma',
    'stench', 'stink', 'stunk', 'perfume', 'perfumed',
  ],
  gustatory: [
    '尝', '品尝', '味道', '甜', '酸', '苦', '辣', '咸', '美味', '难吃',
    'taste', 'tasted', 'flavor', 'flavored', 'sweet', 'sour', 'bitter', 'salty', 'spicy',
    'delicious', 'tasty', 'yummy', 'bitter', 'bland',
  ],
};

// ============================================================
// Detection Functions
// ============================================================

/**
 * Detect template expressions (AI filler phrases)
 */
function detectTemplateExpressions(text: string): {
  matches: Array<{ label: string; count: number; weight: number }>;
  totalScore: number;
  evidence: string[];
} {
  const allPatterns = [...AI_TEMPLATE_PATTERNS, ...AI_TEMPLATE_PATTERNS_EN];
  const matches: Array<{ label: string; count: number; weight: number }> = [];
  const evidence: string[] = [];
  let totalWeightedCount = 0;
  const textLength = Math.max(text.length, 1);

  for (const { pattern, label, weight } of allPatterns) {
    const count = (text.match(pattern) || []).length;
    if (count > 0) {
      matches.push({ label, count, weight });
      totalWeightedCount += count * weight;
      evidence.push(`检测到模板表达 "${label}" (${count} 次)`);
    }
  }

  // Normalize: score based on density (weighted matches per 1000 chars)
  const density = (totalWeightedCount * 1000) / textLength;
  const totalScore = Math.min(1, density / 5); // 5 weighted matches per 1000 chars = max score

  return { matches, totalScore, evidence };
}

/**
 * Detect style drift (uniform paragraph length, repetitive sentence starts)
 */
function detectStyleDrift(text: string): {
  uniformParagraphScore: number;
  repetitiveStartScore: number;
  totalScore: number;
  evidence: string[];
} {
  const evidence: string[] = [];
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 20);

  // 1. Uniform paragraph length
  let uniformParagraphScore = 0;
  if (paragraphs.length >= 3) {
    const lengths = paragraphs.map((p) => p.trim().split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / Math.max(mean, 1); // coefficient of variation

    // Low CV = very uniform = high AI score
    // CV < 0.15 is suspiciously uniform
    uniformParagraphScore = Math.max(0, 1 - cv / 0.15);
    if (uniformParagraphScore > 0.3) {
      evidence.push(`段落长度过于均匀 (CV=${cv.toFixed(3)})，疑似 AI 生成`);
    }
  }

  // 2. Repetitive sentence starts
  let repetitiveStartScore = 0;
  const sentences = text.split(/[.!?。！？\n]+/).filter((s) => s.trim().length > 5);
  if (sentences.length >= 5) {
    const startWords: string[] = [];
    for (const sentence of sentences) {
      const firstWord = sentence.trim().split(/\s+/)[0]?.toLowerCase();
      if (firstWord && firstWord.length > 1) {
        startWords.push(firstWord);
      }
    }

    const startFreq = new Map<string, number>();
    for (const word of startWords) {
      startFreq.set(word, (startFreq.get(word) || 0) + 1);
    }

    // Calculate repetition ratio: most common start / total sentences
    const maxFreq = Math.max(...startFreq.values(), 0);
    const repetitionRatio = maxFreq / Math.max(startWords.length, 1);
    repetitiveStartScore = Math.max(0, (repetitionRatio - 0.15) / 0.35); // >0.5 ratio = high score

    if (repetitiveStartScore > 0.3) {
      const mostCommon = Array.from(startFreq.entries()).sort((a, b) => b[1] - a[1])[0];
      if (mostCommon) {
        evidence.push(`句式开头重复率高，"${mostCommon[0]}" 出现 ${mostCommon[1]} 次`);
      }
    }
  }

  const totalScore = Math.min(1, (uniformParagraphScore + repetitiveStartScore) / 1.5);

  return { uniformParagraphScore, repetitiveStartScore, totalScore, evidence };
}

/**
 * Detect sensory coverage gap (over-reliance on visual)
 */
function detectSensoryGap(text: string): {
  visualDominanceScore: number;
  missingSensesScore: number;
  totalScore: number;
  evidence: string[];
} {
  const evidence: string[] = [];
  const lowerText = text.toLowerCase();

  const counts: Record<string, number> = {};
  for (const [sense, words] of Object.entries(SENSORY_WORDS)) {
    counts[sense] = 0;
    for (const word of words) {
      const regex = new RegExp(word, 'g');
      const matches = (lowerText.match(regex) || []).length;
      counts[sense] += matches;
    }
  }

  const totalSensory = Object.values(counts).reduce((a, b) => a + b, 0);

  if (totalSensory === 0) {
    // No sensory words at all — also suspicious (very dry, abstract text)
    return {
      visualDominanceScore: 0.3,
      missingSensesScore: 0.7,
      totalScore: 0.5,
      evidence: ['文本中几乎没有任何感官描写，过于抽象'],
    };
  }

  const visualRatio = counts.visual / totalSensory;
  const visualDominanceScore = Math.max(0, (visualRatio - 0.5) / 0.5); // >0.5 visual = suspicious

  // Count missing senses (zero count)
  const missingSenses = Object.entries(counts)
    .filter(([, count]) => count === 0)
    .map(([sense]) => sense);
  const missingSensesScore = missingSenses.length / 5; // 0-1

  if (visualDominanceScore > 0.3) {
    evidence.push(`视觉描写占比过高 (${(visualRatio * 100).toFixed(1)}%)，其他感官缺失`);
  }
  if (missingSensesScore > 0.3) {
    evidence.push(`缺少 ${missingSenses.length} 种感官描写: ${missingSenses.join(', ')}`);
  }

  const totalScore = Math.min(1, (visualDominanceScore * 0.6 + missingSensesScore * 0.4));

  return { visualDominanceScore, missingSensesScore, totalScore, evidence };
}

/**
 * Detect repetitive structure (repeated phrases, generic transitions)
 */
function detectRepetitiveStructure(text: string): {
  phraseRepetitionScore: number;
  genericTransitionScore: number;
  totalScore: number;
  evidence: string[];
} {
  const evidence: string[] = [];
  const lowerText = text.toLowerCase();

  // 1. Phrase repetition (3+ word phrases repeated)
  const phrases = new Map<string, number>();
  const words = lowerText.split(/\s+/).filter((w) => w.length > 2);

  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
  }

  let phraseRepetitionScore = 0;
  const repeatedPhrases = Array.from(phrases.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  if (repeatedPhrases.length > 0) {
    const topPhrase = repeatedPhrases[0];
    phraseRepetitionScore = Math.min(1, topPhrase[1] / 10);
    evidence.push(`短语 "${topPhrase[0]}" 重复 ${topPhrase[1]} 次`);
  }

  // 2. Generic transitions (overused connecting words)
  const genericTransitions = [
    '然后', '接着', '之后', '随后', '于是', '因此', '所以', '但是', '不过', '然而',
    'and then', 'after that', 'next', 'so', 'therefore', 'but', 'however', 'meanwhile',
  ];
  let transitionCount = 0;
  for (const transition of genericTransitions) {
    const regex = new RegExp(transition, 'g');
    transitionCount += (lowerText.match(regex) || []).length;
  }

  const textLength = Math.max(text.length, 1);
  const transitionDensity = (transitionCount * 1000) / textLength;
  const genericTransitionScore = Math.min(1, transitionDensity / 15);

  if (genericTransitionScore > 0.3) {
    evidence.push(`通用过渡词密度过高 (${transitionCount} 个，密度 ${transitionDensity.toFixed(2)}/1000字)`);
  }

  const totalScore = Math.min(1, (phraseRepetitionScore * 0.6 + genericTransitionScore * 0.4));

  return { phraseRepetitionScore, genericTransitionScore, totalScore, evidence };
}

// ============================================================
// Scoring Algorithm
// ============================================================

/**
 * Calculate confidence based on text length and match strength
 */
function calculateConfidence(
  textLength: number,
  indicatorCount: number,
  totalEvidenceCount: number,
): number {
  // More text = higher confidence (up to a point)
  const lengthConfidence = Math.min(1, textLength / 500);

  // More indicators = higher confidence
  const indicatorConfidence = Math.min(1, indicatorCount / 3);

  // More evidence = higher confidence
  const evidenceConfidence = Math.min(1, totalEvidenceCount / 5);

  // Weighted average
  return Math.round((lengthConfidence * 0.3 + indicatorConfidence * 0.4 + evidenceConfidence * 0.3) * 100) / 100;
}

/**
 * Generate suggestions based on detected indicators
 */
function generateSuggestions(indicators: AIFlavorIndicator[]): string[] {
  const suggestions: string[] = [];
  const hasTemplate = indicators.some((i) => i.type === 'template_expression');
  const hasStyleDrift = indicators.some((i) => i.type === 'style_drift');
  const hasSensoryGap = indicators.some((i) => i.type === 'sensory_gap');
  const hasRepetitive = indicators.some((i) => i.type === 'repetitive_structure');
  const hasGenericTransition = indicators.some((i) => i.type === 'generic_transition');

  if (hasTemplate) {
    suggestions.push('避免使用 AI 模板化表达，改用更自然的叙述方式');
    suggestions.push('替换"值得注意的是""综上所述"等套话，使用具体场景描写');
  }

  if (hasStyleDrift) {
    suggestions.push('调整段落长度，增加长短段落的变化');
    suggestions.push('改变句式开头，避免重复相同的语法结构');
  }

  if (hasSensoryGap) {
    suggestions.push('增加听觉、触觉、嗅觉、味觉描写，丰富感官层次');
    suggestions.push('降低视觉描写的比例，让读者通过多种感官体验场景');
  }

  if (hasRepetitive) {
    suggestions.push('检查并替换重复使用的短语和词汇');
    suggestions.push('使用同义词和不同的表达方式增加语言多样性');
  }

  if (hasGenericTransition) {
    suggestions.push('减少"然后""接着"等通用过渡词，使用场景切换代替');
    suggestions.push('通过动作和对话自然过渡，而非依赖连接词');
  }

  if (suggestions.length === 0) {
    suggestions.push('文本 AI 味较低，保持当前的写作风格');
  }

  return suggestions;
}

// ============================================================
// Main Export
// ============================================================

/**
 * Detect AI flavor in text using rule-based heuristics
 *
 * Returns a score (0-1) and detailed indicators of AI-generated patterns.
 * Higher score = more AI-like. Score < 0.3 suggests natural writing.
 *
 * @param text - The text to analyze
 * @returns AIFlavorResult with score, indicators, confidence, evidence, suggestions
 */
export function detectAIFlavor(text: string): AIFlavorResult {
  if (!text || text.trim().length === 0) {
    return {
      aiFlavorScore: 0,
      indicators: [],
      confidence: 0,
      evidence: [],
      suggestions: ['文本为空，无法检测 AI 味'],
    };
  }

  const trimmedText = text.trim();
  const textLength = trimmedText.length;

  // Run all detectors
  const templateResult = detectTemplateExpressions(trimmedText);
  const styleDriftResult = detectStyleDrift(trimmedText);
  const sensoryGapResult = detectSensoryGap(trimmedText);
  const repetitiveResult = detectRepetitiveStructure(trimmedText);

  // Build indicators
  const indicators: AIFlavorIndicator[] = [];

  if (templateResult.totalScore > 0.1) {
    indicators.push({
      type: 'template_expression',
      description: `检测到 ${templateResult.matches.length} 种模板化表达，疑似 AI 生成痕迹`,
      severity: templateResult.totalScore > 0.5 ? 'high' : templateResult.totalScore > 0.25 ? 'medium' : 'low',
      evidence: templateResult.evidence.slice(0, 5),
    });
  }

  if (styleDriftResult.totalScore > 0.1) {
    indicators.push({
      type: 'style_drift',
      description: '检测到风格指纹漂移，段落或句式过于均匀',
      severity: styleDriftResult.totalScore > 0.5 ? 'high' : styleDriftResult.totalScore > 0.25 ? 'medium' : 'low',
      evidence: styleDriftResult.evidence,
    });
  }

  if (sensoryGapResult.totalScore > 0.1) {
    indicators.push({
      type: 'sensory_gap',
      description: '感官覆盖不足，视觉描写占比过高或缺少其他感官',
      severity: sensoryGapResult.totalScore > 0.5 ? 'high' : sensoryGapResult.totalScore > 0.25 ? 'medium' : 'low',
      evidence: sensoryGapResult.evidence,
    });
  }

  if (repetitiveResult.totalScore > 0.1) {
    const isPhraseRepetition = repetitiveResult.phraseRepetitionScore > 0.1;
    const isGenericTransition = repetitiveResult.genericTransitionScore > 0.1;

    if (isPhraseRepetition) {
      indicators.push({
        type: 'repetitive_structure',
        description: '检测到重复短语结构，语言多样性不足',
        severity: repetitiveResult.phraseRepetitionScore > 0.5 ? 'high' : repetitiveResult.phraseRepetitionScore > 0.25 ? 'medium' : 'low',
        evidence: repetitiveResult.evidence.filter((e) => e.includes('短语')),
      });
    }

    if (isGenericTransition) {
      indicators.push({
        type: 'generic_transition',
        description: '通用过渡词使用过多，叙述显得机械',
        severity: repetitiveResult.genericTransitionScore > 0.5 ? 'high' : repetitiveResult.genericTransitionScore > 0.25 ? 'medium' : 'low',
        evidence: repetitiveResult.evidence.filter((e) => e.includes('过渡')),
      });
    }
  }

  // Calculate composite score
  // Weight: template (0.35) + style drift (0.25) + sensory gap (0.20) + repetitive (0.20)
  const aiFlavorScore = Math.min(1, Math.round(
    (templateResult.totalScore * 0.35 +
      styleDriftResult.totalScore * 0.25 +
      sensoryGapResult.totalScore * 0.20 +
      repetitiveResult.totalScore * 0.20) * 100,
  ) / 100);

  // Flatten all evidence
  const allEvidence = [
    ...templateResult.evidence,
    ...styleDriftResult.evidence,
    ...sensoryGapResult.evidence,
    ...repetitiveResult.evidence,
  ];

  // Confidence
  const confidence = calculateConfidence(textLength, indicators.length, allEvidence.length);

  // Suggestions
  const suggestions = generateSuggestions(indicators);

  return {
    aiFlavorScore,
    indicators,
    confidence,
    evidence: allEvidence,
    suggestions,
  };
}

// ============================================================
// Factory
// ============================================================

export function createAIFlavorDetector(): {
  detect: (text: string) => AIFlavorResult;
} {
  return {
    detect: detectAIFlavor,
  };
}
