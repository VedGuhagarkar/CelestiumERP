import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  dot?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'neutral',
  dot = true,
  size = 'md'
}) => {
  const getColors = (): { bg: string; text: string; border: string; dotColor: string } => {
    switch (variant) {
      case 'success':
        return {
          bg: 'var(--color-success-subtle)',
          text: 'var(--color-success)',
          border: 'rgba(16, 185, 129, 0.3)',
          dotColor: 'var(--color-success)'
        };
      case 'warning':
        return {
          bg: 'var(--color-warning-subtle)',
          text: 'var(--color-warning)',
          border: 'rgba(245, 158, 11, 0.3)',
          dotColor: 'var(--color-warning)'
        };
      case 'danger':
        return {
          bg: 'var(--color-danger-subtle)',
          text: 'var(--color-danger)',
          border: 'rgba(239, 68, 68, 0.3)',
          dotColor: 'var(--color-danger)'
        };
      case 'info':
        return {
          bg: 'var(--color-info-subtle)',
          text: 'var(--color-info)',
          border: 'rgba(14, 165, 233, 0.3)',
          dotColor: 'var(--color-info)'
        };
      case 'primary':
        return {
          bg: 'var(--color-primary-subtle)',
          text: 'var(--color-primary)',
          border: 'rgba(249, 115, 22, 0.3)',
          dotColor: 'var(--color-primary)'
        };
      case 'neutral':
      default:
        return {
          bg: 'rgba(156, 163, 175, 0.1)',
          text: 'var(--color-text-secondary)',
          border: 'var(--color-border-subtle)',
          dotColor: 'var(--color-text-muted)'
        };
    }
  };

  const colors = getColors();

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: size === 'sm' ? '2px 8px' : '4px 10px',
    fontSize: size === 'sm' ? '11px' : '12px',
    fontWeight: 600,
    borderRadius: 'var(--radius-full)',
    backgroundColor: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    userSelect: 'none'
  };

  return (
    <span style={badgeStyle}>
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: colors.dotColor
          }}
        />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  );
};
