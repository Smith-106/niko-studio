/**
 * Analysis REST Endpoints
 *
 * Pattern detection and session clustering endpoints.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { graphQuery } from '../services/graph';
import { graphGetRelationships } from '../services/graph';
import {
  buildNarrativeVisualizationBundle,
  type NarrativeVisualizationChapterInput,
} from '../../narrative/narrative-visualization.js';
import {
  runConsistencyCheck,
  type ConsistencyCheckRequest,
} from './critic.js';

export async function analysisPatternsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const category = body.category as string | undefined;
  const categoryFilter = category ? ` AND n.category = '${category.replace(/'/g, "''")}'` : '';

  const rawEntities = await graphQuery(
    `MATCH (n) WHERE (n.type IN ['Scene', 'Chapter', 'Event'] OR labels(n)[0] IN ['Scene', 'Chapter', 'Event'])${categoryFilter} RETURN n.id as id, n.name as name, coalesce(n.observations, []) as observations`
  );

  const entities = (Array.isArray(rawEntities) ? rawEntities : []) as Array<Record<string, unknown>>;
  const patterns = analyzePatterns(entities, category);
  return jsonResponse(patterns);
}

export async function analysisSessionsEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  return jsonResponse([]);
}

export async function analysisNarrativeVisualizationEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Omit<ConsistencyCheckRequest, 'chapters'> & {
    chapters?: Array<{ content?: string; chapterIndex?: number; chapterNumber?: number; title?: string }>;
    chapterMeta?: Array<{ chapterNumber?: number; title?: string }>;
    relationshipRoot?: string;
  };

  const chaptersInput = Array.isArray(body.chapters) ? body.chapters : [];
  const chapterMeta = Array.isArray(body.chapterMeta) ? body.chapterMeta : [];

  const normalizedChapters: NarrativeVisualizationChapterInput[] = chaptersInput.map((chapter, index) => ({
    content: String(chapter.content ?? ''),
    chapterIndex: Number(chapter.chapterIndex ?? index),
    chapterNumber: Number(chapter.chapterNumber ?? chapterMeta[index]?.chapterNumber ?? index + 1),
    title: String(chapter.title ?? chapterMeta[index]?.title ?? `Chapter ${index + 1}`),
  }));

  if (normalizedChapters.length === 0) {
    return jsonResponse(buildNarrativeVisualizationBundle({ chapters: [] }));
  }

  const consistencyResult = await runConsistencyCheck({
    ...body,
    chapters: normalizedChapters.map((chapter) => chapter.content),
    chapterMeta: normalizedChapters.map((chapter) => ({
      chapterNumber: chapter.chapterNumber ?? chapter.chapterIndex + 1,
      title: chapter.title ?? `Chapter ${chapter.chapterIndex + 1}`,
    })),
  });

  const relationshipRoot = String(body.relationshipRoot ?? '').trim();
  const relationshipData = await graphGetRelationships(relationshipRoot, null, 2);
  const nodeSet = new Map<string, { id: string; name: string; role: string }>();
  const edges = (Array.isArray(relationshipData) ? relationshipData : []).map((relationship) => {
    const entry = relationship as Record<string, unknown>;
    const source = String(entry.from ?? entry.source ?? '');
    const target = String(entry.to ?? entry.target ?? '');
    if (source && !nodeSet.has(source)) nodeSet.set(source, { id: source, name: source, role: 'character' });
    if (target && !nodeSet.has(target)) nodeSet.set(target, { id: target, name: target, role: 'character' });
    return {
      source,
      target,
      type: String(entry.type ?? entry.relation_type ?? 'related'),
      trust: Number(entry.trust ?? entry.weight ?? 0.5),
    };
  });

  const bundle = buildNarrativeVisualizationBundle({
    chapters: normalizedChapters,
    timelineReport: consistencyResult.timeline,
    characterReport: consistencyResult.character,
    relationshipGraph: {
      nodes: [...nodeSet.values()],
      edges,
    },
  });

  return jsonResponse(bundle);
}

interface PatternTemplate {
  name: string
  category: string
  keywords: string[]
  minOccurrences: number
}

const TEMPLATES: PatternTemplate[] = [
  { name: 'three-act-rise', category: 'structure', keywords: ['开端', '发展', '高潮', '结局', 'setup', 'climax', 'resolution'], minOccurrences: 3 },
  { name: 'foreshadow-payoff', category: 'structure', keywords: ['伏笔', '回收', '铺垫', '呼应', 'foreshadow', 'payoff'], minOccurrences: 3 },
  { name: 'character-arc', category: 'character', keywords: ['转变', '成长', '觉醒', 'redemption', 'growth', 'arc'], minOccurrences: 2 },
  { name: 'foil-pair', category: 'character', keywords: ['对比', '镜像', '反衬', 'foil', 'mirror', 'contrast'], minOccurrences: 2 },
  { name: 'recurring-motif', category: 'theme', keywords: ['象征', '意象', '主题', 'motif', 'symbol', 'theme'], minOccurrences: 3 },
  { name: 'tension-curve', category: 'pacing', keywords: ['紧张', '冲突', '悬念', 'tension', 'conflict', 'suspense'], minOccurrences: 3 },
];

function analyzePatterns(
  entities: Array<Record<string, unknown>>,
  categoryFilter?: string | null,
): Array<Record<string, unknown>> {
  const templates = categoryFilter
    ? TEMPLATES.filter((t) => t.category === categoryFilter)
    : TEMPLATES;

  const results: Array<Record<string, unknown>> = [];

  for (const template of templates) {
    const occurrences: Array<Record<string, unknown>> = [];

    for (const entity of entities) {
      const text = [
        String(entity.name ?? ''),
        ...(Array.isArray(entity.observations) ? entity.observations.map(String) : []),
      ].join(' ').toLowerCase();

      let matched = 0;
      const contexts: string[] = [];
      for (const kw of template.keywords) {
        if (text.includes(kw.toLowerCase())) {
          matched++;
          const idx = text.indexOf(kw.toLowerCase());
          contexts.push(text.slice(Math.max(0, idx - 20), idx + kw.length + 20));
        }
      }

      if (matched > 0) {
        occurrences.push({
          entityId: String(entity.id ?? ''),
          entityName: String(entity.name ?? ''),
          confidence: Math.min(1, matched / Math.max(template.keywords.length * 0.3, 1)),
          context: contexts.join(' | '),
        });
      }
    }

    if (occurrences.length >= template.minOccurrences) {
      const avgConf = occurrences.reduce((s, o) => s + (o.confidence as number), 0) / occurrences.length;
      results.push({
        id: `pattern-${template.name}-${Date.now()}`,
        name: template.name,
        category: template.category,
        occurrences,
        confidence: Math.round(avgConf * 1000) / 1000,
        avgSimilarity: 0.85,
      });
    }
  }

  return results.sort((a, b) => (b.confidence as number) - (a.confidence as number));
}
