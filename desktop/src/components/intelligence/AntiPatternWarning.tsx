import React from 'react'
import { AlertTriangle } from 'lucide-react'

interface AntiPatternWarningProps {
  antiPatternHealth?: number
  criticalCount?: number
}

function resolveTone(antiPatternHealth?: number, criticalCount?: number) {
  const critical = criticalCount ?? 0
  const health = antiPatternHealth ?? 0

  if (critical > 0 || health < 4) {
    return {
      label: '高风险',
      className: 'border-red-800/40 bg-red-900/20 text-red-200',
      description: '当前文本存在明显的结构性写作反模式，建议优先修复。',
    }
  }

  if (health < 7) {
    return {
      label: '需关注',
      className: 'border-amber-700/40 bg-amber-900/20 text-amber-200',
      description: '已检测到一些潜在反模式，建议在修改时重点复查。',
    }
  }

  return {
    label: '健康',
    className: 'border-emerald-800/40 bg-emerald-900/20 text-emerald-200',
    description: '当前维度没有明显的高风险反模式，可继续关注细节优化。',
  }
}

export const AntiPatternWarning: React.FC<AntiPatternWarningProps> = ({
  antiPatternHealth,
  criticalCount,
}) => {
  if (antiPatternHealth == null && criticalCount == null) {
    return null
  }

  const tone = resolveTone(antiPatternHealth, criticalCount)

  return (
    <div className={`rounded-md border px-3 py-2 ${tone.className}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="shrink-0" />
        <span className="text-xs font-semibold">反面模式预警 · {tone.label}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{tone.description}</p>
      <div className="mt-2 flex gap-3 text-[11px] opacity-80">
        <span>健康度：{antiPatternHealth ?? '—'} / 10</span>
        <span>严重项：{criticalCount ?? 0}</span>
      </div>
    </div>
  )
}
