import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { createLogger } from '../../logger/index.js';

const log = createLogger('m10-style');

const SENTENCE_ENDINGS = /[.!?。！？；；…]+/g;
const DIALOGUE_MARKERS = /[""「」『』""'']/g;
const PARAGRAPH_BREAK = /\n\s*\n/;

function splitSentences(text: string): string[] {
  return text.split(SENTENCE_ENDINGS).map(s => s.trim()).filter(s => s.length > 0);
}

function countWords(text: string): number {
  const cjk = text.match(/\p{Script=Han}/gu);
  const latin = text.replace(/\p{Script=Han}/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return (cjk?.length ?? 0) + latin.length;
}

function countUniqueWords(text: string): number {
  const normalized = text.normalize('NFKC').toLowerCase().replace(/[^\w\p{Script=Han}]/gu, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  return new Set(words).size;
}

function countDialogueSentences(text: string): number {
  const sentences = splitSentences(text);
  let count = 0;
  for (const s of sentences) {
    if (DIALOGUE_MARKERS.test(s)) count++;
    DIALOGUE_MARKERS.lastIndex = 0;
  }
  return count;
}

function detectTense(text: string): 'past' | 'present' | 'mixed' {
  const lower = text.toLowerCase();
  const pastCount = (lower.match(/\b(was|were|had|did|went|came|said|thought|felt)\b/g) ?? []).length;
  const presentCount = (lower.match(/\b(is|are|has|does|goes|comes|says|thinks|feels)\b/g) ?? []).length;
  if (pastCount > presentCount * 2) return 'past';
  if (presentCount > pastCount * 2) return 'present';
  return 'mixed';
}

function detectPOV(text: string): 'first' | 'third' | 'mixed' {
  const lower = text.toLowerCase();
  const firstCount = (lower.match(/\b(i|me|my|mine|myself|we|us|our|ours)\b/g) ?? []).length;
  const thirdCount = (lower.match(/\b(he|him|his|she|her|hers|they|them|their|it|its)\b/g) ?? []).length;
  if (firstCount > thirdCount * 2) return 'first';
  if (thirdCount > firstCount * 2) return 'third';
  return 'mixed';
}

function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 16);
}

function extractStyle(text: string): Record<string, unknown> {
  const sentences = splitSentences(text);
  const paragraphs = text.split(PARAGRAPH_BREAK).filter(p => p.trim().length > 0);
  const totalWords = countWords(text);
  const uniqueWords = countUniqueWords(text);
  const dialogueSentences = countDialogueSentences(text);

  const sentenceLengths = sentences.map(s => countWords(s));
  const avgSentenceLength = sentenceLengths.length > 0
    ? Math.round((sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length) * 10) / 10
    : 0;

  const buckets = 5;
  const maxLen = Math.max(...sentenceLengths, 1);
  const distribution = new Array(buckets).fill(0);
  for (const len of sentenceLengths) {
    const bucket = Math.min(Math.floor((len / maxLen) * buckets), buckets - 1);
    distribution[bucket]++;
  }

  return {
    avgSentenceLength,
    vocabRichness: Math.round((uniqueWords / totalWords) * 1000) / 1000,
    dialogueRatio: sentences.length > 0 ? Math.round((dialogueSentences / sentences.length) * 1000) / 1000 : 0,
    tensePreference: detectTense(text),
    avgParagraphLength:
      Math.round((paragraphs.reduce((a, p) => a + countWords(p), 0) / paragraphs.length) * 10) / 10,
    sentenceLengthDistribution: distribution,
    dominantPOV: detectPOV(text),
    sampleHash: hashContent(text),
    extractedAt: new Date().toISOString(),
  };
}

export async function styleExtractEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const text = body.text as string ?? '';

  if (!text.trim()) {
    return jsonResponse({ error: 'text is required' }, 400);
  }

  log.info(`Style extraction: text_len=${text.length}`);
  const profile = extractStyle(text);
  return jsonResponse(profile);
}

export async function styleProfileEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const projectId = request.params?.projectId ?? '';
  if (!projectId) {
    return jsonResponse({ error: 'projectId is required' }, 400);
  }
  log.info(`Style profile lookup: project=${projectId}`);
  return jsonResponse(null);
}

export async function styleApplyEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const text = body.text as string ?? '';
  const styleProfile = body.style_profile as Record<string, unknown> ?? {};

  if (!text.trim()) {
    return jsonResponse({ error: 'text is required' }, 400);
  }

  const guidance = [
    'Target style parameters:',
    `- Average sentence length: ${styleProfile.avgSentenceLength ?? 'N/A'} words`,
    `- Vocabulary richness: ${((styleProfile.vocabRichness as number ?? 0) * 100).toFixed(1)}%`,
    `- Dialogue ratio: ${((styleProfile.dialogueRatio as number ?? 0) * 100).toFixed(1)}%`,
    `- Tense: ${styleProfile.tensePreference ?? 'mixed'}`,
    `- POV: ${styleProfile.dominantPOV ?? 'mixed'}`,
    '',
    'Match these parameters when generating or revising text.',
  ].join('\n');

  return jsonResponse({ context: guidance });
}
