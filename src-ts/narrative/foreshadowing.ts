/**
 * Foreshadowing Lifecycle Tracker
 *
 * Implements foreshadowing state machine: PLANTED -> HINTED -> HARVESTED
 *
 * Foreshadowing is an important narrative technique for:
 * 1. Planting suspense, laying groundwork for later plot points
 * 2. Strengthening reader anticipation through hints
 * 3. Harvesting at the right moment to form narrative closure
 *
 * Key features:
 * - Foreshadowing state machine (PLANTED -> HINTED -> HARVESTED)
 * - Harvest reminder trigger rules (scene count, time, importance)
 * - IGraphManager integration for tracking foreshadow relationships
 *
 * NOTE: Original Python uses sqlite3; TypeScript uses in-memory Map storage.
 */

import type { INarrativeLLMClient } from './types.js';
import type { IGraphManager } from './character-manager.js';

// ============================================================
// Enums
// ============================================================

export enum ForeshadowState {
  PLANTED = 'planted',
  HINTED = 'hinted',
  HARVESTED = 'harvested',
}

// ============================================================
// Data Types
// ============================================================

export interface ForeshadowHint {
  id: string;
  sceneId: string;
  description: string;
  timestamp: string;
}

export interface Foreshadow {
  id: string;
  description: string;
  state: ForeshadowState;
  plantedAt: string;
  plantedTime: string;
  hints: ForeshadowHint[];
  harvestedAt: string | null;
  harvestedTime: string | null;
  importance: number;
  tags: string[];
  metadata: Record<string, unknown>;
}

export function foreshadowToDict(f: Foreshadow): Record<string, unknown> {
  return {
    id: f.id, description: f.description, state: f.state,
    planted_at: f.plantedAt, planted_time: f.plantedTime,
    hints: f.hints.map((h) => ({ id: h.id, scene_id: h.sceneId, description: h.description, timestamp: h.timestamp })),
    harvested_at: f.harvestedAt,
    harvested_time: f.harvestedTime,
    importance: f.importance, tags: f.tags, metadata: f.metadata,
  };
}

export function foreshadowFromDict(data: Record<string, unknown>): Foreshadow {
  return {
    id: data.id as string,
    description: data.description as string,
    state: (() => {
      const raw = (data.state as string) ?? 'PLANTED';
      return (Object.values(ForeshadowState) as string[]).includes(raw)
        ? (raw as ForeshadowState) : ForeshadowState.PLANTED;
    })(),
    plantedAt: data.planted_at as string,
    plantedTime: data.planted_time as string,
    hints: ((data.hints as Record<string, unknown>[]) ?? []).map((h) => ({
      id: (h.id as string) ?? '',
      sceneId: h.scene_id as string,
      description: h.description as string,
      timestamp: h.timestamp as string,
    })),
    harvestedAt: (data.harvested_at as string) ?? null,
    harvestedTime: (data.harvested_time as string) ?? null,
    importance: (data.importance as number) ?? 5,
    tags: (data.tags as string[]) ?? [],
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  };
}

export interface HarvestReminder {
  foreshadow: Foreshadow;
  reason: string;
  urgency: string; // 'low' | 'medium' | 'high' | 'critical'
  scenesSincePlant: number;
  suggestion: string;
}

// ============================================================
// In-memory storage (replaces sqlite3)
// ============================================================

interface SceneOrderEntry {
  storyId: string;
  sceneId: string;
  sequence: number;
}

// ============================================================
// ForeshadowingManager
// ============================================================

export class ForeshadowingManager {
  static readonly DEFAULT_THRESHOLD = 10;

  static readonly IMPORTANCE_THRESHOLDS: Record<number, number> = {
    10: 5, 9: 7, 8: 10, 7: 12, 6: 15,
    5: 20, 4: 25, 3: 30, 2: 40, 1: 50,
  };

  private foreshadows: Map<string, Foreshadow>;
  private hints: Map<string, ForeshadowHint>; // hintId -> hint
  private foreshadowHints: Map<string, string[]>; // foreshadowId -> hintIds
  private sceneOrders: Map<string, number>; // "storyId:sceneId" -> sequence
  private idCounter: number;

  constructor() {
    this.foreshadows = new Map();
    this.hints = new Map();
    this.foreshadowHints = new Map();
    this.sceneOrders = new Map();
    this.idCounter = 0;
  }

  private nextId(): string {
    this.idCounter++;
    return `fs-${Date.now()}-${this.idCounter}`;
  }

  // ============================================================
  // Core operations
  // ============================================================

  plant(
    description: string,
    sceneId: string,
    importance = 5,
    tags?: string[],
    metadata?: Record<string, unknown>,
  ): Foreshadow {
    const id = this.nextId();
    const now = new Date().toISOString();
    const clampedImportance = Math.max(1, Math.min(10, importance));

    const foreshadow: Foreshadow = {
      id, description,
      state: ForeshadowState.PLANTED,
      plantedAt: sceneId, plantedTime: now,
      hints: [], harvestedAt: null, harvestedTime: null,
      importance: clampedImportance,
      tags: tags ?? [], metadata: metadata ?? {},
    };

    this.foreshadows.set(id, foreshadow);
    this.foreshadowHints.set(id, []);
    return foreshadow;
  }

