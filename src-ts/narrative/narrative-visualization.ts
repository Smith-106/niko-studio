import { analyzeEmotionalArc } from './emotional-arc.js';
import type { TimelineReport } from './timeline-consistency-checker.js';
import type { CrossChapterCharacterReport } from './cross-chapter-character-tracker.js';

export interface NarrativeVisualizationChapterInput {
  content: string;
  chapterIndex: number;
  chapterNumber?: number;
  title?: string;
}

export interface NarrativeVisualizationTimelineEvent {
  id: string;
  label: string;
  chapterIndex: number;
  chapterNumber: number;
  type: 'turning_point' | 'conflict' | 'warning';
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
}

export interface NarrativeVisualizationTimelineData {
  chapters: Array<{
    chapterId: string;
    chapterIndex: number;
    chapterNumber: number;
    title: string;
    label: string;
    arcPosition: number;
    tension: number;
    eventCount: number;
  }>;
  events: NarrativeVisualizationTimelineEvent[];
  summary: string;
  empty: boolean;
}

export interface NarrativeVisualizationTensionPoint {
  chapterId: string;
  chapterIndex: number;
  chapterNumber: number;
  title: string;
  tension: number;
  engagement: number;
  dominantEmotion: string;
  label: string;
}

export interface NarrativeVisualizationTensionData {
  points: NarrativeVisualizationTensionPoint[];
  deserts: Array<{
    startChapter: number;
    endChapter: number;
    length: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  overallArcScore: number;
  summary: string;
  empty: boolean;
}

export interface NarrativeVisualizationCharacterData {
  nodes: Array<{
    id: string;
    name: string;
    role: string;
    importance: number;
    chapterCount: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
    label: string;
  }>;
  summary: string;
  empty: boolean;
}

export interface NarrativeVisualizationBundle {
  timeline: NarrativeVisualizationTimelineData;
  tension: NarrativeVisualizationTensionData;
  characterGraph: NarrativeVisualizationCharacterData;
  meta: {
    chapterCount: number;
    generatedAt: string;
    hasData: boolean;
    source: 'existing-analysis';
  };
}

function chapterLabel(index: number, chapterNumber?: number, title?: string): string {
  const numberLabel = chapterNumber ?? index + 1;
  return title?.trim() ? `Chapter ${numberLabel}: ${title.trim()}` : `Chapter ${numberLabel}`;
}

function normalizeChapterNumber(chapter: NarrativeVisualizationChapterInput): number {
  return chapter.chapterNumber ?? chapter.chapterIndex + 1;
}

function summarizeTimeline(report: TimelineReport, chapterCount: number): string {
  if (chapterCount === 0) return 'No chapter timeline data available.';
  if (report.totalConflicts === 0) return `Timeline covers ${chapterCount} chapters with no detected conflicts.`;
  return `Timeline covers ${chapterCount} chapters with ${report.totalConflicts} detected consistency issues.`;
}

function summarizeTension(pointCount: number, overallArcScore: number, dominantEmotion?: string): string {
  if (pointCount === 0) return 'No tension data available.';
  const emotion = dominantEmotion?.trim() ? dominantEmotion : 'neutral';
  return `Tension data spans ${pointCount} chapters. Overall arc score ${overallArcScore}. Dominant opening emotion: ${emotion}.`;
}

function summarizeCharacter(nodeCount: number, edgeCount: number): string {
  if (nodeCount === 0) return 'No character relationship data available.';
  return `Character graph includes ${nodeCount} characters and ${edgeCount} relationships.`;
}

export function buildNarrativeVisualizationBundle(input: {
  chapters: NarrativeVisualizationChapterInput[];
  timelineReport?: TimelineReport | null;
  characterReport?: CrossChapterCharacterReport | null;
  relationshipGraph?: {
    nodes?: Array<{ id: string; name: string; role?: string }>;
    edges?: Array<{ source: string; target: string; type?: string; trust?: number }>;
  } | null;
}): NarrativeVisualizationBundle {
  const chapters = input.chapters ?? [];
  const timelineReport = input.timelineReport ?? null;
  const characterReport = input.characterReport ?? null;
  const relationshipGraph = input.relationshipGraph ?? null;

  const emotionalArc = analyzeEmotionalArc(
    chapters.map((chapter) => ({
      content: chapter.content,
      chapterIndex: chapter.chapterIndex,
    })),
  );

  const chapterMap = chapters.map((chapter) => {
    const chapterNumber = normalizeChapterNumber(chapter);
    const point = emotionalArc.timeline.find((entry) => entry.chapterIndex === chapter.chapterIndex);
    return {
      chapterId: `chapter-${chapterNumber}`,
      chapterIndex: chapter.chapterIndex,
      chapterNumber,
      title: chapter.title?.trim() || `Chapter ${chapterNumber}`,
      label: chapterLabel(chapter.chapterIndex, chapterNumber, chapter.title),
      arcPosition: chapters.length > 1 ? chapter.chapterIndex / (chapters.length - 1) : 0,
      tension: point?.emotionalIntensity ?? 0,
      eventCount: timelineReport?.conflicts.filter((conflict) => conflict.chaptersInvolved.includes(chapterNumber)).length ?? 0,
    };
  });

  const timelineEvents: NarrativeVisualizationTimelineEvent[] = (timelineReport?.conflicts ?? []).map((conflict, index) => ({
    id: conflict.id || `timeline-conflict-${index + 1}`,
    label: conflict.type,
    chapterIndex: Math.max(0, (conflict.chaptersInvolved[0] ?? 1) - 1),
    chapterNumber: conflict.chaptersInvolved[0] ?? 1,
    type: conflict.severity === 'critical' || conflict.severity === 'major' ? 'conflict' : 'warning',
    severity: conflict.severity,
    description: conflict.description,
  }));

  const timeline: NarrativeVisualizationTimelineData = {
    chapters: chapterMap,
    events: timelineEvents,
    summary: summarizeTimeline(timelineReport ?? {
      totalConflicts: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      infoCount: 0,
      conflicts: [],
      chapterProfiles: [],
      globalTimeline: [],
      consistencyScore: 100,
      summary: '',
      analyzedAt: new Date().toISOString(),
    }, chapters.length),
    empty: chapterMap.length === 0,
  };

  const tensionPoints: NarrativeVisualizationTensionPoint[] = emotionalArc.timeline.map((point) => {
    const chapter = chapters.find((entry) => entry.chapterIndex === point.chapterIndex);
    const chapterNumber = chapter ? normalizeChapterNumber(chapter) : point.chapterIndex + 1;
    const label = chapterLabel(point.chapterIndex, chapterNumber, chapter?.title);
    return {
      chapterId: `chapter-${chapterNumber}`,
      chapterIndex: point.chapterIndex,
      chapterNumber,
      title: chapter?.title?.trim() || `Chapter ${chapterNumber}`,
      tension: point.emotionalIntensity,
      engagement: point.emotionScore / 10,
      dominantEmotion: point.dominantEmotion,
      label,
    };
  });

  const tension: NarrativeVisualizationTensionData = {
    points: tensionPoints,
    deserts: emotionalArc.tensionDeserts,
    overallArcScore: emotionalArc.overallArcScore,
    summary: summarizeTension(
      tensionPoints.length,
      emotionalArc.overallArcScore,
      tensionPoints[0]?.dominantEmotion,
    ),
    empty: tensionPoints.length === 0,
  };

  const chapterCounts = new Map<string, number>();
  for (const state of characterReport?.characterTimelines?.values?.() ?? []) {
    for (const entry of state) {
      chapterCounts.set(entry.characterName, (chapterCounts.get(entry.characterName) ?? 0) + (entry.present ? 1 : 0));
    }
  }

  const nodes = (relationshipGraph?.nodes ?? []).map((node) => ({
    id: node.id,
    name: node.name,
    role: node.role ?? 'character',
    importance: chapterCounts.get(node.name) ?? 1,
    chapterCount: chapterCounts.get(node.name) ?? 0,
  }));

  const edges = (relationshipGraph?.edges ?? []).map((edge) => ({
    source: edge.source,
    target: edge.target,
    type: edge.type ?? 'related',
    weight: edge.trust ?? 0.5,
    label: `${edge.source} -> ${edge.target}`,
  }));

  const characterGraph: NarrativeVisualizationCharacterData = {
    nodes,
    edges,
    summary: summarizeCharacter(nodes.length, edges.length),
    empty: nodes.length === 0,
  };

  return {
    timeline,
    tension,
    characterGraph,
    meta: {
      chapterCount: chapters.length,
      generatedAt: new Date().toISOString(),
      hasData: !(timeline.empty && tension.empty && characterGraph.empty),
      source: 'existing-analysis',
    },
  };
}
