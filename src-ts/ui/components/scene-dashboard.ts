/**
 * UI Components - Scene Dashboard
 *
 * Scene card dashboard with LOCK scoring, dependency graphs, and parallelization analysis.
 * Migrated from src/ui/components/scene_dashboard.py - logic only (no Streamlit).
 */

import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface SceneCard {
  id: string;
  title: string;
  summary?: string;
  status: string;
  lock_scores?: Record<string, number>;
  dependencies?: string[];
  word_count?: number;
  critique?: string;
  _filepath?: string;
  [key: string]: unknown;
}

export interface SceneMetrics {
  totalScenes: number;
  doneCount: number;
  writingCount: number;
  avgLock: number;
}

export interface ParallelLevel {
  level: number;
  sceneIds: string[];
}

// --- Data Loading ---

export function loadScenes(taskDir = '.task', projectRoot?: string): SceneCard[] {
  const root = projectRoot ?? process.cwd();
  const taskPath = join(root, taskDir);

  if (!existsSync(taskPath)) {
    mkdirSync(taskPath, { recursive: true });
    return [];
  }

  let files: string[];
  try {
    files = readdirSync(taskPath)
      .filter(f => f.startsWith('SCENE-') && f.endsWith('.json'))
      .sort()
      .map(f => join(taskPath, f));
  } catch {
    return [];
  }

  const scenes: SceneCard[] = [];
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(f, 'utf-8')) as Record<string, unknown>;
      if (!('id' in data)) {
        data.id = f.split('/').pop()?.replace('.json', '') ?? '';
      }
      (data as SceneCard)._filepath = f;
      scenes.push(data as SceneCard);
    } catch {
      // Skip unreadable files
    }
  }
  return scenes;
}

// --- Metrics ---

export function computeSceneMetrics(scenes: SceneCard[]): SceneMetrics {
  const totalScenes = scenes.length;
  const doneCount = scenes.filter(s => s.status === 'DONE').length;
  const writingCount = scenes.filter(s => s.status === 'WRITING').length;

  const lockTotals = scenes
    .map(s => {
      const ls = s.lock_scores ?? {};
      return ['L', 'O', 'C', 'K'].reduce((sum, k) => sum + ((ls as Record<string, number>)[k] ?? 0), 0);
    })
    .filter(t => t > 0);

  const avgLock = lockTotals.length > 0 ? lockTotals.reduce((a, b) => a + b, 0) / lockTotals.length : 0;

  return { totalScenes, doneCount, writingCount, avgLock };
}

// --- Dependency Graph ---

export function buildDependencyDot(scenes: SceneCard[]): string {
  const lines = ['digraph SceneDependency {', '  rankdir=LR;', '  node [shape=box, style=filled];'];

  const statusStyles: Record<string, string> = {
    DONE: 'fillcolor="#c8e6c9"',
    WRITING: 'fillcolor="#fff9c4"',
    REVIEWING: 'fillcolor="#bbdefb"',
    PENDING: 'fillcolor="#e0e0e0"',
    FAILED: 'fillcolor="#ffcdd2"',
  };

  for (const s of scenes) {
    const sid = s.id ?? '???';
    const title = (s.title ?? '').slice(0, 12);
    const status = s.status ?? 'PENDING';
    const style = statusStyles[status] ?? 'fillcolor="#e0e0e0"';
    const ls = s.lock_scores ?? {};
    const total = ['L', 'O', 'C', 'K'].reduce((sum, k) => sum + ((ls as Record<string, number>)[k] ?? 0), 0);

    lines.push(`  "${sid}" [label="${sid}\\n${title}\\n[${status}]\\n(LOCK:${total})", ${style}];`);
  }

  for (const s of scenes) {
    const sid = s.id ?? '';
    for (const dep of s.dependencies ?? []) {
      lines.push(`  "${dep}" -> "${sid}";`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// --- Parallelization Analysis ---

export function analyzeParallelization(scenes: SceneCard[]): ParallelLevel[] {
  const sceneMap = new Map<string, SceneCard>();
  for (const s of scenes) sceneMap.set(s.id, s);

  const memo = new Map<string, number>();

  function getLevel(sceneId: string, visited: Set<string>): number {
    if (memo.has(sceneId)) return memo.get(sceneId)!;
    if (visited.has(sceneId)) return 0;

    const scene = sceneMap.get(sceneId);
    if (!scene) return 0;

    const deps = scene.dependencies ?? [];
    if (deps.length === 0) {
      memo.set(sceneId, 1);
      return 1;
    }

    visited.add(sceneId);
    let maxDepLevel = 0;
    for (const dep of deps) {
      maxDepLevel = Math.max(maxDepLevel, getLevel(dep, visited));
    }
    visited.delete(sceneId);

    const result = maxDepLevel + 1;
    memo.set(sceneId, result);
    return result;
  }

  const levels = new Map<number, string[]>();
  for (const s of scenes) {
    const level = getLevel(s.id, new Set());
    const arr = levels.get(level) ?? [];
    arr.push(s.id);
    levels.set(level, arr);
  }

  return [...levels.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, sceneIds]) => ({ level, sceneIds }));
}

export function findParallelReady(scenes: SceneCard[]): string[] {
  const doneIds = new Set(
    scenes.filter(s => s.status === 'DONE').map(s => s.id),
  );

  return scenes
    .filter(s => s.status === 'PENDING' || s.status === 'WRITING')
    .filter(s => {
      const deps = s.dependencies ?? [];
      return deps.length === 0 || deps.every(d => doneIds.has(d));
    })
    .map(s => s.id);
}