  hint(
    foreshadowId: string,
    sceneId: string,
    hintDescription?: string,
  ): Foreshadow | null {
    const foreshadow = this.foreshadows.get(foreshadowId);
    if (!foreshadow) return null;
    if (foreshadow.state === ForeshadowState.HARVESTED) return null;

    const now = new Date().toISOString();
    const hintId = `hint-${Date.now()}-${this.idCounter}`;
    const desc = hintDescription ?? `Hint at scene ${sceneId}`;

    const hintEntry: ForeshadowHint = {
      id: hintId, sceneId, description: desc, timestamp: now,
    };

    this.hints.set(hintId, hintEntry);
    const existingHints = this.foreshadowHints.get(foreshadowId) ?? [];
    existingHints.push(hintId);
    this.foreshadowHints.set(foreshadowId, existingHints);

    foreshadow.hints.push(hintEntry);
    foreshadow.state = ForeshadowState.HINTED;
    return foreshadow;
  }

  harvest(foreshadowId: string, sceneId: string): Foreshadow | null {
    const foreshadow = this.foreshadows.get(foreshadowId);
    if (!foreshadow) return null;
    if (foreshadow.state === ForeshadowState.HARVESTED) return foreshadow;

    const now = new Date().toISOString();
    foreshadow.state = ForeshadowState.HARVESTED;
    foreshadow.harvestedAt = sceneId;
    foreshadow.harvestedTime = now;
    return foreshadow;
  }

  // ============================================================
  // Query operations
  // ============================================================

  get(foreshadowId: string): Foreshadow | null {
    return this.foreshadows.get(foreshadowId) ?? null;
  }

  getAll(state?: ForeshadowState): Foreshadow[] {
    const all = Array.from(this.foreshadows.values());
    if (state) return all.filter((f) => f.state === state);
    return all.sort((a, b) => a.plantedTime.localeCompare(b.plantedTime));
  }

  getPending(): Foreshadow[] {
    return Array.from(this.foreshadows.values())
      .filter((f) => f.state === ForeshadowState.PLANTED || f.state === ForeshadowState.HINTED)
      .sort((a, b) => b.importance - a.importance || a.plantedTime.localeCompare(b.plantedTime));
  }

  getOverdue(
    threshold?: number,
    currentSceneId?: string,
    storyId = 'default',
  ): HarvestReminder[] {
    const reminders: HarvestReminder[] = [];
    const pending = this.getPending();
    const currentSeq = this.getSceneSequence(storyId, currentSceneId);

    for (const foreshadow of pending) {
      const plantedSeq = this.getSceneSequence(storyId, foreshadow.plantedAt);
      let scenesSince: number;

      if (currentSeq != null && plantedSeq != null) {
        scenesSince = currentSeq - plantedSeq;
      } else {
        const plantedDate = new Date(foreshadow.plantedTime);
        const daysSince = Math.floor((Date.now() - plantedDate.getTime()) / (1000 * 60 * 60 * 24));
        scenesSince = daysSince * 2;
      }

      const maxScenes = threshold ?? ForeshadowingManager.IMPORTANCE_THRESHOLDS[foreshadow.importance] ?? ForeshadowingManager.DEFAULT_THRESHOLD;

      if (scenesSince >= maxScenes) {
        const urgency = this.calculateUrgency(scenesSince, maxScenes);
        reminders.push({
          foreshadow,
          reason: this.getOverdueReason(scenesSince, maxScenes, foreshadow),
          urgency,
          scenesSincePlant: scenesSince,
          suggestion: this.getHarvestSuggestion(foreshadow, urgency),
        });
      }
    }

    const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    reminders.sort((a, b) => (urgencyOrder[a.urgency] ?? 4) - (urgencyOrder[b.urgency] ?? 4) || b.foreshadow.importance - a.foreshadow.importance);
    return reminders;
  }

  // ============================================================
  // Scene management
  // ============================================================

  registerScene(storyId: string, sceneId: string, sequence: number): void {
    this.sceneOrders.set(`${storyId}:${sceneId}`, sequence);
  }

  getForeshadowsAtScene(sceneId: string): Record<string, Foreshadow[]> {
    const result: Record<string, Foreshadow[]> = { planted: [], hinted: [], harvested: [] };

    for (const f of this.foreshadows.values()) {
      if (f.plantedAt === sceneId) result.planted.push(f);
      if (f.harvestedAt === sceneId) result.harvested.push(f);
      if (f.hints.some((h) => h.sceneId === sceneId)) result.hinted.push(f);
    }
    return result;
  }

  // ============================================================
  // Statistics
  // ============================================================

  getStats(): Record<string, unknown> {
    const all = Array.from(this.foreshadows.values());
    const total = all.length;

    const byState = { planted: 0, hinted: 0, harvested: 0 };
    for (const f of all) {
      if (f.state === ForeshadowState.PLANTED) byState.planted++;
      else if (f.state === ForeshadowState.HINTED) byState.hinted++;
      else if (f.state === ForeshadowState.HARVESTED) byState.harvested++;
    }

    let totalHints = 0;
    for (const f of all) totalHints += f.hints.length;

    const avgHints = total > 0 ? Math.round(totalHints / total * 100) / 100 : 0;
    const harvestRate = total > 0 ? Math.round(byState.harvested / total * 1000) / 10 : 0;

    return { total, by_state: byState, total_hints: totalHints, avg_hints_per_foreshadow: avgHints, harvest_rate: harvestRate };
  }

