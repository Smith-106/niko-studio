import React from 'react';

type IntelligenceBadgeVariant = 'success' | 'warning' | 'danger';

interface IntelligenceBadgeProps {
  variant: IntelligenceBadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<IntelligenceBadgeVariant, { bg: string; text: string }> = {
  success: { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' },
  warning: { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706' },
  danger: { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626' },
};

export const IntelligenceBadge: React.FC<IntelligenceBadgeProps> = ({ variant, children }) => {
  const { bg, text } = variantClasses[variant];
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: bg, color: text }}
    >
      {children}
    </span>
  );
};
