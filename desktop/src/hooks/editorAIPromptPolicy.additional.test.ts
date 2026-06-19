import { describe, expect, it } from 'vitest'

import {
  buildEditorAIPayload,
  buildEditorAIStyleInstruction,
  getEditorActionInstruction,
  getEditorAIRewriteOptions,
  getEditorRewriteInstruction,
  normalizeEditorLanguage,
} from './editorAIPromptPolicy'

describe('editorAIPromptPolicy additional coverage', () => {
  it('normalizes languages and returns defensive rewrite option copies', () => {
    expect(normalizeEditorLanguage('en')).toBe('en')
    expect(normalizeEditorLanguage('fr')).toBe('zh')
    expect(normalizeEditorLanguage(null)).toBe('zh')

    const options = getEditorAIRewriteOptions()
    options[0].labelKey = 'editorBubbleSummarize'

    expect(getEditorAIRewriteOptions()[0]).toEqual({
      id: 'polish',
      labelKey: 'editorBubblePolish',
    })
  })

  it('returns localized action, rewrite, and style instructions', () => {
    expect(getEditorActionInstruction('en', 'full-article')).toContain('complete article')
    expect(getEditorActionInstruction('zh', 'generate')).toContain('生成')
    expect(getEditorRewriteInstruction('en', 'summarize')).toContain('key points')
    expect(getEditorRewriteInstruction('zh', 'casual')).toContain('口语化')
    expect(buildEditorAIStyleInstruction('en', '  terse and vivid  ')).toBe(
      'Style requirements: terse and vivid',
    )
    expect(buildEditorAIStyleInstruction('zh', '   ')).toBe('')
    expect(buildEditorAIStyleInstruction('zh', null)).toBe('')
  })

  it('builds all editor AI payload shapes with fenced data boundaries and story context', () => {
    expect(buildEditorAIPayload({
      request: { action: 'generate' },
      language: 'en',
      contextBefore: 'Scene setup',
    }).prompt).toContain('Document context:\n```text\nScene setup\n```')

    expect(buildEditorAIPayload({
      request: { action: 'full-article' },
      language: 'zh',
      contextBefore: '大纲',
    }).prompt).toContain('完整的文章')

    expect(buildEditorAIPayload({
      request: { action: 'continue' },
      language: 'en',
      contextBefore: 'The door opened.',
    }).prompt).toContain('Continue the following text')

    const rewrite = buildEditorAIPayload({
      request: { action: 'rewrite', variant: 'formal' },
      language: 'en',
      selectedText: 'make this sound serious',
      rawStyleRequirements: 'measured cadence',
      storyContext: {
        characters: 'Niko: pragmatic editor',
        plotThreads: 'Deadline pressure',
        worldview: 'Near-future studio',
        previousChapterSummary: 'Previously: the release gate failed.',
      },
    })

    expect(rewrite.styleInstruction).toBe('Style requirements: measured cadence')
    expect(rewrite.prompt).toContain('Rewrite requirement: Rewrite the selected text in a formal written style.')
    expect(rewrite.prompt).toContain('Original text:\n```text\nmake this sound serious\n```')
    expect(rewrite.prompt).toContain('Character Profiles\n```text\nNiko: pragmatic editor\n```')
    expect(rewrite.prompt).toContain('Plot Threads\n```text\nDeadline pressure\n```')
    expect(rewrite.prompt).toContain('Worldbuilding\n```text\nNear-future studio\n```')
    expect(rewrite.prompt).toContain('Previously: the release gate failed.')
    expect(rewrite.storyContext?.characters).toBe('Niko: pragmatic editor')
  })

  it('omits empty story context sections without changing the base prompt', () => {
    const withoutContext = buildEditorAIPayload({
      request: { action: 'continue' },
      language: 'zh',
      contextBefore: '第一段',
    })
    const withEmptyContext = buildEditorAIPayload({
      request: { action: 'continue' },
      language: 'zh',
      contextBefore: '第一段',
      storyContext: {},
    })

    expect(withEmptyContext.prompt).toBe(withoutContext.prompt)
    expect(withEmptyContext.storyContext).toEqual({})
  })
})
