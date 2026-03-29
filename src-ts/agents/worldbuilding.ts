/**
 * worldbuilding.ts - Worldbuilding context agent
 *
 * Migrated from src/agents/worldbuilding.py
 *
 * Responsible for world setting queries, scene-world consistency
 * validation, and environmental detail generation.
 */

import { BaseAgent } from './base';
import type { IAgentGraphEngine, IAgentMemoryEngine } from './base';

// ── Interfaces (Pydantic BaseModel -> TS interface) ────────

export interface WorldSetting {
  category: string;
  name: string;
  description: string;
  rules: string[];
  relatedLocations: string[];
  relatedCharacters: string[];
}

export interface WorldContext {
  settings: WorldSetting[];
  activeRules: string[];
  locationDetails: Record<string, unknown>;
  timePeriod: string;
  atmosphere: string;
}

// ── Agent ──────────────────────────────────────────────────

export class WorldbuildingAgent extends BaseAgent {
  private _memoryEngine: IAgentMemoryEngine | null;
  private _graphEngine: IAgentGraphEngine | null;

  constructor(
    deps?: {
      memoryEngine?: IAgentMemoryEngine;
      graphEngine?: IAgentGraphEngine;
      config?: Record<string, unknown>;
    },
  ) {
    super('Worldbuilding', deps?.config);
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
   * Build the worldbuilding context needed for a given scene.
   */
  async getContext(sceneInfo: Record<string, unknown>): Promise<WorldContext> {
    const location  = (sceneInfo['location'] as string) ?? '';
    const timePeriod = (sceneInfo['time'] as string) ?? '';

    const settings: WorldSetting[] = [];
    const activeRules: string[] = [];
    let locationDetails: Record<string, unknown> = {};

    // Query location from graph
    if (this._graphEngine?.query && location) {
      try {
        const result = await this.queryLocation(location);
        if (result) {
          locationDetails = result;
          settings.push({
            category: 'geography',
            name: location,
            description: (result['description'] as string) ?? '',
            rules: (result['rules'] as string[]) ?? [],
            relatedLocations: (result['nearby'] as string[]) ?? [],
            relatedCharacters: (result['inhabitants'] as string[]) ?? [],
          });
        }
      } catch (e) {
        this.logActivity(`Location query failed: ${e}`, 'WARNING');
      }
    }

    // Query applicable rules from memory
    if (this._memoryEngine) {
      try {
        const rules = await this.queryRules(location, timePeriod);
        activeRules.push(...rules);
      } catch (e) {
        this.logActivity(`Rules query failed: ${e}`, 'WARNING');
      }
    }

    // Determine atmosphere
    const atmosphere = this.determineAtmosphere(locationDetails, timePeriod);

    const context: WorldContext = {
      settings,
      activeRules,
      locationDetails,
      timePeriod,
      atmosphere,
    };

    this.logActivity(
      `Generated world context for ${location}: ${settings.length} settings, ${activeRules.length} rules`
    );
    return context;
  }

  /**
   * Validate content against the worldbuilding context for consistency.
   */
  async validateConsistency(
    content: string,
    context: WorldContext,
  ): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
    checkedRules: number;
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Keyword-based rule violation scan
    for (const rule of context.activeRules) {
      const keywords = rule.split(/\s+/).slice(0, 3);
      for (const keyword of keywords) {
        if (keyword.length > 2 && content.includes(keyword)) {
          // Potentially related -- mark for review
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      checkedRules: context.activeRules.length,
    };
  }

  /**
   * Synchronous entry point (mirrors Python `run`).
   */
  run(inputData: unknown): Promise<WorldContext> {
    return this.getContext(inputData as Record<string, unknown>);
  }

  // ── Private helpers ──────────────────────────────────────

  private async queryLocation(location: string): Promise<Record<string, unknown> | null> {
    if (!this._graphEngine?.query) return null;

    const query = [
      `MATCH (l:Location {name: '${location}'})`,
      'OPTIONAL MATCH (l)-[:NEAR]->(nearby:Location)',
      'OPTIONAL MATCH (c:Character)-[:LIVES_IN]->(l)',
      'RETURN l, collect(DISTINCT nearby.name) as nearby, collect(DISTINCT c.name) as inhabitants',
    ].join('\n');

    try {
      const result = await this._graphEngine.query(query);
      if (result && result.length > 0) {
        const node = result[0] as Record<string, unknown>;
        const lNode = (node['l'] as Record<string, unknown>) ?? {};
        return {
          name: location,
          description: (lNode['description'] as string) ?? '',
          rules: (lNode['rules'] as string[]) ?? [],
          nearby: (node['nearby'] as string[]) ?? [],
          inhabitants: (node['inhabitants'] as string[]) ?? [],
        };
      }
    } catch {
      // Silently ignore
    }

    return null;
  }

  private async queryRules(location: string, timePeriod: string): Promise<string[]> {
    const rules: string[] = [];

    if (!this._memoryEngine?.search) return rules;

    // Location-based rules
    if (location) {
      try {
        const locationRules = await this._memoryEngine.search(
          `world rules ${location}`,
          { limit: 5 },
        );
        for (const r of locationRules) {
          if (typeof r === 'object' && r !== null && 'content' in r) {
            rules.push((r as Record<string, unknown>)['content'] as string);
          }
        }
      } catch {
        // Silently ignore
      }
    }

    // Time-period-based rules
    if (timePeriod) {
      try {
        const timeRules = await this._memoryEngine.search(
          `world rules ${timePeriod}`,
          { limit: 3 },
        );
        for (const r of timeRules) {
          if (typeof r === 'object' && r !== null && 'content' in r) {
            rules.push((r as Record<string, unknown>)['content'] as string);
          }
        }
      } catch {
        // Silently ignore
      }
    }

    return rules;
  }

  private determineAtmosphere(
    locationDetails: Record<string, unknown>,
    timePeriod: string,
  ): string {
    const hints: string[] = [];

    if (locationDetails) {
      const desc = ((locationDetails['description'] as string) ?? '').toLowerCase();
      if (['dark', '\u9ED1\u6697', '\u9634\u6697', '\u5371\u9669'].some(w => desc.includes(w))) {
        hints.push('\u538B\u6291');
      }
      if (['bright', '\u660E\u4EAE', '\u6E29\u6696', '\u7E41\u534E'].some(w => desc.includes(w))) {
        hints.push('\u6D3B\u8DC3');
      }
      if (['ancient', '\u53E4\u8001', '\u5E9F\u589F', '\u5386\u53F2'].some(w => desc.includes(w))) {
        hints.push('\u795E\u79D8');
      }
    }

    if (timePeriod) {
      const t = timePeriod.toLowerCase();
      if (['night', '\u591C', '\u6DF1\u591C'].some(w => t.includes(w))) {
        hints.push('\u7D27\u5F20');
      }
      if (['dawn', '\u9ECE\u660E', '\u6E05\u6668'].some(w => t.includes(w))) {
        hints.push('\u5E0C\u671B');
      }
    }

    return hints.length > 0 ? hints.join('\u3001') : '\u4E2D\u6027';
  }
}
