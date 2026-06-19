import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import {
  qcGetCreativityConfig,
  qcValidateOutput,
  sbCreateEntity,
  sbDeleteEntity,
  sbExtractFromManuscript,
  sbGetCompleteness,
  sbGetEntities,
  sbGetEntity,
  sbUpdateEntity,
} from './story-bible'

describe('story-bible api', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    callApiMock.mockResolvedValue({ success: true, data: {} })
  })

  it('lists entities with and without type filters', async () => {
    await sbGetEntities('novel-1')
    await sbGetEntities('novel-1', 'character')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/story-bible/entities/list', 'POST', {
      novelId: 'novel-1',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/story-bible/entities/list', 'POST', {
      novelId: 'novel-1',
      type: 'character',
    })
  })

  it('reads and mutates single entities through the expected endpoints', async () => {
    const payload = {
      novelId: 'novel-1',
      name: 'Atlas',
      type: 'character' as const,
      archetype: 'hero',
    }

    await sbGetEntity('entity-1')
    await sbCreateEntity(payload)
    await sbUpdateEntity('entity-1', { name: 'Atlas Prime' })
    await sbDeleteEntity('entity-1')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/story-bible/entity/entity-1', 'GET')
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/story-bible/entities', 'POST', payload)
    expect(callApiMock).toHaveBeenNthCalledWith(3, '/story-bible/entity/entity-1', 'PUT', {
      name: 'Atlas Prime',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(4, '/story-bible/entity/entity-1', 'DELETE')
  })

  it('requests extraction and completeness reports for a manuscript', async () => {
    await sbExtractFromManuscript('novel-2')
    await sbGetCompleteness('novel-2')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/story-bible/extract', 'POST', {
      novelId: 'novel-2',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/story-bible/completeness', 'POST', {
      novelId: 'novel-2',
    })
  })

  it('validates QC payloads with optional creativity config', async () => {
    const creativityConfig = {
      value: 0.72,
      preset: 'balanced' as const,
      modeDefault: 0.5,
      constraints: {
        maxSentenceLength: 32,
        minVocabularyDiversity: 0.3,
        maxMetaphorDensity: 0.4,
        allowNonlinearStructure: true,
        allowUnreliableNarrator: false,
      },
    }

    await qcValidateOutput('chapter text', 'rewrite')
    await qcValidateOutput('chapter text', 'rewrite', creativityConfig)

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/qc/validate', 'POST', {
      text: 'chapter text',
      mode: 'rewrite',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/qc/validate', 'POST', {
      text: 'chapter text',
      mode: 'rewrite',
      creativityConfig,
    })
  })

  it('builds creativity-config requests with optional preset and custom value', async () => {
    await qcGetCreativityConfig('polish')
    await qcGetCreativityConfig('polish', 'creative', 0.91)

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/qc/creativity-config', 'POST', {
      mode: 'polish',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/qc/creativity-config', 'POST', {
      mode: 'polish',
      preset: 'creative',
      customValue: 0.91,
    })
  })
})