  getLifecycleSummary(foreshadowId: string): Record<string, unknown> | null {
    const foreshadow = this.foreshadows.get(foreshadowId);
    if (!foreshadow) return null;

    const lifecycle: Array<Record<string, unknown>> = [
      { event: 'planted', scene_id: foreshadow.plantedAt, timestamp: foreshadow.plantedTime },
    ];

    for (const h of foreshadow.hints) {
      lifecycle.push({ event: 'hinted', scene_id: h.sceneId, timestamp: h.timestamp, description: h.description });
    }

    if (foreshadow.harvestedAt) {
      lifecycle.push({ event: 'harvested', scene_id: foreshadow.harvestedAt, timestamp: foreshadow.harvestedTime });
    }

    lifecycle.sort((a, b) => (a.timestamp as string).localeCompare(b.timestamp as string));

    return { id: foreshadow.id, description: foreshadow.description, current_state: foreshadow.state, lifecycle };
  }

  // ============================================================
  // Batch operations
  // ============================================================

  delete(foreshadowId: string): boolean {
    const existed = this.foreshadows.has(foreshadowId);
    if (!existed) return false;

    // Remove associated hints
    const hintIds = this.foreshadowHints.get(foreshadowId) ?? [];
    for (const hid of hintIds) this.hints.delete(hid);
    this.foreshadowHints.delete(foreshadowId);
    this.foreshadows.delete(foreshadowId);
    return existed;
  }

  search(query: string, state?: ForeshadowState, tags?: string[], limit = 20): Foreshadow[] {
    let results = Array.from(this.foreshadows.values());

    if (query) {
      results = results.filter((f) => f.description.includes(query));
    }
    if (state) {
      results = results.filter((f) => f.state === state);
    }
    if (tags) {
      results = results.filter((f) => tags.every((t) => f.tags.includes(t)));
    }

    results.sort((a, b) => b.importance - a.importance || b.plantedTime.localeCompare(a.plantedTime));
    return results.slice(0, limit);
  }

  // ============================================================
  // Private helpers
  // ============================================================

  protected getSceneSequence(storyId: string, sceneId?: string | null): number | null {
    if (!sceneId) return null;
    return this.sceneOrders.get(`${storyId}:${sceneId}`) ?? null;
  }

  private calculateUrgency(scenesSince: number, maxScenes: number): string {
    const ratio = maxScenes > 0 ? scenesSince / maxScenes : 1.0;
    if (ratio >= 2.0) return 'critical';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.0) return 'medium';
    return 'low';
  }

  private getOverdueReason(scenesSince: number, maxScenes: number, foreshadow: Foreshadow): string {
    const hintCount = foreshadow.hints.length;
    if (scenesSince >= maxScenes * 2) return `\u4E25\u91CD\u8D85\u671F: \u5DF2\u8FC7 ${scenesSince} \u4E2A\u573A\u666F\uFF0C\u5EFA\u8BAE\u9608\u503C\u4E3A ${maxScenes}`;
    if (hintCount === 0) return `\u672A\u66FE\u6697\u793A: \u57CB\u8BBE\u540E ${scenesSince} \u4E2A\u573A\u666F\u5185\u65E0\u4EFB\u4F55\u6697\u793A`;
    return `\u7B49\u5F85\u8FC7\u957F: ${scenesSince} \u4E2A\u573A\u666F\uFF0C\u5DF2\u6709 ${hintCount} \u6B21\u6697\u793A`;
  }

  private getHarvestSuggestion(foreshadow: Foreshadow, urgency: string): string {
    if (urgency === 'critical') return '\u7ACB\u5373\u56DE\u6536\u6B64\u4F0F\u7B14\uFF0C\u5426\u5219\u8BFB\u8005\u53EF\u80FD\u5DF2\u9057\u5FD8';
    if (urgency === 'high') return '\u5C3D\u5FEB\u5B89\u6392\u56DE\u6536\u573A\u666F\uFF0C\u53EF\u5728\u5F53\u524D\u7AE0\u8282\u5185\u5B8C\u6210';
    if (foreshadow.state === ForeshadowState.PLANTED) return '\u8003\u8651\u5148\u6DFB\u52A0\u6697\u793A\u5F3A\u5316\u8BFB\u8005\u8BB0\u5FC6\uFF0C\u518D\u9002\u65F6\u56DE\u6536';
    return '\u53EF\u5728\u63A5\u4E0B\u6765\u7684\u5267\u60C5\u9AD8\u6F6E\u5904\u56DE\u6536';
  }
}

// ============================================================
// Reminder trigger rules
// ============================================================

export interface ReminderTriggerRule {
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  evaluate(
    foreshadow: Foreshadow,
    currentSceneSeq: number,
    plantedSceneSeq: number,
  ): HarvestReminder | null;
}

export class SceneCountRule implements ReminderTriggerRule {
  name = 'scene_count';
  description = '\u57FA\u4E8E\u573A\u666F\u6570\u91CF\u5224\u65AD\u662F\u5426\u9700\u8981\u56DE\u6536';
  priority = 5;
  enabled = true;

  private thresholdMultiplier: number;

