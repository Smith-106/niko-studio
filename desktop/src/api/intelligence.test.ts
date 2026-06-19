import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import { callAnalysisAgent } from './intelligence'

describe('intelligence api bridge', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    callApiMock.mockResolvedValue({ success: true, data: { ok: true } })
  })

  it('builds the character arc payload with story bible context', async () => {
    await callAnalysisAgent('character_arc', '正文内容'.repeat(10), '故事圣经')

    expect(callApiMock).toHaveBeenCalledWith('/agent/context', 'POST', {
      scene_info: {
        content: '正文内容'.repeat(10),
        analysis_type: 'character_arc',
        prompt:
          'Analyze the character development arc in the following text. Identify main characters, their motivations, growth trajectory, and any inconsistencies. Return structured JSON with characters array (name, arc_stage, motivation, consistency_score).',
      },
      context_types: ['analysis'],
      story_bible: '故事圣经',
    })
  })

  it('truncates long content and uses null story bible context by default', async () => {
    await callAnalysisAgent('readability', 'a'.repeat(5005))

    expect(callApiMock).toHaveBeenCalledWith('/agent/context', 'POST', {
      scene_info: {
        content: 'a'.repeat(4000),
        analysis_type: 'readability',
        prompt:
          'Analyze the readability of the following Chinese fiction text. Evaluate sentence length variation, paragraph structure, vocabulary diversity, and flow. Return structured JSON with readability_score (0-100), metrics (avg_sentence_length, vocab_diversity, paragraph_balance), and suggestions.',
      },
      context_types: ['analysis'],
      story_bible: null,
    })
  })
})
