import { describe, expect, it } from 'vitest'

import { buildSuggestionActionTemplate } from './suggestionUtils'

describe('suggestionUtils additional coverage', () => {
  it('covers the remaining english action templates', () => {
    expect(buildSuggestionActionTemplate('conflict', false)).toContain('opposing goals')
    expect(buildSuggestionActionTemplate('pacing', false)).toContain('meaningful action sooner')
    expect(buildSuggestionActionTemplate('logic', false)).toContain('cause-and-effect chain')
    expect(buildSuggestionActionTemplate('character', false)).toContain('character wants and fears')
    expect(buildSuggestionActionTemplate('dialogue', false)).toContain('Differentiate each speaker')
    expect(buildSuggestionActionTemplate('detail', false)).toContain('concrete scene details')
  })

  it('covers the remaining chinese action templates', () => {
    expect(buildSuggestionActionTemplate('character', true)).toContain('角色')
    expect(buildSuggestionActionTemplate('dialogue', true)).toContain('对白')
    expect(buildSuggestionActionTemplate('detail', true)).toContain('细节')
    expect(buildSuggestionActionTemplate('style', true)).toContain('语气')
  })
})
