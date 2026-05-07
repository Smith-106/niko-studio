import React, { useMemo, useState } from 'react';
import type { WritingCraftDimension, DimensionResult } from '../../api/writing-craft';

interface TrendDataPoint {
  chapterLabel: string;
  scores: Record<WritingCraftDimension, number>;
}

interface TrendChartProps {
  data: TrendDataPoint[];
}

const DIMENSION_COLORS: Record<WritingCraftDimension, string> = {
  structure: '#6366f1',
  character: '#8b5cf6',
  suspense: '#ec4899',
  emotion: '#f59e0b',
  dialogue: '#10b981',
  webnovel: '#06b6d4',
};

const DIMENSION_LABELS: Record<WritingCraftDimension, string> = {
  structure: '结构',
  character: '角色',
  suspense: '悬疑',
  emotion: '情感',
  dialogue: '对话',
  webnovel: '网文',
};

const ALL_DIMS: WritingCraftDimension[] = ['structure', 'character', 'suspense', 'emotion', 'dialogue', 'webnovel'];

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const [visibleDims, setVisibleDims] = useState<Set<WritingCraftDimension>>(
    new Set(ALL_DIMS),
  );
  const [hoverPoint, setHoverPoint] = useState<{ x: number; chapter: number; dim: WritingCraftDimension } | null>(null);

  const toggleDim = (dim: WritingCraftDimension) => {
    setVisibleDims((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });
  };

  const width = 600;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 30, left: 30 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  if (data.length === 0) {
    return (
      <div className="text-sm text-dark-text-muted py-4 text-center">
        暂无跨章节数据，请分析多个章节后查看趋势
      </div>
    );
  }

  const xStep = data.length > 1 ? plotW / (data.length - 1) : plotW / 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        {ALL_DIMS.map((dim) => (
          <label key={dim} className="flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={visibleDims.has(dim)}
              onChange={() => toggleDim(dim)}
              className="w-3 h-3"
            />
            <span style={{ color: DIMENSION_COLORS[dim] }}>{DIMENSION_LABELS[dim]}</span>
          </label>
        ))}
      </div>

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {Array.from({ length: 5 }, (_, i) => {
          const y = padding.top + (plotH / 4) * i;
          const val = 10 - (10 / 4) * i;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#333" strokeWidth={0.5} />
              <text x={padding.left - 5} y={y + 4} textAnchor="end" fill="#888" fontSize={9}>{val}</text>
            </g>
          );
        })}

        {data.map((dp, i) => {
          const x = data.length > 1 ? padding.left + i * xStep : padding.left + plotW / 2;
          return (
            <text key={i} x={x} y={height - 5} textAnchor="middle" fill="#888" fontSize={9}>
              {dp.chapterLabel}
            </text>
          );
        })}

        {ALL_DIMS.filter((dim) => visibleDims.has(dim)).map((dim) => {
          const points = data.map((dp, i) => {
            const x = data.length > 1 ? padding.left + i * xStep : padding.left + plotW / 2;
            const y = padding.top + plotH - (dp.scores[dim] / 10) * plotH;
            return { x, y, score: dp.scores[dim] };
          });

          const pathD = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
            .join(' ');

          return (
            <g key={dim}>
              <path d={pathD} fill="none" stroke={DIMENSION_COLORS[dim]} strokeWidth={1.5} />
              {points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={DIMENSION_COLORS[dim]}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverPoint({ x: p.x, chapter: i, dim })}
                  onMouseLeave={() => setHoverPoint(null)}
                />
              ))}
            </g>
          );
        })}

        {hoverPoint && (
          <text
            x={hoverPoint.x}
            y={padding.top - 2}
            textAnchor="middle"
            fill={DIMENSION_COLORS[hoverPoint.dim]}
            fontSize={10}
          >
            {DIMENSION_LABELS[hoverPoint.dim]}: {data[hoverPoint.chapter].scores[hoverPoint.dim]}
          </text>
        )}
      </svg>
    </div>
  );
};

export type { TrendDataPoint };
