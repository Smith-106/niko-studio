import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { createLogger } from '../../logger/index.js';
import { getContainer } from '../../container/ServiceContainer.js';

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

function detectTimelineIssues(chapters: ChapterInput[]) {
  const issues: Array<{ event1: string; event2: string; chapter1: number; chapter2: number; description: string }> = [];

  const timeExpressions: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /(\d{1,4})年/g, label: 'year' },
    { pattern: /([春夏秋冬][天季])/g, label: 'season' },
    { pattern: /(昨天|今天|明天|前天|后天|大前天|大后天)/g, label: 'relative_day' },
    { pattern: /(上午|下午|傍晚|深夜|凌晨|中午|黄昏|黎明)/g, label: 'time_of_day' },
  ];

  const chapterTimelines = chapters.map(ch => {
    const events: Array<{ text: string; type: string }> = [];
    for (const { pattern, label } of timeExpressions) {
      for (const match of ch.content.matchAll(pattern)) {
        events.push({ text: match[0], type: label });
      }
    }
    return { chapter: ch.chapterNumber, events };
  });

  const dayExpr = /(昨天|今天|明天|前天|后天)/g;
  const chapterRelDays = chapters.map(ch => {
    const refs: string[] = [];
    for (const match of ch.content.matchAll(dayExpr)) refs.push(match[0]);
    return { chapter: ch.chapterNumber, refs };
  });

  for (let i = 0; i < chapterRelDays.length; i++) {
    const cur = chapterRelDays[i];
    if (cur.refs.length === 0) continue;
    for (let j = i + 1; j < chapterRelDays.length; j++) {
      const later = chapterRelDays[j];
      const same = cur.refs.filter(r => later.refs.includes(r));
      if (same.length > 0 && same.length >= Math.max(cur.refs.length, later.refs.length) * 0.5) {
        issues.push({
          event1: same.join(', '), event2: same.join(', '),
          chapter1: cur.chapter, chapter2: later.chapter,
          description: `Same relative time references (${same.join(', ')}) in chapters ${cur.chapter} and ${later.chapter} may indicate timeline inconsistency.`,
        });
      }
    }
  }

  for (let i = 0; i < chapterTimelines.length; i++) {
    const ct = chapterTimelines[i];
    const yearEvents = ct.events.filter(e => e.type === 'year');
    for (let j = i + 1; j < chapterTimelines.length; j++) {
      const lt = chapterTimelines[j];
      const laterYears = lt.events.filter(e => e.type === 'year');
      if (yearEvents.length > 0 && laterYears.length > 0) {
        const fy = parseInt(yearEvents[0].text, 10);
        const ly = parseInt(laterYears[laterYears.length - 1].text, 10);
        if (!isNaN(fy) && !isNaN(ly) && fy > ly) {
          issues.push({
            event1: yearEvents[0].text, event2: laterYears[laterYears.length - 1].text,
            chapter1: ct.chapter, chapter2: lt.chapter,
            description: `Timeline regression: "${yearEvents[0].text}" in ch.${ct.chapter} is later than "${laterYears[laterYears.length - 1].text}" in ch.${lt.chapter}.`,
          });
        }
      }
    }
  }

  return issues;
}

function normalizeCharacterName(raw: string): string {
  if (raw.length > 2) {
    const lastChar = raw[raw.length - 1];
    const actionChars = '说想看走笑问答喊叫点摇皱叹握拉推拍抱瞪扭抬低转站坐躺冲跑飞道';
    if (actionChars.includes(lastChar)) return raw.slice(0, -1);
  }
  return raw;
}

