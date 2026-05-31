interface Props {
  dimensions: Record<string, number>
  overall: number
  criticalIssues: string[]
  suggestions: string[]
}

const dimLabels: Record<string, string> = {
  hook: '钩子', cliffhanger: '悬念', emotion_craft: '情感工艺',
  suspense: '悬疑', character: '角色', pacing: '节奏',
  retention: '留存', style: '风格', worldview: '世界观',
  continuity: '连贯性',
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

export function QualityScorePanel({ dimensions, overall, criticalIssues, suggestions }: Props) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">质量评分</h3>
        <span className={`text-lg font-bold ${scoreColor(overall)}`}>{overall}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(dimensions).map(([dim, score]) => (
          <div key={dim} className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">{dimLabels[dim] ?? dim}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${score}%` }} />
              </div>
              <span className={`w-7 text-right ${scoreColor(score)}`}>{score}</span>
            </div>
          </div>
        ))}
      </div>
      {criticalIssues.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-red-400">关键问题</span>
          {criticalIssues.map((issue, i) => (
            <p key={i} className="text-[10px] text-red-300">• {issue}</p>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-blue-400">改进建议</span>
          {suggestions.map((s, i) => (
            <p key={i} className="text-[10px] text-blue-300">• {s}</p>
          ))}
        </div>
      )}
    </div>
  )
}
