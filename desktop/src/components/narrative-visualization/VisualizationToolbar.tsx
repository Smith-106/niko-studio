import { ALL_EVENT_TYPES, type NarrativeVisualizationViewMode } from './useVisualizationState'

const EVENT_TYPE_LABELS: Record<string, string> = {
  turning_point: 'Turning Point',
  conflict: 'Conflict',
  warning: 'Warning',
}

interface VisualizationToolbarProps {
  activeView: NarrativeVisualizationViewMode
  availableViews: Array<{ id: NarrativeVisualizationViewMode; label: string }>
  onViewChange: (view: NarrativeVisualizationViewMode) => void
  zoomScale?: number
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetZoom?: () => void
  eventFilters?: string[]
  onToggleEventFilter?: (eventType: string) => void
}

export function VisualizationToolbar({
  activeView,
  availableViews,
  onViewChange,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  eventFilters,
  onToggleEventFilter,
}: VisualizationToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Narrative visualization modes">
      {availableViews.map((view) => (
        <button
          key={view.id}
          type="button"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            activeView === view.id
              ? 'border-primary-500 bg-primary-500/15 text-primary-200'
              : 'border-dark-border bg-dark-card text-dark-text-muted'
          }`}
          aria-pressed={activeView === view.id}
          onClick={() => onViewChange(view.id)}
        >
          {view.label}
        </button>
      ))}

      {onZoomIn && onZoomOut && onResetZoom && (
        <div className="ml-2 flex items-center gap-1 border-l border-dark-border pl-2" aria-label="Zoom controls">
          <button
            type="button"
            className="rounded border border-dark-border bg-dark-card px-2 py-1 text-xs text-dark-text-muted hover:text-dark-text-primary"
            onClick={onZoomIn}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="rounded border border-dark-border bg-dark-card px-2 py-1 text-xs text-dark-text-muted hover:text-dark-text-primary"
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            className="rounded border border-dark-border bg-dark-card px-2 py-1 text-xs text-dark-text-muted hover:text-dark-text-primary"
            onClick={onResetZoom}
            aria-label="Reset zoom"
          >
            Reset
          </button>
          {zoomScale != null && (
            <span className="text-xs text-dark-text-muted">{Math.round(zoomScale * 100)}%</span>
          )}
        </div>
      )}

      {eventFilters != null && onToggleEventFilter && (
        <div className="ml-2 flex items-center gap-2 border-l border-dark-border pl-2" aria-label="Event type filters">
          {ALL_EVENT_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={eventFilters.includes(type)}
                onChange={() => onToggleEventFilter(type)}
                className="h-3 w-3"
              />
              <span className="text-dark-text-muted">{EVENT_TYPE_LABELS[type]}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
