import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import type { Template, TemplateCategory } from '../types/template'
import { ALL_BUILTINS } from './templates/builtins'

const TEMPLATES_DIR = 'templates'

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true })
  }
}

function userTemplatePath(templateId: string): string {
  return `${TEMPLATES_DIR}/${templateId}.json`
}

export async function listTemplates(category?: TemplateCategory): Promise<Template[]> {
  const builtins = category
    ? ALL_BUILTINS.filter((t) => t.category === category)
    : ALL_BUILTINS

  const userTemplates = await loadUserTemplates()
  const filtered = category
    ? userTemplates.filter((t) => t.category === category)
    : userTemplates

  return [...builtins, ...filtered]
}

async function loadUserTemplates(): Promise<Template[]> {
  try {
    if (!(await exists(TEMPLATES_DIR))) return []
    const entries = await readDir(TEMPLATES_DIR)
    const templates: Template[] = []
    for (const entry of entries) {
      if (entry.name.endsWith('.json') && !entry.name.startsWith('.')) {
        try {
          const raw = await readTextFile(`${TEMPLATES_DIR}/${entry.name}`)
          templates.push(JSON.parse(raw) as Template)
        } catch {
          // skip corrupted files
        }
      }
    }
    return templates
  } catch {
    return []
  }
}

export async function getTemplate(id: string): Promise<Template | null> {
  const builtin = ALL_BUILTINS.find((t) => t.id === id)
  if (builtin) return builtin

  try {
    const raw = await readTextFile(userTemplatePath(id))
    return JSON.parse(raw) as Template
  } catch {
    return null
  }
}

export async function saveTemplate(template: Template): Promise<void> {
  await ensureDir(TEMPLATES_DIR)
  const now = new Date().toISOString()
  const toSave: Template = {
    ...template,
    isBuiltIn: false,
    updatedAt: now,
    createdAt: template.createdAt || now,
  }
  await writeTextFile(userTemplatePath(toSave.id), JSON.stringify(toSave, null, 2))
}

export async function deleteTemplate(id: string): Promise<void> {
  const path = userTemplatePath(id)
  if (await exists(path)) {
    await remove(path)
  }
}

export async function duplicateTemplate(id: string, newTitle: string): Promise<Template> {
  const source = await getTemplate(id)
  if (!source) throw new Error(`Template not found: ${id}`)

  const now = new Date().toISOString()
  const duplicate: Template = {
    ...source,
    id: crypto.randomUUID().slice(0, 8),
    title: newTitle,
    isBuiltIn: false,
    category: 'custom',
    createdAt: now,
    updatedAt: now,
  }

  await saveTemplate(duplicate)
  return duplicate
}

export function substitutePlaceholders(
  content: Record<string, unknown>,
  values: Record<string, string>,
): Record<string, unknown> {
  const json = JSON.stringify(content)
  const substituted = json.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return values[key] ?? match
  })
  return JSON.parse(substituted) as Record<string, unknown>
}

export function extractPlaceholders(content: Record<string, unknown>): string[] {
  const json = JSON.stringify(content)
  const matches = json.match(/\{\{(\w+)\}\}/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}
