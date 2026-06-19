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

describe('skillsSlice', () => {
  it('defaults availableSkills to DEFAULT_AVAILABLE_SKILLS', () => {
    const store = createHarness()
    expect(store.getState().availableSkills).toEqual(DEFAULT_AVAILABLE_SKILLS)
  })

  it('starts with empty selectedSkills', () => {
    const store = createHarness()
    expect(store.getState().selectedSkills).toEqual([])
  })

  it('toggleSkill adds a skill to selectedSkills', () => {
    const store = createHarness()
    store.getState().toggleSkill('character-forge')
    expect(store.getState().selectedSkills).toEqual(['character-forge'])
  })

  it('toggleSkill removes an existing skill from selectedSkills', () => {
    const store = createHarness()
    store.getState().toggleSkill('character-forge')
    store.getState().toggleSkill('suspense-craft')
    expect(store.getState().selectedSkills).toEqual(['character-forge', 'suspense-craft'])

    store.getState().toggleSkill('character-forge')
    expect(store.getState().selectedSkills).toEqual(['suspense-craft'])
  })

  it('refreshAvailableSkills populates availableSkills on successful listSkills response', async () => {
    const { listSkills } = await import('@/api/client')
    vi.mocked(listSkills).mockResolvedValue({
      success: true,
      data: {
        skills: [
          { id: 'skill-a', name: 'Skill A' },
          { id: 'skill-b', name: 'Skill B' },
        ],
      },
    })

    const store = createHarness()
    store.patchState({ selectedSkills: ['skill-a', 'skill-c'] })

    await store.getState().refreshAvailableSkills()

    expect(store.getState().availableSkills).toEqual(['skill-a', 'skill-b'])
    expect(store.getState().selectedSkills).toEqual(['skill-a'])
  })
})
