/**
 * Style Learning & Imitation System
 *
 * 30-dimensional style vector, sliding-window drift detection,
 * style learning and matching.
 *
 * Dimensions based on:
 * 1. Lexical: vocabulary richness, avg word length, technical density, etc.
 * 2. Syntactic: sentence length, complexity, clause ratio, etc.
 * 3. Rhetorical: metaphor density, parallelism, rhetorical questions, etc.
 * 4. Rhythmic: paragraph length, punctuation rhythm, pause patterns, etc.
 * 5. Tone: formality, emotional valence, subjectivity, etc.
 * 6. Narrative: POV consistency, tense distribution, dialogue ratio, etc.
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Enums
// ============================================================

export enum StyleDimension {
  // Lexical (1-5)
  VOCABULARY_RICHNESS = 'vocabulary_richness',
  AVG_WORD_LENGTH = 'avg_word_length',
  RARE_WORD_RATIO = 'rare_word_ratio',
  TECHNICAL_DENSITY = 'technical_density',
  COLLOQUIAL_RATIO = 'colloquial_ratio',

  // Syntactic (6-10)
  AVG_SENTENCE_LENGTH = 'avg_sentence_length',
  SENTENCE_COMPLEXITY = 'sentence_complexity',
  CLAUSE_RATIO = 'clause_ratio',
  PASSIVE_RATIO = 'passive_ratio',
  INTERROGATIVE_RATIO = 'interrogative_ratio',

  // Rhetorical (11-15)
  METAPHOR_DENSITY = 'metaphor_density',
  PARALLELISM_FREQ = 'parallelism_freq',
  RHETORICAL_QUESTION = 'rhetorical_question',
  HYPERBOLE_LEVEL = 'hyperbole_level',
  PERSONIFICATION = 'personification',

  // Rhythmic (16-20)
  AVG_PARAGRAPH_LENGTH = 'avg_paragraph_length',
  PUNCTUATION_RHYTHM = 'punctuation_rhythm',
  PAUSE_PATTERN = 'pause_pattern',
  SENTENCE_VARIATION = 'sentence_variation',
  DIALOGUE_PACING = 'dialogue_pacing',

  // Tone (21-25)
  FORMALITY_LEVEL = 'formality_level',
  EMOTIONAL_VALENCE = 'emotional_valence',
  SUBJECTIVITY = 'subjectivity',
  CERTAINTY_LEVEL = 'certainty_level',
  INTIMACY_LEVEL = 'intimacy_level',

  // Narrative (26-30)
  POV_CONSISTENCY = 'pov_consistency',
  TENSE_DISTRIBUTION = 'tense_distribution',
  DIALOGUE_RATIO = 'dialogue_ratio',
  DESCRIPTION_DENSITY = 'description_density',
  SHOWING_VS_TELLING = 'showing_vs_telling',
}

// ============================================================
// Data Types
// ============================================================

export interface StyleVector {
  // Lexical
  vocabulary_richness: number;
  avg_word_length: number;
  rare_word_ratio: number;
  technical_density: number;
  colloquial_ratio: number;

  // Syntactic
  avg_sentence_length: number;
  sentence_complexity: number;
  clause_ratio: number;
  passive_ratio: number;
  interrogative_ratio: number;

  // Rhetorical
  metaphor_density: number;
  parallelism_freq: number;
  rhetorical_question: number;
  hyperbole_level: number;
  personification: number;

  // Rhythmic
  avg_paragraph_length: number;
  punctuation_rhythm: number;
  pause_pattern: number;
  sentence_variation: number;
  dialogue_pacing: number;

  // Tone
  formality_level: number;
  emotional_valence: number;
  subjectivity: number;
  certainty_level: number;
  intimacy_level: number;

  // Narrative
  pov_consistency: number;
  tense_distribution: number;
  dialogue_ratio: number;
  description_density: number;
  showing_vs_telling: number;
}

export function createDefaultStyleVector(): StyleVector {
  return {
    vocabulary_richness: 0.5, avg_word_length: 0.5, rare_word_ratio: 0.3,
    technical_density: 0.2, colloquial_ratio: 0.3,
    avg_sentence_length: 0.5, sentence_complexity: 0.5, clause_ratio: 0.3,
    passive_ratio: 0.2, interrogative_ratio: 0.1,
    metaphor_density: 0.3, parallelism_freq: 0.2, rhetorical_question: 0.1,
    hyperbole_level: 0.2, personification: 0.2,
    avg_paragraph_length: 0.5, punctuation_rhythm: 0.5, pause_pattern: 0.5,
    sentence_variation: 0.5, dialogue_pacing: 0.5,
    formality_level: 0.5, emotional_valence: 0.5, subjectivity: 0.5,
    certainty_level: 0.5, intimacy_level: 0.5,
    pov_consistency: 0.8, tense_distribution: 0.5, dialogue_ratio: 0.3,
    description_density: 0.5, showing_vs_telling: 0.5,
  };
}

const STYLE_VECTOR_KEYS: (keyof StyleVector)[] = [
  'vocabulary_richness', 'avg_word_length', 'rare_word_ratio',
  'technical_density', 'colloquial_ratio',
  'avg_sentence_length', 'sentence_complexity', 'clause_ratio',
  'passive_ratio', 'interrogative_ratio',
  'metaphor_density', 'parallelism_freq', 'rhetorical_question',
  'hyperbole_level', 'personification',
  'avg_paragraph_length', 'punctuation_rhythm', 'pause_pattern',
  'sentence_variation', 'dialogue_pacing',
  'formality_level', 'emotional_valence', 'subjectivity',
  'certainty_level', 'intimacy_level',
  'pov_consistency', 'tense_distribution', 'dialogue_ratio',
  'description_density', 'showing_vs_telling',
];

export function styleVectorToArray(v: StyleVector): number[] {
  return STYLE_VECTOR_KEYS.map((k) => v[k]);
}

export function styleVectorFromArray(arr: number[]): StyleVector {
  if (arr.length !== 30) {
    throw new Error(`Expected 30 dimensions, got ${arr.length}`);
  }
  return {
    vocabulary_richness: arr[0], avg_word_length: arr[1], rare_word_ratio: arr[2],
    technical_density: arr[3], colloquial_ratio: arr[4],
    avg_sentence_length: arr[5], sentence_complexity: arr[6], clause_ratio: arr[7],
    passive_ratio: arr[8], interrogative_ratio: arr[9],
    metaphor_density: arr[10], parallelism_freq: arr[11], rhetorical_question: arr[12],
    hyperbole_level: arr[13], personification: arr[14],
    avg_paragraph_length: arr[15], punctuation_rhythm: arr[16], pause_pattern: arr[17],
    sentence_variation: arr[18], dialogue_pacing: arr[19],
    formality_level: arr[20], emotional_valence: arr[21], subjectivity: arr[22],
    certainty_level: arr[23], intimacy_level: arr[24],
    pov_consistency: arr[25], tense_distribution: arr[26], dialogue_ratio: arr[27],
    description_density: arr[28], showing_vs_telling: arr[29],
  };
}

export function styleVectorToDict(v: StyleVector): Record<string, number> {
  const result: Record<string, number> = {};
  for (const k of STYLE_VECTOR_KEYS) {
    result[k] = v[k];
  }
  return result;
}

export function styleVectorFromDict(d: Record<string, number>): StyleVector {
  const defaults = createDefaultStyleVector();
  const result = { ...defaults };
  for (const k of STYLE_VECTOR_KEYS) {
    if (k in d) {
      (result as Record<string, number>)[k] = d[k];
    }
  }
  return result;
}

export function styleVectorDistance(a: StyleVector, b: StyleVector): number {
  const arr1 = styleVectorToArray(a);
  const arr2 = styleVectorToArray(b);
  let sum = 0;
  for (let i = 0; i < 30; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function styleVectorCosineSimilarity(a: StyleVector, b: StyleVector): number {
  const arr1 = styleVectorToArray(a);
  const arr2 = styleVectorToArray(b);
  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;
  for (let i = 0; i < 30; i++) {
    dot += arr1[i] * arr2[i];
    norm1 += arr1[i] * arr1[i];
    norm2 += arr2[i] * arr2[i];
  }
  if (norm1 === 0 || norm2 === 0) return 0.0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ============================================================
// StyleProfile / DriftEvent / StyleMatchResult
// ============================================================

export interface StyleProfile {
  name: string;
  vector: StyleVector;
  sampleCount: number;
  description: string;
  tags: string[];
  sourceTexts: string[];
}

export function styleProfileToDict(p: StyleProfile): Record<string, unknown> {
  return {
    name: p.name,
    vector: styleVectorToDict(p.vector),
    sample_count: p.sampleCount,
    description: p.description,
    tags: p.tags,
  };
}

export function styleProfileFromDict(d: Record<string, unknown>): StyleProfile {
  return {
    name: (d.name as string) ?? '',
    vector: styleVectorFromDict(d.vector as Record<string, number>),
    sampleCount: (d.sample_count as number) ?? 1,
    description: (d.description as string) ?? '',
    tags: (d.tags as string[]) ?? [],
    sourceTexts: [],
  };
}

export interface DriftEvent {
  position: number;
  segmentIndex: number;
  driftMagnitude: number;
  driftedDimensions: string[];
  beforeVector: StyleVector;
  afterVector: StyleVector;
  severity: string; // 'minor' | 'moderate' | 'severe'
}

export function driftEventToDict(e: DriftEvent): Record<string, unknown> {
  return {
    position: e.position,
    segment_index: e.segmentIndex,
    drift_magnitude: e.driftMagnitude,
    drifted_dimensions: e.driftedDimensions,
    severity: e.severity,
  };
}

export interface StyleMatchResult {
  targetProfile: string;
  similarity: number;
  distance: number;
  dimensionScores: Record<string, number>;
  suggestions: string[];
}

export function getMatchLevel(result: StyleMatchResult): string {
  if (result.similarity >= 0.9) return 'excellent';
  if (result.similarity >= 0.75) return 'good';
  if (result.similarity >= 0.6) return 'fair';
  if (result.similarity >= 0.4) return 'weak';
  return 'poor';
}

// ============================================================
// LLM Prompts
// ============================================================

const STYLE_ANALYSIS_PROMPT = `
## 风格深度分析

请分析以下文本的风格特征，特别关注修辞和叙事技巧。

**文本**:
{text}

**基础分析结果**:
{base_analysis}

请补充以下方面的分析，输出 JSON 格式:
`;

const STYLE_GUIDE_PROMPT = `
## 生成风格指南

请根据以下风格档案生成一份详细的写作风格指南。

**风格名称**: {name}
**描述**: {description}

**风格向量**:
{vector}

**样本片段**:
{samples}

请生成一份包含以下内容的风格指南:
1. 风格概述 (100字以内)
2. 词汇选择建议
3. 句式结构建议
4. 修辞手法建议
5. 语气和情感基调
6. 叙事技巧建议
7. 需要避免的写法

请使用 Markdown 格式输出。
`;

// ============================================================
// Chinese text analysis constants
// ============================================================

const CN_PUNCTUATION = new Set('\uFF0C\u3002\uFF01\uFF1F\u3001\uFF1B\uFF1A\u201C\u201D\u2018\u2019\uFF08\uFF09\u3010\u3011\u300A\u300B\u2014\u2026\u00B7');

const CN_SENTENCE_END = new Set('\u3002\uFF01\uFF1F');

const COLLOQUIAL_PATTERNS: RegExp[] = [
  /\u554A[\uFF0C\u3002\uFF01\uFF1F]/,
  /\u5462[\uFF0C\u3002\uFF01\uFF1F]/,
  /\u5427[\uFF0C\u3002\uFF01\uFF1F]/,
  /\u561B[\uFF0C\u3002\uFF01\uFF1F]/,
  /\u54E6[\uFF0C\u3002\uFF01\uFF1F]/,
  /\u5440[\uFF0C\u3002\uFF01\uFF1F]/,
  /\u54CE[\uFF0C\u3002\uFF01\uFF1F]/,
  /\u55EF[\uFF0C\u3002\uFF01\uFF1F]/,
];

const METAPHOR_MARKERS = ['\u50CF', '\u5982\u540C', '\u4EFF\u4F5B', '\u597D\u50CF', '\u72B9\u5982', '\u5B9B\u5982', '\u6070\u4F3C', '\u822C'];

const PASSIVE_MARKERS = ['\u88AB', '\u53D7\u5230', '\u906D\u5230', '\u5F97\u5230', '\u83B7\u5F97'];

const QUESTION_MARKERS = ['\u5417', '\u5462', '\uFF1F', '\u600E\u4E48', '\u4E3A\u4EC0\u4E48', '\u4EC0\u4E48', '\u54EA', '\u8C01', '\u51E0'];

const PERSONIFICATION_VERBS = ['\u8BF4', '\u5531', '\u7B11', '\u54ED', '\u8DF3', '\u821E', '\u53F9\u606F', '\u4F4E\u8BED', '\u5462\u5583'];

// ============================================================
// StyleAnalyzer
// ============================================================

export class StyleAnalyzer {
  private llmClient: INarrativeLLMClient | null;

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  analyze(text: string): StyleVector {
    if (!text || !text.trim()) return createDefaultStyleVector();

    const paragraphs = this.splitParagraphs(text);
    const sentences = this.splitSentences(text);
    const words = this.tokenize(text);

    const lexical = this.analyzeLexical(text, words);
    const syntactic = this.analyzeSyntactic(text, sentences);
    const rhetorical = this.analyzeRhetorical(text, sentences);
    const rhythmic = this.analyzeRhythmic(text, paragraphs, sentences);
    const tone = this.analyzeTone(text, sentences);
    const narrative = this.analyzeNarrative(text, sentences);

    return {
      vocabulary_richness: lexical.vocabulary_richness,
      avg_word_length: lexical.avg_word_length,
      rare_word_ratio: lexical.rare_word_ratio,
      technical_density: lexical.technical_density,
      colloquial_ratio: lexical.colloquial_ratio,
      avg_sentence_length: syntactic.avg_sentence_length,
      sentence_complexity: syntactic.sentence_complexity,
      clause_ratio: syntactic.clause_ratio,
      passive_ratio: syntactic.passive_ratio,
      interrogative_ratio: syntactic.interrogative_ratio,
      metaphor_density: rhetorical.metaphor_density,
      parallelism_freq: rhetorical.parallelism_freq,
      rhetorical_question: rhetorical.rhetorical_question,
      hyperbole_level: rhetorical.hyperbole_level,
      personification: rhetorical.personification,
      avg_paragraph_length: rhythmic.avg_paragraph_length,
      punctuation_rhythm: rhythmic.punctuation_rhythm,
      pause_pattern: rhythmic.pause_pattern,
      sentence_variation: rhythmic.sentence_variation,
      dialogue_pacing: rhythmic.dialogue_pacing,
      formality_level: tone.formality_level,
      emotional_valence: tone.emotional_valence,
      subjectivity: tone.subjectivity,
      certainty_level: tone.certainty_level,
      intimacy_level: tone.intimacy_level,
      pov_consistency: narrative.pov_consistency,
      tense_distribution: narrative.tense_distribution,
      dialogue_ratio: narrative.dialogue_ratio,
      description_density: narrative.description_density,
      showing_vs_telling: narrative.showing_vs_telling,
    };
  }

  async analyzeWithLlm(
    text: string,
    _context?: Record<string, unknown>,
  ): Promise<StyleVector> {
    const baseVector = this.analyze(text);

    if (!this.llmClient) return baseVector;

    const prompt = STYLE_ANALYSIS_PROMPT
      .replace('{text}', text.slice(0, 2000))
      .replace('{base_analysis}', JSON.stringify(styleVectorToDict(baseVector)));

    try {
      const result = await this.llmClient.generateJson<{
        rhetorical?: { metaphor_density?: number; hyperbole_level?: number; personification?: number };
        narrative?: { showing_vs_telling?: number; description_density?: number };
      }>(prompt);

      if (result.rhetorical) {
        baseVector.metaphor_density = result.rhetorical.metaphor_density ?? baseVector.metaphor_density;
        baseVector.hyperbole_level = result.rhetorical.hyperbole_level ?? baseVector.hyperbole_level;
        baseVector.personification = result.rhetorical.personification ?? baseVector.personification;
      }
      if (result.narrative) {
        baseVector.showing_vs_telling = result.narrative.showing_vs_telling ?? baseVector.showing_vs_telling;
        baseVector.description_density = result.narrative.description_density ?? baseVector.description_density;
      }
    } catch {
      // LLM analysis failed; use base analysis
    }

    return baseVector;
  }

  // ============================================================
  // Private - text preprocessing
  // ============================================================

  private splitParagraphs(text: string): string[] {
    return text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  }

  private splitSentences(text: string): string[] {
    return text.split(/[\u3002\uFF01\uFF1F]/).map((s) => s.trim()).filter((s) => s.length > 0);
  }

  private tokenize(text: string): string[] {
    const cleanText = text.replace(/[^\w\s\u4e00-\u9fff]/g, '');
    const tokens: string[] = [];
    let currentWord = '';
    for (const char of cleanText) {
      const code = char.charCodeAt(0);
      if (code >= 0x4e00 && code <= 0x9fff) {
        if (currentWord) { tokens.push(currentWord); currentWord = ''; }
        tokens.push(char);
      } else if (/\s/.test(char)) {
        if (currentWord) { tokens.push(currentWord); currentWord = ''; }
      } else {
        currentWord += char;
      }
    }
    if (currentWord) tokens.push(currentWord);
    return tokens;
  }

  // ============================================================
  // Private - feature extraction
  // ============================================================

  private analyzeLexical(text: string, words: string[]): Record<string, number> {
    if (!words.length) {
      return { vocabulary_richness: 0.5, avg_word_length: 0.5, rare_word_ratio: 0.3, technical_density: 0.2, colloquial_ratio: 0.3 };
    }

    const uniqueWords = new Set(words);
    const ttr = uniqueWords.size / words.length;
    const vocabulary_richness = Math.min(ttr * 2, 1.0);

    const avgLen = words.reduce((s, w) => s + w.length, 0) / words.length;
    const avg_word_length = Math.min(avgLen / 4, 1.0);

    const rareCount = words.filter((w) => w.length >= 3).length;
    const rare_word_ratio = rareCount / words.length;

    const technicalPatterns = [/\d+/g, /[a-zA-Z]+/g, /[%\uFF05\u00B0]/g];
    let technicalCount = 0;
    for (const pat of technicalPatterns) {
      const matches = text.match(pat);
      if (matches) technicalCount += matches.length;
    }
    const technical_density = text.length > 0 ? Math.min(technicalCount / text.length * 10, 1.0) : 0;

    let colloquialCount = 0;
    for (const pat of COLLOQUIAL_PATTERNS) {
      const m = text.match(pat);
      if (m) colloquialCount += m.length;
    }
    const colloquial_ratio = words.length > 0 ? Math.min(colloquialCount / words.length * 5, 1.0) : 0;

    return { vocabulary_richness, avg_word_length, rare_word_ratio, technical_density, colloquial_ratio };
  }

  private analyzeSyntactic(text: string, sentences: string[]): Record<string, number> {
    if (!sentences.length) {
      return { avg_sentence_length: 0.5, sentence_complexity: 0.5, clause_ratio: 0.3, passive_ratio: 0.2, interrogative_ratio: 0.1 };
    }

    const avgLen = sentences.reduce((s, x) => s + x.length, 0) / sentences.length;
    const avg_sentence_length = Math.min(avgLen / 50, 1.0);

    const commaCounts = sentences.map((s) => {
      let c = 0;
      for (const ch of s) { if (ch === '\uFF0C' || ch === ',') c++; }
      return c;
    });
    const avgCommas = commaCounts.reduce((a, b) => a + b, 0) / sentences.length;
    const sentence_complexity = Math.min(avgCommas / 5, 1.0);

    const clauseMarkers = ['\u56E0\u4E3A', '\u6240\u4EE5', '\u867D\u7136', '\u4F46\u662F', '\u5982\u679C', '\u90A3\u4E48', '\u5F53', '\u800C'];
    const clauseCount = sentences.filter((s) => clauseMarkers.some((m) => s.includes(m))).length;
    const clause_ratio = clauseCount / sentences.length;

    const passiveCount = sentences.filter((s) => PASSIVE_MARKERS.some((m) => s.includes(m))).length;
    const passive_ratio = passiveCount / sentences.length;

    const interrogativeCount = sentences.filter((s) => QUESTION_MARKERS.some((m) => s.includes(m))).length;
    const interrogative_ratio = interrogativeCount / sentences.length;

    return { avg_sentence_length, sentence_complexity, clause_ratio, passive_ratio, interrogative_ratio };
  }

  private analyzeRhetorical(text: string, sentences: string[]): Record<string, number> {
    if (!sentences.length) {
      return { metaphor_density: 0.3, parallelism_freq: 0.2, rhetorical_question: 0.1, hyperbole_level: 0.2, personification: 0.2 };
    }

    let metaphorCount = 0;
    for (const marker of METAPHOR_MARKERS) {
      if (text.includes(marker)) metaphorCount++;
    }
    const metaphor_density = Math.min(metaphorCount / sentences.length, 1.0);

    let parallelismCount = 0;
    for (let i = 0; i < sentences.length - 2; i++) {
      if (this.isParallel(sentences.slice(i, i + 3))) parallelismCount++;
    }
    const parallelism_freq = Math.min(parallelismCount / Math.max(sentences.length - 2, 1) * 3, 1.0);

    const rhetoricalPatterns = ['\u96BE\u9053', '\u4F55\u5FC5', '\u5C82', '\u600E\u80FD'];
    let rhetoricalCount = 0;
    for (const p of rhetoricalPatterns) { if (text.includes(p)) rhetoricalCount++; }
    const rhetorical_question = Math.min(rhetoricalCount / sentences.length * 2, 1.0);

    const hyperbolePatterns = ['\u6700', '\u6781', '\u975E\u5E38', '\u65E0\u6BD4', '\u7EDD\u5BF9', '\u6C38\u8FDC', '\u5343\u4E07', '\u4E07\u5206'];
    let hyperboleCount = 0;
    for (const p of hyperbolePatterns) {
      const m = text.match(new RegExp(p, 'g'));
      if (m) hyperboleCount += m.length;
    }
    const hyperbole_level = Math.min(hyperboleCount / sentences.length, 1.0);

    let personificationCount = 0;
    for (const verb of PERSONIFICATION_VERBS) {
      if (text.includes(verb)) personificationCount++;
    }
    const personification = Math.min(personificationCount / sentences.length * 0.5, 1.0);

    return { metaphor_density, parallelism_freq, rhetorical_question, hyperbole_level, personification };
  }

  private analyzeRhythmic(text: string, paragraphs: string[], sentences: string[]): Record<string, number> {
    if (!paragraphs.length || !sentences.length) {
      return { avg_paragraph_length: 0.5, punctuation_rhythm: 0.5, pause_pattern: 0.5, sentence_variation: 0.5, dialogue_pacing: 0.5 };
    }

    const avgParaLen = paragraphs.reduce((s, p) => s + p.length, 0) / paragraphs.length;
    const avg_paragraph_length = Math.min(avgParaLen / 200, 1.0);

    let punctCount = 0;
    for (const c of text) { if (CN_PUNCTUATION.has(c)) punctCount++; }
    const punctuation_rhythm = text.length > 0 ? Math.min(punctCount / text.length * 10, 1.0) : 0.5;

    const pauseMarkers = (text.match(/\u2026\u2026/g) || []).length + (text.match(/\u2014\u2014/g) || []).length + (text.match(/\.\.\./g) || []).length;
    const pause_pattern = Math.min(pauseMarkers / paragraphs.length, 1.0);

    let sentence_variation = 0.5;
    if (sentences.length > 1) {
      const lengths = sentences.map((s) => s.length);
      const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((s, l) => s + (l - meanLen) ** 2, 0) / lengths.length;
      sentence_variation = Math.min(Math.sqrt(variance) / 20, 1.0);
    }

    const dialogueMarkers = (text.match(/"/g) || []).length + (text.match(/\u300C/g) || []).length + (text.match(/\u300D/g) || []).length;
    const dialogue_pacing = Math.min(dialogueMarkers / paragraphs.length * 0.5, 1.0);

    return { avg_paragraph_length, punctuation_rhythm, pause_pattern, sentence_variation, dialogue_pacing };
  }

  private analyzeTone(text: string, sentences: string[]): Record<string, number> {
    if (!sentences.length) {
      return { formality_level: 0.5, emotional_valence: 0.5, subjectivity: 0.5, certainty_level: 0.5, intimacy_level: 0.5 };
    }

    const formalMarkers = ['\u8BF7', '\u60A8', '\u8D35', '\u656C', '\u6073\u8BF7', '\u8BDA'];
    const informalMarkers = ['\u4F60', '\u6211', '\u54B1', '\u6EF4', '\u5565', '\u548B'];
    const formalCount = formalMarkers.filter((m) => text.includes(m)).length;
    const informalCount = informalMarkers.filter((m) => text.includes(m)).length;
    const formality_level = (formalCount + informalCount > 0) ? formalCount / (formalCount + informalCount) : 0.5;

    const positiveMarkers = ['\u559C\u6B22', '\u7231', '\u7F8E', '\u597D', '\u5FEB\u4E50', '\u5E78\u798F', '\u6E29\u6696', '\u5E0C\u671B'];
    const negativeMarkers = ['\u6068', '\u8BA8\u538C', '\u574F', '\u75DB', '\u60B2\u4F24', '\u7EDD\u671B', '\u51B7', '\u5BB3\u6015'];
    const posCount = positiveMarkers.filter((m) => text.includes(m)).length;
    const negCount = negativeMarkers.filter((m) => text.includes(m)).length;
    const emotional_valence = (posCount + negCount > 0) ? (posCount + 1) / (posCount + negCount + 2) : 0.5;

    const subjectiveMarkers = ['\u6211\u89C9\u5F97', '\u6211\u8BA4\u4E3A', '\u6211\u60F3', '\u4E5F\u8BB8', '\u53EF\u80FD', '\u5927\u6982'];
    const subjectiveCount = subjectiveMarkers.filter((m) => text.includes(m)).length;
    const firstPersonCount = (text.match(/\u6211/g) || []).length;
    const subjectivity = Math.min((subjectiveCount + firstPersonCount * 0.1) / sentences.length, 1.0);

    const uncertainMarkers = ['\u4E5F\u8BB8', '\u53EF\u80FD', '\u5927\u6982', '\u6216\u8BB8', '\u4F3C\u4E4E', '\u597D\u50CF'];
    const certainMarkers = ['\u4E00\u5B9A', '\u5FC5\u987B', '\u7EDD\u5BF9', '\u80AF\u5B9A', '\u786E\u5B9E', '\u5F53\u7136'];
    const uncertainCount = uncertainMarkers.filter((m) => text.includes(m)).length;
    const certainCount = certainMarkers.filter((m) => text.includes(m)).length;
    const certainty_level = (uncertainCount + certainCount > 0) ? certainCount / (uncertainCount + certainCount) : 0.5;

    const intimateMarkers = ['\u4EB2\u7231\u7684', '\u5B9D\u8D1D', '\u4EB2', '\u5462', '\u5566', '\u54E6'];
    const intimateCount = intimateMarkers.filter((m) => text.includes(m)).length;
    const intimacy_level = Math.min(intimateCount / sentences.length, 1.0);

    return { formality_level, emotional_valence, subjectivity, certainty_level, intimacy_level };
  }

  private analyzeNarrative(text: string, sentences: string[]): Record<string, number> {
    if (!sentences.length) {
      return { pov_consistency: 0.8, tense_distribution: 0.5, dialogue_ratio: 0.3, description_density: 0.5, showing_vs_telling: 0.5 };
    }

    const firstPerson = text.includes('\u6211') || text.includes('\u6211\u4EEC');
    const secondPerson = text.includes('\u4F60') || text.includes('\u4F60\u4EEC');
    const thirdPerson = text.includes('\u4ED6') || text.includes('\u5979') || text.includes('\u5B83');
    const povCount = [firstPerson, secondPerson, thirdPerson].filter(Boolean).length;
    let pov_consistency = 1.0;
    if (povCount > 1) pov_consistency = 1.0 - (povCount - 1) * 0.3;

    const pastMarkers = ['\u4E86', '\u8FC7', '\u66FE\u7ECF', '\u5F53\u65F6'];
    const presentMarkers = ['\u6B63\u5728', '\u6B63', '\u7740'];
    let pastCount = 0;
    for (const m of pastMarkers) { const r = text.match(new RegExp(m, 'g')); if (r) pastCount += r.length; }
    let presentCount = 0;
    for (const m of presentMarkers) { const r = text.match(new RegExp(m, 'g')); if (r) presentCount += r.length; }
    const tense_distribution = (pastCount + presentCount > 0) ? pastCount / (pastCount + presentCount) : 0.5;

    let dialogueChars = 0;
    let inDialogue = false;
    for (const char of text) {
      if (char === '\u201C' || char === '\u300C') { inDialogue = true; }
      else if (char === '\u201D' || char === '\u300D') { inDialogue = false; }
      else if (inDialogue) { dialogueChars++; }
    }
    const dialogue_ratio = text.length > 0 ? dialogueChars / text.length : 0;

    const descriptionMarkers = ['\u7684', '\u5730', '\u5F97'];
    let descriptionCount = 0;
    for (const m of descriptionMarkers) { const r = text.match(new RegExp(m, 'g')); if (r) descriptionCount += r.length; }
    const description_density = text.length > 0 ? Math.min(descriptionCount / text.length * 5, 1.0) : 0.5;

    const actionMarkers = ['\u8D70', '\u8DD1', '\u8BF4', '\u770B', '\u542C', '\u62FF', '\u653E', '\u6253', '\u8E22'];
    const tellingMarkers = ['\u662F', '\u6709', '\u611F\u5230', '\u89C9\u5F97', '\u8BA4\u4E3A'];
    let actionCount = 0;
    for (const m of actionMarkers) { const r = text.match(new RegExp(m, 'g')); if (r) actionCount += r.length; }
    let tellingCount = 0;
    for (const m of tellingMarkers) { const r = text.match(new RegExp(m, 'g')); if (r) tellingCount += r.length; }
    const showing_vs_telling = (actionCount + tellingCount > 0) ? actionCount / (actionCount + tellingCount) : 0.5;

    return { pov_consistency: Math.max(0, pov_consistency), tense_distribution, dialogue_ratio, description_density, showing_vs_telling };
  }

  private isParallel(sents: string[]): boolean {
    if (sents.length < 3) return false;
    const lengths = sents.map((s) => s.length);
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((s, l) => s + (l - avgLen) ** 2, 0) / lengths.length;
    return variance < (avgLen * 0.3) ** 2;
  }
}

// ============================================================
// StyleDriftDetector
// ============================================================

export class StyleDriftDetector {
  private windowSize: number;
  private stride: number;
  private threshold: number;
  private analyzer: StyleAnalyzer;
  private windowHistory: StyleVector[];

  constructor(
    windowSize = 500,
    stride = 100,
    threshold = 0.15,
    analyzer?: StyleAnalyzer,
  ) {
    this.windowSize = windowSize;
    this.stride = stride;
    this.threshold = threshold;
    this.analyzer = analyzer ?? new StyleAnalyzer();
    this.windowHistory = [];
  }

  detect(text: string): DriftEvent[] {
    if (text.length < this.windowSize * 2) return [];

    const events: DriftEvent[] = [];
    const vectors: StyleVector[] = [];
    const positions: number[] = [];

    for (let i = 0; i <= text.length - this.windowSize; i += this.stride) {
      const windowText = text.slice(i, i + this.windowSize);
      vectors.push(this.analyzer.analyze(windowText));
      positions.push(i);
    }

    if (vectors.length < 2) return [];

    for (let i = 1; i < vectors.length; i++) {
      const distance = styleVectorDistance(vectors[i], vectors[i - 1]);
      if (distance > this.threshold) {
        const driftedDims = this.findDriftedDimensions(vectors[i - 1], vectors[i]);
        let severity = 'minor';
        if (distance > this.threshold * 3) severity = 'severe';
        else if (distance > this.threshold * 2) severity = 'moderate';

        events.push({
          position: positions[i],
          segmentIndex: i,
          driftMagnitude: distance,
          driftedDimensions: driftedDims,
          beforeVector: vectors[i - 1],
          afterVector: vectors[i],
          severity,
        });
      }
    }

    return events;
  }

  detectAgainstReference(text: string, reference: StyleVector): DriftEvent[] {
    const events: DriftEvent[] = [];

    for (let i = 0; i <= text.length - this.windowSize; i += this.stride) {
      const windowText = text.slice(i, i + this.windowSize);
      const vector = this.analyzer.analyze(windowText);
      const distance = styleVectorDistance(vector, reference);

      if (distance > this.threshold) {
        const driftedDims = this.findDriftedDimensions(reference, vector);
        let severity = 'minor';
        if (distance > this.threshold * 3) severity = 'severe';
        else if (distance > this.threshold * 2) severity = 'moderate';

        events.push({
          position: i,
          segmentIndex: Math.floor(i / this.stride),
          driftMagnitude: distance,
          driftedDimensions: driftedDims,
          beforeVector: reference,
          afterVector: vector,
          severity,
        });
      }
    }

    return events;
  }

  getStabilityScore(text: string): number {
    const events = this.detect(text);
    if (events.length === 0) return 1.0;

    const severityWeights: Record<string, number> = { minor: 0.1, moderate: 0.3, severe: 0.5 };
    const totalPenalty = events.reduce((s, e) => s + (severityWeights[e.severity] ?? 0.1), 0);
    const maxEvents = Math.floor(text.length / this.stride);
    const normalizedPenalty = totalPenalty / Math.max(maxEvents, 1);
    return Math.max(0, 1.0 - normalizedPenalty);
  }

  private findDriftedDimensions(before: StyleVector, after: StyleVector, threshold = 0.1): string[] {
    const beforeDict = styleVectorToDict(before);
    const afterDict = styleVectorToDict(after);
    const drifted: string[] = [];
    for (const dim of Object.keys(beforeDict)) {
      if (Math.abs(afterDict[dim] - beforeDict[dim]) > threshold) {
        drifted.push(dim);
      }
    }
    return drifted;
  }
}

// ============================================================
// StyleMatcher
// ============================================================

export class StyleMatcher {
  private analyzer: StyleAnalyzer;
  private llmClient: INarrativeLLMClient | null;
  private profiles: Map<string, StyleProfile>;

  constructor(analyzer?: StyleAnalyzer, llmClient?: INarrativeLLMClient) {
    this.analyzer = analyzer ?? new StyleAnalyzer();
    this.llmClient = llmClient ?? null;
    this.profiles = new Map();
  }

  learn(name: string, texts: string[], description = '', tags?: string[]): StyleProfile {
    if (!texts.length) throw new Error('At least one sample text is required');

    const vectors = texts.map((t) => this.analyzer.analyze(t));
    const avgVector = this.averageVectors(vectors);

    const profile: StyleProfile = {
      name,
      vector: avgVector,
      sampleCount: texts.length,
      description,
      tags: tags ?? [],
      sourceTexts: texts.map((t) => t.slice(0, 200)),
    };

    this.profiles.set(name, profile);
    return profile;
  }

  match(text: string, targetName: string): StyleMatchResult {
    const target = this.profiles.get(targetName);
    if (!target) throw new Error(`Unknown style profile: ${targetName}`);

    const textVector = this.analyzer.analyze(text);
    const similarity = styleVectorCosineSimilarity(textVector, target.vector);
    const distance = styleVectorDistance(textVector, target.vector);
    const dimensionScores = this.computeDimensionScores(textVector, target.vector);
    const suggestions = this.generateSuggestions(textVector, target.vector, dimensionScores);

    return { targetProfile: targetName, similarity, distance, dimensionScores, suggestions };
  }

  findClosestStyle(text: string): [string, number] {
    if (this.profiles.size === 0) return ['', 0.0];

    const textVector = this.analyzer.analyze(text);
    let bestName = '';
    let bestSimilarity = -1.0;

    for (const [name, profile] of this.profiles) {
      const sim = styleVectorCosineSimilarity(textVector, profile.vector);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestName = name;
      }
    }
    return [bestName, bestSimilarity];
  }

  getProfile(name: string): StyleProfile | undefined {
    return this.profiles.get(name);
  }

  listProfiles(): string[] {
    return Array.from(this.profiles.keys());
  }

  exportProfiles(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, profile] of this.profiles) {
      result[name] = styleProfileToDict(profile);
    }
    return result;
  }

  importProfiles(data: Record<string, unknown>): number {
    let count = 0;
    for (const [name, profileData] of Object.entries(data)) {
      try {
        const profile = styleProfileFromDict(profileData as Record<string, unknown>);
        this.profiles.set(name, profile);
        count++;
      } catch {
        continue;
      }
    }
    return count;
  }

  async generateStyleGuide(name: string): Promise<string> {
    const profile = this.profiles.get(name);
    if (!profile) throw new Error(`Unknown style profile: ${name}`);

    if (!this.llmClient) return this.generateBasicGuide(profile);

    const prompt = STYLE_GUIDE_PROMPT
      .replace('{name}', name)
      .replace('{description}', profile.description)
      .replace('{vector}', JSON.stringify(styleVectorToDict(profile.vector)))
      .replace('{samples}', profile.sourceTexts.slice(0, 3).join('\n---\n'));

    try {
      return await this.llmClient.generateJson<string>(prompt);
    } catch {
      return this.generateBasicGuide(profile);
    }
  }

  private averageVectors(vectors: StyleVector[]): StyleVector {
    if (!vectors.length) return createDefaultStyleVector();
    const arrays = vectors.map(styleVectorToArray);
    const avgArray: number[] = [];
    for (let i = 0; i < 30; i++) {
      avgArray.push(arrays.reduce((s, arr) => s + arr[i], 0) / arrays.length);
    }
    return styleVectorFromArray(avgArray);
  }

  private computeDimensionScores(textVector: StyleVector, targetVector: StyleVector): Record<string, number> {
    const textDict = styleVectorToDict(textVector);
    const targetDict = styleVectorToDict(targetVector);
    const scores: Record<string, number> = {};
    for (const dim of Object.keys(textDict)) {
      scores[dim] = Math.max(0, 1.0 - Math.abs(textDict[dim] - targetDict[dim]));
    }
    return scores;
  }

  private generateSuggestions(
    textVector: StyleVector,
    targetVector: StyleVector,
    scores: Record<string, number>,
  ): string[] {
    const suggestions: string[] = [];
    const sortedDims = Object.entries(scores).sort((a, b) => a[1] - b[1]);
    const textDict = styleVectorToDict(textVector);
    const targetDict = styleVectorToDict(targetVector);

    const suggestionsMap: Record<string, (diff: number) => string> = {
      vocabulary_richness: (d) => `${d > 0 ? '增加' : '减少'}词汇多样性，使用更多同义词`,
      avg_word_length: (d) => `${d > 0 ? '增加' : '减少'}词语长度，${d > 0 ? '使用更多书面语' : '使用更简洁的表达'}`,
      colloquial_ratio: (d) => `${d > 0 ? '增加' : '减少'}口语化程度`,
      avg_sentence_length: (d) => `${d > 0 ? '增加' : '减少'}句子长度`,
      sentence_complexity: (d) => `${d > 0 ? '增加' : '减少'}句式复杂度`,
      metaphor_density: (d) => `${d > 0 ? '增加' : '减少'}比喻的使用`,
      formality_level: (d) => `${d > 0 ? '增加' : '减少'}正式程度`,
      emotional_valence: (d) => `调整情感基调，使其更${d > 0 ? '积极' : '克制'}`,
      dialogue_ratio: (d) => `${d > 0 ? '增加' : '减少'}对话比例`,
      showing_vs_telling: (d) => `${d > 0 ? '多用展示少用叙述' : '适当增加叙述'}`,
    };

    for (const [dim, score] of sortedDims.slice(0, 5)) {
      if (score < 0.7) {
        const diff = targetDict[dim] - textDict[dim];
        const fn = suggestionsMap[dim];
        if (fn) suggestions.push(fn(diff));
      }
    }
    return suggestions;
  }

  private generateBasicGuide(profile: StyleProfile): string {
    const v = profile.vector;
    const level = (val: number, low: number, high: number) =>
      val > high ? '高' : val > low ? '中' : '低';

    return `# ${profile.name} 风格指南

## 概述
${profile.description || '(无描述)'}

## 风格特征

### 词汇层
- 词汇丰富度: ${level(v.vocabulary_richness, 0.3, 0.6)}
- 口语化程度: ${level(v.colloquial_ratio, 0.2, 0.5)}

### 句法层
- 句子长度: ${v.avg_sentence_length > 0.6 ? '长' : v.avg_sentence_length > 0.3 ? '中' : '短'}
- 句式复杂度: ${level(v.sentence_complexity, 0.3, 0.6)}

### 修辞层
- 比喻使用: ${v.metaphor_density > 0.5 ? '频繁' : v.metaphor_density > 0.2 ? '适中' : '较少'}

### 语气层
- 正式度: ${v.formality_level > 0.6 ? '正式' : v.formality_level > 0.3 ? '中性' : '随意'}
- 情感倾向: ${v.emotional_valence > 0.6 ? '积极' : v.emotional_valence > 0.4 ? '中性' : '消极'}

### 叙事层
- 对话比例: ${level(v.dialogue_ratio, 0.2, 0.4)}
- 展示 vs 叙述: ${v.showing_vs_telling > 0.6 ? '偏展示' : v.showing_vs_telling > 0.4 ? '平衡' : '偏叙述'}
`;
  }
}
