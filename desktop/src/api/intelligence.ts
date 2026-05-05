import { type ApiResponse, callApi } from './core'

export type AnalysisModule = 'character_arc' | 'pacing' | 'consistency' | 'readability'

const MODULE_PROMPTS: Record<AnalysisModule, string> = {
  character_arc:
    'Analyze the character development arc in the following text. Identify main characters, their motivations, growth trajectory, and any inconsistencies. Return structured JSON with characters array (name, arc_stage, motivation, consistency_score).',
  pacing:
    'Analyze the narrative pacing of the following text. Evaluate rhythm, tension curves, scene-to-scene transitions, and paragraph density. Return structured JSON with pacing_score (0-100), tension_points array, and recommendations.',
  consistency:
    'Check the following text for narrative consistency: timeline coherence, character behavior consistency, world-building contradictions, and plot logic. Return structured JSON with consistency_score (0-100), issues array (type, description, severity), and summary.',
  readability:
    'Analyze the readability of the following Chinese fiction text. Evaluate sentence length variation, paragraph structure, vocabulary diversity, and flow. Return structured JSON with readability_score (0-100), metrics (avg_sentence_length, vocab_diversity, paragraph_balance), and suggestions.',
}

export async function callAnalysisAgent(
  module: AnalysisModule,
  chapterContent: string,
  storyBibleContext?: string,
): Promise<ApiResponse<Record<string, unknown>>> {
  const prompt = MODULE_PROMPTS[module]

  return callApi('/agent/context', 'POST', {
    scene_info: {
      content: chapterContent.slice(0, 4000),
      analysis_type: module,
      prompt,
    },
    context_types: ['analysis'],
    story_bible: storyBibleContext ?? null,
  })
}
