import { describe, expect, it, beforeEach } from 'vitest';
import { pluginEngine, type WritingPlugin } from '../../plugins/plugin-engine.js';

const mockPlugin: WritingPlugin = {
  id: 'test-plugin',
  name: 'Test Plugin',
  version: '0.1.0',
  description: 'A test plugin',
  dimension: 'custom',
  detect(text: string) {
    const exclamationCount = (text.match(/[！!]/g) ?? []).length;
    return {
      pluginId: this.id,
      pluginName: this.name,
      score: Math.min(10, exclamationCount * 2),
      maxScore: 10,
      evidence: exclamationCount > 0 ? [`感叹号: ${exclamationCount}个`] : [],
      suggestions: exclamationCount > 3 ? ['感叹号过多'] : [],
      details: { exclamationCount },
    };
  },
};

describe('PluginEngine', () => {
  beforeEach(() => {
    pluginEngine.unregister('test-plugin');
  });

  it('registers and lists plugins', () => {
    pluginEngine.register(mockPlugin);
    const list = pluginEngine.list();
    const found = list.find((p) => p.id === 'test-plugin');
    expect(found).toBeDefined();
    expect(found!.name).toBe('Test Plugin');
  });

  it('unregisters plugins', () => {
    pluginEngine.register(mockPlugin);
    expect(pluginEngine.unregister('test-plugin')).toBe(true);
    expect(pluginEngine.get('test-plugin')).toBeUndefined();
  });

  it('unregister returns false for unknown plugin', () => {
    expect(pluginEngine.unregister('nonexistent')).toBe(false);
  });

  it('executes a plugin', () => {
    pluginEngine.register(mockPlugin);
    const result = pluginEngine.execute('test-plugin', '你好！世界！');
    expect(result).not.toBeNull();
    expect(result!.score).toBe(4);
    expect(result!.evidence).toHaveLength(1);
    expect(result!.details.exclamationCount).toBe(2);
  });

  it('returns null for unknown plugin execution', () => {
    const result = pluginEngine.execute('nonexistent', 'text');
    expect(result).toBeNull();
  });

  it('executeAll runs all registered plugins', () => {
    pluginEngine.register(mockPlugin);
    const results = pluginEngine.executeAll('你好！');
    const builtins = results.filter((r) => r.pluginId.startsWith('builtin-'));
    expect(builtins.length).toBeGreaterThanOrEqual(0);
    const testResult = results.find((r) => r.pluginId === 'test-plugin');
    expect(testResult).toBeDefined();
    expect(testResult!.score).toBeGreaterThan(0);
  });

  it('get returns specific plugin', () => {
    pluginEngine.register(mockPlugin);
    const plugin = pluginEngine.get('test-plugin');
    expect(plugin).toBeDefined();
    expect(plugin!.version).toBe('0.1.0');
  });
});
