import type { LucideIcon } from 'lucide-react'

export type TabType = 'characters' | 'locations' | 'plots' | 'skills'

export type KnowledgeItem = Record<string, unknown>

export interface TabConfig {
  id: TabType
  label: string
  icon: LucideIcon
}

export interface FieldConfig {
  key: string
  label: string
  type: 'text' | 'textarea'
}

export interface OperationStatus {
  type: 'success' | 'error'
  message: string
}

export interface SkillMatch {
  skill_id: string
  relevance: number
}

export interface SkillChainItem {
  skill_id: string
  step: number
}
