import { describe, expect, it } from 'vitest'

import * as cowritingBarrel from './cowriting'
import { CoWritingPanel } from './cowriting/CoWritingPanel'
import { CreativitySlider } from './cowriting/CreativitySlider'
import { GuidedOptions } from './cowriting/GuidedOptions'
import { InlineHints } from './cowriting/InlineHints'
import { MetadataBadge } from './cowriting/MetadataBadge'
import { ModeSwitcher } from './cowriting/ModeSwitcher'
import * as qualityBarrel from './quality'
import { QCDashboard } from './quality/QCDashboard'
import * as readerBarrel from './reader'
import { DetailPanel } from './reader/DetailPanel'
import { PersonaSelector } from './reader/PersonaSelector'
import { ReaderOverlay } from './reader/ReaderOverlay'
import { ReportGenerator } from './reader/ReportGenerator'
import * as storyBibleBarrel from './story-bible'
import { AutoExtractButton } from './story-bible/AutoExtractButton'
import {
  CompletenessIndicator,
  completenessColor,
  completenessTextColor,
} from './story-bible/CompletenessIndicator'
import {
  CharacterCard,
  CompletenessBadge,
  EntityCardDispatcher,
  PlotThreadCard,
  TimelineEventCard,
  WorldRuleCard,
  completenessColor as entityCardsCompletenessColor,
  completenessTextColor as entityCardsCompletenessTextColor,
  joinFromArray,
  splitToArray,
} from './story-bible/EntityCards'
import { StoryBiblePanel } from './story-bible/StoryBiblePanel'

describe('component barrels', () => {
  it('re-exports the cowriting module surface', () => {
    expect(cowritingBarrel.CoWritingPanel).toBe(CoWritingPanel)
    expect(cowritingBarrel.CreativitySlider).toBe(CreativitySlider)
    expect(cowritingBarrel.GuidedOptions).toBe(GuidedOptions)
    expect(cowritingBarrel.MetadataBadge).toBe(MetadataBadge)
    expect(cowritingBarrel.ModeSwitcher).toBe(ModeSwitcher)
    expect(cowritingBarrel.InlineHints).toBe(InlineHints)
  })

  it('re-exports the quality and reader module surface', () => {
    expect(qualityBarrel.QCDashboard).toBe(QCDashboard)
    expect(readerBarrel.ReaderOverlay).toBe(ReaderOverlay)
    expect(readerBarrel.PersonaSelector).toBe(PersonaSelector)
    expect(readerBarrel.DetailPanel).toBe(DetailPanel)
    expect(readerBarrel.ReportGenerator).toBe(ReportGenerator)
  })

  it('re-exports the story-bible module surface', () => {
    expect(storyBibleBarrel.StoryBiblePanel).toBe(StoryBiblePanel)
    expect(storyBibleBarrel.AutoExtractButton).toBe(AutoExtractButton)
    expect(storyBibleBarrel.CompletenessIndicator).toBe(CompletenessIndicator)
    expect(storyBibleBarrel.completenessColor).toBe(completenessColor)
    expect(storyBibleBarrel.completenessTextColor).toBe(completenessTextColor)
    expect(storyBibleBarrel.CharacterCard).toBe(CharacterCard)
    expect(storyBibleBarrel.WorldRuleCard).toBe(WorldRuleCard)
    expect(storyBibleBarrel.PlotThreadCard).toBe(PlotThreadCard)
    expect(storyBibleBarrel.TimelineEventCard).toBe(TimelineEventCard)
    expect(storyBibleBarrel.EntityCardDispatcher).toBe(EntityCardDispatcher)
    expect(storyBibleBarrel.EntityCompletenessBadge).toBe(CompletenessBadge)
    expect(storyBibleBarrel.entityCompletenessColor).toBe(entityCardsCompletenessColor)
    expect(storyBibleBarrel.entityCompletenessTextColor).toBe(entityCardsCompletenessTextColor)
    expect(storyBibleBarrel.entityCompletenessColor(0.2)).toBe('bg-red-500')
    expect(storyBibleBarrel.entityCompletenessColor(0.65)).toBe('bg-blue-500')
    expect(storyBibleBarrel.entityCompletenessTextColor(0.2)).toBe('text-red-400')
    expect(storyBibleBarrel.entityCompletenessTextColor(0.65)).toBe('text-blue-400')
    expect(storyBibleBarrel.completenessColor(0.2)).toBe('bg-red-500')
    expect(storyBibleBarrel.completenessTextColor(0.65)).toBe('text-blue-400')
    expect(storyBibleBarrel.splitToArray).toBe(splitToArray)
    expect(storyBibleBarrel.joinFromArray).toBe(joinFromArray)
  })
})
