import { describe, expect, it } from 'vitest'

import NarrativeVisualizationPanelDefault, {
  NarrativeVisualizationPanel,
} from './NarrativeVisualizationPanel'
import { NarrativeVisualizationPanel as NarrativeVisualizationPanelContent } from './narrative-visualization/NarrativeVisualizationPanelContent'

describe('NarrativeVisualizationPanel barrel', () => {
  it('re-exports the narrative visualization panel as both named and default exports', () => {
    expect(NarrativeVisualizationPanel).toBe(NarrativeVisualizationPanelContent)
    expect(NarrativeVisualizationPanelDefault).toBe(NarrativeVisualizationPanelContent)
  })
})
