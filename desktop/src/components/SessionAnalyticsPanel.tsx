import React, { useEffect, useState } from 'react';
import { SessionCluster } from '../api/analysis';
import { MetricValue, SectionHeader, IntelligenceBadge } from './intelligence';
import { useI18n } from '../i18n';

interface PanelProps {
  onClose: () => void;
}

export const SessionAnalyticsPanel: React.FC<PanelProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [clusters, setClusters] = useState<SessionCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const exampleData: SessionCluster[] = [
          { id: 'c1', name: 'Theme Group A', description: 'Sessions about redemption', intent: 'redemption', status: 'active', createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-02T14:00:00Z', members: [{ clusterId: 'c1', sessionId: 's1', sessionType: 'chapter', relevanceScore: 0.92, addedAt: '2026-01-01T00:00:00Z' }] },
          { id: 'c2', name: 'Character Arc B', description: 'Sessions about betrayal', intent: 'betrayal', status: 'active', createdAt: '2026-05-03T08:00:00Z', updatedAt: '2026-05-03T09:00:00Z', members: [{ clusterId: 'c2', sessionId: 's2', sessionType: 'chapter', relevanceScore: 0.88, addedAt: '2026-01-01T00:00:00Z' }] },
        ];
        setClusters(exampleData);
      } catch (e) {
        setError(t.intelligenceError);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t.intelligenceError]);

  const totalSessions = clusters.reduce((acc, cluster) => acc + cluster.members.length, 0);
  const avgDuration = 35;
  const totalWords = 12500;

  return (
    <div
      className="w-[400px] h-full bg-dark-bg-2 border-l border-dark-border text-white flex flex-col"
      role="region"
      aria-label={t.sessionTitle}
    >
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="intelligence-panel-title">{t.sessionTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label={t.intelligenceClose}>&times;</button>
        </div>
      </div>

      <div className="p-4 flex-shrink-0">
        <SectionHeader title={t.sessionSummary} />
        <div className="grid grid-cols-3 gap-4 text-center">
          <MetricValue value={totalSessions} label={t.sessionTotalSessions} />
          <MetricValue value={`${avgDuration}m`} label={t.sessionAvgDuration} />
          <MetricValue value={totalWords.toLocaleString()} label={t.sessionTotalWords} />
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        style={{ transition: 'opacity 0.2s ease' }}
      >
        <SectionHeader title={t.sessionClusters} />
        {loading && <p>{t.intelligenceLoading}</p>}
        {error && <p className="text-danger-500">{error}</p>}
        {!loading && !error && (
          clusters.length > 0 ? (
            <div className="space-y-2">
              {clusters.map(cluster => (
                <div key={cluster.id} className="intelligence-data-row">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{cluster.name}</p>
                      <p className="text-xs text-dark-text-muted">{cluster.description}</p>
                    </div>
                    <IntelligenceBadge variant={cluster.status === 'active' ? 'success' : 'warning'}>
                      {cluster.status}
                    </IntelligenceBadge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-dark-text-muted">{t.sessionNoData}</p>
          )
        )}
      </div>
    </div>
  );
};
