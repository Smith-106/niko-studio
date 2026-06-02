import { useCallback, useMemo, useId } from 'react'

// ============================================================
// Types
// ============================================================

export interface CreativityPreset {
  id: string
  label: string
  value: number
}

export interface CreativitySliderProps {
  value: number // 0-1
  mode: 'auto' | 'guided'
  onChange: (value: number, preset: CreativityPreset) => void
  disabled?: boolean
}

// ============================================================
// Constants
// ============================================================

const MODE_BALANCED_DEFAULT: Record<'auto' | 'guided', number> = {
  auto: 0.5,
  guided: 0.6,
}

const PRESETS: CreativityPreset[] = [
  { id: 'conservative', label: '保守', value: 0.2 },
  { id: 'balanced', label: '平衡', value: 0.5 },
  { id: 'creative', label: '创意', value: 0.7 },
  { id: 'experimental', label: '实验', value: 0.9 },
]

// ============================================================
// Helpers
// ============================================================

/** Map a 0-1 value to a position along the blue→purple→orange gradient */
function gradientStop(value: number): string {
  if (value <= 0.5) {
    // blue (#3b82f6) → purple (#a855f7)
    const t = value * 2
    const r = Math.round(59 + (168 - 59) * t)
    const g = Math.round(130 + (85 - 130) * t)
    const b = Math.round(246 + (247 - 246) * t)
    return `rgb(${r},${g},${b})`
  }
  // purple (#a855f7) → orange (#f97316)
  const t = (value - 0.5) * 2
  const r = Math.round(168 + (249 - 168) * t)
  const g = Math.round(85 + (115 - 85) * t)
  const b = Math.round(247 + (22 - 247) * t)
  return `rgb(${r},${g},${b})`
}

// ============================================================
// Component
// ============================================================

export function CreativitySlider({ value, mode, onChange, disabled = false }: CreativitySliderProps) {
  const styleId = useId()
  const resolvedPresets = useMemo<CreativityPreset[]>(
    () =>
      PRESETS.map(p =>
        p.id === 'balanced' ? { ...p, value: MODE_BALANCED_DEFAULT[mode] } : p,
      ),
    [mode],
  )

  const activePresetId = useMemo(() => {
    for (const p of resolvedPresets) {
      if (Math.abs(value - p.value) < 0.05) return p.id
    }
    return null
  }, [value, resolvedPresets])

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = parseFloat(e.target.value)
      // Find closest preset if within tolerance, otherwise use custom
      const matched = resolvedPresets.find(p => Math.abs(next - p.value) < 0.05)
      onChange(next, matched ?? { id: 'custom', label: '自定义', value: next })
    },
    [resolvedPresets, onChange],
  )

  const handlePresetClick = useCallback(
    (preset: CreativityPreset) => {
      onChange(preset.value, preset)
    },
    [onChange],
  )

  const pct = Math.round(value * 100)
  const trackColor = gradientStop(value)
  const trackGradient = `linear-gradient(to right, #3b82f6 0%, #a855f7 50%, #f97316 100%)`

  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {/* Header: label + percentage */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">创造力光谱</span>
        <span className="text-[10px] font-mono text-zinc-400">{pct}%</span>
      </div>

      {/* Slider */}
      <div className="relative">
        {/* Gradient track background */}
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
          style={{ background: trackGradient, opacity: 0.25 }}
        />
        {/* Filled portion */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full left-0"
          style={{
            width: `${pct}%`,
            background: trackGradient,
          }}
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={value}
          onChange={handleSliderChange}
          disabled={disabled}
          data-slider-id={styleId}
          className="relative z-10 w-full h-1.5 rounded-full appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-900
            disabled:cursor-not-allowed"
        />
        {/* Thumb color override via scoped style */}
        <style id={styleId}>{`
          input[type=range][data-slider-id="${styleId}"]::-webkit-slider-thumb {
            background: ${trackColor};
          }
          input[type=range][data-slider-id="${styleId}"]::-moz-range-thumb {
            background: ${trackColor};
            border: 2px solid #18181b;
            width: 12px;
            height: 12px;
            border-radius: 9999px;
          }
          input[type=range][data-slider-id="${styleId}"]::-moz-range-track {
            background: transparent;
            height: 6px;
          }
        `}</style>
      </div>

      {/* Preset buttons */}
      <div className="flex gap-1">
        {resolvedPresets.map(preset => (
          <button
            key={preset.id}
            onClick={() => handlePresetClick(preset)}
            disabled={disabled}
            className={`flex-1 py-1 text-[10px] rounded transition-colors ${
              activePresetId === preset.id
                ? 'bg-blue-600/80 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            } disabled:cursor-not-allowed`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
