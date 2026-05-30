import React, { useEffect, useState, useMemo } from 'react';
import { detectPatterns, DetectedPattern } from '../api/analysis';
import { IntelligenceBadge, SectionHeader, ProgressBar } from './intelligence';
import { useI18n } from '../i18n';

interface PanelProps {
  onClose: () => void;
}

export const PatternDashboardPanel: React.FC<PanelProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await detectPatterns();
        if (response.success && response.data) {
          const exampleData: DetectedPattern[] = [
            { id: 'p1', name: 'Recurring Motif', category: 'Symbolism', occurrences: [{ entityId: 'e1', entityName: 'mirror', confidence: 0.9, context: 'Ch3' }, { entityId: 'e2', entityName: 'mirror', confidence: 0.8, context: 'Ch5' }], confidence: 0.85, avgSimilarity: 0.88 },
            { id: 'p2', name: 'Repetitive Phrasing', category: 'Style', occurrences: [{ entityId: 'e3', entityName: 'just then', confidence: 0.95, context: 'Ch1' }, { entityId: 'e4', entityName: 'just then', confidence: 0.92, context: 'Ch2' }], confidence: 0.93, avgSimilarity: 0.95 },
            { id: 'p3', name: 'Character Tic', category: 'Character', occurrences: [{ entityId: 'c1', entityName: 'Alice', confidence: 0.8, context: 'taps her foot' }], confidence: 0.8, avgSimilarity: 0.8 },
          ];
          setPatterns(exampleData);
        } else {
          setError(t.intelligenceError);
        }
      } catch (e) {
        setError(t.intelligenceError);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t.intelligenceError]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(patterns.map(p => p.category)))], [patterns]);

  const filteredPatterns = useMemo(() => {
    if (categoryFilter === 'all') return patterns;
    return patterns.filter(p => p.category === categoryFilter);
  }, [patterns, categoryFilter]);

  const groupedPatterns = useMemo(() => {
    return filteredPatterns.reduce((acc, pattern) => {
      if (!acc[pattern.category]) {
        acc[pattern.category] = [];
      }
      acc[pattern.category].push(pattern);
      return acc;
    }, {} as Record<string, DetectedPattern[]>);
  }, [filteredPatterns]);

  return (
    <div
      className="w-[400px] h-full bg-white dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text flex flex-col"
      role="region"
      aria-label={t.patternTitle}
    >
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="intelligence-panel-title">{t.patternTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label={t.intelligenceClose}>&times;</button>
        </div>
      </div>

      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {categories.map(category => (
            <button key={category} onClick={() => setCategoryFilter(category)}>
              <IntelligenceBadge variant={categoryFilter === category ? 'success' : 'warning'}>
                {category === 'all' ? t.intelligenceAll : category}
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
        {!loading && !error && Object.entries(groupedPatterns).map(([category, patterns]) => (
          <div key={category} className="mb-6">
            <SectionHeader title={category} />
            <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {patterns.map(pattern => (
                <div key={pattern.id} className="intelligence-card">
                  <p className="font-semibold text-sm mb-2">{pattern.name}</p>
                  <div className="text-xs text-dark-text-muted mb-2">{t.patternOccurrences}: {pattern.occurrences.length}</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {pattern.occurrences.map((occ, i) => <IntelligenceBadge key={i} variant="success">{occ.context}</IntelligenceBadge>)}
                  </div>
                  <ProgressBar value={pattern.confidence * 100} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
