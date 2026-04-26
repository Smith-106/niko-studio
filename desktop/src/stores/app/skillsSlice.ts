import { listSkills } from '@/api/client'

import type { AppSlice } from '../appStore'

export const DEFAULT_AVAILABLE_SKILLS = [
  'character-forge',
  'suspense-craft',
  'dialogue-system',
  'tension-arc',
  'opening-craft',
  'ending-craft',
  'emotion-arc',
  'conflict-escalation',
]

export interface SkillsSlice {
  availableSkills: string[]
  selectedSkills: string[]
  toggleSkill: (skill: string) => void
  refreshAvailableSkills: () => Promise<void>
}

export const createSkillsSlice: AppSlice<SkillsSlice> = (set) => ({
  availableSkills: DEFAULT_AVAILABLE_SKILLS,
  selectedSkills: [],
  toggleSkill: (skill) => {
    set((state) => ({
      selectedSkills: state.selectedSkills.includes(skill)
        ? state.selectedSkills.filter((selected) => selected !== skill)
        : [...state.selectedSkills, skill],
    }))
  },
  refreshAvailableSkills: async () => {
    try {
      const response = await listSkills()
      if (!response.success || !Array.isArray(response.data) || response.data.length === 0) {
        return
      }

      const nextSkills = response.data
        .map((skill) => (typeof skill?.id === 'string' && skill.id.trim() ? skill.id.trim() : ''))
        .filter(Boolean)

      if (nextSkills.length === 0) {
        return
      }

      set((state) => ({
        availableSkills: nextSkills,
        selectedSkills: state.selectedSkills.filter((skill) => nextSkills.includes(skill)),
      }))
    } catch {
      // Ignore dynamic fetch failures and keep the static fallback list.
    }
  },
})
