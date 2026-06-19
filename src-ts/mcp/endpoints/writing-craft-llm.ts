/**
 * Writing Craft LLM-Enhanced Analysis Endpoint
 *
 * Provides LLM-powered deep analysis for writing craft dimensions.
 * Falls back to keyword-based results when no LLM config is provided.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import type { WritingCraftDimension, DimensionResult } from './writing-craft';

const DIMENSION_LABELS: Record<WritingCraftDimension, string> = {
  structure: '结构分析',
  character: '角色分析',
  suspense: '悬疑/叙事',
  emotion: '情感/描写',
  dialogue: '对话分析',
  webnovel: '网文专项',
  hook: '钩子分析',
  cliffhanger: '悬念分析',
  show_tell: '展示/叙述',
};

const DIMENSION_SYSTEM_PROMPT: Record<WritingCraftDimension, string> = {
  structure: `你是一位专业的叙事结构分析师。分析文本的结构质量，包括：三幕结构、Snyder节拍表、Truby22步、Edson序列对齐。评估结构完整性、转折点有效性、节奏控制。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
  character: `你是一位角色塑造专家。分析文本中的角色质量，包括：角色弧线、动机合理性、性格一致性、成长轨迹、角色间冲突。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
  suspense: `你是一位悬疑叙事专家。分析文本的悬疑/叙事技巧，包括：悬念设置、伏笔回收、信息控制、读者期待管理、反转合理性。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
  emotion: `你是一位情感描写专家。分析文本的情感表达质量，包括：Show vs Tell、情感层次、感官描写、比喻运用、情感节奏。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
  dialogue: `你是一位对话写作专家。分析文本的对话质量，包括：潜台词丰富度、角色声音区分、对话推动情节、冲突密度、信息量。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
  webnovel: `你是一位网文写作专家。分析文本的网文特质，包括：爽点设计、升级体系、金手指运用、节奏控制、读者留存、期待管理。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
  hook: `你是一位章节钩子分析专家。分析文本的章节开头质量，关注以下维度：冲突暗示（是否有冲突或对峙暗示）、信息悬念（是否制造信息差或秘密）、感官冲击（是否通过感官描写抓住注意力）、节奏切入（是否用转折或节奏变化开场）。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
  cliffhanger: `你是一位章节悬念分析专家。分析文本的章节结尾质量，关注以下维度：未解问题（是否留下悬而未决的问题）、情感高峰（是否在情绪高点断章）、反转冲击（是否有意料之外的转折）、期待感（是否让读者迫切想看下一章）。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
  show_tell: `你是一位展示(show)与叙述(tell)分析专家。分析文本中展示/叙述比例、五感描写覆盖、抽象/具体表达，并给出可执行的改写建议。返回JSON格式：{"score":0-10,"evidence":["证据1"],"suggestions":["建议1"],"analysis":"详细分析段落"}`,
};

void DIMENSION_LABELS;
void DIMENSION_SYSTEM_PROMPT;

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function resolveProviderConfig(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): ProviderConfig | null {
  // Prefer header-based API key transmission over body field
  const apiKey =
    headers?.['x-llm-api-key']?.trim()
    ?? headers?.['X-LLM-API-Key']?.trim()
    ?? (body.api_key as string | undefined)?.trim()
    ?? undefined;
  const baseUrl =
    headers?.['x-llm-base-url']?.trim()
    ?? headers?.['X-LLM-Base-Url']?.trim()
    ?? (body.base_url as string | undefined)?.trim()
    ?? undefined;
  const model = (body.model as string | undefined)?.trim() ?? undefined;

  if (!apiKey || !baseUrl || !model) return null;

  return { apiKey, baseUrl, model };
}

async function callLLM(config: ProviderConfig, prompt: string, systemPrompt: string): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const choices = data.choices as Array<{ message: { content: string } }>;
  return choices?.[0]?.message?.content ?? '';
}

function parseLLMResponse(raw: string): { score: number; evidence: string[]; suggestions: string[]; analysis: string } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { score: 0, evidence: [], suggestions: [], analysis: raw };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 0,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      analysis: typeof parsed.analysis === 'string' ? parsed.analysis : '',
    };
  } catch {
    return { score: 0, evidence: [], suggestions: [], analysis: raw };
  }
}

export async function writingCraftLLMEndpoint(
  request: HttpRequest,
): Promise<HttpResponse> {
  const body = parseBody(request) as {
    text?: string;
    dimension?: WritingCraftDimension;
    dimensions?: WritingCraftDimension[];
    api_key?: string;
    base_url?: string;
    model?: string;
  };

  const text = body.text ?? '';
  if (!text.trim()) {
    return jsonResponse({ success: false, error: 'text is required' }, 400);
  }

  const config = resolveProviderConfig(body as Record<string, unknown>, request.headers);
  if (!config) {
    return jsonResponse({ success: false, error: 'LLM config (api_key, base_url, model) is required' }, 400);
  }

  const dimensions: WritingCraftDimension[] = body.dimensions ?? (body.dimension ? [body.dimension] : ['structure', 'character', 'suspense', 'emotion', 'dialogue', 'webnovel']);

  const results: Array<DimensionResult & { analysis?: string }> = [];

  for (const dim of dimensions) {
    const systemPrompt = DIMENSION_SYSTEM_PROMPT[dim];
    const userPrompt = `请分析以下文本的${DIMENSION_LABELS[dim]}质量：\n\n${text.slice(0, 4000)}`;

    try {
      const raw = await callLLM(config, userPrompt, systemPrompt);
      const parsed = parseLLMResponse(raw);

      results.push({
        dimension: dim,
        label: DIMENSION_LABELS[dim],
        score: parsed.score,
        maxScore: 10,
        evidence: parsed.evidence,
        suggestions: parsed.suggestions,
        details: { analysis: parsed.analysis, source: 'llm' },
        analysis: parsed.analysis,
      });
    } catch (err) {
      results.push({
        dimension: dim,
        label: DIMENSION_LABELS[dim],
        score: 0,
        maxScore: 10,
        evidence: [],
        suggestions: [`LLM 分析失败: ${err instanceof Error ? err.message : 'Unknown error'}`],
        details: { error: true, source: 'llm' },
      });
    }
  }

  const overallScore = results.length > 0
    ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10
    : 0;

  return jsonResponse({
    success: true,
    data: {
      overallScore,
      dimensions: results,
      textLength: text.length,
      source: 'llm',
    },
  });
}
