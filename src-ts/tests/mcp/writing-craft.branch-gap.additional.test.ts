import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/writing-craft/test',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function getBody(response: HttpResponse): any {
  return response.body as any;
}

const SAMPLE_TEXT = [
  '林岚抬头看向走廊尽头，手指一点点收紧，指节泛白。',
  '“你还要继续查下去吗？”老陈压低声音，目光躲闪。',
  '她没有回答，只是把匿名信慢慢折好，塞回口袋。',
].join('\n');

async function importEndpointsWithMocks(options: {
  lowBoundaryScores?: boolean;
  highBoundaryScores?: boolean;
  zeroWebNovelScore?: boolean;
  voiceWarnings?: boolean;
} = {}) {
  vi.resetModules();
  vi.doUnmock('../../narrative/writing-craft/hook-cliffhanger-scorer');
  vi.doUnmock('../../narrative/character-voice-fingerprint');
  vi.doUnmock('../../narrative/reader-satisfaction-analyzer');
  vi.doUnmock('../../narrative/premise-validator');

  if (options.lowBoundaryScores) {
    vi.doMock('../../narrative/writing-craft/hook-cliffhanger-scorer', () => ({
      scoreHook: vi.fn().mockReturnValue({
        overall: 20,
        dimensions: {
          conflict_hint: 20,
          info_gap: 20,
          sensory_impact: 20,
          pacing_entry: 20,
        },
        evidence: ['平淡开场'],
      }),
      scoreCliffhanger: vi.fn().mockReturnValue({
        overall: 10,
        dimensions: {
          unresolved_questions: 10,
          emotional_peak: 10,
          twist_impact: 10,
          anticipation: 10,
        },
        evidence: ['平淡结尾'],
      }),
      analyzeHookCliffhanger: vi.fn().mockReturnValue({
        chapters: [],
        averageHookScore: 20,
        averageCliffhangerScore: 10,
        weakChapters: [0],
        suggestions: ['补充章节边界张力'],
      }),
    }));
  }

  if (options.highBoundaryScores) {
    vi.doMock('../../narrative/writing-craft/hook-cliffhanger-scorer', () => ({
      scoreHook: vi.fn().mockReturnValue({
        overall: 80,
        dimensions: {
          conflict_hint: 80,
          info_gap: 80,
          sensory_impact: 80,
          pacing_entry: 80,
        },
        evidence: ['强开场'],
      }),
      scoreCliffhanger: vi.fn().mockReturnValue({
        overall: 85,
        dimensions: {
          unresolved_questions: 85,
          emotional_peak: 85,
          twist_impact: 85,
          anticipation: 85,
        },
        evidence: ['强结尾'],
      }),
      analyzeHookCliffhanger: vi.fn().mockReturnValue({
        chapters: [],
        averageHookScore: 80,
        averageCliffhangerScore: 85,
        weakChapters: [],
        suggestions: ['保持章节边界张力'],
      }),
    }));
  }

  if (options.zeroWebNovelScore) {
    vi.doMock('../../narrative/reader-satisfaction-analyzer', () => ({
      ReaderSatisfactionAnalyzer: class {
        detectUpgradePattern() {
          return [];
        }

        analyzeGoldenFinger() {
          return [];
        }

        analyzeWebNovelCurve() {
          return { curveData: [], suggestions: [] };
        }
      },
    }));
    vi.doMock('../../narrative/premise-validator', () => ({
      assessOutlineQuality: vi.fn().mockReturnValue({
        overallQualityScore: 0,
        qualityLevel: 'poor',
        actionableSuggestions: [],
      }),
    }));
  }

  if (options.voiceWarnings) {
    vi.doMock('../../narrative/character-voice-fingerprint', () => ({
      extractVoiceFingerprints: vi.fn().mockReturnValue({
        fingerprints: [
          {
            character: '林岚',
            dialogueCount: 2,
            sentenceLengthPreference: 6,
            catchphrases: [],
            formalityLevel: 0.2,
            emotionalExpressionTendency: 0.1,
            rhetoricalHabits: [],
            sampleDialogues: ['短句', '请您务必立刻把所有细节全部完整说明清楚'],
          },
        ],
        voiceDistinctness: 0.45,
        suggestions: ['角色声音需要进一步稳定'],
      }),
      checkVoiceConsistency: vi.fn((fingerprint, line: string) => {
        if (line.includes('务必')) {
          return {
            character: fingerprint.character,
            line,
            issue: '正式度偏离 80%',
            severity: 'high',
          };
        }
        return null;
      }),
    }));
  }

  return import('../../mcp/endpoints/writing-craft.js');
}

