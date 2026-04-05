/**
 * Suspense Analyzer
 *
 * Based on Frey's three pillars of suspense:
 * 1. Story Questions - arouse curiosity
 * 2. Threat Situations - create worry
 * 3. Lit Fuses - time-pressure crises
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Enums
// ============================================================

export enum SuspensePillar {
  STORY_QUESTION = 'story_question',
  THREAT_SITUATION = 'threat_situation',
  LIT_FUSE = 'lit_fuse',
}

// ============================================================
// Data Types
// ============================================================

export interface StoryQuestion {
  question: string;
  location: string;
  intensity: number;
  isAnswered: boolean;
  answerLocation: string | null;
}

export interface ThreatSituation {
  threatType: string;
  description: string;
  targetCharacter: string;
  intensity: number;
  isResolved: boolean;
}

export interface LitFuse {
  crisis: string;
  deadline: string;
  consequence: string;
  intensity: number;
  isDefused: boolean;
}

export interface SuspenseScore {
  pillar: SuspensePillar;
  score: number;
  elements: (StoryQuestion | ThreatSituation | LitFuse)[];
  issues: string[];
  suggestions: string[];
}

export interface SuspenseAnalysisResult {
  storyQuestions: SuspenseScore;
  threatSituations: SuspenseScore;
  litFuses: SuspenseScore;
  overallScore: number;
  suspenseLevel: string;
  suspenseCurve: [string, number][];
}

export function computeSuspenseResult(
  storyQuestions: SuspenseScore,
  threatSituations: SuspenseScore,
  litFuses: SuspenseScore,
): SuspenseAnalysisResult {
  const overallScore =
    (storyQuestions.score * 0.3 +
      threatSituations.score * 0.4 +
      litFuses.score * 0.3) *
    10;

  let suspenseLevel: string;
  if (overallScore >= 85) suspenseLevel = 'GRIPPING';
  else if (overallScore >= 70) suspenseLevel = 'HIGH';
  else if (overallScore >= 50) suspenseLevel = 'MODERATE';
  else suspenseLevel = 'LOW';

  return {
    storyQuestions,
    threatSituations,
    litFuses,
    overallScore,
    suspenseLevel,
    suspenseCurve: [],
  };
}

// ============================================================
// LLM Prompts
// ============================================================

const STORY_QUESTION_PROMPT = `
## 故事问题检测 (Story Question Detection)

分析以下内容，找出所有能激发读者好奇心的"故事问题"。

**待分析内容**:
{content}

请输出JSON格式:
`;

const THREAT_SITUATION_PROMPT = `
## 威胁情境分析 (Threat Situation Analysis)

分析以下内容，找出所有让读者为角色担忧的威胁情境。

**待分析内容**:
{content}

**角色信息**:
{character_info}

请输出JSON格式:
`;

const LIT_FUSE_PROMPT = `
## 导火索检测 (Lit Fuse Detection)

分析以下内容，找出所有"点燃的导火索"——有明确时限的危机。

**待分析内容**:
{content}

请输出JSON格式:
`;

// ============================================================
// SuspenseAnalyzer
// ============================================================

export class SuspenseAnalyzer {
  private llmClient: INarrativeLLMClient | null;

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  async detectStoryQuestions(content: string): Promise<SuspenseScore> {
    if (!this.llmClient) return this.mockStoryQuestions();

    try {
      const prompt = STORY_QUESTION_PROMPT.replace('{content}', content);
      const result = await this.llmClient.generateJson<{
        questions: Array<{
          question: string;
          location: string;
          intensity: number;
        }>;
        score: number;
        issues: string[];
        suggestions: string[];
      }>(prompt);

      const questions: StoryQuestion[] = (result.questions ?? []).map((q) => ({
        question: q.question,
        location: q.location,
        intensity: q.intensity,
        isAnswered: false,
        answerLocation: null,
      }));

      return {
        pillar: SuspensePillar.STORY_QUESTION,
        score: result.score,
        elements: questions,
        issues: result.issues ?? [],
        suggestions: result.suggestions ?? [],
      };
    } catch {
      return this.mockStoryQuestions();
    }
  }

  async analyzeThreatSituations(
    content: string,
    characterInfo: Record<string, unknown>,
  ): Promise<SuspenseScore> {
    if (!this.llmClient) return this.mockThreatSituations();

    try {
      const prompt = THREAT_SITUATION_PROMPT.replace(
        '{content}',
        content,
      ).replace('{character_info}', JSON.stringify(characterInfo));

      const result = await this.llmClient.generateJson<{
        threats: Array<{
          threat_type: string;
          description: string;
          target_character: string;
          intensity: number;
        }>;
        score: number;
        issues: string[];
        suggestions: string[];
      }>(prompt);

      const threats: ThreatSituation[] = (result.threats ?? []).map((t) => ({
        threatType: t.threat_type,
        description: t.description,
        targetCharacter: t.target_character,
        intensity: t.intensity,
        isResolved: false,
      }));

      return {
        pillar: SuspensePillar.THREAT_SITUATION,
        score: result.score,
        elements: threats,
        issues: result.issues ?? [],
        suggestions: result.suggestions ?? [],
      };
    } catch {
      return this.mockThreatSituations();
    }
  }

  async findLitFuses(content: string): Promise<SuspenseScore> {
    if (!this.llmClient) return this.mockLitFuses();

    try {
      const prompt = LIT_FUSE_PROMPT.replace('{content}', content);
      const result = await this.llmClient.generateJson<{
        fuses: Array<{
          crisis: string;
          deadline: string;
          consequence: string;
          intensity: number;
        }>;
        score: number;
        issues: string[];
        suggestions: string[];
      }>(prompt);

      const fuses: LitFuse[] = (result.fuses ?? []).map((f) => ({
        crisis: f.crisis,
        deadline: f.deadline,
        consequence: f.consequence,
        intensity: f.intensity,
        isDefused: false,
      }));

      return {
        pillar: SuspensePillar.LIT_FUSE,
        score: result.score,
        elements: fuses,
        issues: result.issues ?? [],
        suggestions: result.suggestions ?? [],
      };
    } catch {
      return this.mockLitFuses();
    }
  }

  async analyzeFull(
    content: string,
    characterInfo: Record<string, unknown>,
  ): Promise<SuspenseAnalysisResult> {
    const storyQuestions = await this.detectStoryQuestions(content);
    const threatSituations = await this.analyzeThreatSituations(
      content,
      characterInfo,
    );
    const litFuses = await this.findLitFuses(content);

    return computeSuspenseResult(
      storyQuestions,
      threatSituations,
      litFuses,
    );
  }

  calculateSuspenseCurve(
    scenes: Array<{ scene_id?: string; suspense_intensity?: number }>,
  ): [string, number][] {
    return scenes.map((scene) => [
      scene.scene_id ?? 'unknown',
      scene.suspense_intensity ?? 5.0,
    ]);
  }

  suggestSuspenseEnhancement(result: SuspenseAnalysisResult): string[] {
    const suggestions: string[] = [];

    if (result.storyQuestions.score < 6) {
      suggestions.push(
        '开篇需要更强的故事问题来抓住读者',
      );
      suggestions.push(...result.storyQuestions.suggestions);
    }

    if (result.threatSituations.score < 6) {
      suggestions.push(
        '威胁情境不够明确，读者难以为角色担忧',
      );
      suggestions.push(...result.threatSituations.suggestions);
    }

    if (result.litFuses.score < 6) {
      suggestions.push(
        '缺少时限压力，考虑增加导火索元素',
      );
      suggestions.push(...result.litFuses.suggestions);
    }

    return suggestions;
  }

  // ============================================================
  // Mock methods
  // ============================================================

  private mockStoryQuestions(): SuspenseScore {
    return {
      pillar: SuspensePillar.STORY_QUESTION,
      score: 7.0,
      elements: [
        {
          question: '主角接下来会怎么做？',
          location: '开篇',
          intensity: 7.0,
          isAnswered: false,
          answerLocation: null,
        },
      ],
      issues: [],
      suggestions: ['可以在开篇增加更直接的问题'],
    };
  }

  private mockThreatSituations(): SuspenseScore {
    return {
      pillar: SuspensePillar.THREAT_SITUATION,
      score: 6.0,
      elements: [],
      issues: ['威胁不够具体'],
      suggestions: ['增加更明确的威胁描写'],
    };
  }

  private mockLitFuses(): SuspenseScore {
    return {
      pillar: SuspensePillar.LIT_FUSE,
      score: 5.0,
      elements: [],
      issues: ['缺少时限压力'],
      suggestions: ['考虑增加deadline元素'],
    };
  }
}
