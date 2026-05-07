/**
 * Plugin MCP Endpoints
 *
 * HTTP API for the plugin system: list, execute, register.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { pluginEngine, type WritingPlugin, type PluginResult } from '../../plugins/plugin-engine';

export async function pluginListEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  const plugins = pluginEngine.list().map((p) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    description: p.description,
    dimension: p.dimension,
  }));

  return jsonResponse({ success: true, data: { plugins } });
}

export async function pluginExecuteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as {
    text?: string;
    pluginId?: string;
    pluginIds?: string[];
  };

  const text = body.text ?? '';
  if (!text.trim()) {
    return jsonResponse({ success: false, error: 'text is required' }, 400);
  }

  const ids: string[] = body.pluginIds ?? (body.pluginId ? [body.pluginId] : []);
  if (ids.length === 0) {
    return jsonResponse({ success: false, error: 'pluginId or pluginIds is required' }, 400);
  }

  const results: PluginResult[] = [];
  for (const id of ids) {
    const result = pluginEngine.execute(id, text);
    if (result) {
      results.push(result);
    }
  }

  return jsonResponse({ success: true, data: { results } });
}

export async function pluginRegisterEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as {
    id?: string;
    name?: string;
    version?: string;
    description?: string;
    dimension?: string;
    rules?: Array<{ keyword: string; score: number; evidence: string; suggestion?: string }>;
  };

  if (!body.id || !body.name || !body.rules || body.rules.length === 0) {
    return jsonResponse({ success: false, error: 'id, name, and rules[] are required' }, 400);
  }

  const rules = body.rules;

  const plugin: WritingPlugin = {
    id: body.id,
    name: body.name,
    version: body.version ?? '1.0.0',
    description: body.description ?? '',
    dimension: (body.dimension as WritingPlugin['dimension']) ?? 'custom',

    detect(text: string): PluginResult {
      const evidence: string[] = [];
      const suggestions: string[] = [];
      let totalScore = 0;

      for (const rule of rules) {
        const matches = text.match(new RegExp(rule.keyword, 'g'));
        if (matches && matches.length > 0) {
          totalScore += rule.score * matches.length;
          evidence.push(rule.evidence.replace('{count}', String(matches.length)));
          if (rule.suggestion) suggestions.push(rule.suggestion);
        }
      }

      return {
        pluginId: body.id!,
        pluginName: body.name!,
        score: Math.min(10, totalScore),
        maxScore: 10,
        evidence,
        suggestions,
        details: { ruleCount: rules.length, source: 'user-registered' },
      };
    },
  };

  pluginEngine.register(plugin);

  return jsonResponse({ success: true, data: { id: plugin.id, name: plugin.name } });
}
