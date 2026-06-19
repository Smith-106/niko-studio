import React, { useState, useCallback } from 'react';
import {
  ShieldCheck,
  Loader2,
  AlertCircle,
  ChevronDown,
  Sparkles,
  Play,
} from 'lucide-react';
import { callApi, type ApiResponse } from '../../api/core';

// ============================================================
// Types (mirrors src-ts/quality/types.ts)
// ============================================================

export type QualityDimension =
  | 'plot-coherence'
  | 'character-consistency'
  | 'style-consistency'
  | 'pacing-tension';

export type ConstraintSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface HardConstraintViolation {
  dimension: QualityDimension;
  severity: ConstraintSeverity;
  message: string;
  location: {
    chapterId?: string;
    paragraphIndex?: number;
    characterId?: string;
  };
  evidence: string;
  suggestedFix: string | null;
}

export interface HardConstraintResult {
  dimension: QualityDimension;
  score: number;
  violations: HardConstraintViolation[];
  passed: boolean;
}

export interface HardConstraintReport {
  overallScore: number;
  dimensionResults: HardConstraintResult[];
  allViolations: HardConstraintViolation[];
  blockingViolations: HardConstraintViolation[];
  timestamp: string;
}

export type CreativityPreset =
  | 'conservative'
  | 'balanced'
  | 'creative'
  | 'experimental';

export interface CreativitySpectrumConfig {
  value: number;
  preset: CreativityPreset;
  modeDefault: number;
  constraints: {
    maxSentenceLength: number;
    minVocabularyDiversity: number;
    maxMetaphorDensity: number;
    allowNonlinearStructure: boolean;
    allowUnreliableNarrator: boolean;
  };
}

export type QCEforcementMode = 'blocking' | 'advisory';

export interface QCEnforcementResult {
  mode: QCEforcementMode;
  allowed: boolean;
  warnings: HardConstraintViolation[];
  blocked: HardConstraintViolation[];
  creativityConfig: CreativitySpectrumConfig;
}

// ============================================================
// Props
// ============================================================

export interface QCDashboardProps {
  novelId: string;
}

// ============================================================
// Constants
// ============================================================

const DIMENSION_META: Record<
  QualityDimension,
  { label: string; icon: string }
> = {
  'plot-coherence': { label: '情节连贯', icon: '🔗' },
  'character-consistency': { label: '角色一致', icon: '👤' },
  'style-consistency': { label: '风格一致', icon: '✍️' },
  'pacing-tension': { label: '节奏张力', icon: '⚡' },
};

const DIMENSION_ORDER: QualityDimension[] = [
  'plot-coherence',
  'character-consistency',
  'style-consistency',
  'pacing-tension',
];

const SEVERITY_META: Record<
  ConstraintSeverity,
  { label: string; bg: string; text: string }
> = {
  critical: {
    label: '严重',
    bg: 'rgba(239, 68, 68, 0.15)',
    text: '#f87171',
  },
  high: {
    label: '高',
    bg: 'rgba(245, 158, 11, 0.15)',
    text: '#fbbf24',
  },
  medium: {
    label: '中',
    bg: 'rgba(59, 130, 246, 0.15)',
    text: '#60a5fa',
  },
  low: {
    label: '低',
    bg: 'rgba(100, 116, 139, 0.15)',
    text: '#94a3b8',
  },
};

const PRESET_LABELS: Record<CreativityPreset, string> = {
  conservative: '保守',
  balanced: '均衡',
  creative: '创意',
  experimental: '实验',
};

// ============================================================
// Helpers
// ============================================================

function scoreColor(score: number): string {
  if (score >= 0.7) return '#10b981';
  if (score >= 0.4) return '#f59e0b';
  return '#ef4444';
}

function scoreBarBg(score: number): string {
  if (score >= 0.7) return 'bg-emerald-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================================
// Sub-components
// ============================================================

/** Overall quality score circle at top */
const OverallScore: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.round(score * 100);
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (circumference * pct) / 100;

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 shrink-0">
        <svg
          className="w-20 h-20 -rotate-90"
          viewBox="0 0 80 80"
        >
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-zinc-800"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>
            {pct}
          </span>
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold text-zinc-200">综合质量评分</div>
        <div className="text-xs text-zinc-500 mt-0.5">
          {pct >= 70
            ? '质量良好，可继续优化细节'
            : pct >= 40
              ? '存在改进空间，建议关注违规项'
              : '质量较低，建议优先修复严重问题'}
        </div>
      </div>
    </div>
  );
};