  constructor(thresholdMultiplier = 1.0) {
    this.thresholdMultiplier = thresholdMultiplier;
  }

  evaluate(foreshadow: Foreshadow, currentSceneSeq: number, plantedSceneSeq: number): HarvestReminder | null {
    const scenesSince = currentSceneSeq - plantedSceneSeq;
    const baseThreshold = ForeshadowingManager.IMPORTANCE_THRESHOLDS[foreshadow.importance] ?? ForeshadowingManager.DEFAULT_THRESHOLD;
    const threshold = Math.floor(baseThreshold * this.thresholdMultiplier);

    if (scenesSince >= threshold) {
      const ratio = scenesSince / threshold;
      let urgency = 'low';
      if (ratio >= 2.0) urgency = 'critical';
      else if (ratio >= 1.5) urgency = 'high';
      else if (ratio >= 1.0) urgency = 'medium';

      return {
        foreshadow,
        reason: `\u5DF2\u8FC7 ${scenesSince} \u4E2A\u573A\u666F\uFF0C\u9608\u503C\u4E3A ${threshold}`,
        urgency,
        scenesSincePlant: scenesSince,
        suggestion: this.getSuggestion(foreshadow, urgency),
      };
    }
    return null;
  }

  private getSuggestion(foreshadow: Foreshadow, urgency: string): string {
    if (urgency === 'critical') return '\u7ACB\u5373\u56DE\u6536\u6B64\u4F0F\u7B14\uFF0C\u5426\u5219\u8BFB\u8005\u53EF\u80FD\u5DF2\u9057\u5FD8';
    if (urgency === 'high') return '\u5C3D\u5FEB\u5B89\u6392\u56DE\u6536\u573A\u666F\uFF0C\u53EF\u5728\u5F53\u524D\u7AE0\u8282\u5185\u5B8C\u6210';
    if (foreshadow.state === ForeshadowState.PLANTED) return '\u8003\u8651\u5148\u6DFB\u52A0\u6697\u793A\u5F3A\u5316\u8BFB\u8005\u8BB0\u5FC6\uFF0C\u518D\u9002\u65F6\u56DE\u6536';
    return '\u53EF\u5728\u63A5\u4E0B\u6765\u7684\u5267\u60C5\u9AD8\u6F6E\u5904\u56DE\u6536';
  }
}

export class NoHintRule implements ReminderTriggerRule {
  name = 'no_hint';
  description = '\u68C0\u6D4B\u57CB\u8BBE\u540E\u957F\u65F6\u95F4\u65E0\u6697\u793A\u7684\u4F0F\u7B14';
  priority = 7;
  enabled = true;

  private minScenesWithoutHint: number;

  constructor(minScenesWithoutHint = 5) {
    this.minScenesWithoutHint = minScenesWithoutHint;
  }

  evaluate(foreshadow: Foreshadow, currentSceneSeq: number, plantedSceneSeq: number): HarvestReminder | null {
    if (foreshadow.state !== ForeshadowState.PLANTED) return null;
    const scenesSince = currentSceneSeq - plantedSceneSeq;
    const adjustedThreshold = Math.max(3, this.minScenesWithoutHint - (foreshadow.importance - 5));

    if (scenesSince >= adjustedThreshold) {
      const urgency = scenesSince < adjustedThreshold * 2 ? 'medium' : 'high';
      return {
        foreshadow,
        reason: `\u57CB\u8BBE\u540E ${scenesSince} \u4E2A\u573A\u666F\u5185\u65E0\u4EFB\u4F55\u6697\u793A`,
        urgency,
        scenesSincePlant: scenesSince,
        suggestion: '\u5EFA\u8BAE\u6DFB\u52A0\u6697\u793A\u5F3A\u5316\u8BFB\u8005\u5370\u8C61\uFF0C\u907F\u514D\u4F0F\u7B14\u88AB\u9057\u5FD8',
      };
    }
    return null;
  }
}

export class HighImportanceRule implements ReminderTriggerRule {
  name = 'high_importance';
  description = '\u9AD8\u91CD\u8981\u6027\u4F0F\u7B14\u7684\u65E9\u671F\u63D0\u9192';
  priority = 9;
  enabled = true;

  private importanceThreshold: number;
  private sceneThreshold: number;

  constructor(importanceThreshold = 8, sceneThreshold = 3) {
    this.importanceThreshold = importanceThreshold;
    this.sceneThreshold = sceneThreshold;
  }

  evaluate(foreshadow: Foreshadow, currentSceneSeq: number, plantedSceneSeq: number): HarvestReminder | null {
    if (foreshadow.importance < this.importanceThreshold) return null;
    const scenesSince = currentSceneSeq - plantedSceneSeq;

    if (scenesSince >= this.sceneThreshold) {
      return {
        foreshadow,
        reason: `\u9AD8\u91CD\u8981\u6027\u4F0F\u7B14 (\u91CD\u8981\u5EA6: ${foreshadow.importance}) \u5DF2\u7B49\u5F85 ${scenesSince} \u4E2A\u573A\u666F`,
        urgency: scenesSince >= this.sceneThreshold * 2 ? 'high' : 'medium',
        scenesSincePlant: scenesSince,
        suggestion: '\u9AD8\u91CD\u8981\u6027\u4F0F\u7B14\u5E94\u5C3D\u65E9\u56DE\u6536\u4EE5\u4FDD\u6301\u8BFB\u8005\u5174\u8DA3',
      };
    }
    return null;
  }
}

