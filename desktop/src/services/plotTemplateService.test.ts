import { describe, expect, it } from 'vitest'
import { PLOT_BUILTINS, threeActOutline, heroJourneyOutline, mysteryClueWeb, conflictEscalation } from './plotTemplateService'
import type { Template } from '../types/template'

describe('plotTemplateService', () => {
  it('exports a non-empty array of plot templates', () => {
    expect(PLOT_BUILTINS.length).toBeGreaterThan(0)
  })

  it('has exactly 4 plot builtins', () => {
    expect(PLOT_BUILTINS).toHaveLength(4)
  })

  it('each template has the correct id, title, and category', () => {
    const expected = [
      { id: 'builtin-plot-three-act', title: '三幕结构大纲' },
      { id: 'builtin-plot-hero-journey', title: '英雄之旅大纲' },
      { id: 'builtin-plot-mystery-clue', title: '悬疑线索网' },
      { id: 'builtin-plot-conflict-escalation', title: '冲突升级表' },
    ]

    for (const exp of expected) {
      const template = PLOT_BUILTINS.find((t) => t.id === exp.id)
      expect(template).toBeDefined()
      expect(template!.title).toBe(exp.title)
      expect(template!.category).toBe('plot')
    }
  })

  it('each template has a doc-structured content object', () => {
    for (const template of PLOT_BUILTINS) {
      expect(template.content).toBeDefined()
      expect(template.content).toHaveProperty('type', 'doc')
      expect(template.content).toHaveProperty('content')
      expect(Array.isArray(template.content.content)).toBe(true)
      expect(template.content.content.length).toBeGreaterThan(0)
    }
  })

  it('each template has an array of placeholders', () => {
    for (const template of PLOT_BUILTINS) {
      expect(Array.isArray(template.placeholders)).toBe(true)
      expect(template.placeholders.length).toBeGreaterThan(0)
    }
  })

  it('each placeholder has name, label, defaultValue, and type', () => {
    for (const template of PLOT_BUILTINS) {
      for (const ph of template.placeholders) {
        expect(ph).toHaveProperty('name')
        expect(ph).toHaveProperty('label')
        expect(ph).toHaveProperty('defaultValue')
        expect(ph).toHaveProperty('type')
        expect(typeof ph.name).toBe('string')
        expect(typeof ph.label).toBe('string')
        expect(ph.name.length).toBeGreaterThan(0)
        expect(ph.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('threeActOutline has the expected placeholders', () => {
    const names = threeActOutline.placeholders.map((p) => p.name)
    expect(names).toContain('story_title')
    expect(names).toContain('inciting_event')
    expect(names).toContain('central_conflict')
    expect(names).toContain('rising_action')
    expect(names).toContain('midpoint_turn')
    expect(names).toContain('darkest_moment')
    expect(names).toContain('climax')
    expect(names).toContain('resolution')
  })

  it('heroJourneyOutline has the expected placeholders', () => {
    const names = heroJourneyOutline.placeholders.map((p) => p.name)
    expect(names).toContain('story_title')
    expect(names).toContain('ordinary_world')
    expect(names).toContain('call_to_adventure')
    expect(names).toContain('crossing_threshold')
    expect(names).toContain('road_of_trials')
    expect(names).toContain('allies_and_enemies')
    expect(names).toContain('abyss_ordeal')
    expect(names).toContain('ultimate_boon')
    expect(names).toContain('refusal_to_return')
    expect(names).toContain('return_with_elixir')
  })

  it('all plot templates are marked as built-in', () => {
    for (const template of PLOT_BUILTINS) {
      expect(template.isBuiltIn).toBe(true)
    }
  })

  it('all plot templates have createdAt and updatedAt timestamps', () => {
    for (const template of PLOT_BUILTINS) {
      expect(template.createdAt).toEqual(expect.any(String))
      expect(template.updatedAt).toEqual(expect.any(String))
    }
  })

  it('individual exports match PLOT_BUILTINS array', () => {
    expect(PLOT_BUILTINS).toContain(threeActOutline)
    expect(PLOT_BUILTINS).toContain(heroJourneyOutline)
    expect(PLOT_BUILTINS).toContain(mysteryClueWeb)
    expect(PLOT_BUILTINS).toContain(conflictEscalation)
  })
})
