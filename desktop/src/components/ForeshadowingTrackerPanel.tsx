import React, { useEffect, useState, useMemo } from 'react';
import { type ForeshadowItem, type ForeshadowStats } from '../api/knowledge';
import { AccordionWrapper, IntelligenceBadge, MetricValue, SectionHeader, ProgressBar } from './intelligence';
import { useI18n } from '../i18n';

interface PanelProps {
  onClose: () => void;
}

export const ForeshadowingTrackerPanel: React.FC<PanelProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [items, setItems] = useState<ForeshadowItem[]>([]);
  const [stats, setStats] = useState<ForeshadowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const exampleItems: ForeshadowItem[] = [
          {
            id: 'f1', description: 'The broken mirror in the hallway', state: 'planted',
            planted_at: '2026-04-20T10:00:00Z', planted_time: 'Chapter 2',
            hints: [], harvested_at: null, harvested_time: null,
            importance: 0.9, tags: ['symbolism', 'alice'], metadata: {},
          },
          {
            id: 'f2', description: 'Bob\'s mysterious past references', state: 'hinted',
            planted_at: '2026-04-18T08:00:00Z', planted_time: 'Chapter 1',
            hints: [
              { id: 'h1', scene_id: 's3', description: 'Bob hesitates when asked about his family', timestamp: '2026-04-22T14:00:00Z' },
              { id: 'h2', scene_id: 's5', description: 'Bob reacts to the photograph', timestamp: '2026-04-24T16:00:00Z' },
            ],
            harvested_at: null, harvested_time: null,
            importance: 0.7, tags: ['character', 'bob'], metadata: {},
          },
          {
            id: 'f3', description: 'The recurring rain motif', state: 'harvested',
            planted_at: '2026-04-15T10:00:00Z', planted_time: 'Chapter 1',
            hints: [
              { id: 'h3', scene_id: 's2', description: 'Rain starts as Alice makes her decision', timestamp: '2026-04-17T12:00:00Z' },
            ],
            harvested_at: '2026-04-28T18:00:00Z', harvested_time: 'Chapter 6',
            importance: 0.85, tags: ['motif', 'weather'], metadata: {},
          },
          {
            id: 'f4', description: 'Charlie\'s hidden agenda', state: 'planted',
            planted_at: '2026-04-21T09:00:00Z', planted_time: 'Chapter 3',
            hints: [], harvested_at: null, harvested_time: null,
            importance: 0.6, tags: ['character', 'charlie'], metadata: {},
          },
        ];
        const exampleStats: ForeshadowStats = {
          total: 4,
          by_state: { planted: 2, hinted: 1, harvested: 1 },
          total_hints: 3,
          avg_hints_per_foreshadow: 0.75,
          harvest_rate: 0.25,
        };
        setItems(exampleItems);
        setStats(exampleStats);
      } catch (e) {
        setError(t.intelligenceError);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t.intelligenceError]);

  const states = useMemo(() => ['all', 'planted', 'hinted', 'harvested'], []);

  const filteredItems = useMemo(() => {
    if (stateFilter === 'all') return items;
    return items.filter(item => item.state === stateFilter);
  }, [items, stateFilter]);

  const getBadgeVariant = (state: string) => {
    switch (state) {
      case 'harvested': return 'success';
      case 'hinted': return 'warning';
      default: return 'danger';
    }
  };

  const accordionItems = filteredItems.map(item => ({
    id: item.id,
    header: (
      <div className="flex justify-between items-center w-full">
        <span className="font-semibold text-sm truncate flex-1 mr-2">{item.description}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <IntelligenceBadge variant={getBadgeVariant(item.state)}>{item.state}</IntelligenceBadge>
          {item.hints.length > 0 && (
            <IntelligenceBadge variant="warning">{item.hints.length} hints</IntelligenceBadge>
          )}
        </div>
      </div>
    ),
    content: (
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-dark-text-muted">
          <span>{t.foreshadowPlanted}: {item.planted_time}</span>
          {item.harvested_time && <span>{t.foreshadowHarvested}: {item.harvested_time}</span>}
        </div>
        <div className="mb-2">
          <span className="text-xs text-dark-text-muted">{t.foreshadowImportance}</span>
          <ProgressBar value={item.importance * 100} />
        </div>
        {item.hints.length > 0 && (
          <div>
            <span className="text-xs text-dark-text-muted">{t.foreshadowHints}</span>
            <div className="space-y-1 mt-1">
              {item.hints.map(hint => (
                <div key={hint.id} className="intelligence-data-row text-xs">{hint.description}</div>
              ))}
            </div>
          </div>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map(tag => (
              <IntelligenceBadge key={tag} variant="warning">{tag}</IntelligenceBadge>
            ))}
          </div>
        )}
      </div>
    ),
  }));

  return (
    <div
      className="w-[400px] h-full bg-white dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text flex flex-col"
      role="region"
      aria-label={t.foreshadowTitle}
    >
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="intelligence-panel-title">{t.foreshadowTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label={t.intelligenceClose}>&times;</button>
        </div>
      </div>

      <div className="p-4 flex-shrink-0">
        <SectionHeader title={t.foreshadowSummary} />
        {stats && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <MetricValue value={stats.total} label={t.foreshadowTotal} />
            <MetricValue value={stats.by_state.planted} label={t.foreshadowPlanted} />
            <MetricValue value={stats.by_state.hinted} label={t.foreshadowHinted} />
            <MetricValue value={stats.by_state.harvested} label={t.foreshadowHarvested} />
          </div>
        )}
      </div>

      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {states.map(s => (
            <button key={s} onClick={() => setStateFilter(s)}>
              <IntelligenceBadge variant={stateFilter === s ? 'success' : 'warning'}>
                {s === 'all' ? t.intelligenceAll : s}
              </IntelligenceBadge>
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        style={{ transition: 'opacity 0.2s ease' }}
      >
        {loading && <p>{t.intelligenceLoading}</p>}
        {error && <p className="text-danger-500">{error}</p>}
        {!loading && !error && (
          filteredItems.length > 0 ? (
            <AccordionWrapper items={accordionItems} mode="multi" />
          ) : (
            <p className="text-center text-dark-text-muted">{t.foreshadowNoData}</p>
          )
        )}
      </div>
    </div>
  );
};
