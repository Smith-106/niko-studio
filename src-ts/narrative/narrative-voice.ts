/**
 * Narrative Voice Manager
 *
 * Based on Frey's narrative voice theory:
 * 1. Narrator as "disguise" - carefully constructed idealized projection
 * 2. Key to strong voice - dominance over tone and detail
 * 3. Breaking the "invisible author" myth - strong authorial presence
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Enums
// ============================================================

export enum VoiceStrength {
  WEAK = 'weak',
  MODERATE = 'moderate',
  STRONG = 'strong',
  AUTHORITATIVE = 'authoritative',
}

// ============================================================
// Data Types
// ============================================================

export interface VoiceMetrics {
  detailSpecificity: number;
  sensoryRichness: number;
  voiceConfidence: number;
  authorPresence: number;
}

export function getOverallStrength(m: VoiceMetrics): number {
  return (
    m.detailSpecificity * 0.3 +
    m.sensoryRichness * 0.25 +
    m.voiceConfidence * 0.25 +
    m.authorPresence * 0.2
  );
}

export function getStrengthLevel(m: VoiceMetrics): VoiceStrength {
  const score = getOverallStrength(m);
  if (score >= 8.5) return VoiceStrength.AUTHORITATIVE;
  if (score >= 7.0) return VoiceStrength.STRONG;
  if (score >= 5.0) return VoiceStrength.MODERATE;
  return VoiceStrength.WEAK;
}

export interface WeakPassage {
  location: string;
  originalText: string;
  issue: string;
  suggestion: string;
  improvedExample: string | null;
}

export interface NarrativeVoiceResult {
  metrics: VoiceMetrics;
  weakPassages: WeakPassage[];
  strongPassages: string[];
  overallAssessment: string;
  improvementPriority: string[];
}

export function computeOverallAssessment(metrics: VoiceMetrics): string {
  const level = getStrengthLevel(metrics);
  switch (level) {
    case VoiceStrength.AUTHORITATIVE:
      return '叙事语气权威有力，读者会完全信服';
    case VoiceStrength.STRONG:
      return '叙事语气较强，有改进空间';
    case VoiceStrength.MODERATE:
      return '叙事语气中等，需要增强细节和自信';
    case VoiceStrength.WEAK:
      return '叙事语气薄弱，需要全面加强';
  }
}

// ============================================================
// LLM Prompts
// ============================================================

const VOICE_ANALYSIS_PROMPT = `
## 叙事语气分析 (Narrative Voice Analysis)

分析以下内容的叙事语气强度。

**评估维度**:
1. 细节具体度 (Detail Specificity)
2. 感官丰富度 (Sensory Richness)
3. 语气自信度 (Voice Confidence)
4. 作者在场感 (Author Presence)

**待分析内容**:
{content}

请输出JSON格式:
`;

const WEAK_PASSAGE_DETECTION_PROMPT = `
## 薄弱段落检测 (Weak Passage Detection)

识别以下内容中语气薄弱的段落，并提供改进建议。

**待分析内容**:
{content}

请输出JSON格式:
`;

const VOICE_STRENGTHENING_PROMPT = `
## 语气强化建议 (Voice Strengthening Suggestions)

为以下内容提供语气强化的具体建议。

**待强化内容**:
{content}

**当前语气指标**:
{metrics}

请输出JSON格式:
`;

// ============================================================
// Sensory / analysis keyword dictionaries
// ============================================================

const SPECIFIC_INDICATORS = [
  '\u9CA2\u76AE', // shark skin
  '\u9CC4\u9C7C\u76AE', // crocodile
  '\u4E1D\u8D28', // silk
  '\u5F13\u7740\u8170', // bent over
  '\u91D1\u65AF\u987F', // Kingston
];

const SENSORY_KEYWORDS: Record<string, string[]> = {
  visual: [
    '\u770B\u5230',
    '\u671B\u89C1',
    '\u989C\u8272',
    '\u5149',
    '\u6697',
    '\u95EA',
  ],
  auditory: [
    '\u542C\u5230',
    '\u58F0\u97F3',
    '\u54CD',
    '\u9759',
    '\u558A',
    '\u4F4E\u8BED',
  ],
  tactile: [
    '\u89E6',
    '\u6478',
    '\u51B7',
    '\u70ED',
    '\u7C97\u7CD9',
    '\u5149\u6ED1',
  ],
  olfactory: [
    '\u95FB',
    '\u9999',
    '\u81ED',
    '\u6C14\u5473',
    '\u82AC\u82B3',
  ],
  gustatory: [
    '\u5C1D',
    '\u751C',
    '\u82E6',
    '\u8FA3',
    '\u5473\u9053',
  ],
};

const WEAK_WORDS = [
  '\u597D\u50CF',
  '\u4F3C\u4E4E',
  '\u5927\u6982',
  '\u53EF\u80FD',
  '\u4E5F\u8BB8',
  '\u6216\u8BB8',
  '\u4E0D\u77E5\u9053',
];

const PRESENCE_INDICATORS = [
  '\u663E\u7136',
  '\u65E0\u7591',
  '\u6BEB\u65E0\u7591\u95EE',
  '\u4E8B\u5B9E\u4E0A',
  '\u4E0D\u5F97\u4E0D\u8BF4',
  '\u503C\u5F97\u6CE8\u610F\u7684\u662F',
];

// ============================================================
// NarrativeVoiceManager
// ============================================================

export class NarrativeVoiceManager {
  private llmClient: INarrativeLLMClient | null;
  private lastStrongPassages: string[] = [];

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  async analyzeDetailSpecificity(content: string): Promise<number> {
    let score = 5.0;
    for (const indicator of SPECIFIC_INDICATORS) {
      if (content.includes(indicator)) score += 0.5;
    }
    return Math.min(score, 10.0);
  }

  async measureSensoryRichness(content: string): Promise<number> {
    let sensesFound = 0;
    for (const keywords of Object.values(SENSORY_KEYWORDS)) {
      if (keywords.some((kw) => content.includes(kw))) sensesFound++;
    }
    return Math.min(sensesFound * 2, 10.0);
  }

  async evaluateVoiceConfidence(content: string): Promise<number> {
    let score = 8.0;
    for (const word of WEAK_WORDS) {
      const count = content.split(word).length - 1;
      score -= count * 0.5;
    }
    return Math.max(score, 0.0);
  }

  async detectAuthorPresence(content: string): Promise<number> {
    let score = 5.0;
    for (const indicator of PRESENCE_INDICATORS) {
      if (content.includes(indicator)) score += 1.0;
    }
    return Math.min(score, 10.0);
  }

  async analyzeVoice(content: string): Promise<VoiceMetrics> {
    if (this.llmClient) {
      const prompt = VOICE_ANALYSIS_PROMPT.replace('{content}', content);
      const result = await this.llmClient.generateJson<{
        detail_specificity: number;
        sensory_richness: number;
        voice_confidence: number;
        author_presence: number;
      }>(prompt);

      return {
        detailSpecificity: result.detail_specificity,
        sensoryRichness: result.sensory_richness,
        voiceConfidence: result.voice_confidence,
        authorPresence: result.author_presence,
      };
    }

    return {
      detailSpecificity: await this.analyzeDetailSpecificity(content),
      sensoryRichness: await this.measureSensoryRichness(content),
      voiceConfidence: await this.evaluateVoiceConfidence(content),
      authorPresence: await this.detectAuthorPresence(content),
    };
  }

  async identifyWeakPassages(content: string): Promise<WeakPassage[]> {
    if (!this.llmClient) return this.mockWeakPassages();

    const prompt = WEAK_PASSAGE_DETECTION_PROMPT.replace(
      '{content}',
      content,
    );
    const result = await this.llmClient.generateJson<{
      weak_passages: Array<{
        location: string;
        original_text: string;
        issue: string;
        suggestion: string;
        improved_example: string;
      }>;
      strong_passages: string[];
    }>(prompt);

    this.lastStrongPassages = result.strong_passages ?? [];

    return (result.weak_passages ?? []).map((p) => ({
      location: p.location,
      originalText: p.original_text,
      issue: p.issue,
      suggestion: p.suggestion,
      improvedExample: p.improved_example ?? null,
    }));
  }

  async extractStrongPassages(content: string): Promise<string[]> {
    if (this.lastStrongPassages.length > 0) {
      return this.lastStrongPassages;
    }

    if (!this.llmClient) return this.mockStrongPassages();

    const prompt = WEAK_PASSAGE_DETECTION_PROMPT.replace(
      '{content}',
      content,
    );
    const result = await this.llmClient.generateJson<{
      strong_passages: string[];
    }>(prompt);

    this.lastStrongPassages = result.strong_passages ?? [];
    return this.lastStrongPassages;
  }

  async suggestVoiceStrengthening(
    _content: string,
    metrics: VoiceMetrics,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (metrics.detailSpecificity < 7) {
      suggestions.push(
        '增加具体细节: 用具体描述替代泛泛表达',
      );
    }
    if (metrics.sensoryRichness < 7) {
      suggestions.push(
        '丰富感官描写: 不要只依赖视觉，加入听觉、触觉、嗅觉',
      );
    }
    if (metrics.voiceConfidence < 7) {
      suggestions.push(
        '增强语气自信: 减少模糊词的使用',
      );
    }
    if (metrics.authorPresence < 7) {
      suggestions.push(
        '强化作者在场: 让叙述者展现独特观点和评价',
      );
    }

    return suggestions;
  }

  async analyzeFull(content: string): Promise<NarrativeVoiceResult> {
    const metrics = await this.analyzeVoice(content);
    const weakPassages = await this.identifyWeakPassages(content);
    const strongPassages = await this.extractStrongPassages(content);
    const suggestions = await this.suggestVoiceStrengthening(
      content,
      metrics,
    );

    return {
      metrics,
      weakPassages,
      strongPassages,
      overallAssessment: computeOverallAssessment(metrics),
      improvementPriority: suggestions,
    };
  }

  // ============================================================
  // Mock methods
  // ============================================================

  private mockWeakPassages(): WeakPassage[] {
    return [
      {
        location: '开头段落',
        originalText: '他是一个好人',
        issue: '过于泛泛，缺乏具体细节',
        suggestion: '用具体行为展示而非直接告诉',
        improvedExample:
          '他每天早起给邻居老太太送牛奶，从不收钱',
      },
    ];
  }

  private mockStrongPassages(): string[] {
    return [
      '鲨皮套装、鳄鱼皮鞋、丝质衬衣——他站在那里，像一尊用钱堆砌的雕像。',
    ];
  }
}
