import React from 'react'
import type { ShowTellAnalysisResult } from '../../api/writing-craft'

interface ShowTellLegendProps {
  result: ShowTellAnalysisResult | null
}

export const ShowTellLegend: React.FC<ShowTellLegendProps> = ({ result }) => {
  if (!result) {
    return (
      <div className="flex items-center gap-3 text-[11px] text-dark-text-muted" />
    )
  }

  const showPct = Math.round((result.showTellRatio ?? 0) * 100)
  const tellPct = 100 - showPct

  return (
    <div className="flex items-center gap-3 text-[11px] text-dark-text-muted">
      <span className="ml-1">比例：Show {showPct}% / Tell {tellPct}%</span>
    </div>
  )
}