export class ChapterBoundaryRule implements ReminderTriggerRule {
  name = 'chapter_boundary';
  description = '\u7AE0\u8282\u8FB9\u754C\u65F6\u68C0\u67E5\u5F85\u56DE\u6536\u4F0F\u7B14';
  priority = 6;
  enabled = true;

  private maxChaptersPending: number;

  constructor(maxChaptersPending = 2) {
    this.maxChaptersPending = maxChaptersPending;
  }

  evaluate(foreshadow: Foreshadow, currentSceneSeq: number, plantedSceneSeq: number): HarvestReminder | null {
    const plantedChapter = (foreshadow.metadata.planted_chapter as number) ?? 0;
    const currentChapter = (foreshadow.metadata.current_chapter as number) ?? 0;

    if (currentChapter - plantedChapter >= this.maxChaptersPending) {
      return {
        foreshadow,
        reason: `\u4F0F\u7B14\u8DE8\u8D8A ${currentChapter - plantedChapter} \u4E2A\u7AE0\u8282\u672A\u56DE\u6536`,
        urgency: 'high',
        scenesSincePlant: currentSceneSeq - plantedSceneSeq,
        suggestion: '\u5EFA\u8BAE\u5728\u5F53\u524D\u7AE0\u8282\u6216\u4E0B\u4E00\u7AE0\u8282\u56DE\u6536',
      };
    }
    return null;
  }
}

// ============================================================
// Rule Engine
// ============================================================

export class ReminderRuleEngine {
  rules: ReminderTriggerRule[];

  constructor() {
    this.rules = [
      new SceneCountRule(1.0),
      new NoHintRule(5),
      new HighImportanceRule(8, 3),
      new ChapterBoundaryRule(2),
    ];
  }

  addRule(rule: ReminderTriggerRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(name: string): boolean {
    const idx = this.rules.findIndex((r) => r.name === name);
    if (idx >= 0) { this.rules.splice(idx, 1); return true; }
    return false;
  }

  evaluate(foreshadow: Foreshadow, currentSceneSeq: number, plantedSceneSeq: number): HarvestReminder[] {
    const reminders: HarvestReminder[] = [];
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const reminder = rule.evaluate(foreshadow, currentSceneSeq, plantedSceneSeq);
      if (reminder) reminders.push(reminder);
    }
    return reminders;
  }
}

// ============================================================
// Graph integration
// ============================================================

export class ForeshadowGraphIntegration {
  static readonly REL_PLANTED_IN = 'PLANTED_IN';
  static readonly REL_HINTED_IN = 'HINTED_IN';
  static readonly REL_HARVESTED_IN = 'HARVESTED_IN';
  static readonly REL_INVOLVES = 'INVOLVES';
  static readonly REL_FORESHADOWS = 'FORESHADOWS';
  static readonly REL_RELATED_TO = 'RELATED_TO';

  private fm: ForeshadowingManager;
  private gm: IGraphManager | null;

  constructor(fm: ForeshadowingManager, graphManager?: IGraphManager) {
    this.fm = fm;
    this.gm = graphManager ?? null;
  }

  setGraphManager(graphManager: IGraphManager): void {
    this.gm = graphManager;
  }

  syncForeshadowToGraph(foreshadow: Foreshadow): string | null {
    if (!this.gm) return null;

    try {
      const entityId = `foreshadow_${foreshadow.id}`;
      const entity = {
        id: entityId,
        name: foreshadow.description.slice(0, 50),
        type: 'CONCEPT',
        properties: {
          foreshadow_id: foreshadow.id,
          state: foreshadow.state,
          importance: foreshadow.importance,
          planted_at: foreshadow.plantedAt,
          planted_time: foreshadow.plantedTime,
          tags: foreshadow.tags,
          hint_count: foreshadow.hints.length,
        },
      };

      const existing = this.gm.getEntity(entityId);
      if (existing) { this.gm.updateEntity(entity); }
      else { this.gm.createEntity(entity); }

      return entityId;
    } catch {
      return null;
    }
  }

  linkForeshadowToEntity(foreshadowId: string, entityId: string, relationType = 'INVOLVES'): boolean {
    if (!this.gm) return false;

    try {
      this.gm.createRelationship({
        id: `rel_${foreshadowId}_${entityId}_${relationType}`,
        source_id: `foreshadow_${foreshadowId}`,
        target_id: entityId,
        type: relationType,
        properties: { created_at: new Date().toISOString() },
      });
      return true;
    } catch {
      return false;
    }
  }

  findRelatedForeshadows(entityId: string, maxDepth = 2): Foreshadow[] {
    if (!this.gm) return [];

    try {
      const relatedEntities = this.gm.findRelatedEntities(entityId, maxDepth);
      const foreshadows: Foreshadow[] = [];

      for (const entity of relatedEntities) {
        const e = entity as { id?: string; properties?: Record<string, unknown> };
        if (e.id?.startsWith('foreshadow_')) {
          const fsId = e.properties?.foreshadow_id as string | undefined;
          if (fsId) {
            const f = this.fm.get(fsId);
            if (f) foreshadows.push(f);
          }
        }
      }
      return foreshadows;
    } catch {
      return [];
    }
  }

