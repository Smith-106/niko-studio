import { useState, useMemo } from 'react'
import type { OverlayMarker } from '../../types/reader'

export interface ReaderOverlayProps {
  markers: OverlayMarker[]
  visible?: boolean
  onMarkerClick?: (markerId: string) => void
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
}

const SEVERITY_BORDER_COLORS: Record<string, string> = {
  critical: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-yellow-500',
  low: 'border-blue-500',
}

const DIMENSION_LABELS: Record<string, string> = {
  Plot: '情节',
  Character: '角色',
  Style: '风格',
  Pacing: '节奏',
  Suspense: '悬疑',
  Emotion: '情感',
  Worldview: '世界观',
  Continuity: '连贯性',
}

type DimensionFilter = 'All' | 'Plot' | 'Character' | 'Style' | 'Pacing'

export function ReaderOverlay({
  markers,
  visible = true,
  onMarkerClick,
}: ReaderOverlayProps) {
  const [dimensionFilter, setDimensionFilter] = useState<DimensionFilter>('All')
  const [showConsensus, setShowConsensus] = useState(true)
  const [showDissent, setShowDissent] = useState(true)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)

  const filteredMarkers = useMemo(() => {
    return markers.filter((marker) => {
      const dimensionMatch =
        dimensionFilter === 'All' || marker.dimension === dimensionFilter
      const typeMatch =
        (showConsensus && marker.type === 'consensus') ||
        (showDissent && marker.type === 'dissent')
      return dimensionMatch && typeMatch
    })
  }, [markers, dimensionFilter, showConsensus, showDissent])

  const selectedMarker = useMemo(() => {
    return filteredMarkers.find((m) => m.id === selectedMarkerId) ?? null
  }, [filteredMarkers, selectedMarkerId])

  if (!visible) {
    return null
  }

  const handleMarkerClick = (markerId: string) => {
    setSelectedMarkerId(markerId)
    onMarkerClick?.(markerId)
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">读者模拟叠加层</h3>
        <span className="text-xs text-zinc-500">
          {filteredMarkers.length} / {markers.length} 标记
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Dimension Filter */}
        <select
          value={dimensionFilter}
          onChange={(e) => setDimensionFilter(e.target.value as DimensionFilter)}
          className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300 border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="All">全部维度</option>
          <option value="Plot">情节</option>
          <option value="Character">角色</option>
          <option value="Style">风格</option>
          <option value="Pacing">节奏</option>
        </select>

        {/* Consensus Toggle */}
        <button
          onClick={() => setShowConsensus(!showConsensus)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            showConsensus
              ? 'bg-zinc-600 text-white border-zinc-500'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700'
          }`}
        >
          共识 ({markers.filter((m) => m.type === 'consensus').length})
        </button>

        {/* Dissent Toggle */}
        <button
          onClick={() => setShowDissent(!showDissent)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            showDissent
              ? 'bg-zinc-600 text-white border-zinc-500'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700'
          }`}
        >
          分歧 ({markers.filter((m) => m.type === 'dissent').length})
        </button>
      </div>

      {/* Marker List */}
      {filteredMarkers.length === 0 ? (
        <p className="text-xs text-zinc-600 py-2">暂无符合条件的标记</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
          {filteredMarkers.map((marker) => {
            const isSelected = selectedMarkerId === marker.id
            const baseColor = SEVERITY_COLORS[marker.severity]
            const borderColor = SEVERITY_BORDER_COLORS[marker.severity]
            const dimensionLabel = DIMENSION_LABELS[marker.dimension] ?? marker.dimension

            return (
              <button
                key={marker.id}
                type="button"
                onClick={() => handleMarkerClick(marker.id)}
                className={`w-full text-left rounded border p-2 text-xs transition-all ${
                  isSelected
                    ? `${borderColor} bg-zinc-700/50`
                    : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Marker Dot */}
                    {marker.type === 'consensus' ? (
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${baseColor}`}
                        style={{
                          transform: `scale(${0.8 + Math.min(marker.personaCount * 0.1, 0.5)})`,
                        }}
                      />
                    ) : (
                      <span
                        className={`w-2.5 h-2.5 rounded-full border-2 ${borderColor} flex items-center justify-center text-[8px] text-zinc-400`}
                      >
                        ?
                      </span>
                    )}
                    <span className="font-medium text-zinc-300 truncate max-w-[120px]">
                      {dimensionLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="text-[10px]">{marker.severity}</span>
                    <span className="text-[10px] bg-zinc-700 px-1 rounded">
                      {marker.personaCount}人
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-zinc-400 line-clamp-2 text-[10px]">
                  {marker.description}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Selected Marker Tooltip */}
      {selectedMarker && (
        <div className="mt-2 rounded border border-zinc-600 bg-zinc-800/80 p-3 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-700 pb-2 mb-2">
            <span className="font-semibold text-zinc-200">
              {DIMENSION_LABELS[selectedMarker.dimension] ?? selectedMarker.dimension}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                SEVERITY_COLORS[selectedMarker.severity]
              } text-white`}
            >
              {selectedMarker.severity}
            </span>
          </div>
          <p className="text-zinc-300 leading-relaxed">{selectedMarker.description}</p>
          <div className="mt-2 pt-2 border-t border-zinc-700 space-y-1 text-zinc-500">
            <div className="flex justify-between">
              <span>共识强度</span>
              <span className="text-zinc-300 font-mono">
                {(selectedMarker.consensusStrength * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>涉及角色</span>
              <span className="text-zinc-300">{selectedMarker.personaCount}</span>
            </div>
            {selectedMarker.personaIds.length > 0 && (
              <div className="pt-1">
                <span className="text-zinc-500">角色 ID:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedMarker.personaIds.slice(0, 5).map((id) => (
                    <span
                      key={id}
                      className="px-1.5 py-0.5 bg-zinc-700 rounded text-[10px] text-zinc-400"
                    >
                      {id}
                    </span>
                  ))}
                  {selectedMarker.personaIds.length > 5 && (
                    <span className="text-[10px] text-zinc-500">
                      +{selectedMarker.personaIds.length - 5} 更多
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
