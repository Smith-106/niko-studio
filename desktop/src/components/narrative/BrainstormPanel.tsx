import { useState } from 'react'

interface RoleAnalysis {
  roleId: string
  roleName: string
  findings: Array<{ dimension: string; score: number; issue?: string; suggestion?: string }>
  weightedScore: number
}

interface Props {
  analyses: RoleAnalysis[]
  onApply: (roleId: string, finding: string) => void
}

const roleIcons: Record<string, string> = {
  'plot-architect': '📐', 'character-psychologist': '🧠', 'suspense-engineer': '🔍',
  'emotion-craftsman': '🎭', 'world-builder': '🌍', 'reader-advocate': '👥',
  'style-editor': '✍️', 'continuity-guard': '🔗',
}

export function BrainstormPanel({ analyses, onApply }: Props) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const selected = analyses.find(a => a.roleId === selectedRole)

  return (
    <div className="flex flex-col gap-2 p-3">
      <h3 className="text-sm font-semibold text-zinc-300">多角色分析</h3>
      <div className="grid grid-cols-4 gap-1">
        {analyses.map(a => (
          <button key={a.roleId} onClick={() => setSelectedRole(a.roleId)}
            className={`flex flex-col items-center rounded p-1.5 text-[10px] transition-colors
              ${selectedRole === a.roleId ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
            <span className="text-base">{roleIcons[a.roleId] ?? '📝'}</span>
            <span className="mt-0.5 truncate w-full text-center">{a.roleName}</span>
            <span className={`font-mono ${a.weightedScore >= 70 ? 'text-green-400' : a.weightedScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
              {a.weightedScore}
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="border border-zinc-700 rounded p-2 space-y-1.5">
          <h4 className="text-xs font-semibold text-zinc-300">{selected.roleName} 详细发现</h4>
          {selected.findings.map((f, i) => (
            <div key={i} className="text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">{f.dimension}</span>
                <span className={f.score >= 70 ? 'text-green-400' : f.score >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                  {f.score}/100
                </span>
              </div>
              {f.issue && <p className="text-orange-300">⚠ {f.issue}</p>}
              {f.suggestion && (
                <p className="text-blue-300 flex items-center justify-between">
                  💡 {f.suggestion}
                  <button onClick={() => onApply(selected.roleId, f.dimension)}
                    className="text-zinc-500 hover:text-white underline ml-1">应用</button>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
