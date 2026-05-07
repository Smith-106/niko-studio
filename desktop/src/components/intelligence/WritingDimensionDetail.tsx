import React from 'react';
import { SectionHeader } from './SectionHeader';
import { ProgressBar } from './ProgressBar';
import type { DimensionResult } from '../../api/writing-craft';

interface WritingDimensionDetailProps {
  dimension: DimensionResult;
}

function scoreLabel(score: number): string {
  if (score >= 8) return '优秀';
  if (score >= 6) return '良好';
  if (score >= 4) return '一般';
  return '待改进';
}

export const WritingDimensionDetail: React.FC<WritingDimensionDetailProps> = ({ dimension }) => {
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
    </div>
  );
};
