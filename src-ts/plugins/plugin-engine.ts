/**
 * Plugin Engine — user-extensible analysis framework.
 *
 * Each plugin implements the WritingPlugin interface and registers
 * with the singleton PluginEngine. Results conform to DimensionResult
 * so they integrate seamlessly with the existing WritingDashboard.
 */

import type { WritingCraftDimension } from '../mcp/endpoints/writing-craft';

export interface PluginResult {
  pluginId: string;
  pluginName: string;
  score: number;
  maxScore: number;
  evidence: string[];
  suggestions: string[];
  details: Record<string, unknown>;
}

export interface WritingPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  dimension: WritingCraftDimension | 'custom';
  detect(text: string): PluginResult;
}

class PluginEngine {
  private plugins = new Map<string, WritingPlugin>();

  register(plugin: WritingPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  list(): WritingPlugin[] {
    return Array.from(this.plugins.values());
  }

  get(id: string): WritingPlugin | undefined {
    return this.plugins.get(id);
  }

  execute(id: string, text: string): PluginResult | null {
    const plugin = this.plugins.get(id);
    if (!plugin) return null;
    return plugin.detect(text);
  }

  executeAll(text: string): PluginResult[] {
    return Array.from(this.plugins.values()).map((p) => p.detect(text));
  }
}

export const pluginEngine = new PluginEngine();
