interface ModeSwitcherProps {
  currentMode: 'auto' | 'guided'
  onModeChange: (mode: 'auto' | 'guided') => void
  disabled?: boolean
}

const MODES = [
  { key: 'auto' as const, label: '自动', description: 'AI 自动续写' },
  { key: 'guided' as const, label: '引导', description: '多方案选择' },
]

export function ModeSwitcher({ currentMode, onModeChange, disabled = false }: ModeSwitcherProps) {
  return (
    <div className="flex gap-1">
      {MODES.map(m => {
        const active = currentMode === m.key
        return (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            disabled={disabled}
            className={`flex flex-col items-center flex-1 px-2 py-1 rounded transition-colors
              ${active ? 'bg-zinc-600 text-white' : 'text-zinc-500 hover:bg-zinc-800'}
              ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className="text-xs font-medium">{m.label}</span>
            <span className="text-[10px] leading-tight">{m.description}</span>
          </button>
        )
      })}
    </div>
  )
}
