import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  analyzeParallelization,
  buildDependencyDot,
  computeSceneMetrics,
  findParallelReady,
  loadScenes,
  type SceneCard,
} from '../../ui/components/scene-dashboard.js';

describe('ui/components/scene-dashboard', () => {
  let tempRoot = '';

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = '';
    }
  });

  it('creates the task directory when missing and returns no scenes', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-scene-dashboard-missing-'));

    const scenes = loadScenes('.task', tempRoot);

    expect(scenes).toEqual([]);
    expect(existsSync(join(tempRoot, '.task'))).toBe(true);
  });

  it('returns an empty list when the task path cannot be enumerated as a directory', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-scene-dashboard-enotdir-'));
    writeFileSync(join(tempRoot, '.task'), 'not-a-directory', 'utf8');

    expect(loadScenes('.task', tempRoot)).toEqual([]);
  });

  it('loads sorted scene files, derives missing ids, and skips unreadable JSON', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-scene-dashboard-load-'));
    const taskDir = join(tempRoot, '.task');
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(
      join(taskDir, 'SCENE-010.json'),
      JSON.stringify({
        id: 'scene-010',
        title: 'Finale',
        status: 'DONE',
        lock_scores: { L: 8, O: 7, C: 6, K: 5 },
      }),
      'utf8',
    );
    writeFileSync(
      join(taskDir, 'SCENE-002.json'),
      JSON.stringify({
        title: 'Opening',
        status: 'WRITING',
        dependencies: ['scene-010'],
      }),
      'utf8',
    );
    writeFileSync(join(taskDir, 'SCENE-bad.json'), '{bad json', 'utf8');

    const scenes = loadScenes('.task', tempRoot);

    expect(scenes).toHaveLength(2);
    expect(scenes[0].title).toBe('Opening');
    expect(String(scenes[0].id)).toMatch(/SCENE-002$/);
    expect(String(scenes[0]._filepath)).toMatch(/SCENE-002\.json$/);
    expect(scenes[1].id).toBe('scene-010');
  });

  it('computes aggregate metrics including average LOCK score and empty defaults', () => {
    const scenes: SceneCard[] = [
      {
        id: 'A',
        title: 'A',
        status: 'DONE',
        lock_scores: { L: 8, O: 7, C: 6, K: 5 },
      },
      {
        id: 'B',
        title: 'B',
        status: 'WRITING',
        lock_scores: { L: 4, O: 4, C: 4, K: 4 },
      },
      {
        id: 'C',
        title: 'C',
        status: 'PENDING',
      },
    ];

    expect(computeSceneMetrics(scenes)).toEqual({
      totalScenes: 3,
      doneCount: 1,
      writingCount: 1,
      avgLock: 21,
    });
    expect(computeSceneMetrics([])).toEqual({
      totalScenes: 0,
      doneCount: 0,
      writingCount: 0,
      avgLock: 0,
    });
  });

  it('builds dependency dot graphs with status styling, labels, and edges', () => {
    const dot = buildDependencyDot([
      {
        id: 'SC-1',
        title: 'Opening sequence',
        status: 'DONE',
        lock_scores: { L: 8, O: 7, C: 6, K: 5 },
        dependencies: [],
      },
      {
        id: 'SC-2',
        title: 'Mystery node',
        status: 'UNKNOWN',
        dependencies: ['SC-1'],
      },
    ]);

    expect(dot).toContain('digraph SceneDependency');
    expect(dot).toContain('"SC-1" [label="SC-1\\nOpening sequ');
    expect(dot).toContain('fillcolor="#c8e6c9"');
    expect(dot).toContain('fillcolor="#e0e0e0"');
    expect(dot).toContain('"SC-1" -> "SC-2";');
  });

  it('analyzes parallel levels for normal, missing, and cyclic dependencies', () => {
    const levels = analyzeParallelization([
      { id: 'A', title: 'A', status: 'DONE' },
      { id: 'B', title: 'B', status: 'PENDING', dependencies: ['A'] },
      { id: 'C', title: 'C', status: 'PENDING', dependencies: ['B'] },
      { id: 'D', title: 'D', status: 'PENDING', dependencies: ['MISSING'] },
      { id: 'E', title: 'E', status: 'PENDING', dependencies: ['F'] },
      { id: 'F', title: 'F', status: 'PENDING', dependencies: ['E'] },
    ]);

    expect(levels.map((entry) => entry.level)).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(levels.flatMap((entry) => entry.sceneIds).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('finds scenes that are ready for parallel work based on dependency completion', () => {
    const ready = findParallelReady([
      { id: 'A', title: 'A', status: 'DONE' },
      { id: 'B', title: 'B', status: 'PENDING', dependencies: ['A'] },
      { id: 'C', title: 'C', status: 'WRITING', dependencies: [] },
      { id: 'D', title: 'D', status: 'PENDING', dependencies: ['Z'] },
      { id: 'E', title: 'E', status: 'DONE', dependencies: [] },
    ]);

    expect(ready).toEqual(['B', 'C']);
  });
});
