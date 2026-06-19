import { describe, expect, it } from 'vitest'

import * as knowledgeGraphBarrel from '.'
import { KnowledgeGraphToolbar } from './KnowledgeGraphToolbar'
import { KnowledgeGraphView } from './KnowledgeGraphView'
import { useCytoscape } from './useCytoscape'

describe('knowledge-graph barrel', () => {
  it('re-exports the knowledge graph module surface', () => {
    expect(knowledgeGraphBarrel.KnowledgeGraphView).toBe(KnowledgeGraphView)
    expect(knowledgeGraphBarrel.KnowledgeGraphToolbar).toBe(KnowledgeGraphToolbar)
    expect(knowledgeGraphBarrel.useCytoscape).toBe(useCytoscape)
  })
})
