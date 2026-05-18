import type { NarrativeVisualizationViewMode } from './useVisualizationState'

interface VisualizationToolbarProps {
  activeView: NarrativeVisualizationViewMode
  availableViews: Array<{ id: NarrativeVisualizationViewMode; label: string }>
  onViewChange: (view: NarrativeVisualizationViewMode) => void
}

export function VisualizationToolbar({
  activeView,
  availableViews,
  onViewChange,
}: VisualizationToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Narrative visualization modes">
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
    </div>
  )
}
