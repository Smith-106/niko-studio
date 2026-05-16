import React from 'react'
import type { ShowTellAnalysisResult } from '../../api/writing-craft'

interface ShowTellLegendProps {
  result: ShowTellAnalysisResult | null
}

export const ShowTellLegend: React.FC<ShowTellLegendProps> = ({ result }) => {
  const showPct = result ? Math.round((result.showTellRatio ?? 0) * 100) : null
  const tellPct = result ? 100 - (showPct ?? 0) : null

  return (
    <div className="flex items-center gap-3 text-[11px] text-dark-text-muted">
      {showPct !== null && tellPct !== null && (
        <span className="ml-1">比例：Show {showPct}% / Tell {tellPct}%</span>
      )}
    </div>
  )
}
