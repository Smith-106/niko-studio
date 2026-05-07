import type { WritingCraftDimension } from '../api/writing-craft';

export interface AnalysisTemplate {
  id: string;
  name: string;
  dimensions: WritingCraftDimension[];
  weights: Record<WritingCraftDimension, number>;
  builtin?: boolean;
}

const STORAGE_KEY = 'niko-writing-analysis-templates';

const ALL_DIMS: WritingCraftDimension[] = ['structure', 'character', 'suspense', 'emotion', 'dialogue', 'webnovel'];

export const BUILTIN_TEMPLATES: AnalysisTemplate[] = [
  {
    id: 'full-analysis',
    name: '全面分析',
    dimensions: ALL_DIMS,
    weights: { structure: 1, character: 1, suspense: 1, emotion: 1, dialogue: 1, webnovel: 1 },
    builtin: true,
  },
  {
    id: 'quick-check',
    name: '快速检查',
    dimensions: ['structure', 'character', 'emotion'],
    weights: { structure: 2, character: 1, emotion: 1, suspense: 0, dialogue: 0, webnovel: 0 },
    builtin: true,
  },
  {
    id: 'webnovel-focus',
    name: '网文专用',
    dimensions: ['webnovel', 'structure', 'suspense', 'character'],
    weights: { structure: 1, character: 1, suspense: 1, emotion: 0, dialogue: 0, webnovel: 2 },
    builtin: true,
  },
];

export function loadTemplates(): AnalysisTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const custom: AnalysisTemplate[] = stored ? JSON.parse(stored) : [];
    return [...BUILTIN_TEMPLATES, ...custom];
  } catch {
    return [...BUILTIN_TEMPLATES];
  }
}

export function saveTemplate(template: Omit<AnalysisTemplate, 'id'>): AnalysisTemplate {
  const id = `custom-${Date.now()}`;
  const full: AnalysisTemplate = { ...template, id };
  const custom = loadCustomTemplates();
  custom.push(full);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  return full;
}

export function updateTemplate(id: string, updates: Partial<Omit<AnalysisTemplate, 'id'>>): AnalysisTemplate | null {
  if (!id.startsWith('custom-')) {
    return null;
  }
  const custom = loadCustomTemplates();
  const idx = custom.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  custom[idx] = { ...custom[idx], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  return custom[idx];
}

export function deleteTemplate(id: string): boolean {
  const custom = loadCustomTemplates();
  const filtered = custom.filter((t) => t.id !== id);
  if (filtered.length === custom.length) return false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

function loadCustomTemplates(): AnalysisTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}
