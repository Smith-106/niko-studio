import React, { useCallback, useState } from 'react';
import { BarChart3, Loader2, AlertCircle, Download, FileText } from 'lucide-react';
import { analyzeWritingCraft, type LLMConfig, type WritingCraftDimension, type WritingCraftResult } from '../../api/writing-craft';
import { SectionHeader } from './SectionHeader';
import { ProgressBar } from './ProgressBar';
import { WritingDimensionDetail } from './WritingDimensionDetail';
import { InlineAnnotation } from './InlineAnnotation';
import { EmotionalArcChart } from './EmotionalArcChart';
import { ReaderImmersionDashboard } from './ReaderImmersionDashboard';
import { PacingPrescriptionPanel } from './PacingPrescriptionPanel';
import { analyzeEmotionalArc, type EmotionalArcResult } from '../../api/writing-craft';
import { generateMarkdownReport, downloadAsFile } from '../../utils/export-analysis';
import { generatePdfHtml, downloadPdfFile } from '../../utils/export-pdf';

interface WritingDashboardProps {
  text: string;
  visible: boolean;
  llmConfig?: LLMConfig;
  chapters?: Array<{ content: string; chapterIndex: number }>;
}

const DIMENSION_ORDER: WritingCraftDimension[] = [
  'structure', 'character', 'suspense', 'emotion', 'dialogue', 'webnovel', 'show_tell', 'hook', 'cliffhanger',
];

const DIMENSION_LABELS: Record<WritingCraftDimension, string> = {
  structure: '结构',
  character: '角色',
  suspense: '悬疑',
  emotion: '情感',
  dialogue: '对话',
  webnovel: '网文',
  show_tell: 'Show/Tell',
  hook: '钩子',
  cliffhanger: '悬念',
};

function scoreColor(score: number): string {
  if (score >= 7) return '#059669';
  if (score >= 4) return '#d97706';
  return '#dc2626';
}

export const WritingDashboard: React.FC<WritingDashboardProps> = ({ text, visible, llmConfig, chapters }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WritingCraftResult | null>(null);
  const [activeTab, setActiveTab] = useState<WritingCraftDimension>('structure');
  const [showAnnotation, setShowAnnotation] = useState(false);

  const [mode, setMode] = useState<'single' | 'cross'>('single');
  const [crossLoading, setCrossLoading] = useState(false);
  const [crossError, setCrossError] = useState<string | null>(null);
  const [emotionalArc, setEmotionalArc] = useState<EmotionalArcResult | null>(null);

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

  const handleAnalyzeCrossChapter = useCallback(async () => {
    if (!chapters || chapters.length < 2) return;

    setCrossLoading(true);
    setCrossError(null);

    try {
      const arcRes = await analyzeEmotionalArc(chapters);
      if (arcRes.success && arcRes.data) {
        setEmotionalArc(arcRes.data);
      } else {
        setCrossError(arcRes.error ?? 'Analysis failed');
      }
    } catch (err) {
      setCrossError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCrossLoading(false);
    }
  }, [chapters]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const md = generateMarkdownReport(result);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadAsFile(md, `writing-analysis-${timestamp}.md`);
  }, [result]);

  const handleExportPdf = useCallback(() => {
    if (!result) return;
    const html = generatePdfHtml(result);
    downloadPdfFile(html, 'writing-analysis-report.html');
  }, [result]);

  if (!visible) return null;

  const activeDimension = result?.dimensions.find((d) => d.dimension === activeTab) ?? null;

  const crossChapters = chapters ?? [];
  const hasCrossData = crossChapters.length >= 2;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-primary-cta" />
          <h2 className="text-sm font-bold text-dark-text">写作质量分析</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-dark-border overflow-hidden">
            <button
              onClick={() => setMode('single')}
              className={`px-2 py-1.5 text-xs transition-colors ${mode === 'single' ? 'bg-primary-cta/20 text-primary-cta font-semibold' : 'text-dark-text-muted hover:bg-dark-surface-sunken'}`}
            >
              单章
            </button>
            <button
              onClick={() => {
                setMode('cross');
                if (hasCrossData && !emotionalArc && !crossLoading) {
                  void handleAnalyzeCrossChapter();
                }
              }}
              disabled={!hasCrossData}
              className={`px-2 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${mode === 'cross' ? 'bg-primary-cta/20 text-primary-cta font-semibold' : 'text-dark-text-muted hover:bg-dark-surface-sunken'}`}
              title={hasCrossData ? '跨章节分析' : '需要至少 2 章'}
            >
              跨章节
            </button>
          </div>

          {mode === 'single' ? (
            <button
              onClick={handleAnalyze}
              disabled={loading || !text.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-cta text-white
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-primary-cta-hover transition-colors"
            >
              {loading ? '分析中...' : '开始分析'}
            </button>
          ) : (
            <button
              onClick={() => { void handleAnalyzeCrossChapter(); }}
              disabled={crossLoading || !hasCrossData}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-cta text-white
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-primary-cta-hover transition-colors"
            >
              {crossLoading ? '分析中...' : '重新分析'}
            </button>
          )}

          {mode === 'single' && result && (
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
              <button
                onClick={handleExportPdf}
                className="px-2 py-1.5 text-xs rounded-md border border-dark-border text-dark-text-muted hover:bg-dark-surface-sunken transition-colors"
                title="导出 PDF 报告"
              >
                <FileText size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'cross' && !hasCrossData && (
        <div className="text-xs text-dark-text-muted py-2">
          需要至少 2 个章节才能执行跨章节分析。
        </div>
      )}

      {mode === 'cross' && crossError && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-900/20 border border-red-800/40">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-sm text-red-300">{crossError}</span>
        </div>
      )}

      {mode === 'cross' && crossLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-dark-text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">正在分析跨章节数据...</span>
        </div>
      )}

      {mode === 'cross' && !crossLoading && hasCrossData && (
        <div className="flex flex-col gap-4">
          {emotionalArc && (
            <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/10">
              <SectionHeader title="情感弧线" />
              <EmotionalArcChart result={emotionalArc} />
            </div>
          )}

          <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/10">
            <ReaderImmersionDashboard chapters={crossChapters} visible={true} />
          </div>

          <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/10">
            <PacingPrescriptionPanel chapters={crossChapters} visible={true} />
          </div>
        </div>
      )}

      {mode === 'cross' && hasCrossData && !crossLoading && !emotionalArc && !crossError && (
        <div className="text-sm text-dark-text-muted py-6 text-center">
          点击「重新分析」生成跨章节报告。
        </div>
      )}

      {mode === 'single' && loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-dark-text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">正在分析文本...</span>
        </div>
      )}

      {mode === 'single' && error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-900/20 border border-red-800/40">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {mode === 'single' && result && !loading && (
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
                <WritingDimensionDetail dimension={activeDimension} text={text} llmConfig={llmConfig} />
              ) : (
                <div className="text-sm text-dark-text-muted py-4 text-center">
                  未找到该维度的分析结果
                </div>
              )}
            </>
          )}
        </>
      )}

      {mode === 'single' && !result && !loading && !error && (
        <div className="text-sm text-dark-text-muted py-8 text-center">
          输入文本后点击「开始分析」查看写作质量报告
        </div>
      )}
    </div>
  );
};
