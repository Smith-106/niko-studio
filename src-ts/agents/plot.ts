/**
 * plot.ts - Plot context agent
 *
 * Migrated from src/agents/plot.py
 *
 * Responsible for plot outline management, timeline tracking,
 * foreshadow management, and tension analysis.
 */

import { BaseAgent } from './base';
import type { IAgentGraphEngine, IAgentMemoryEngine } from './base';
import { createLogger } from '../logger/index.js';

const _log = createLogger('agent-plot');

// ── Enums ──────────────────────────────────────────────────

export enum ForeshadowStatus {
  PLANTED   = 'planted',
  HINTED    = 'hinted',
  HARVESTED = 'harvested',
  ABANDONED = 'abandoned',
}

// ── Interfaces (Pydantic BaseModel -> TS interface) ────────

export interface Foreshadow {
  foreshadowId: string;
  description: string;
  plantedAt: string;
  harvestedAt: string;
  status: ForeshadowStatus;
  importance: string;
  relatedCharacters: string[];
  hints: string[];
}

export interface TimelineEvent {
  eventId: string;
  description: string;
  sceneId: string;
  charactersInvolved: string[];
  consequences: string[];
  isKeyEvent: boolean;
}

export interface PlotContext {
  currentPosition: string;
  structuralFunction: string;

  // Timeline
  previousEvents: TimelineEvent[];
  upcomingEvents: string[];

  // Foreshadowing
  activeForeshadows: Foreshadow[];
  foreshadowsToPlant: string[];
  foreshadowsToHarvest: string[];

  // Tension
  tensionLevel: number;
  tensionTrend: string;
}

// ── Agent ──────────────────────────────────────────────────

export class PlotAgent extends BaseAgent {
  private _memoryEngine: IAgentMemoryEngine | null;
  private _graphEngine: IAgentGraphEngine | null;

  constructor(
    deps?: {
      memoryEngine?: IAgentMemoryEngine;
      graphEngine?: IAgentGraphEngine;
      config?: Record<string, unknown>;
    },
  ) {
    super('Plot', deps?.config);
    this._memoryEngine = deps?.memoryEngine ?? null;
    this._graphEngine = deps?.graphEngine ?? null;
  }

  // ── Lazy engine accessors ────────────────────────────────

  get memoryEngine(): IAgentMemoryEngine | null {
    return this._memoryEngine;
  }

  set memoryEngine(engine: IAgentMemoryEngine | null) {
    this._memoryEngine = engine;
  }

  get graphEngine(): IAgentGraphEngine | null {
    return this._graphEngine;
  }