/** Single dimension card */
const DimensionCard: React.FC<{
  dimension: QualityDimension;
  result: HardConstraintResult;
}> = ({ dimension, result }) => {
  const meta = DIMENSION_META[dimension];
  const pct = Math.round(result.score * 100);
  const color = scoreColor(result.score);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{meta.icon}</span>
          <span className="text-xs font-semibold text-zinc-300">
            {meta.label}
          </span>
        </div>
        <span className="text-xs font-mono font-bold" style={{ color }}>
          {pct}%
        </span>
      </div>

      {/* Score bar */}
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${scoreBarBg(result.score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
        <span>
          违规 {result.violations.length} 项
        </span>
        <span>
          {result.passed ? '✓ 通过' : '✗ 未通过'}
        </span>
      </div>
    </div>
  );
};

/** Creativity spectrum display */
const CreativitySpectrum: React.FC<{ config: CreativitySpectrumConfig }> = ({
  config,
}) => {
  const pct = Math.round(config.value * 100);
  const presetLabel = PRESET_LABELS[config.preset] ?? config.preset;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={14} className="text-amber-400" />
        <span className="text-xs font-semibold text-zinc-300">创意光谱</span>
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-zinc-500">
          预设: <span className="text-zinc-300 font-medium">{presetLabel}</span>
        </span>
        <span className="text-[10px] text-zinc-500">
          值: <span className="text-zinc-300 font-mono">{config.value.toFixed(2)}</span>
        </span>
      </div>

      {/* Spectrum bar */}
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-purple-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        {/* Mode default marker */}
        <div
          className="absolute top-0 h-1.5 w-px bg-zinc-400"
          style={{ left: `${Math.round(config.modeDefault * 100)}%` }}
          title={`模式默认: ${config.modeDefault.toFixed(2)}`}
        />
      </div>

      {/* Mode-specific enforcement */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Object.entries(config.constraints).map(([key, val]) => {
          const labelMap: Record<string, string> = {
            maxSentenceLength: '最大句长',
            minVocabularyDiversity: '最低词汇多样性',
            maxMetaphorDensity: '最大隐喻密度',
            allowNonlinearStructure: '非线性结构',
            allowUnreliableNarrator: '不可靠叙述',
          };
          const displayVal =
            typeof val === 'boolean' ? (val ? '允许' : '禁止') : String(val);
          const isActive =
            typeof val === 'boolean' ? val : true;

          return (
            <span
              key={key}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${
                isActive
                  ? 'bg-zinc-800 text-zinc-400'
                  : 'bg-zinc-900 text-zinc-600 line-through'
              }`}
            >
              {labelMap[key] ?? key}: {displayVal}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Expandable violation row */
const ViolationRow: React.FC<{ violation: HardConstraintViolation }> = ({
  violation,
}) => {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_META[violation.severity];
  const dimMeta = DIMENSION_META[violation.dimension];

  const locationParts: string[] = [];
  if (violation.location.chapterId)
    locationParts.push(`章节 ${violation.location.chapterId}`);
  if (violation.location.paragraphIndex != null)
    locationParts.push(`段落 ${violation.location.paragraphIndex}`);
  if (violation.location.characterId)
    locationParts.push(`角色 ${violation.location.characterId}`);
  const locationText =
    locationParts.length > 0 ? locationParts.join(' / ') : '—';

  return (
    <div className="border-b border-zinc-800 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-2 px-1 text-left hover:bg-zinc-800/40 transition-colors"
        aria-expanded={expanded}
      >
        <ChevronDown
          size={12}
          className={`shrink-0 text-zinc-600 transition-transform duration-150 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: sev.bg, color: sev.text }}
        >
          {sev.label}
        </span>
        <span className="text-[10px] text-zinc-500 shrink-0">
          {dimMeta.icon}
        </span>
        <span className="text-xs text-zinc-300 truncate flex-1">
          {violation.message}
        </span>
      </button>

      {expanded && (
        <div className="px-6 pb-2 space-y-1.5">
          <div className="text-[10px] text-zinc-500">
            <span className="text-zinc-400">位置:</span>{' '}
            {locationText}
          </div>
          {violation.evidence && (
            <div className="text-[10px] text-zinc-500">
              <span className="text-zinc-400">证据:</span>{' '}
              {violation.evidence}
            </div>
          )}
          {violation.suggestedFix && (
            <div className="text-[10px] text-zinc-500">
              <span className="text-zinc-400">建议修复:</span>{' '}
              <span className="text-emerald-400/80">
                {violation.suggestedFix}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const QCDashboard: React.FC<QCDashboardProps> = ({ novelId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<HardConstraintReport | null>(null);
  const [enforcement, setEnforcement] = useState<QCEnforcementResult | null>(
    null,
  );

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Call /qc/validate endpoint
      const res: ApiResponse<{ result: QCEnforcementResult }> = await callApi(
        '/qc/validate',
        'POST',
        { text: novelId, mode: 'auto' },
      );

      if (!res.success || !res.data?.result) {
        setError(res.error ?? 'Quality check failed');
        return;
      }

      const qcResult = res.data.result;

      // Build a HardConstraintReport from the enforcement result
      const allViolations = [
        ...qcResult.blocked,
        ...qcResult.warnings,
      ];

      // Group violations by dimension
      const dimensionMap = new Map<QualityDimension, HardConstraintViolation[]>();
      for (const v of allViolations) {
        const list = dimensionMap.get(v.dimension) ?? [];
        list.push(v);
        dimensionMap.set(v.dimension, list);
      }

      // Build dimension results with placeholder scores for dimensions without violations
      const dimensionResults: HardConstraintResult[] = DIMENSION_ORDER.map(
        (dim) => {
          const violations = dimensionMap.get(dim) ?? [];
          // Derive score from violation severity count (heuristic)
          const criticalCount = violations.filter(
            (v) => v.severity === 'critical',
          ).length;
          const highCount = violations.filter(
            (v) => v.severity === 'high',
          ).length;
          const mediumCount = violations.filter(
            (v) => v.severity === 'medium',
          ).length;
          const lowCount = violations.filter(
            (v) => v.severity === 'low',
          ).length;
          const penalty =
            criticalCount * 0.3 +
            highCount * 0.2 +
            mediumCount * 0.1 +
            lowCount * 0.05;
          const score = Math.max(0, Math.min(1, 1 - penalty));

          return {
            dimension: dim,
            score,
            violations,
            passed: score >= 0.5,
          };
        },
      );

      const overallScore =
        dimensionResults.reduce((sum, r) => sum + r.score, 0) /
        dimensionResults.length;

      const blockingViolations = allViolations.filter(
        (v) => v.severity === 'critical' || v.severity === 'high',
      );

      setReport({
        overallScore,
        dimensionResults,
        allViolations,
        blockingViolations,
        timestamp: new Date().toISOString(),
      });
      setEnforcement(qcResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-zinc-200">质量控制面板</h2>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-emerald-600 text-white
                     disabled:opacity-40 disabled:cursor-not-allowed
                     hover:bg-emerald-500 transition-colors"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          {loading ? '检查中...' : '运行质量检查'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-900/20 border border-red-800/40">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">正在执行质量检查...</span>
        </div>
      )}

      {/* Results */}
      {report && !loading && (
        <>
          {/* Overall score */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <OverallScore score={report.overallScore} />
            {report.timestamp && (
              <div className="mt-2 text-[10px] text-zinc-600">
                最近检查: {formatTimestamp(report.timestamp)}
              </div>
            )}
          </div>

          {/* Dimension cards */}
          <div className="grid grid-cols-2 gap-2">
            {report.dimensionResults.map((dr) => (
              <DimensionCard
                key={dr.dimension}
                dimension={dr.dimension}
                result={dr}
              />
            ))}
          </div>

          {/* Creativity spectrum */}
          {enforcement?.creativityConfig && (
            <CreativitySpectrum config={enforcement.creativityConfig} />
          )}

          {/* Enforcement status */}
          {enforcement && (
            <div
              className={`rounded-md border px-3 py-2 text-xs ${
                enforcement.allowed
                  ? 'border-emerald-800/40 bg-emerald-900/20 text-emerald-200'
                  : 'border-red-800/40 bg-red-900/20 text-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {enforcement.allowed ? '输出允许' : '输出被阻止'}
                </span>
                <span className="opacity-70">
                  ({enforcement.mode === 'blocking' ? '阻断模式' : '建议模式'})
                </span>
              </div>
              {!enforcement.allowed && enforcement.blocked.length > 0 && (
                <div className="mt-1 opacity-80">
                  {enforcement.blocked.length} 项阻断性违规需要修复
                </div>
              )}
            </div>
          )}

          {/* Violations list */}
          {report.allViolations.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60">
              <div className="px-3 py-2 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">
                    违规列表
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    共 {report.allViolations.length} 项
                  </span>
                </div>
              </div>
              <div className="px-2">
                {report.allViolations.map((v, i) => (
                  <ViolationRow
                    key={`${v.dimension}-${v.severity}-${i}`}
                    violation={v}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No violations */}
          {report.allViolations.length === 0 && (
            <div className="rounded-lg border border-emerald-800/40 bg-emerald-900/20 px-3 py-4 text-center">
              <div className="text-xs text-emerald-300 font-semibold">
                未检测到违规项
              </div>
              <div className="text-[10px] text-emerald-400/60 mt-1">
                当前文本质量良好
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!report && !loading && !error && (
        <div className="text-sm text-zinc-600 py-8 text-center">
          点击「运行质量检查」查看质量控制报告
        </div>
      )}
    </div>
  );
};
