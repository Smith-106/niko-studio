import { useState } from 'react'

interface ForeshadowAlert {
  foreshadowId: string
  hint: string
  plantedAt: number
  currentChapter: number
  chaptersUntilDue: number
  urgency: 'approaching' | 'due' | 'overdue'
}

interface Props {
  alerts: ForeshadowAlert[]
  onResolve: (id: string) => void
}

const urgencyColor: Record<string, string> = {
  overdue: 'bg-red-500/20 text-red-400 border-red-500/50',
  due: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  approaching: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
}

export function ForeshadowPanel({ alerts, onResolve }: Props) {
  const [filter, setFilter] = useState<'all' | 'due' | 'overdue'>('all')
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.urgency === filter)

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">伏笔追踪</h3>
        <div className="flex gap-1">
          {(['all', 'due', 'overdue'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2 py-0.5 text-xs rounded ${filter === f ? 'bg-zinc-600 text-white' : 'text-zinc-500'}`}>
              {f === 'all' ? '全部' : f === 'due' ? '到期' : '过期'}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-zinc-600">暂无伏笔提醒</p>
      ) : (
        filtered.map(a => (
          <div key={a.foreshadowId}
            className={`rounded border p-2 text-xs ${urgencyColor[a.urgency]}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{a.hint}</span>
              <span className="text-[10px]">{a.urgency === 'overdue' ? '已过期' : a.urgency === 'due' ? '即将到期' : '接近'}</span>
            </div>
            <div className="mt-1 text-zinc-400">
              第{a.plantedAt}章埋设 · 还剩{a.chaptersUntilDue}章
            </div>
            <button onClick={() => onResolve(a.foreshadowId)}
              className="mt-1 text-[10px] text-zinc-400 hover:text-white underline">
              标记已回收
            </button>
          </div>
        ))
      )}
    </div>
  )
}