  set graphEngine(engine: IAgentGraphEngine | null) {
    this._graphEngine = engine;
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Build the plot context needed for a given scene.
   */
  async getContext(sceneInfo: Record<string, unknown>): Promise<PlotContext> {
    const sceneId = (sceneInfo['scene_id'] as string) ?? 'CH01-SC01';
    const structuralFunction = (sceneInfo['structural_function'] as string) ?? 'Rising';

    // Fetch timeline events
    const previousEvents = await this.getPreviousEvents(sceneId);
    const upcomingEvents = await this.getUpcomingEvents(sceneId);

    // Fetch foreshadow state
    const activeForeshadows = await this.getActiveForeshadows(sceneId);
    const foreshadowsToPlant = (sceneInfo['foreshadows_to_plant'] as string[]) ?? [];
    const foreshadowsToHarvest = (sceneInfo['foreshadows_to_harvest'] as string[]) ?? [];

    // Analyze tension
    const [tensionLevel, tensionTrend] = this.analyzeTension(
      structuralFunction, previousEvents,
    );

    const context: PlotContext = {
      currentPosition: sceneId,
      structuralFunction,
      previousEvents,
      upcomingEvents,
      activeForeshadows,
      foreshadowsToPlant,
      foreshadowsToHarvest,
      tensionLevel,
      tensionTrend,
    };

    this.logActivity(
      `Generated plot context for ${sceneId}: tension=${tensionLevel}, ${activeForeshadows.length} active foreshadows`
    );
    return context;
  }

  /**
   * Track a foreshadow state transition.
   */
  async trackForeshadow(
    foreshadowId: string,
    action: string,
    sceneId: string = '',
  ): Promise<{ success: boolean; newStatus?: string; error?: string }> {
    const statusMap: Record<string, ForeshadowStatus> = {
      plant:    ForeshadowStatus.PLANTED,
      hint:     ForeshadowStatus.HINTED,
      harvest:  ForeshadowStatus.HARVESTED,
      abandon:  ForeshadowStatus.ABANDONED,
    };

    const newStatus = statusMap[action] ?? ForeshadowStatus.PLANTED;

    if (this._graphEngine?.query) {
      try {
        let updateQuery =
          `MATCH (f:Foreshadow {id: '${foreshadowId}'})\n` +
          `SET f.status = '${newStatus}'`;

        if (action === 'harvest') {
          updateQuery += `, f.harvested_at = '${sceneId}'`;
        } else if (action === 'hint') {
          updateQuery += `, f.hints = f.hints + ['${sceneId}']`;
        }

        await this._graphEngine.query(updateQuery);

        this.logActivity(`Foreshadow ${foreshadowId} -> ${newStatus} at ${sceneId}`);
        return { success: true, newStatus };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    }

    return { success: false, error: 'No graph engine' };
  }

  /**
   * Validate content against the timeline for consistency.
   */
  async validateTimeline(
    content: string,
    context: PlotContext,
  ): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for references to events that have not happened yet
    for (const upcoming of context.upcomingEvents) {
      if (content.toLowerCase().includes(upcoming.toLowerCase())) {
        issues.push(`Content may reference an event that has not yet occurred: ${upcoming.slice(0, 50)}...`);
      }
    }

    // Check whether foreshadows that should be harvested appear in the content
    for (const fs of context.foreshadowsToHarvest) {
      if (!content.toLowerCase().includes(fs.toLowerCase())) {
        suggestions.push(`This scene should harvest foreshadow: ${fs}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Synchronous entry point (mirrors Python `run`).
   */
  run(inputData: unknown): Promise<PlotContext> {
    return this.getContext(inputData as Record<string, unknown>);
  }

  // ── Private helpers ──────────────────────────────────────

  private async getPreviousEvents(currentSceneId: string): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    if (!this._memoryEngine?.search) return events;

    try {
      const chapterNum = currentSceneId.length >= 4
        ? parseInt(currentSceneId.substring(2, 4), 10)
        : 1;

      const results = await this._memoryEngine.search(
        `key event chapter before ${chapterNum}`,
        { limit: 10 },
      );

      for (const r of results) {
        if (typeof r === 'object' && r !== null) {
          const item = r as Record<string, unknown>;
          events.push({
            eventId: (item['id'] as string) ?? '',
            description: (item['content'] as string) ?? '',
            sceneId: (item['scene_id'] as string) ?? '',
            charactersInvolved: (item['characters'] as string[]) ?? [],
            consequences: [],
            isKeyEvent: (item['is_key'] as boolean) ?? false,
          });
        }
      }
    } catch (e) {
      this.logActivity(`Event query failed: ${e}`, 'WARNING');
    }

    return events;
  }

  private async getUpcomingEvents(currentSceneId: string): Promise<string[]> {
    const upcoming: string[] = [];

    if (!this._memoryEngine?.search) return upcoming;

    try {
      const results = await this._memoryEngine.search(
        `planned event after ${currentSceneId}`,
        { limit: 5 },
      );

      for (const r of results) {
        if (typeof r === 'object' && r !== null && 'content' in r) {
          upcoming.push((r as Record<string, unknown>)['content'] as string);
        }
      }
    } catch (e) {
      _log.warn('Upcoming events query failed', { detail: e });
    }

    return upcoming;
  }

  private async getActiveForeshadows(_currentSceneId: string): Promise<Foreshadow[]> {
    const foreshadows: Foreshadow[] = [];

    if (!this._graphEngine?.query) return foreshadows;

    const query = [
      'MATCH (f:Foreshadow)',
      "WHERE f.status = 'planted' OR f.status = 'hinted'",
      'RETURN f',
      'ORDER BY f.importance DESC',
      'LIMIT 20',
    ].join('\n');

    try {
      const results = await this._graphEngine.query(query);
      for (const r of results) {
        const fData = ((r as Record<string, unknown>)['f'] as Record<string, unknown>) ?? {};
        foreshadows.push({
          foreshadowId: (fData['id'] as string) ?? '',
          description: (fData['description'] as string) ?? '',
          plantedAt: (fData['planted_at'] as string) ?? '',
          harvestedAt: '',
          status: Object.values(ForeshadowStatus).includes((fData['status'] as ForeshadowStatus))
            ? (fData['status'] as ForeshadowStatus)
            : ForeshadowStatus.PLANTED,
          importance: (fData['importance'] as string) ?? 'medium',
          relatedCharacters: (fData['characters'] as string[]) ?? [],
          hints: (fData['hints'] as string[]) ?? [],
        });
      }
    } catch (e) {
      this.logActivity(`Foreshadow query failed: ${e}`, 'WARNING');
    }

    return foreshadows;
  }

  private analyzeTension(
    structuralFunction: string,
    previousEvents: TimelineEvent[],
  ): [number, string] {
    const tensionMap: Record<string, [number, string]> = {
      Establishment: [3, 'rising'],
      Door1:         [6, 'rising'],
      Rising:        [5, 'rising'],
      Midpoint:      [7, 'peak'],
      Falling:       [4, 'falling'],
      Door2:         [8, 'rising'],
      Climax:        [10, 'peak'],
      Resolution:    [2, 'falling'],
    };

    const [baseTension, trend] = tensionMap[structuralFunction] ?? [5, 'rising'];

    const keyEvents = previousEvents.filter(e => e.isKeyEvent).length;
    const tensionAdjustment = Math.min(keyEvents, 2); // max +2

    const tensionLevel = Math.min(10, baseTension + tensionAdjustment);

    return [tensionLevel, trend];
  }
}
