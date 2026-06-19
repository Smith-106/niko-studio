import React, { useEffect, useState } from 'react';
import { Puzzle, Play, Loader2, Plus } from 'lucide-react';
import { SectionHeader } from './SectionHeader';

interface PluginResult {
  score: number;
  maxScore: number;
  evidence: string;
  suggestions: string[];
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  dimension?: string;
}

interface PluginPanelProps {
  text: string;
}

export const PluginPanel: React.FC<PluginPanelProps> = ({ text }) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [results, setResults] = useState<Map<string, PluginResult>>(new Map());
  const [loading, setloading] = useState<Set<string>>(new Set());
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      const { callApi } = await import('../../api/core');
      const resp = await callApi<{ plugins: PluginInfo[] }>('/plugins/list', 'GET');
      if (resp.success && resp.data) {
        setPlugins(resp.data.plugins);
      }
    } catch {}
  };

  const executePlugin = async (id: string) => {
    if (!text.trim()) return;
    setloading((prev) => new Set(prev).add(id));
    try {
      const { callApi } = await import('../../api/core');
      const resp = await callApi<{ results: PluginResult[] }>('/plugins/execute', 'POST', {
        text,
        pluginId: id,
      });
      if (resp.success && resp.data?.results[0]) {
        setResults((prev) => new Map(prev).set(id, resp.data!.results[0]));
      }
    } catch {}
    setloading((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle size={14} className="text-primary-cta" />
          <SectionHeader title="Plugin 扩展分析" />
        </div>
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-dark-border text-dark-text-muted hover:bg-dark-surface-sunken"
        >
          <Plus size={12} /> 注册
        </button>
      </div>

      {plugins.length === 0 && (
        <div className="text-xs text-dark-text-muted py-2">暂无已注册的 Plugin</div>
      )}

      {plugins.map((plugin) => {
        const result = results.get(plugin.id);
        const isLoading = loading.has(plugin.id);
        return (
          <div key={plugin.id} className="p-2 rounded-md bg-dark-surface-sunken">
            <div className="flex items-center justify-between mb-1">
              <div>
                <span className="text-xs font-medium text-dark-text">{plugin.name}</span>
                <span className="text-xs text-dark-text-muted ml-1">v{plugin.version}</span>
              </div>
              <button
                onClick={() => executePlugin(plugin.id)}
                disabled={isLoading || !text.trim()}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary-cta/20 text-primary-cta
                           disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-cta/30"
              >
                {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                执行
              </button>
            </div>
            <p className="text-xs text-dark-text-muted">{plugin.description}</p>

            {result && (
              <div className="mt-2 pt-2 border-t border-dark-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold" style={{ color: result.score >= 6 ? '#059669' : result.score >= 3 ? '#d97706' : '#dc2626' }}>
                    {result.score}/{result.maxScore}
                  </span>
                </div>
                {result.evidence && (
                  <div className="text-xs text-dark-text pl-2 border-l-2 border-dark-border mb-0.5">{result.evidence}</div>
                )}
                {result.suggestions.map((s: string, i: number) => (
                  <div key={i} className="text-xs text-dark-text bg-dark-surface-sunken rounded px-2 py-0.5 mt-0.5">{s}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showRegister && (
        <div className="p-2 rounded-md border border-dark-border text-xs text-dark-text-muted">
          <p>通过 API POST /plugins/register 注册自定义 Plugin：</p>
          <code className="block mt-1 p-2 bg-dark-surface-sunken rounded text-xs overflow-x-auto">
            {JSON.stringify({ id: 'my-plugin', name: '我的检测器', rules: [{ keyword: '关键词', score: 1, evidence: '检测到{count}处' }] }, null, 2)}
          </code>
        </div>
      )}
    </div>
  );
};
