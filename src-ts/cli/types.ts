/**
 * CLI module - Command Line Interface
 *
 * Provides CLI commands for project initialization, workflow execution,
 * interactive chat, evaluation, and export functionality.
 *
 * Migrated from src/cli/.
 */

// ============================================================
// Types
// ============================================================

export interface CliContext {
  console: ConsoleLike;
  [key: string]: unknown;
}

export interface ConsoleLike {
  log(message?: string, ...args: unknown[]): void;
  error(message?: string, ...args: unknown[]): void;
  clear(): void;
}

export interface CommandOption {
  name: string;
  alias?: string;
  type: 'string' | 'number' | 'boolean' | 'choice';
  choices?: string[];
  default?: unknown;
  required?: boolean;
  description: string;
}

export interface Command {
  name: string;
  description: string;
  options: CommandOption[];
  execute: (ctx: CliContext, args: Record<string, unknown>) => Promise<void> | void;
}

export interface RoutingResult {
  level: string;
  level_slug?: string;
  description: string;
  reason: string;
}

export interface PlanStep {
  id: string;
  name: string;
  description: string;
  status: string;
  output?: Record<string, unknown>;
}

export interface Plan {
  plan_id: string;
  level: string;
  steps: PlanStep[];
  total_steps: number;
}

export interface ExecuteResult {
  step_name?: string;
  step_id?: string;
  status?: string;
  plan_status?: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface QualityControls {
  quality_mode: string;
  quality_level: string;
  degrade_on_timeout: boolean;
  degrade_on_error: boolean;
  critical_gate_always_on: boolean;
  quality_phase_timeout_seconds: number;
}

// ============================================================
// Genre Profile
// ============================================================

export const GENRE_CHOICES = ['none', 'mystery', 'scifi', 'xuanhuan', '悬疑', '科幻', '东方玄幻'] as const;

const GENRE_ALIASES: Record<string, string> = {
  none: 'none',
  mystery: 'mystery',
  '悬疑': 'mystery',
  scifi: 'scifi',
  'sci-fi': 'scifi',
  '科幻': 'scifi',
  xuanhuan: 'xuanhuan',
  '东方玄幻': 'xuanhuan',
};

const GENRE_GENERATION_PROFILES: Record<string, { style: string; length: string; constraints: string[] }> = {
  mystery: {
    style: 'cinematic',
    length: 'medium',
    constraints: [
      'Maintain clue consistency across all scenes',
      'Control information reveal cadence',
      'Keep deduction chain explicit and verifiable',
    ],
  },
  scifi: {
    style: 'neutral',
    length: 'medium',
    constraints: [
      'Keep speculative rules internally consistent',
      'Ground technology through character action',
      'Preserve cause-effect logic from world rules',
    ],
  },
  xuanhuan: {
    style: 'lyrical',
    length: 'long',
    constraints: [
      'Keep realm progression and power boundaries consistent',
      'Maintain sect hierarchy and world lore continuity',
      'Balance cultivation exposition with scene momentum',
    ],
  },
};

export function normalizeGenre(genre: string): string {
  const normalized = (genre || 'none').trim().toLowerCase();
  return GENRE_ALIASES[normalized] ?? normalized;
}

export function genreProfile(genre: string): { style: string; length: string; constraints: string[] } | null {
  const g = normalizeGenre(genre);
  if (g === 'none') return null;
  const profile = GENRE_GENERATION_PROFILES[g];
  if (!profile) return null;
  return { style: profile.style, length: profile.length, constraints: [...profile.constraints] };
}

export function genreToGenerationRecommendation(genre: string): { action: string; target: string; params: Record<string, unknown> } | null {
  const profile = genreProfile(genre);
  if (profile === null) return null;
  return { action: 'set_generation_controls', target: 'draft', params: profile };
}

export function mergeControlsWithGenre(
  controls: { style?: string; length?: string; constraints?: string[] },
  genre: string,
): { style: string; length: string; constraints: string[] } {
  const merged: { style: string; length: string; constraints: string[] } = {
    style: controls.style ?? 'neutral',
    length: controls.length ?? 'medium',
    constraints: [...(controls.constraints ?? [])],
  };
  const profile = genreProfile(genre);
  if (profile === null) return merged;
  if (merged.style === 'neutral') merged.style = profile.style;
  if (merged.length === 'medium') merged.length = profile.length;
  const existing = new Set(merged.constraints);
  for (const c of profile.constraints) {
    if (!existing.has(c)) { merged.constraints.push(c); existing.add(c); }
  }
  return merged;
}

// ============================================================
// Helpers
// ============================================================

export function normalizeNamespace(namespace: string): string {
  return (namespace || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function formatDate(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function generateSessionId(prefix = 'sess'): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${prefix}_${ts}`;
}
