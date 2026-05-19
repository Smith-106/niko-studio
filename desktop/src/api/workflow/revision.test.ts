import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

import {
  workflowRevisionAnalyze,
  workflowRevisionCompare,
  workflowRevisionHistory,
  workflowRevisionMarkRevised,
  workflowRevisionStartSession,
  workflowRevisionSuggest,
} from './revision'

describe('workflow revision api bridge', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    callApiMock.mockResolvedValue({ success: true, data: {} })
  })

  it('routes start-session requests through workflow bridge', async () => {
    await workflowRevisionStartSession('chapter-7', '章节正文')

    expect(callApiMock).toHaveBeenCalledWith('/workflow/revision/start-session', 'POST', {
      chapter_id: 'chapter-7',
      content: '章节正文',
    })
  })

  it('routes analyze and suggest requests with session identifiers', async () => {
    await workflowRevisionAnalyze('session-1', '修订后的正文')
    await workflowRevisionSuggest('session-1', ['weak-1', 'weak-2'])

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/workflow/revision/analyze', 'POST', {
      session_id: 'session-1',
      content: '修订后的正文',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/workflow/revision/suggest', 'POST', {
      session_id: 'session-1',
      weak_point_ids: ['weak-1', 'weak-2'],
    })
  })

  it('routes mark-revised, compare, and history requests', async () => {
    await workflowRevisionMarkRevised('session-1', '最终修订文本')
    await workflowRevisionCompare('session-1', '最终修订文本')
    await workflowRevisionHistory('chapter-7')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/workflow/revision/mark-revised', 'POST', {
      session_id: 'session-1',
      revised_text: '最终修订文本',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/workflow/revision/compare', 'POST', {
      session_id: 'session-1',
      revised_text: '最终修订文本',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(3, '/workflow/revision/history', 'POST', {
      chapter_id: 'chapter-7',
    })
  })
})
