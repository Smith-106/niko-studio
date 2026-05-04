import React from 'react';

interface MetricValueProps {
  value: string | number;
  label: string;
}

export const MetricValue: React.FC<MetricValueProps> = ({ value, label }) => {
  return (
    <div>
      <div className="text-2xl font-bold text-dark-text">{value}</div>
      <div className="text-xs text-dark-text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
};
