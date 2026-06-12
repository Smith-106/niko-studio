import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildDependencyDot,
  findParallelReady,
  loadScenes,
  type SceneCard,
} from '../../ui/components/scene-dashboard.js';

describe('ui/components/scene-dashboard branch-gap coverage', () => {
  let tempRoot = '';
  let originalCwd = '';

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalCwd) {
      process.chdir(originalCwd);
      originalCwd = '';
    }
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = '';
    }
  });

  it('uses process cwd and falls back to an empty derived id when path splitting yields no segment', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-scene-dashboard-cwd-'));
    const taskDir = join(tempRoot, '.task');
    mkdirSync(taskDir, { recursive: true });
    const scenePath = join(taskDir, 'SCENE-001.json');
    writeFileSync(
      scenePath,
      JSON.stringify({
        title: 'No explicit id',
        status: 'PENDING',
      }),
      'utf8',
    );

    originalCwd = process.cwd();
    process.chdir(tempRoot);

    const splitSpy = vi
      .spyOn(String.prototype, 'split')
      .mockImplementation(function (
        this: string,
        separator: string | RegExp,
        limit?: number,
      ): string[] {
        if (this.toString() === scenePath && separator === '/') {
          return [];
        }
        return String.prototype.split.wrappedMethod.call(this, separator as never, limit);
      });

    const scenes = loadScenes('.task');

    expect(splitSpy).toHaveBeenCalled();
    expect(scenes).toHaveLength(1);
    expect(scenes[0]?.id).toBe('');
  });

  it('falls back to placeholder fields in dot graphs and treats missing dependencies as ready', () => {
    const dot = buildDependencyDot([
      {
        lock_scores: { L: 1 },
      } as SceneCard,
      {
        id: 'SC-2',
        title: 'Known',
        status: 'DONE',
      } as SceneCard,
    ]);

    expect(dot).toContain('"???" [label="???\\n\\n[PENDING]\\n(LOCK:1)"');
    expect(dot).toContain('fillcolor="#e0e0e0"');

    const ready = findParallelReady([
      {
        id: 'SC-3',
        title: 'Needs no deps array',
        status: 'PENDING',
      } as SceneCard,
      {
        id: 'SC-4',
        title: 'Blocked',
        status: 'PENDING',
        dependencies: ['missing-done-id'],
      },
    ]);

    expect(ready).toEqual(['SC-3']);
  });
});
