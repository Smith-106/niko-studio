import { useState, useCallback } from 'react'
import { CreativitySlider } from './CreativitySlider'
import type { CreativityPreset } from './CreativitySlider'
import { GuidedOptions } from './GuidedOptions'
import type { GuidedOptionData } from './GuidedOptions'
import { ModeSwitcher } from './ModeSwitcher'

// ============================================================
// Types
// ============================================================

type CoWritingMode = 'auto' | 'guided'

interface AutoResult {
  text: string
  mode: 'auto'
  metadata: {
    model: string
    generatedAt: string
    tokenCount: number
    confidence: number
    creativityLevel: number
  }
}

interface GuidedResult {
  options: GuidedOptionData[]
  mode: 'guided'
  metadata: {
    model: string
    generatedAt: string
    tokenCount: number
    creativityLevel: number
  }
}

type CowritingResult = AutoResult | GuidedResult

// ============================================================
// Component
// ============================================================

export function CoWritingPanel() {
  const [mode, setMode] = useState<CoWritingMode>('auto')
  const [creativityValue, setCreativityValue] = useState(0.5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CowritingResult | null>(null)

  // Generate auto continuation
  const generateAuto = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Mock result for now
      await new Promise(resolve => setTimeout(resolve, 800))
      const mockResult: AutoResult = {
        text: 'The narrative continues with a sense of quiet anticipation. Characters move through the space with purpose, each action carrying the weight of what came before. The dialogue crackles with subtext, revealing layers of motivation beneath the surface.',
        mode: 'auto',
        metadata: {
          model: 'claude-sonnet-4-6',
          generatedAt: new Date().toISOString(),
          tokenCount: 42,
          confidence: 0.85,
          creativityLevel: creativityValue,
        },
      }
      setResult(mockResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }, [creativityValue])

  // Generate guided options
  const generateGuided = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Mock result for now
      await new Promise(resolve => setTimeout(resolve, 1200))
      const mockResult: GuidedResult = {
        options: [
          {
            text: 'The door creaked open, revealing a dimly lit corridor that stretched into shadow. She hesitated, her hand still on the worn brass handle, listening for any sound from within.',
            scores: { coherence: 92, creativity: 65, styleMatch: 88 },
            overallScore: 82,
            index: 0,
          },
          {
            text: 'A sudden draft swept through the room, extinguishing the candle and plunging everything into darkness. She heard footsteps—quick, deliberate—approaching from the hallway.',
            scores: { coherence: 85, creativity: 78, styleMatch: 82 },
            overallScore: 82,
            index: 1,
          },
          {
            text: 'Before she could step inside, a voice called her name from behind. She turned to find him standing at the top of the stairs, his expression unreadable in the fading light.',
            scores: { coherence: 78, creativity: 88, styleMatch: 75 },
            overallScore: 80,
            index: 2,
          },
        ],
        mode: 'guided',
        metadata: {
          model: 'claude-sonnet-4-6',
          generatedAt: new Date().toISOString(),
          tokenCount: 156,
          creativityLevel: creativityValue,
        },
      }
      setResult(mockResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }, [creativityValue])

  // Handle generate button click
  const handleGenerate = useCallback(() => {
    if (mode === 'auto') {
      generateAuto()
    } else {
      generateGuided()
    }
  }, [mode, generateAuto, generateGuided])

  // Handle creativity change
  const handleCreativityChange = useCallback((value: number, _preset: CreativityPreset) => {
    setCreativityValue(value)
  }, [])

  // Handle "Use This" button for guided options
  const handleUseOption = useCallback((_index: number) => {
    // Placeholder: option insertion is not implemented in this release
  }, [result])

  return (
    <div className="flex flex-col gap-3 p-3 h-full">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">AI 协作</h3>
        <ModeSwitcher
          currentMode={mode}
          onModeChange={m => {
            setMode(m)
            setResult(null)
            setError(null)
          }}
          disabled={loading}
        />
      </div>

      {/* Creativity Spectrum */}
      <CreativitySlider
        value={creativityValue}
        mode={mode}
        onChange={handleCreativityChange}
        disabled={loading}
      />

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2 text-xs rounded bg-blue-600/80 hover:bg-blue-600
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            生成中...
          </span>
        ) : mode === 'auto' ? (
          '生成续写'
        ) : (
          '生成选项'
        )}
      </button>

      {/* Error State */}
      {error && (
        <div className="p-2 rounded bg-red-500/20 border border-red-500/50 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Auto Mode Output */}
      {mode === 'auto' && result && result.mode === 'auto' && (
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          <div className="text-[10px] text-zinc-500">生成结果</div>
          <div className="flex-1 overflow-y-auto p-2 rounded bg-zinc-800/50 border border-zinc-700">
            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {result.text}
            </p>
          </div>
        </div>
      )}

      {/* Guided Mode Options */}
      {mode === 'guided' && result && result.mode === 'guided' && (
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          <div className="text-[10px] text-zinc-500">选择续写方案</div>
          <div className="flex-1 overflow-y-auto">
            <GuidedOptions
              options={result.options}
              onSelect={handleUseOption}
              disabled={loading}
            />
          </div>
        </div>
      )}

      {/* Metadata Badge */}
      {result && (
        <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-800 pt-2">
          <div className="flex items-center gap-2">
            <span
              className={`px-1.5 py-0.5 rounded ${
                result.mode === 'auto'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              {result.mode === 'auto' ? '自动' : '引导'}
            </span>
            <span className="font-mono">{result.metadata.model}</span>
          </div>
          <div className="flex items-center gap-2">
            {result.mode === 'auto' && (
              <span className="text-zinc-400">
                {Math.round((result.metadata as AutoResult['metadata']).confidence * 100)}%
              </span>
            )}
            <span className="text-zinc-400">
              {result.metadata.tokenCount} tokens
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
