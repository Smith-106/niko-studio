import { describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import {
  writingCraftAnalyzeEndpoint,
  writingCraftEmotionalArcEndpoint,
  writingCraftPacingNavigatorEndpoint,
  writingCraftReaderImmersionEndpoint,
  writingCraftVoiceConsistencyEndpoint,
} from '../../mcp/endpoints/writing-craft.js';

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
  '门外骤然灌进一阵冷风，信纸边缘轻轻颤动，像某种不祥的预告。',
].join('\n');

const CHAPTERS = [
  { chapterIndex: 1, content: '秘密还没有揭开，但她已经听见门外急促的脚步声。' },
  { chapterIndex: 2, content: '他猛地转身，掌心发冷，心跳一下下撞在肋骨上。' },
  { chapterIndex: 3, content: '真相逼近时，所有人都沉默了，只剩呼吸在黑暗里回响。' },
];

describe('writing craft additional coverage', () => {
  it('covers show_tell and unknown dimensions in analyze endpoint', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      makeRequest({
        text: SAMPLE_TEXT,
        dimensions: ['show_tell', 'unknown_dimension'],
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.dimensions).toHaveLength(2);
    expect(body.dimensions[0]).toMatchObject({
      dimension: 'show_tell',
      maxScore: 10,
    });
    expect(body.dimensions[0].details).toHaveProperty('showTellRatio');
    expect(body.dimensions[0].details).toHaveProperty('heatMap');
    expect(body.dimensions[1]).toMatchObject({
      dimension: 'unknown_dimension',
      score: 0,
      evidence: [],
      suggestions: [],
      details: {},
    });
  });

  it('returns validation errors and success payloads for emotional arc endpoint', async () => {
    const emptyResponse = await writingCraftEmotionalArcEndpoint(makeRequest({}));
    expect(emptyResponse.statusCode).toBe(400);
    expect(getBody(emptyResponse).error).toBe('chapters are required');

    const successResponse = await writingCraftEmotionalArcEndpoint(
      makeRequest({ chapters: CHAPTERS }),
    );
    expect(successResponse.statusCode).toBe(200);
    expect(getBody(successResponse)).toMatchObject({
      timeline: expect.any(Array),
      tensionDeserts: expect.any(Array),
      curveMatches: expect.any(Array),
      overallArcScore: expect.any(Number),
      suggestions: expect.any(Array),
    });
    expect(getBody(successResponse).timeline).toHaveLength(CHAPTERS.length);
  });

  it('returns validation errors and structured output for voice consistency endpoint', async () => {
    const emptyResponse = await writingCraftVoiceConsistencyEndpoint(makeRequest({ text: '   ' }));
    expect(emptyResponse.statusCode).toBe(400);
    expect(getBody(emptyResponse).error).toBe('text is required');

    const successResponse = await writingCraftVoiceConsistencyEndpoint(
      makeRequest({
        text: [
          '“你最好现在就说清楚。”林岚盯着他，声音很轻。',
          '“我、我已经说过了！”老陈猛地后退半步。',
          '“那你为什么发抖？”林岚抬起下巴。',
        ].join('\n'),
      }),
    );

    expect(successResponse.statusCode).toBe(200);
    expect(getBody(successResponse)).toMatchObject({
      fingerprints: expect.any(Array),
      voiceDistinctness: expect.any(Number),
      warnings: expect.any(Array),
      suggestions: expect.any(Array),
    });
  });

  it('returns validation errors and success payloads for reader immersion endpoint', async () => {
    const emptyResponse = await writingCraftReaderImmersionEndpoint(makeRequest({}));
    expect(emptyResponse.statusCode).toBe(400);
    expect(getBody(emptyResponse).error).toBe('chapters are required');

    const successResponse = await writingCraftReaderImmersionEndpoint(
      makeRequest({ chapters: CHAPTERS }),
    );
    expect(successResponse.statusCode).toBe(200);
    expect(getBody(successResponse)).toMatchObject({
      chapterStates: expect.any(Array),
      averageImmersion: expect.any(Number),
      averageDropoutRisk: expect.any(Number),
      highRiskChapters: expect.any(Array),
      trajectory: expect.any(String),
      suggestions: expect.any(Array),
    });
  });

  it('returns validation errors and success payloads for pacing navigator endpoint', async () => {
    const emptyResponse = await writingCraftPacingNavigatorEndpoint(makeRequest({}));
    expect(emptyResponse.statusCode).toBe(400);
    expect(getBody(emptyResponse).error).toBe('chapters are required');

    const successResponse = await writingCraftPacingNavigatorEndpoint(
      makeRequest({ chapters: CHAPTERS }),
    );
    expect(successResponse.statusCode).toBe(200);
    expect(getBody(successResponse)).toMatchObject({
      prescriptions: expect.any(Array),
      pacingScore: expect.any(Number),
      rhythmAnalysis: expect.anything(),
      emotionalArc: expect.anything(),
      suggestions: expect.any(Array),
    });
  });
});
