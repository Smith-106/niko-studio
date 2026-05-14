/**
 * Insight Distiller — CAP-003 component
 *
 * 6-stage marginalia pipeline: capture → annotate → connect → question → synthesize → distill.
 * Progressive refinement of reading insights.
 */

import type { DistilledInsight, Insight } from './learning-types';

export function distillInsights(rawInsights: Insight[]): DistilledInsight[] {
  const results: DistilledInsight[] = [];

  for (const insight of rawInsights) {
    // Stage 1: Capture — raw insight
    results.push({
      stage: 'capture',
      content: insight.content,
      metadata: { source: insight.source, tags: insight.tags, confidence: insight.confidence },
    });

    // Stage 2: Annotate — add contextual markers
    const annotations = annotate(insight);
    results.push({
      stage: 'annotate',
      content: annotations,
      metadata: { source: insight.source, originalLength: insight.content.length },
    });

    // Stage 3: Connect — relate to existing knowledge
    const connections = connect(insight);
    results.push({
      stage: 'connect',
      content: connections,
      metadata: { source: insight.source, connectionCount: connections.split('；').length },
    });

    // Stage 4: Question — generate follow-up questions
    const questions = question(insight);
    results.push({
      stage: 'question',
      content: questions,
      metadata: { source: insight.source },
    });

    // Stage 5: Synthesize — merge annotations + connections
    const synthesis = synthesize(annotations, connections);
    results.push({
      stage: 'synthesize',
      content: synthesis,
      metadata: { source: insight.source, insightLength: insight.content.length },
    });

    // Stage 6: Distill — final condensed insight
    const distilled = distill(synthesis);
    results.push({
      stage: 'distill',
      content: distilled,
      metadata: { source: insight.source, confidence: insight.confidence },
    });
  }

  return results;
}

function annotate(insight: Insight): string {
  const tags = insight.tags.join('、');
  return `[${tags}] ${insight.content}`;
}

function connect(insight: Insight): string {
  if (insight.chapter) {
    return `${insight.content}（见于第${insight.chapter}章）`;
  }
  return `${insight.content}（来源：${insight.source}）`;
}

function question(insight: Insight): string {
  return `→ 此处值得思考：${insight.content}`;
}

function synthesize(annotations: string, connections: string): string {
  return `${annotations}\n关联：${connections}`;
}

function distill(synthesis: string): string {
  // Take the first line as the core distilled insight
  const firstLine = synthesis.split('\n')[0] ?? synthesis;
  return firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine;
}