  getForeshadowNetwork(foreshadowId: string, radius = 2): Record<string, unknown> {
    if (!this.gm) return { error: 'GraphManager not set' };

    try {
      const entityId = `foreshadow_${foreshadowId}`;
      const subgraph = this.gm.getSubgraph(entityId, radius);
      return {
        center: foreshadowId,
        entities: (subgraph.entities as Array<{ id: string; name: string; type: string }>).map((e) => ({ id: e.id, name: e.name, type: e.type })),
        relationships: (subgraph.relationships as Array<{ source_id: string; target_id: string; type: string; properties?: unknown }>).map((r) => ({ source: r.source_id, target: r.target_id, type: r.type, properties: r.properties })),
      };
    } catch (e) {
      return { error: String(e) };
    }
  }
}

// ============================================================
// EnhancedForeshadowingManager
// ============================================================

export class EnhancedForeshadowingManager extends ForeshadowingManager {
  ruleEngine: ReminderRuleEngine;
  graphIntegration: ForeshadowGraphIntegration;

  constructor(graphManager?: IGraphManager) {
    super();
    this.ruleEngine = new ReminderRuleEngine();
    this.graphIntegration = new ForeshadowGraphIntegration(this, graphManager);
  }

  setGraphManager(graphManager: IGraphManager): void {
    this.graphIntegration.setGraphManager(graphManager);
  }

  plant(
    description: string,
    sceneId: string,
    importance = 5,
    tags?: string[],
    metadata?: Record<string, unknown>,
    syncToGraph = true,
  ): Foreshadow {
    const foreshadow = super.plant(description, sceneId, importance, tags, metadata);
    if (syncToGraph) this.graphIntegration.syncForeshadowToGraph(foreshadow);
    return foreshadow;
  }

  hint(
    foreshadowId: string,
    sceneId: string,
    hintDescription?: string,
    syncToGraph = true,
  ): Foreshadow | null {
    const foreshadow = super.hint(foreshadowId, sceneId, hintDescription);
    if (foreshadow && syncToGraph) this.graphIntegration.syncForeshadowToGraph(foreshadow);
    return foreshadow;
  }

  harvest(foreshadowId: string, sceneId: string, syncToGraph = true): Foreshadow | null {
    const foreshadow = super.harvest(foreshadowId, sceneId);
    if (foreshadow && syncToGraph) this.graphIntegration.syncForeshadowToGraph(foreshadow);
    return foreshadow;
  }

  getRemindersWithRules(currentSceneId?: string, storyId = 'default'): HarvestReminder[] {
    const reminders: HarvestReminder[] = [];
    const pending = this.getPending();
    const currentSeq = this.getSceneSequence(storyId, currentSceneId) ?? 0;

    for (const foreshadow of pending) {
      const plantedSeq = this.getSceneSequence(storyId, foreshadow.plantedAt) ?? 0;
      const ruleReminders = this.ruleEngine.evaluate(foreshadow, currentSeq, plantedSeq);

      if (ruleReminders.length > 0) {
        const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        ruleReminders.sort((a, b) => (urgencyOrder[a.urgency] ?? 4) - (urgencyOrder[b.urgency] ?? 4));
        reminders.push(ruleReminders[0]);
      }
    }

    const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    reminders.sort((a, b) => (urgencyOrder[a.urgency] ?? 4) - (urgencyOrder[b.urgency] ?? 4) || b.foreshadow.importance - a.foreshadow.importance);
    return reminders;
  }

  analyzeForeshadowHealth(): Record<string, unknown> {
    const stats = this.getStats() as Record<string, unknown>;
    const statsByState = stats.by_state as Record<string, number>;
    const pending = this.getPending();

    const total = stats.total as number;
    const harvested = statsByState.harvested ?? 0;
    const planted = statsByState.planted ?? 0;
    const hinted = statsByState.hinted ?? 0;

    const harvestRate = total > 0 ? Math.round(harvested / total * 1000) / 10 : 100;
    const hintRate = (planted + hinted) > 0 ? Math.round(hinted / (planted + hinted) * 1000) / 10 : 100;
    const avgHints = stats.avg_hints_per_foreshadow as number;

    const importanceDistribution: Record<number, number> = {};
    for (const f of pending) {
      importanceDistribution[f.importance] = (importanceDistribution[f.importance] ?? 0) + 1;
    }

    const healthScore = Math.min(100, harvestRate * 0.4 + hintRate * 0.3 + Math.min(avgHints * 10, 30));

    return {
      health_score: Math.round(healthScore * 10) / 10,
      stats,
      metrics: { harvest_rate: harvestRate, hint_rate: hintRate, avg_hints: avgHints },
      importance_distribution: importanceDistribution,
      pending_count: pending.length,
      recommendations: this.generateRecommendations(harvestRate, hintRate, avgHints, pending),
    };
  }

