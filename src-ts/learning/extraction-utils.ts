/**
 * Extraction Utilities — Stateless helpers for all learning pipelines
 *
 * Document parsing, text segmentation, entity extraction, style feature
 * calculation, and worldview element detection. All functions are pure.
 */

import {
  type EntityExtraction,
  EntityType,
  type StyleFeatureVector,
  type WorldviewElement,
  WorldviewCategory,
  type Insight,
} from './learning-types';

// ============================================================
// Document Parsing
// ============================================================

export function parseDocument(raw: string, format: string): string {
  switch (format.toLowerCase()) {
    case 'txt':
    case 'md':
      return stripMarkdownFrontmatter(raw);
    case 'pdf':
    case 'docx':
      // PDF/DOCX parsing requires external libraries (pdf-parse, mammoth).
      // At runtime these are loaded dynamically. For now return the raw text
      // which the caller is expected to pre-extract.
      return raw;
    default:
      return raw;
  }
}

function stripMarkdownFrontmatter(text: string): string {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('---', 3);
  if (end === -1) return text;
  return text.slice(end + 3).trim();
}

// ============================================================
// Text Segmentation
// ============================================================

export interface Segment {
  index: number;
  content: string;
  label?: string;
}

export function segmentText(text: string, mode: 'paragraph' | 'chapter'): Segment[] {
  if (mode === 'chapter') return segmentByChapter(text);
  return segmentByParagraph(text);
}

function segmentByParagraph(text: string): Segment[] {
  const blocks = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  return blocks.map((content, index) => ({ index, content }));
}

function segmentByChapter(text: string): Segment[] {
  // Match common chapter heading patterns (Chinese + English)
  const chapterRe = /^(第[零一二三四五六七八九十百千万\d]+[章节回]|Chapter\s+\d+|CHAPTER\s+\d+|.+\n={3,}|.+\n-{3,})/gm;
  const splits: number[] = [0];
  let match: RegExpExecArray | null;
  while ((match = chapterRe.exec(text)) !== null) {
    if (match.index > 0) splits.push(match.index);
  }
  splits.sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < splits.length; i++) {
    const start = splits[i];
    const end = i + 1 < splits.length ? splits[i + 1] : text.length;
    const content = text.slice(start, end).trim();
    if (content) {
      segments.push({ index: segments.length, content });
    }
  }
  if (segments.length === 0 && text.trim()) {
    segments.push({ index: 0, content: text.trim() });
  }
  return segments;
}

// ============================================================
// Entity Extraction
// ============================================================

const CJK_NAME_RE = /^[一-鿿·]{2,8}$/;
const DIALOGUE_RE = /[""「」『』""](.*?)[""「」『』""]/g;

export function extractEntities(text: string): EntityExtraction[] {
  const entities = new Map<string, { type: EntityType; mentions: number; contexts: string[] }>();

  // Extract names from dialogue attribution patterns
  const patterns = [
    /[""「」『』""''].*?[""「」『』""'']\s*([^\s，。！？,!?]{2,8})[说道想喊叫问答笑哭叹]/g,
    /([^\s，。！？,!?]{2,8})[说道想喊叫问答笑哭叹]\s*[:：]\s*[""「」『』""'']/g,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const name = m[1].trim();
      if (CJK_NAME_RE.test(name)) {
        const existing = entities.get(name);
        if (existing) {
          existing.mentions++;
        } else {
          entities.set(name, { type: EntityType.CHARACTER, mentions: 1, contexts: [] });
        }
      }
    }
  }

  // Extract location-like nouns after prepositions
  const locationRe = /[在到去往来从](.{2,10}?)[，。！？,\.\s]/g;
  let lm: RegExpExecArray | null;
  while ((lm = locationRe.exec(text)) !== null) {
    const loc = lm[1].trim();
    if (loc.length >= 2 && loc.length <= 10) {
      const existing = entities.get(loc);
      if (existing) {
        existing.mentions++;
      } else {
        entities.set(loc, { type: EntityType.LOCATION, mentions: 1, contexts: [] });
      }
    }
  }

  const results: EntityExtraction[] = [];
  for (const [name, info] of entities) {
    if (info.mentions < 2) continue;
    results.push({
      name,
      type: info.type,
      confidence: Math.min(0.5 + info.mentions * 0.1, 0.95),
      attributes: {},
      mentions: info.mentions,
    });
  }
  return results.sort((a, b) => b.mentions - a.mentions);
}

// ============================================================
// Style Feature Calculation
// ============================================================

const SENTENCE_END = /[.!?。！？]+/g;
const DIALOGUE_MARKERS = /[""「」『』""'']/g;
const CJK_CHAR = /[一-鿿㐀-䶿]/g;
const WHITESPACE = /\s+/;

function countWords(text: string): number {
  const cjk = text.match(CJK_CHAR);
  const latin = text.replace(CJK_CHAR, ' ').trim().split(WHITESPACE).filter(Boolean);
  return (cjk?.length ?? 0) + latin.length;
}

function countUniqueWords(text: string): number {
  const normalized = text.toLowerCase().replace(/[^\w一-鿿㐀-䶿]/g, ' ');
  return new Set(normalized.split(WHITESPACE).filter(Boolean)).size;
}

function splitSentences(text: string): string[] {
  return text.split(SENTENCE_END).map(s => s.trim()).filter(Boolean);
}

