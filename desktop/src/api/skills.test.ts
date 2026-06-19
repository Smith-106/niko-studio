import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import {
  createSkill,
  deleteSkill,
  getSkillChain,
  listSkills,
  loadSkill,
  matchSkills,
  saveSkill,
} from './skills'

describe('skills api', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('lists skills with and without category filters', async () => {
    callApiMock.mockResolvedValue({ success: true, data: [] })

    await listSkills()
    await listSkills('writing')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/skills/list', 'GET')
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/skills/list?category=writing', 'GET')
  })

  it('loads, creates, saves, and deletes skills through their endpoints', async () => {
    callApiMock.mockResolvedValue({ success: true, data: {} })

    await loadSkill('skill-1')
    await createSkill('Outline Coach', 'content')
    await saveSkill('skill-1', 'updated')
    await deleteSkill('skill-1')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/skills/load', 'POST', {
      skill_id: 'skill-1',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/skills/create', 'POST', {
      name: 'Outline Coach',
      content: 'content',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(3, '/skills/save', 'POST', {
      skill_id: 'skill-1',
      content: 'updated',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(4, '/skills/delete', 'POST', {
      skill_id: 'skill-1',
    })
  })

  it('matches skills and fetches skill chains with task payloads', async () => {
    callApiMock.mockResolvedValue({ success: true, data: [] })

    await matchSkills('revision', ['pacing', 'clarity'], 'chapter drifts')
    await getSkillChain('revision')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/skills/match', 'POST', {
      task_type: 'revision',
      keywords: ['pacing', 'clarity'],
      issue: 'chapter drifts',
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/skills/chain', 'POST', {
      task_type: 'revision',
    })
  })
})
