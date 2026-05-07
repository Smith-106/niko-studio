import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { ProgressBar } from './ProgressBar';
import { analyzeWritingCraftLLM, type DimensionResult, type LLMConfig } from '../../api/writing-craft';

interface WritingDimensionDetailProps {
  dimension: DimensionResult;
  text?: string;
  llmConfig?: LLMConfig;
}

function scoreLabel(score: number): string {
  if (score >= 8) return '优秀';
  if (score >= 6) return '良好';
  if (score >= 4) return '一般';
  return '待改进';
}

export const WritingDimensionDetail: React.FC<WritingDimensionDetailProps> = ({ dimension, text, llmConfig }) => {
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmAnalysis, setLlmAnalysis] = useState<string | null>(null);
  const [llmSuggestions, setLlmSuggestions] = useState<string[]>([]);

  const handleDeepAnalyze = async () => {
    if (!text || !llmConfig) return;
    setLlmLoading(true);
    try {
      const response = await analyzeWritingCraftLLM(text, llmConfig, [dimension.dimension]);
      if (response.success && response.data) {
        const llmDim = response.data.dimensions[0];
        if (llmDim) {
          setLlmAnalysis((llmDim.details as Record<string, unknown>).analysis as string ?? null);
          setLlmSuggestions(llmDim.suggestions);
        }
      }
    } catch {
      setLlmAnalysis('分析失败，请检查 LLM 配置');
    } finally {
      setLlmLoading(false);
    }
  };

  const pct = (dimension.score / dimension.maxScore) * 100;

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title={`${dimension.label} · ${dimension.score}/${dimension.maxScore} · ${scoreLabel(dimension.score)}`} />
      <ProgressBar value={pct} />

      {dimension.evidence.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-dark-text-muted mb-1">检测证据</h4>
          <ul className="space-y-0.5">
            {dimension.evidence.map((item, i) => (
              <li key={i} className="text-xs text-dark-text pl-2 border-l-2 border-dark-border">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dimension.suggestions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-dark-text-muted mb-1">改进建议</h4>
          <ul className="space-y-1">
            {dimension.suggestions.slice(0, 5).map((s, i) => (
              <li key={i} className="text-xs text-dark-text bg-dark-surface-sunken rounded px-2 py-1">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {llmConfig && text && (
        <div className="border-t border-dark-border pt-2">
          <button
            onClick={handleDeepAnalyze}
            disabled={llmLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                       bg-purple-600/20 text-purple-300 hover:bg-purple-600/30
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {llmLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {llmLoading ? 'AI 深度分析中...' : 'AI 深度分析'}
          </button>

          {llmAnalysis && (
            <div className="mt-2 p-2 rounded-md bg-purple-900/10 border border-purple-800/30">
              <div className="flex items-center gap-1 mb-1">
                <Sparkles size={10} className="text-purple-400" />
                <span className="text-xs font-semibold text-purple-300">AI 分析</span>
              </div>
              <p className="text-xs text-dark-text leading-relaxed">{llmAnalysis}</p>
              {llmSuggestions.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {llmSuggestions.map((s, i) => (
                    <li key={i} className="text-xs text-dark-text pl-2 border-l-2 border-purple-600/40">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