export function calculateStyleFeatures(text: string): StyleFeatureVector {
  const words = countWords(text);
  const uniqueWords = countUniqueWords(text);
  const sentences = splitSentences(text);
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  const dialogueCount = (text.match(DIALOGUE_MARKERS) ?? []).length / 2;

  // Lexical
  const vocabulary_richness = words > 0 ? uniqueWords / words : 0;
  const avg_word_length = words > 0 ? text.replace(/\s/g, '').length / words : 0;
  const rare_word_ratio = 0; // requires external word frequency data

  // Syntactic
  const avg_sentence_length = sentences.length > 0 ? words / sentences.length : 0;
  const sentence_complexity = avg_sentence_length > 30 ? 0.8 : avg_sentence_length > 15 ? 0.5 : 0.2;

  // Rhythmic
  const avg_paragraph_length = paragraphs.length > 0 ? words / paragraphs.length : 0;

  // Tone — heuristic
  const lower = text.toLowerCase();
  const emotionalWords = (lower.match(/\b(love|hate|joy|anger|fear|sad|happiness)\b|[爱恨喜怒哀乐忧愁欢乐激动]/g) ?? []).length;
  const emotional_valence = words > 0 ? emotionalWords / words : 0;

  // Narrative
  const dialogue_ratio = words > 0 ? dialogueCount / sentences.length : 0;

  const dimensions: Record<string, number> = {
    vocabulary_richness: clamp(vocabulary_richness),
    avg_word_length: clamp(avg_word_length / 10),
    rare_word_ratio: clamp(rare_word_ratio),
    technical_density: 0,
    colloquial_ratio: 0,
    avg_sentence_length: clamp(avg_sentence_length / 50),
    sentence_complexity: clamp(sentence_complexity),
    clause_ratio: 0,
    passive_ratio: 0,
    interrogative_ratio: clamp((text.match(/[?？]/g) ?? []).length / Math.max(sentences.length, 1)),
    metaphor_density: 0,
    parallelism_freq: 0,
    rhetorical_question: 0,
    hyperbole_level: 0,
    personification: 0,
    avg_paragraph_length: clamp(avg_paragraph_length / 200),
    punctuation_rhythm: 0,
    pause_pattern: 0,
    sentence_variation: 0,
    dialogue_pacing: 0,
    formality_level: 0.5,
    emotional_valence: clamp(emotional_valence),
    subjectivity: 0,
    certainty_level: 0,
    intimacy_level: 0,
    pov_consistency: 0,
    tense_distribution: 0,
    dialogue_ratio: clamp(dialogue_ratio),
    description_density: 0,
    showing_vs_telling: 0,
  };

  return {
    dimensions,
    summary: `${words} words, ${sentences.length} sentences, ${paragraphs.length} paragraphs`,
    confidence: Math.min(words / 500, 0.95),
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ============================================================
// Worldview Element Detection
// ============================================================

const WORLDVIEW_PATTERNS: Array<{ re: RegExp; category: WorldviewCategory }> = [
  { re: /(魔法|法术|咒语|灵力|仙力|真气|内力|魔力|异能|超能力|魔法系统)/g, category: WorldviewCategory.MAGIC_SYSTEM },
  { re: /(王朝|帝国|联邦|共和国|王国|城邦|氏族|宗门|门派|朝廷)/g, category: WorldviewCategory.SOCIAL_STRUCTURE },
  { re: /(科技|机械|蒸汽|电力|网络|AI|人工智能|飞船|星舰|传送门)/g, category: WorldviewCategory.TECHNOLOGY },
  { re: /(大陆|世界|星球|位面|领域|秘境|仙境|魔界|天界|地府|冥界)/g, category: WorldviewCategory.SETTING },
  { re: /(禁忌|法则|规则|律法|戒律|天规|法则|秩序)/g, category: WorldviewCategory.RULE },
  { re: /(习俗|传统|节日|仪式|祭祀|婚礼|葬礼|成年礼|信仰|宗教|神殿)/g, category: WorldviewCategory.CULTURE },
];

export function detectWorldviewElements(text: string): WorldviewElement[] {
  const elements: WorldviewElement[] = [];

  for (const { re, category } of WORLDVIEW_PATTERNS) {
    re.lastIndex = 0;
    const matches = text.matchAll(re);
    const seen = new Map<string, string[]>();

    for (const m of matches) {
      const keyword = m[1];
      const existing = seen.get(keyword);
      if (existing) {
        const start = Math.max(m.index - 20, 0);
        const end = Math.min(m.index + m[0].length + 20, text.length);
        existing.push(text.slice(start, end));
      } else {
        const start = Math.max(m.index - 20, 0);
        const end = Math.min(m.index + m[0].length + 20, text.length);
        seen.set(keyword, [text.slice(start, end)]);
      }
    }

    for (const [keyword, evidence] of seen) {
      elements.push({
        name: keyword,
        category,
        description: `${category} element detected: ${keyword}`,
        evidence: evidence.slice(0, 3),
        confidence: Math.min(0.5 + evidence.length * 0.1, 0.9),
      });
    }
  }

  return elements;
}

// ============================================================
// Insight Extraction
// ============================================================

export function extractBasicInsights(
  text: string,
  source: string,
  chapter?: string,
): Insight[] {
  const insights: Insight[] = [];
  const sentences = splitSentences(text);

  // Extract sentences with strong sentiment or insight markers
  const insightMarkers = /[总而言之|换句话说|也就是说|关键是|值得注意的是|核心在于|本质上|归根结底]/;

  for (const s of sentences) {
    if (insightMarkers.test(s) && s.length >= 10) {
      insights.push({
        content: s,
        source,
        tags: ['auto-extracted'],
        confidence: 0.6,
        chapter,
      });
    }
  }

  return insights;
}