  private generateRecommendations(harvestRate: number, hintRate: number, avgHints: number, pending: Foreshadow[]): string[] {
    const recommendations: string[] = [];

    if (harvestRate < 50) recommendations.push('\u56DE\u6536\u7387\u8F83\u4F4E\uFF0C\u5EFA\u8BAE\u52A0\u5FEB\u4F0F\u7B14\u56DE\u6536\u8282\u594F');
    if (hintRate < 30) recommendations.push('\u6697\u793A\u7387\u8F83\u4F4E\uFF0C\u5EFA\u8BAE\u4E3A\u57CB\u8BBE\u7684\u4F0F\u7B14\u6DFB\u52A0\u66F4\u591A\u6697\u793A');
    if (avgHints < 1) recommendations.push('\u5E73\u5747\u6697\u793A\u6B21\u6570\u4E0D\u8DB3\uFF0C\u8003\u8651\u5F3A\u5316\u4F0F\u7B14\u7684\u8BFB\u8005\u5370\u8C61');

    const highImportancePending = pending.filter((f) => f.importance >= 8);
    if (highImportancePending.length > 0) {
      recommendations.push(`\u6709 ${highImportancePending.length} \u4E2A\u9AD8\u91CD\u8981\u6027\u4F0F\u7B14\u5F85\u5904\u7406`);
    }

    if (recommendations.length === 0) recommendations.push('\u4F0F\u7B14\u7BA1\u7406\u72B6\u6001\u826F\u597D');
    return recommendations;
  }

  // ============================================================
  // M13: \u516C\u5E73\u7EBF\u7D22\u89C4\u5219 + \u4FE1\u606F\u4E0D\u5BF9\u79F0\u5EA6 + \u5151\u73B0\u95F4\u9694
  // ============================================================

  /**
   * Check fair-play clue rules (\u672C\u683C\u63A8\u7406 fair-play principle):
   * All critical clues must be planted before the reveal, and
   * the reader must have enough information to solve the mystery.
   */
  checkFairPlayRules(): FairPlayReport {
    const foreshadows = Array.from(this.foreshadows.values());
    const harvested = foreshadows.filter(f => f.state === ForeshadowState.HARVESTED);
    const planted = foreshadows.filter(f => f.state === ForeshadowState.PLANTED);

    const violations: string[] = [];
    const passed: string[] = [];

    for (const f of harvested) {
      if (f.hints.length === 0) {
        violations.push(`"${f.description}" \u88AB\u56DE\u6536\u4F46\u7F3A\u5C11\u4EFB\u4F55\u6697\u793A\u2014\u2014\u8BFB\u8005\u65E0\u6CD5\u63D0\u524D\u63A8\u7406`);
      } else {
        passed.push(`"${f.description}" \u6709${f.hints.length}\u4E2A\u6697\u793A\uFF0C\u516C\u5E73\u7EBF\u7D22\u89C4\u5219\u6EE1\u8DB3`);
      }
    }

    const highImportanceUnresolved = planted.filter(f => f.importance >= 7);
    if (highImportanceUnresolved.length > 3) {
      violations.push(`\u6709${highImportanceUnresolved.length}\u4E2A\u9AD8\u91CD\u8981\u6027\u4F0F\u7B14\u672A\u56DE\u6536\uFF0C\u53EF\u80FD\u9020\u6210\u7EBF\u7D22\u8FC7\u8F7D`);
    }

    const fairPlayScore = harvested.length > 0
      ? (passed.length / harvested.length) * 100
      : 100;

    return {
      violations,
      passed,
      fairPlayScore,
      harvestedWithClues: passed.length,
      harvestedWithoutClues: violations.filter(v => v.includes('\u7F3A\u5C11')).length,
    };
  }

