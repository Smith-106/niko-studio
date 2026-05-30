import React, { useEffect, useState, useMemo } from 'react';
import { CharacterRelationshipNetwork } from '../api/knowledge';
import { IntelligenceBadge, SectionHeader, ProgressBar } from './intelligence';
import { useI18n } from '../i18n';

interface PanelProps {
  onClose: () => void;
}

export const CharacterRelationshipsPanel: React.FC<PanelProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [network, setNetwork] = useState<CharacterRelationshipNetwork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const exampleData: CharacterRelationshipNetwork = {
          nodes: [
            { id: 'c1', name: 'Alice', role: 'protagonist' },
            { id: 'c2', name: 'Bob', role: 'mentor' },
            { id: 'c3', name: 'Charlie', role: 'antagonist' },
          ],
          edges: [
            { source: 'c1', target: 'c2', type: 'ally', trust: 0.8 },
            { source: 'c1', target: 'c3', type: 'rival', trust: 0.3 },
            { source: 'c2', target: 'c3', type: 'neutral', trust: 0.5 },
          ],
        };
        setNetwork(exampleData);
      } catch (e) {
        setError(t.intelligenceError);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t.intelligenceError]);

  const relationshipTypes = useMemo(() => network ? ['all', ...Array.from(new Set(network.edges.map(e => e.type)))] : ['all'], [network]);

  const filteredEdges = useMemo(() => {
    if (!network) return [];
    if (typeFilter === 'all') return network.edges;
    return network.edges.filter(e => e.type === typeFilter);
  }, [network, typeFilter]);

  const groupedEdges = useMemo(() => {
    return filteredEdges.reduce((acc, edge) => {
      if (!acc[edge.source]) {
        acc[edge.source] = [];
      }
      acc[edge.source].push(edge);
      return acc;
    }, {} as Record<string, typeof filteredEdges>);
  }, [filteredEdges]);

  const getNodeName = (id: string) => network?.nodes.find(n => n.id === id)?.name ?? id;

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'ally': return 'success';
      case 'rival': return 'danger';
      default: return 'warning';
    }
  };

  return (
    <div
      className="w-[400px] h-full bg-white dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text flex flex-col"
      role="region"
      aria-label={t.charRelTitle}
    >
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="intelligence-panel-title">{t.charRelTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label={t.intelligenceClose}>&times;</button>
        </div>
      </div>

      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {relationshipTypes.map(type => (
            <button key={type} onClick={() => setTypeFilter(type)}>
              <IntelligenceBadge variant={typeFilter === type ? 'success' : 'warning'}>
                {type === 'all' ? t.intelligenceAll : type}
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
          network ? (
            Object.entries(groupedEdges).map(([sourceId, edges]) => (
              <div key={sourceId} className="mb-6">
                <SectionHeader title={getNodeName(sourceId)} />
                <div className="space-y-2">
                  {edges.map((edge, index) => (
                    <div key={index} className="intelligence-data-row">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-sm">{getNodeName(edge.target)}</span>
                        <IntelligenceBadge variant={getBadgeVariant(edge.type)}>
                          {edge.type}
                        </IntelligenceBadge>
                      </div>
                      <ProgressBar value={edge.trust * 100} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-dark-text-muted">{t.charRelNoData}</p>
          )
        )}
      </div>
    </div>
  );
};
