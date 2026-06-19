import { describe, expect, it, vi } from 'vitest'

import { createSkillsSlice, DEFAULT_AVAILABLE_SKILLS, type SkillsSlice } from './skillsSlice'

vi.mock('@/api/client', () => ({
  listSkills: vi.fn(),
}))

type SetFn = Parameters<typeof createSkillsSlice>[0]

function createHarness() {
  let state: SkillsSlice = {
    availableSkills: DEFAULT_AVAILABLE_SKILLS,
    selectedSkills: [],
    toggleSkill: () => {},
    refreshAvailableSkills: async () => {},
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    state = { ...state, ...next }
  }
  const get = () => state

  const slice = createSkillsSlice(set as never, get as never, {} as never)
  state = { ...state, ...slice }

  return {
    getState: () => state,
    patchState: (partial: Partial<SkillsSlice> | ((current: SkillsSlice) => Partial<SkillsSlice>)) => {
      const next = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...next }
    },
  }
}

describe('skillsSlice additional coverage', () => {
  it('refreshAvailableSkills keeps fallback when listSkills returns { success: false }', async () => {
    const { listSkills } = await import('@/api/client')
    vi.mocked(listSkills).mockResolvedValue({ success: false })

    const store = createHarness()
    const before = store.getState().availableSkills.slice()

    await store.getState().refreshAvailableSkills()

    expect(store.getState().availableSkills).toEqual(before)
  })

  it('refreshAvailableSkills keeps fallback when listSkills returns empty skills array', async () => {
    const { listSkills } = await import('@/api/client')
    vi.mocked(listSkills).mockResolvedValue({
      success: true,
      data: { skills: [] },
    })

    const store = createHarness()
    const before = store.getState().availableSkills.slice()

    await store.getState().refreshAvailableSkills()

    expect(store.getState().availableSkills).toEqual(before)
  })

  it('refreshAvailableSkills filters out skills with non-string or whitespace-only ids', async () => {
    const { listSkills } = await import('@/api/client')
    vi.mocked(listSkills).mockResolvedValue({
      success: true,
      data: {
        skills: [
          { id: 'valid-skill', name: 'Valid' },
          { id: 42 as unknown as string, name: 'Numeric ID' },
          { id: '   ', name: 'Whitespace ID' },
          { id: null as unknown as string, name: 'Null ID' },
        ],
      },
    })

    const store = createHarness()
    await store.getState().refreshAvailableSkills()

    expect(store.getState().availableSkills).toEqual(['valid-skill'])
  })

  it('refreshAvailableSkills keeps fallback when listSkills throws', async () => {
    const { listSkills } = await import('@/api/client')
    vi.mocked(listSkills).mockRejectedValue(new Error('network failure'))

    const store = createHarness()
    const before = store.getState().availableSkills.slice()

    await store.getState().refreshAvailableSkills()

    expect(store.getState().availableSkills).toEqual(before)
  })

  it('toggleSkill with empty string adds then removes empty string', () => {
    const store = createHarness()
    store.getState().toggleSkill('')
    expect(store.getState().selectedSkills).toEqual([''])

    store.getState().toggleSkill('')
    expect(store.getState().selectedSkills).toEqual([])
  })

  it('double toggle adds then removes a skill', () => {
    const store = createHarness()
    store.getState().toggleSkill('emotion-arc')
    expect(store.getState().selectedSkills).toEqual(['emotion-arc'])

    store.getState().toggleSkill('emotion-arc')
    expect(store.getState().selectedSkills).toEqual([])
  })

  it('refreshAvailableSkills keeps fallback when all filtered skills result in empty nextSkills', async () => {
    const { listSkills } = await import('@/api/client')
    vi.mocked(listSkills).mockResolvedValue({
      success: true,
      data: {
        skills: [
          { id: '   ', name: 'Whitespace' },
          { id: null as unknown as string, name: 'Null' },
        ],
      },
    })

    const store = createHarness()
    const before = store.getState().availableSkills.slice()

    await store.getState().refreshAvailableSkills()

    expect(store.getState().availableSkills).toEqual(before)
  })
})
