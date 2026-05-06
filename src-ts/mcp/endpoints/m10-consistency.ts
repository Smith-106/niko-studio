import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { createLogger } from '../../logger/index.js';

const log = createLogger('m10-consistency');

interface ChapterInput {
  chapterNumber: number;
  title: string;
  content: string;
}

function extractCharacterMentions(content: string): Map<string, Set<string>> {
  const mentions = new Map<string, Set<string>>();
  const namePattern = /[一-鿿]{2,4}(?=说|道|想|看|走|笑|问|答|喊|叫|点|摇|皱|叹|握|拉|推|拍|抱|瞪|扭|抬|低|转|站|坐|躺|冲|跑|飞)/g;
  for (const match of content.matchAll(namePattern)) {
    const name = match[0];
    const existing = mentions.get(name) ?? new Set();
    existing.add(content.substring(Math.max(0, match.index! - 20), match.index! + 20));
    mentions.set(name, existing);
  }
  const englishNames = content.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g);
  if (englishNames) {
    const common = new Set(['The', 'This', 'That', 'Then', 'There', 'When', 'What', 'Where', 'Which', 'Who', 'How', 'But', 'And', 'Not', 'His', 'Her', 'She', 'They', 'Their', 'Our', 'Your', 'My']);
    for (const name of englishNames) {
      if (!common.has(name)) {
        const existing = mentions.get(name) ?? new Set();
        existing.add(`english: ${name}`);
        mentions.set(name, existing);
      }
    }
  }
  return mentions;
}

function findSimilarNames(names: string[]): Map<string, string[]> {
  const similar = new Map<string, string[]>();
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      if (a.length >= 2 && b.length >= 2 && a.length <= 4 && b.length <= 4 && a !== b) {
        const shared = [...a].filter(c => b.includes(c)).length;
        if (shared / Math.max(a.length, b.length) >= 0.6) {
          const existing = similar.get(a) ?? [];
          if (!existing.includes(b)) existing.push(b);
          similar.set(a, existing);
        }
      }
    }
  }
  return similar;
}

function detectNameConflicts(chapters: ChapterInput[]) {
  const conflicts: Array<{ character: string; chapter1: number; chapter2: number; description: string }> = [];
  const chapterNames = chapters.map(ch => ({ chapter: ch.chapterNumber, names: extractCharacterMentions(ch.content) }));
  const allNames = new Set<string>();
  for (const cn of chapterNames) for (const name of cn.names.keys()) allNames.add(name);

  const similar = findSimilarNames([...allNames]);
  for (const [name, aliases] of similar) {
    for (const alias of aliases) {
      const chA = chapterNames.filter(cn => cn.names.has(name)).map(cn => cn.chapter);
      const chB = chapterNames.filter(cn => cn.names.has(alias)).map(cn => cn.chapter);
      if (chA.length > 0 && chB.length > 0) {
        conflicts.push({
          character: `${name} / ${alias}`,
          chapter1: chA[0], chapter2: chB[0],
          description: `Possible name inconsistency: "${name}" in chapters ${chA.join(', ')} and "${alias}" in chapters ${chB.join(', ')}`,
        });
      }
    }
  }
  return conflicts;
}

function detectUnresolvedThreads(chapters: ChapterInput[]) {
  const threads: Array<{ thread: string; lastMentioned: number; description: string }> = [];
  const introPatterns = [/(\S{2,10})的?秘密/g, /(\S{2,10})的?真相/g, /(\S{2,10})之谜/g, /谜底/g];
  const resolutionPatterns = [/原来|真相(?:是|为)|秘密(?:是|为)|谜底(?:是|揭开)/g];
  const introduced = new Map<string, number>();
  const resolved = new Set<string>();

  for (const ch of chapters) {
    for (const pattern of introPatterns) {
      for (const match of ch.content.matchAll(pattern)) {
        const key = match[0].substring(0, 20);
        if (!introduced.has(key)) introduced.set(key, ch.chapterNumber);
      }
    }
    for (const pattern of resolutionPatterns) {
      for (const match of ch.content.matchAll(pattern)) resolved.add(match[0]);
    }
  }
  for (const [thread, chapter] of introduced) {
    if (!resolved.has(thread)) {
      threads.push({ thread, lastMentioned: chapter, description: `"${thread}" introduced in chapter ${chapter} but not resolved` });
    }
  }
  return threads;
}

export async function crossChapterConsistencyEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const chapters = (body.chapters as ChapterInput[]) ?? [];

  if (chapters.length === 0) {
    return jsonResponse({ success: false, error: 'chapters array is required' }, 400);
  }

  log.info(`Cross-chapter consistency: ${chapters.length} chapters`);
  const nameConflicts = detectNameConflicts(chapters);
  const unresolvedThreads = detectUnresolvedThreads(chapters);
  const issueCount = nameConflicts.length + unresolvedThreads.length;
  const maxIssues = Math.max(chapters.length * 2, 1);
  const overallScore = Math.max(0, Math.round((1 - issueCount / maxIssues) * 100) / 10);

  return jsonResponse({
    success: true,
    data: {
      overallScore,
      nameConflicts,
      timelineIssues: [],
      unresolvedThreads,
      traitDrifts: [],
      chaptersChecked: chapters.length,
    },
  });
}

export async function contextAwareSuggestionsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const text = body.text as string ?? '';

  if (!text.trim()) {
    return jsonResponse({ success: false, error: 'text is required' }, 400);
  }

  log.info(`Context-aware suggestions: text_len=${text.length}`);
  return jsonResponse({
    success: true,
    data: { context: '', suggestions: [] },
  });
}