  /**
   * Analyze information asymmetry between reader and characters.
   * Measures how much the reader knows vs how much characters know
   * at each point \u2014 key for suspense and dramatic irony.
   */
  analyzeInformationAsymmetry(
    chapters: Array<{ content: string; chapterIndex: number }>,
  ): InformationAsymmetryReport {
    const timeline: AsymmetryPoint[] = [];

    const readerOnlyPatterns = [
      { keyword: '\u5176\u5B9E', label: '\u8BFB\u8005\u77E5/\u89D2\u8272\u4E0D\u77E5' },
      { keyword: '\u6697\u5730\u91CC', label: '\u8BFB\u8005\u77E5/\u89D2\u8272\u4E0D\u77E5' },
      { keyword: '\u5B9E\u9645\u4E0A', label: '\u8BFB\u8005\u77E5/\u89D2\u8272\u4E0D\u77E5' },
    ];

    const characterOnlyPatterns = [
      { keyword: '\u79D8\u5BC6', label: '\u89D2\u8272\u77E5/\u8BFB\u8005\u4E0D\u77E5' },
      { keyword: '\u9690\u7792', label: '\u89D2\u8272\u77E5/\u8BFB\u8005\u4E0D\u77E5' },
      { keyword: '\u4E0D\u544A\u8BC9', label: '\u89D2\u8272\u77E5/\u8BFB\u8005\u4E0D\u77E5' },
    ];

    for (const chapter of chapters) {
      for (const p of readerOnlyPatterns) {
        if (chapter.content.includes(p.keyword)) {
          timeline.push({
            chapterIndex: chapter.chapterIndex,
            type: 'reader_ahead',
            description: p.label,
            asymmetryLevel: 7,
          });
        }
      }

      for (const p of characterOnlyPatterns) {
        if (chapter.content.includes(p.keyword)) {
          timeline.push({
            chapterIndex: chapter.chapterIndex,
            type: 'character_ahead',
            description: p.label,
            asymmetryLevel: 5,
          });
        }
      }
    }

    const readerAhead = timeline.filter(t => t.type === 'reader_ahead').length;
    const characterAhead = timeline.filter(t => t.type === 'character_ahead').length;
    const balance = readerAhead > 0 && characterAhead > 0
      ? Math.min(readerAhead, characterAhead) / Math.max(readerAhead, characterAhead)
      : 0;

    const overallAsymmetry = timeline.length > 0
      ? timeline.reduce((s, t) => s + t.asymmetryLevel, 0) / timeline.length
      : 0;

    const suggestions: string[] = [];
    if (timeline.length === 0) {
      suggestions.push('\u672A\u68C0\u6D4B\u5230\u4FE1\u606F\u4E0D\u5BF9\u79F0\uFF0C\u8BFB\u8005\u548C\u89D2\u8272\u638C\u63E1\u76F8\u540C\u4FE1\u606F\u2014\u2014\u7F3A\u5C11\u620F\u5267\u6027\u53CD\u8BBD\u6216\u60AC\u5FF5');
    }
    if (readerAhead > characterAhead * 3) {
      suggestions.push('\u8BFB\u8005\u8FDC\u6BD4\u89D2\u8272\u77E5\u9053\u5F97\u591A\uFF0C\u8003\u8651\u589E\u52A0\u89D2\u8272\u89C6\u89D2\u7684\u9650\u5236\u6765\u5236\u9020\u7D27\u5F20\u611F');
    }
    if (characterAhead > readerAhead * 3) {
      suggestions.push('\u89D2\u8272\u77E5\u9053\u592A\u591A\u8BFB\u8005\u4E0D\u77E5\u9053\u7684\uFF0C\u53EF\u80FD\u5728\u63ED\u79D8\u65F6\u7F3A\u4E4F\u94FA\u57AB');
    }

    return {
      timeline,
      readerAheadCount: readerAhead,
      characterAheadCount: characterAhead,
      balanceScore: balance * 10,
      overallAsymmetry,
      suggestions,
    };
  }

  /**
   * Suggest optimal harvest intervals for planted foreshadows.
   * Based on importance and elapsed time.
   */
  suggestHarvestIntervals(currentSceneIndex: number): HarvestSuggestion[] {
    const foreshadows = Array.from(this.foreshadows.values());
    const pending = foreshadows.filter(f => f.state !== ForeshadowState.HARVESTED);

    return pending.map(f => {
      const plantedAt = parseInt(f.plantedAt.replace(/\D/g, ''), 10) || 0;
      const elapsedScenes = Math.max(currentSceneIndex - plantedAt, 0);

      let urgency: 'low' | 'medium' | 'high' | 'overdue';
      let maxScenes: number;

      if (f.importance >= 8) {
        maxScenes = 10;
      } else if (f.importance >= 5) {
        maxScenes = 20;
      } else {
        maxScenes = 30;
      }

      if (elapsedScenes > maxScenes) {
        urgency = 'overdue';
      } else if (elapsedScenes > maxScenes * 0.7) {
        urgency = 'high';
      } else if (elapsedScenes > maxScenes * 0.4) {
        urgency = 'medium';
      } else {
        urgency = 'low';
      }

      return {
        foreshadowId: f.id,
        description: f.description,
        importance: f.importance,
        elapsedScenes,
        maxRecommendedScenes: maxScenes,
        urgency,
        hintCount: f.hints.length,
        suggestion: urgency === 'overdue'
          ? `"${f.description}" \u5DF2\u8D85\u8FC7\u5EFA\u8BAE\u56DE\u6536\u65F6\u95F4(${elapsedScenes}/${maxScenes}\u573A\u666F)\uFF0C\u5E94\u5C3D\u5FEB\u56DE\u6536`
          : urgency === 'high'
            ? `"${f.description}" \u63A5\u8FD1\u5EFA\u8BAE\u56DE\u6536\u65F6\u95F4(${elapsedScenes}/${maxScenes})\uFF0C\u53EF\u5F00\u59CB\u51C6\u5907\u56DE\u6536`
            : `"${f.description}" \u5C1A\u5728\u5408\u7406\u7B49\u5F85\u671F(${elapsedScenes}/${maxScenes})`,
      };
    }).sort((a, b) => {
      const urgencyOrder = { overdue: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
  }
}

// ============================================================
// M13 Types
// ============================================================

export interface FairPlayReport {
  violations: string[];
  passed: string[];
  fairPlayScore: number;
  harvestedWithClues: number;
  harvestedWithoutClues: number;
}

export interface AsymmetryPoint {
  chapterIndex: number;
  type: 'reader_ahead' | 'character_ahead';
  description: string;
  asymmetryLevel: number;
}

export interface InformationAsymmetryReport {
  timeline: AsymmetryPoint[];
  readerAheadCount: number;
  characterAheadCount: number;
  balanceScore: number;
  overallAsymmetry: number;
  suggestions: string[];
}

export interface HarvestSuggestion {
  foreshadowId: string;
  description: string;
  importance: number;
  elapsedScenes: number;
  maxRecommendedScenes: number;
  urgency: 'low' | 'medium' | 'high' | 'overdue';
  hintCount: number;
  suggestion: string;
}
