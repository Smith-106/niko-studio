import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

import {
  workflowRevisionAnalyze,
  workflowRevisionCompare,
  workflowRevisionGenerateSuggestions,
  workflowRevisionSuggest,
} from './revision'

describe('workflow revision api bridge additional coverage', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    callApiMock.mockResolvedValue({ success: true, data: {} })
  })

  it('drops blank optional payloads and routes generated suggestions through suggest endpoint', async () => {
    await workflowRevisionAnalyze('session-analyze', '   ', 'standard')
    await workflowRevisionSuggest('session-suggest', [], 'standard')
    await workflowRevisionGenerateSuggestions('session-generate', ['weak-7'], 'uiBridge')
    await workflowRevisionCompare('session-compare', '   ', 'standard')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/workflow/revision/analyze', 'POST', {
      session_id: 'session-analyze',
      content: undefined,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/workflow/revision/suggest', 'POST', {
      session_id: 'session-suggest',
      weak_point_ids: undefined,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(3, '/ui-bridge/workflow/revision/suggest', 'POST', {
      session_id: 'session-generate',
      weak_point_ids: ['weak-7'],
    })
    expect(callApiMock).toHaveBeenNthCalledWith(4, '/workflow/revision/compare', 'POST', {
      session_id: 'session-compare',
      revised_text: undefined,
    })
  })
})