function detectTraitDrifts(chapters: ChapterInput[]) {
  const drifts: Array<{ character: string; trait: string; chapter1: number; chapter2: number; description: string }> = [];

  const traitWords: Array<{ trait: string; word: string; opposite: string }> = [
    { trait: 'personality', word: '冷酷', opposite: '温柔' },
    { trait: 'personality', word: '温柔', opposite: '冷酷' },
    { trait: 'personality', word: '善良', opposite: '凶恶' },
    { trait: 'personality', word: '凶恶', opposite: '善良' },
    { trait: 'personality', word: '勇敢', opposite: '怯懦' },
    { trait: 'personality', word: '怯懦', opposite: '勇敢' },
    { trait: 'personality', word: '暴躁', opposite: '沉稳' },
    { trait: 'personality', word: '沉稳', opposite: '暴躁' },
    { trait: 'personality', word: '开朗', opposite: '沉默' },
    { trait: 'personality', word: '沉默', opposite: '开朗' },
    { trait: 'appearance', word: '高大', opposite: '矮小' },
    { trait: 'appearance', word: '矮小', opposite: '高大' },
    { trait: 'appearance', word: '苗条', opposite: '肥胖' },
    { trait: 'appearance', word: '肥胖', opposite: '苗条' },
    { trait: 'speech', word: '轻声', opposite: '大喊' },
    { trait: 'speech', word: '大喊', opposite: '轻声' },
    { trait: 'speech', word: '激动', opposite: '平静' },
    { trait: 'speech', word: '平静', opposite: '激动' },
    { trait: 'speech', word: '冷漠', opposite: '温和' },
    { trait: 'speech', word: '温和', opposite: '冷漠' },
  ];

  const charTraits = new Map<string, Map<number, string[]>>();

  for (const ch of chapters) {
    const mentions = extractCharacterMentions(ch.content);
    for (const [rawName] of mentions) {
      const name = normalizeCharacterName(rawName);
      if (name.length < 2) continue;
      if (!charTraits.has(name)) charTraits.set(name, new Map());
      const byChapter = charTraits.get(name)!;
      if (!byChapter.has(ch.chapterNumber)) byChapter.set(ch.chapterNumber, []);
      for (const { word } of traitWords) {
        if (ch.content.includes(word)) byChapter.get(ch.chapterNumber)!.push(word);
      }
    }
  }

  for (const [name, byChapter] of charTraits) {
    const nums = [...byChapter.keys()].sort((a, b) => a - b);
    if (nums.length < 2) continue;
    for (let i = 0; i < nums.length - 1; i++) {
      const t1 = byChapter.get(nums[i])!, t2 = byChapter.get(nums[i + 1])!;
      if (t1.length === 0 || t2.length === 0) continue;
      for (const a of t1) {
        for (const b of t2) {
          const entry = traitWords.find(tw => tw.word === a);
          if (entry && entry.opposite === b) {
            drifts.push({
              character: name, trait: entry.trait,
              chapter1: nums[i], chapter2: nums[i + 1],
              description: `${name}: "${a}" in ch.${nums[i]} shifts to "${b}" in ch.${nums[i + 1]} without development arc.`,
            });
          }
        }
      }
    }
  }

  return drifts;
}

async function enrichWithGraphData(
  chapters: ChapterInput[],
  report: {
    nameConflicts: Array<{ character: string }>;
    traitDrifts: Array<{ character: string }>;
  },
): Promise<{ graphEnriched: boolean; graphEntities: number }> {
  try {
    const container = getContainer();
    const graph = container.graph;
    if (!graph) return { graphEnriched: false, graphEntities: 0 };

    let entityCount = 0;
    const allCharacters = new Set<string>();
    for (const nc of report.nameConflicts) {
      for (const part of nc.character.split(' / ')) {
        allCharacters.add(part);
      }
    }
    for (const td of report.traitDrifts) {
      allCharacters.add(td.character);
    }

    for (const name of allCharacters) {
      try {
        const node = await graph.getNode(name);
        if (node) entityCount++;
      } catch {
        // graph lookup failed for this name, skip
      }
    }

    return { graphEnriched: entityCount > 0, graphEntities: entityCount };
  } catch {
    return { graphEnriched: false, graphEntities: 0 };
  }
}

export async function crossChapterConsistencyEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const chapters = (body.chapters as ChapterInput[]) ?? [];

  if (chapters.length === 0) {
    return jsonResponse({ error: 'chapters array is required' }, 400);
  }

  log.info(`Cross-chapter consistency: ${chapters.length} chapters`);
  const nameConflicts = detectNameConflicts(chapters);
  const timelineIssues = detectTimelineIssues(chapters);
  const unresolvedThreads = detectUnresolvedThreads(chapters);
  const traitDrifts = detectTraitDrifts(chapters);
  const issueCount = nameConflicts.length + timelineIssues.length + unresolvedThreads.length + traitDrifts.length;
  const maxIssues = Math.max(chapters.length * 2, 1);
  const overallScore = Math.max(0, Math.round((1 - issueCount / maxIssues) * 100) / 10);

  const graphInfo = await enrichWithGraphData(chapters, { nameConflicts, traitDrifts });

  return jsonResponse({
    overallScore,
    nameConflicts,
    timelineIssues,
    unresolvedThreads,
    traitDrifts,
    chaptersChecked: chapters.length,
    graphEnriched: graphInfo.graphEnriched,
    graphEntities: graphInfo.graphEntities,
  });
}

export async function contextAwareSuggestionsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const text = body.text as string ?? '';

  if (!text.trim()) {
    return jsonResponse({ error: 'text is required' }, 400);
  }

  log.info(`Context-aware suggestions: text_len=${text.length}`);

  let context = '';
  const suggestions: string[] = [];

  try {
    const container = getContainer();
    const search = container.search;
    if (search) {
      const results = await search.search(text, { limit: 3 });
      if (results.length > 0) {
        context = results.map((r) => r.content ?? String(r)).join('\n');
        suggestions.push(`Found ${results.length} related passages from search index`);
      }
    }
  } catch {
    // search unavailable, return empty
  }

  return jsonResponse({ context, suggestions });
}
