/**
 * UI module - Web Interface Components
 *
 * Migrated from src/ui/.
 * The original was a Streamlit-based UI; this port provides
 * component types for a React-style rendering system.
 */

// ============================================================
// Types
// ============================================================

export interface UITranslations {
  [key: string]: Record<string, string>;
}

export interface UIConfig {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  pageSize: number;
  sidebarOpen: boolean;
}

export interface SceneCard {
  id: string;
  title: string;
  content: string;
  tags: string[];
  order: number;
  wordCount: number;
  status: 'draft' | 'reviewed' | 'final';
}

export interface LockRadarPoint {
  label: string;
  value: number;
  maxValue: number;
  angle: number;
  color: string;
}

export interface TrajectoryPoint {
  step: string;
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration: number;
  metadata: Record<string, unknown>;
}

export interface DashboardState {
  scenes: SceneCard[];
  lockScores: Record<string, number>;
  trajectory: TrajectoryPoint[];
  selectedScene: string | null;
  isGenerating: boolean;
}

// ============================================================
// Translations
// ============================================================

const TRANSLATIONS: UITranslations = {
  en: {
    'app.title': 'Niko Studio',
    'nav.home': 'Home',
    'nav.editor': 'Editor',
    'nav.scenes': 'Scenes',
    'nav.settings': 'Settings',
    'scene.title': 'Scene {id}',
    'scene.content': 'Content',
    'scene.tags': 'Tags',
    'scene.wordCount': 'Words',
    'btn.generate': 'Generate',
    'btn.export': 'Export',
    'btn.save': 'Save',
    'btn.cancel': 'Cancel',
    'lock.title': 'LOCK Analysis',
    'lock.lead': 'Lead',
    'lock.objective': 'Objective',
    'lock.confrontation': 'Confrontation',
    'lock.knockout': 'Knockout',
    'trajectory.title': 'Workflow Trajectory',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.pageSize': 'Page Size',
  },
  zh: {
    'app.title': 'Niko 工作室',
    'nav.home': '首页',
    'nav.editor': '编辑器',
    'nav.scenes': '场景',
    'nav.settings': '设置',
    'scene.title': '场景 {id}',
    'scene.content': '内容',
    'scene.tags': '标签',
    'scene.wordCount': '字数',
    'btn.generate': '生成',
    'btn.export': '导出',
    'btn.save': '保存',
    'btn.cancel': '取消',
    'lock.title': 'LOCK 分析',
    'lock.lead': '钩子',
    'lock.objective': '目标',
    'lock.confrontation': '对抗',
    'lock.knockout': '决胜',
    'trajectory.title': '工作流轨迹',
    'settings.theme': '主题',
    'settings.language': '语言',
    'settings.pageSize': '每页数量',
  },
};

export function translate(key: string, language: string = 'en'): string {
  const lang = TRANSLATIONS[language] || TRANSLATIONS.en;
  return lang[key] || TRANSLATIONS.en[key] || key;
}

// ============================================================
// File Utils
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export function ensureDirectory(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readTextFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

export function writeTextFile(filePath: string, content: string): void {
  ensureDirectory(filePath);
  writeFileSync(filePath, content, 'utf-8');
}

// ============================================================
// Scene Dashboard
// ============================================================

export class SceneDashboard {
  private scenes: SceneCard[] = [];

  addScene(scene: SceneCard): void {
    this.scenes.push(scene);
  }

  getScenes(): SceneCard[] {
    return [...this.scenes];
  }

  getSceneById(id: string): SceneCard | undefined {
    return this.scenes.find(s => s.id === id);
  }

  reorder(sceneIds: string[]): void {
    const sceneMap = new Map(this.scenes.map(s => [s.id, s]));
    this.scenes = sceneIds
      .map((id, i) => {
        const scene = sceneMap.get(id);
        return scene ? { ...scene, order: i } : null;
      })
      .filter((s): s is SceneCard => s !== null);
  }

  removeScene(id: string): boolean {
    const idx = this.scenes.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.scenes.splice(idx, 1);
      return true;
    }
    return false;
  }

  getTotalWordCount(): number {
    return this.scenes.reduce((sum, s) => sum + s.wordCount, 0);
  }

  getSceneStatuses(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of this.scenes) {
      counts[s.status] = (counts[s.status] || 0) + 1;
    }
    return counts;
  }
}

// ============================================================
// Lock Radar
// ============================================================

export class LockRadar {
  private scores: Record<string, number>;

  constructor(scores?: Record<string, number>) {
    this.scores = scores ?? { L: 0, O: 0, C: 0, K: 0 };
  }

  getPoints(): LockRadarPoint[] {
    const labels = { L: 'Lead', O: 'Objective', C: 'Confrontation', K: 'Knockout' };
    const colors = ['#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b'];

    return Object.entries(this.scores).map(([key, value], i) => ({
      label: labels[key as keyof typeof labels] || key,
      value,
      maxValue: 10,
      angle: (i * 90),
      color: colors[i] || '#6b7280',
    }));
  }

  getOverallScore(): number {
    return Object.values(this.scores).reduce((a, b) => a + b, 0);
  }

  getMaxScore(): number {
    return Object.keys(this.scores).length * 10;
  }

  getGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const pct = this.getOverallScore() / this.getMaxScore();
    if (pct >= 0.9) return 'A';
    if (pct >= 0.8) return 'B';
    if (pct >= 0.7) return 'C';
    if (pct >= 0.6) return 'D';
    return 'F';
  }
}

// ============================================================
// Trajectory Viewer
// ============================================================

export class TrajectoryViewer {
  private points: TrajectoryPoint[] = [];

  addPoint(point: TrajectoryPoint): void {
    this.points.push(point);
  }

  getPoints(): TrajectoryPoint[] {
    return [...this.points];
  }

  getLatestPoint(): TrajectoryPoint | undefined {
    return this.points[this.points.length - 1];
  }

  getCompletedCount(): number {
    return this.points.filter(p => p.status === 'completed').length;
  }

  getFailedCount(): number {
    return this.points.filter(p => p.status === 'failed').length;
  }

  getTotalDuration(): number {
    return this.points.reduce((sum, p) => sum + p.duration, 0);
  }

  clear(): void {
    this.points = [];
  }
}

// ============================================================
// Streamlit App (compatibility)
// ============================================================

export class StreamlitApp {
  private config: UIConfig;
  private dashboard: DashboardState;

  constructor(config?: Partial<UIConfig>) {
    this.config = {
      theme: 'auto',
      language: 'en',
      pageSize: 20,
      sidebarOpen: true,
      ...config,
    };
    this.dashboard = {
      scenes: [],
      lockScores: { L: 0, O: 0, C: 0, K: 0 },
      trajectory: [],
      selectedScene: null,
      isGenerating: false,
    };
  }

  getConfig(): UIConfig { return { ...this.config }; }
  getDashboard(): DashboardState { return { ...this.dashboard }; }

  t(key: string): string {
    return translate(key, this.config.language);
  }
}