describe('writing craft branch-gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../narrative/writing-craft/hook-cliffhanger-scorer');
    vi.doUnmock('../../narrative/character-voice-fingerprint');
    vi.doUnmock('../../narrative/reader-satisfaction-analyzer');
    vi.doUnmock('../../narrative/premise-validator');
  });

  it('returns zero overall score when analyze endpoint receives an empty dimension list', async () => {
    const { writingCraftAnalyzeEndpoint } = await importEndpointsWithMocks();

    const response = await writingCraftAnalyzeEndpoint(
      makeRequest({ text: SAMPLE_TEXT, dimensions: [] }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response)).toMatchObject({
      overallScore: 0,
      dimensions: [],
      textLength: SAMPLE_TEXT.length,
    });
  });

  it('surfaces low hook and cliffhanger suggestions and allows zero-score webnovel output', async () => {
    const { writingCraftAnalyzeEndpoint } = await importEndpointsWithMocks({
      lowBoundaryScores: true,
      zeroWebNovelScore: true,
    });

    const response = await writingCraftAnalyzeEndpoint(
      makeRequest({ text: SAMPLE_TEXT, dimensions: ['hook', 'cliffhanger', 'webnovel'] }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.overallScore).toBe(1);
    expect(body.dimensions[0].suggestions).toContain(
      '开头钩子强度不足，建议在前 200 字内加入冲突或悬念',
    );
    expect(body.dimensions[1].suggestions).toContain(
      '结尾悬念不足，建议在末尾 200 字留下未解问题或情感高峰',
    );
    expect(body.dimensions[2]).toMatchObject({
      dimension: 'webnovel',
      score: 0,
      evidence: [],
      suggestions: [],
    });
  });

  it('omits low-score reminders when hook and cliffhanger scores are already strong', async () => {
    const { writingCraftAnalyzeEndpoint } = await importEndpointsWithMocks({
      highBoundaryScores: true,
    });

    const response = await writingCraftAnalyzeEndpoint(
      makeRequest({ text: SAMPLE_TEXT, dimensions: ['hook', 'cliffhanger'] }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.dimensions[0].suggestions).not.toContain(
      '开头钩子强度不足，建议在前 200 字内加入冲突或悬念',
    );
    expect(body.dimensions[1].suggestions).not.toContain(
      '结尾悬念不足，建议在末尾 200 字留下未解问题或情感高峰',
    );
  });

  it('treats missing voice text as required and collects mocked consistency warnings', async () => {
    const { writingCraftVoiceConsistencyEndpoint } = await importEndpointsWithMocks({
      voiceWarnings: true,
    });

    const emptyResponse = await writingCraftVoiceConsistencyEndpoint(makeRequest({}));
    expect(emptyResponse.statusCode).toBe(400);
    expect(getBody(emptyResponse).error).toBe('text is required');

    const response = await writingCraftVoiceConsistencyEndpoint(
      makeRequest({ text: '任意文本' }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response)).toMatchObject({
      fingerprints: expect.any(Array),
      voiceDistinctness: 0.45,
      suggestions: ['角色声音需要进一步稳定'],
    });
    expect(getBody(response).warnings).toEqual([
      {
        character: '林岚',
        line: '请您务必立刻把所有细节全部完整说明清楚',
        issue: '正式度偏离 80%',
        severity: 'high',
      },
    ]);
  });
});
