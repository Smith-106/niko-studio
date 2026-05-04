import React from 'react';

interface SectionHeaderProps {
  title: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title }) => {
  return (
    <div className="pb-1.5 mb-2 border-b border-dark-border">
      <h3 className="text-xs font-bold uppercase tracking-wider text-dark-text-muted">{title}</h3>
    </div>
  );
};
