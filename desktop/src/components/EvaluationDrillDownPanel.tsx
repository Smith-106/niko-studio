import React, { useEffect, useState } from 'react';
import { EvaluationResult } from '../api/evaluation';
import { AccordionWrapper, IntelligenceBadge, SectionHeader, ProgressBar } from './intelligence';
import { useI18n } from '../i18n';

interface PanelProps {
  onClose: () => void;
}

export const EvaluationDrillDownPanel: React.FC<PanelProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [evaluationData, setEvaluationData] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const exampleData: EvaluationResult = {
          decision: 'REVISE',
          total_score: 85,
          lock_score: 90,
          style_score: 80,
          logic_score: 75,
          actionable_feedback: 'Some feedback',
          module_scores: {
            character: 90,
            style: 80,
            logic: 75,
            timeline: 95,
            worldview: 85,
          },
          suggestions: [
            { id: 's1', content: 'Consider rephrasing the dialogue in Chapter 3 to be more impactful.' },
            { id: 's2', content: 'The description of the setting in Chapter 5 could be more vivid.' },
          ],
        };
        setEvaluationData(exampleData);
      } catch (e) {
        setError(t.intelligenceError);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t.intelligenceError]);

  const accordionItems = evaluationData && evaluationData.module_scores ? Object.entries(evaluationData.module_scores).map(([key, score]) => ({
    id: key,
    header: (
      <div className="flex justify-between items-center w-full">
        <span className="font-semibold text-sm capitalize">{key}</span>
        <IntelligenceBadge variant={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'}>
          {score}
        </IntelligenceBadge>
      </div>
    ),
    content: (
      <div>
        <p className="text-sm text-dark-text-muted">{t.evalDrillDetailFor} {key}.</p>
      </div>
    ),
  })) : [];

  return (
    <div
      className="w-[400px] h-full bg-dark-bg-2 border-l border-dark-border text-white flex flex-col"
      role="region"
      aria-label={t.evalDrillTitle}
    >
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="intelligence-panel-title">{t.evalDrillTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label={t.intelligenceClose}>&times;</button>
        </div>
      </div>

      <div className="p-4 flex-shrink-0">
        <SectionHeader title={t.evalDrillOverall} />
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <ProgressBar value={evaluationData?.total_score ?? 0} />
          </div>
          <span className="text-2xl font-bold">{evaluationData?.total_score ?? 0}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        style={{ transition: 'opacity 0.2s ease' }}
      >
        <SectionHeader title={t.evalDrillDimensions} />
        {loading && <p>{t.intelligenceLoading}</p>}
        {error && <p className="text-danger-500">{error}</p>}
        {!loading && !error && (
          evaluationData ? (
            <AccordionWrapper items={accordionItems} mode="single" />
          ) : (
            <p className="text-center text-dark-text-muted">{t.evalDrillNoData}</p>
          )
        )}
      </div>
    </div>
  );
};
