export type TemplateCategory = 'structure' | 'genre' | 'format' | 'custom'

export interface TemplatePlaceholder {
  name: string
  label: string
  defaultValue: string
  type: 'text' | 'number' | 'select'
  options?: string[]
}

export interface Template {
  id: string
  title: string
  description: string
  category: TemplateCategory
  content: Record<string, unknown>
  placeholders: TemplatePlaceholder[]
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}
