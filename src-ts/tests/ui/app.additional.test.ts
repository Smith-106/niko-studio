import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  LockRadar,
  SceneDashboard,
  StreamlitApp,
  TrajectoryViewer,
  ensureDirectory,
  readTextFile,
  translate,
  writeTextFile,
  type SceneCard,
  type TrajectoryPoint,
} from '../../ui/app.js';

describe('ui/app', () => {
  let tempRoot = '';

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = '';
    }
  });

  it('translates known keys and falls back for missing languages or keys', () => {
    expect(translate('app.title')).toBe('Niko Studio');
    expect(translate('nav.home', 'zh')).not.toBe('nav.home');
    expect(translate('missing.key', 'en')).toBe('missing.key');
    expect(translate('btn.save', 'fr')).toBe('Save');
  });

  it('creates directories and round-trips text file content', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-ui-app-'));
    const nestedFile = join(tempRoot, 'deep', 'notes', 'chapter.txt');

    ensureDirectory(nestedFile);
    expect(existsSync(join(tempRoot, 'deep', 'notes'))).toBe(true);

    writeTextFile(nestedFile, 'scene draft');
    expect(readTextFile(nestedFile)).toBe('scene draft');
  });

  it('manages scene dashboard ordering, lookup, totals, and deletion semantics', () => {
    const dashboard = new SceneDashboard();
    const scenes: SceneCard[] = [
      {
        id: 'scene-1',
        title: 'Opening',
        content: 'One',
        tags: ['intro'],
        order: 0,
        wordCount: 120,
        status: 'draft',
      },
      {
        id: 'scene-2',
        title: 'Conflict',
        content: 'Two',
        tags: ['action'],
        order: 1,
        wordCount: 180,
        status: 'reviewed',
      },
      {
        id: 'scene-3',
        title: 'Finale',
        content: 'Three',
        tags: ['ending'],
        order: 2,
        wordCount: 240,
        status: 'final',
      },
    ];

    scenes.forEach((scene) => {
      dashboard.addScene(scene);
    });

    const snapshot = dashboard.getScenes();
    snapshot.pop();
    expect(dashboard.getScenes()).toHaveLength(3);
    expect(dashboard.getSceneById('scene-2')?.title).toBe('Conflict');
    expect(dashboard.getSceneById('missing')).toBeUndefined();

    dashboard.reorder(['scene-3', 'scene-1', 'missing']);

    expect(dashboard.getScenes()).toEqual([
      expect.objectContaining({ id: 'scene-3', order: 0 }),
      expect.objectContaining({ id: 'scene-1', order: 1 }),
    ]);
    expect(dashboard.getTotalWordCount()).toBe(360);
    expect(dashboard.getSceneStatuses()).toEqual({
      final: 1,
      draft: 1,
    });
    expect(dashboard.removeScene('scene-1')).toBe(true);
    expect(dashboard.removeScene('scene-404')).toBe(false);
  });

  it('projects radar points and computes grades across thresholds', () => {
    const extendedRadar = new LockRadar({ L: 9, O: 8, C: 7, K: 6, X: 5 } as Record<string, number>);
    const points = extendedRadar.getPoints();

    expect(points[0]).toMatchObject({
      label: 'Lead',
      value: 9,
      maxValue: 10,
      angle: 0,
      color: '#3b82f6',
    });
    expect(points[4]).toMatchObject({
      label: 'X',
      color: '#6b7280',
    });
    expect(extendedRadar.getOverallScore()).toBe(35);
    expect(extendedRadar.getMaxScore()).toBe(50);

    const gradeCases = [
      { scores: { L: 9, O: 9, C: 9, K: 9 }, expected: 'A' },
      { scores: { L: 8, O: 8, C: 8, K: 8 }, expected: 'B' },
      { scores: { L: 7, O: 7, C: 7, K: 7 }, expected: 'C' },
      { scores: { L: 6, O: 6, C: 6, K: 6 }, expected: 'D' },
      { scores: { L: 5, O: 5, C: 5, K: 5 }, expected: 'F' },
    ] as const;

    for (const { scores, expected } of gradeCases) {
      expect(new LockRadar(scores).getGrade()).toBe(expected);
    }
  });

  it('tracks trajectory progress and can be cleared', () => {
    const viewer = new TrajectoryViewer();
    const points: TrajectoryPoint[] = [
      {
        step: 'outline',
        timestamp: 1,
        status: 'completed',
        duration: 15,
        metadata: { actor: 'planner' },
      },
      {
        step: 'draft',
        timestamp: 2,
        status: 'failed',
        duration: 30,
        metadata: { actor: 'writer' },
      },
    ];

    points.forEach((point) => {
      viewer.addPoint(point);
    });

    const snapshot = viewer.getPoints();
    snapshot.shift();

    expect(viewer.getPoints()).toHaveLength(2);
    expect(viewer.getLatestPoint()).toEqual(points[1]);
    expect(viewer.getCompletedCount()).toBe(1);
    expect(viewer.getFailedCount()).toBe(1);
    expect(viewer.getTotalDuration()).toBe(45);

    viewer.clear();
    expect(viewer.getPoints()).toEqual([]);
    expect(viewer.getLatestPoint()).toBeUndefined();
  });

  it('initializes streamlit compatibility state with defaults and overrides', () => {
    const app = new StreamlitApp({
      language: 'en',
      pageSize: 50,
      sidebarOpen: false,
    });

    expect(app.getConfig()).toEqual({
      theme: 'auto',
      language: 'en',
      pageSize: 50,
      sidebarOpen: false,
    });
    expect(app.getDashboard()).toEqual({
      scenes: [],
      lockScores: { L: 0, O: 0, C: 0, K: 0 },
      trajectory: [],
      selectedScene: null,
      isGenerating: false,
    });
    expect(app.t('btn.generate')).toBe('Generate');
  });
});
