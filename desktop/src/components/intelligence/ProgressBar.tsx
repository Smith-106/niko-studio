import React from 'react';

interface ProgressBarProps {
  value: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value }) => {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1 w-full bg-dark-surface-sunken rounded-full">
      <div
        className="h-1 bg-primary-cta rounded-full"
        style={{ width: `${width}%` }}
      />
    </div>
  );
};
