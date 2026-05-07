import React, { useCallback, useState } from 'react';
import { BarChart3, Loader2, AlertCircle, Download } from 'lucide-react';
import { analyzeWritingCraft, type WritingCraftDimension, type WritingCraftResult, type DimensionResult } from '../../api/writing-craft';
import { SectionHeader } from './SectionHeader';
import { ProgressBar } from './ProgressBar';
import { WritingDimensionDetail } from './WritingDimensionDetail';
import { InlineAnnotation } from './InlineAnnotation';
import { generateMarkdownReport, downloadAsFile } from '../../utils/export-analysis';

interface WritingDashboardProps {
  text: string;
  visible: boolean;
}

const DIMENSION_ORDER: WritingCraftDimension[] = [
  'structure', 'character', 'suspense', 'emotion', 'dialogue', 'webnovel',
];

const DIMENSION_LABELS: Record<WritingCraftDimension, string> = {
  structure: '结构',
  character: '角色',
  suspense: '悬疑',
  emotion: '情感',
  dialogue: '对话',
  webnovel: '网文',
};

function scoreColor(score: number): string {
  if (score >= 7) return '#059669';
  if (score >= 4) return '#d97706';
  return '#dc2626';
}

export const WritingDashboard: React.FC<WritingDashboardProps> = ({ text, visible }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WritingCraftResult | null>(null);
  const [activeTab, setActiveTab] = useState<WritingCraftDimension>('structure');
  const [showAnnotation, setShowAnnotation] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await analyzeWritingCraft(text);
      if (response.success && response.data) {
        setResult(response.data);
      } else {
        setError(response.error ?? 'Analysis failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [text]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const md = generateMarkdownReport(result);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadAsFile(md, `writing-analysis-${timestamp}.md`);
  }, [result]);

  if (!visible) return null;

  const activeDimension = result?.dimensions.find((d) => d.dimension === activeTab) ?? null;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-primary-cta" />
          <h2 className="text-sm font-bold text-dark-text">写作质量分析</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAnalyze}
            disabled={loading || !text.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-cta text-white
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-primary-cta-hover transition-colors"
          >
            {loading ? '分析中...' : '开始分析'}
          </button>
          {result && (
            <>
              <button
                onClick={() => setShowAnnotation(!showAnnotation)}
                className="px-2 py-1.5 text-xs rounded-md border border-dark-border text-dark-text-muted hover:bg-dark-surface-sunken transition-colors"
              >
                {showAnnotation ? '面板模式' : '标注模式'}
              </button>
              <button
                onClick={handleExport}
                className="px-2 py-1.5 text-xs rounded-md border border-dark-border text-dark-text-muted hover:bg-dark-surface-sunken transition-colors"
                title="导出 Markdown 报告"
              >
                <Download size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-dark-text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">正在分析文本...</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-900/20 border border-red-800/40">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {result && !loading && (
        <>
          <SectionHeader title={`综合评分 · ${result.overallScore}/10`} />
          <ProgressBar value={(result.overallScore / 10) * 100} />

          {showAnnotation ? (
            <InlineAnnotation text={text} dimensions={result.dimensions} />
          ) : (
            <>
              <div className="flex gap-1 mt-1 overflow-x-auto">
                {DIMENSION_ORDER.map((dim) => {
                  const dimResult = result.dimensions.find((d) => d.dimension === dim);
                  const isActive = activeTab === dim;
                  const score = dimResult?.score ?? 0;
                  return (
                    <button
                      key={dim}
                      onClick={() => setActiveTab(dim)}
                      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-primary-cta/20 text-primary-cta font-semibold'
                          : 'text-dark-text-muted hover:bg-dark-surface-sunken'
                      }`}
                    >
                      <span>{DIMENSION_LABELS[dim]}</span>
                      <span style={{ color: scoreColor(score) }}>{score}</span>
                    </button>
                  );
                })}
              </div>

              {activeDimension ? (
                <WritingDimensionDetail dimension={activeDimension} />
              ) : (
                <div className="text-sm text-dark-text-muted py-4 text-center">
                  未找到该维度的分析结果
                </div>
              )}
            </>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <div className="text-sm text-dark-text-muted py-8 text-center">
          输入文本后点击「开始分析」查看写作质量报告
        </div>
      )}
    </div>
  );
};
