import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AppAlertProps {
  type?: AlertType;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const AppAlert: React.FC<AppAlertProps> = ({
  type = 'info',
  title,
  children,
  onClose,
  className = ''
}) => {
  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'var(--color-success-subtle)',
          border: 'rgba(16, 185, 129, 0.3)',
          iconColor: 'var(--color-success)',
          Icon: CheckCircle2
        };
      case 'warning':
        return {
          bg: 'var(--color-warning-subtle)',
          border: 'rgba(245, 158, 11, 0.3)',
          iconColor: 'var(--color-warning)',
          Icon: AlertTriangle
        };
      case 'error':
        return {
          bg: 'var(--color-danger-subtle)',
          border: 'rgba(239, 68, 68, 0.3)',
          iconColor: 'var(--color-danger)',
          Icon: AlertCircle
        };
      case 'info':
      default:
        return {
          bg: 'var(--color-info-subtle)',
          border: 'rgba(14, 165, 233, 0.3)',
          iconColor: 'var(--color-info)',
          Icon: Info
        };
    }
  };

  const { bg, border, iconColor, Icon } = getStyles();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-lg)',
        color: 'var(--color-text-primary)'
      }}
      className={className}
    >
      <Icon size={18} color={iconColor} style={{ marginTop: '2px', flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: '13px' }}>
        {title && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{title}</div>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '2px'
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
