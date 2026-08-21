import React from 'react';
import { Inbox } from 'lucide-react';
import { AppButton } from '../buttons/AppButton.js';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        background: 'var(--material-ultra-thin)',
        borderRadius: 'var(--radius-2xl)',
        border: '1px dashed var(--color-border-regular)',
        color: 'var(--color-text-secondary)'
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          color: 'var(--color-text-muted)'
        }}
      >
        {icon || <Inbox size={28} />}
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '13px', maxWidth: '380px', color: 'var(--color-text-muted)', marginBottom: actionLabel ? '20px' : '0' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <AppButton variant="tinted" size="sm" onClick={onAction}>
          {actionLabel}
        </AppButton>
      )}
    </div>
  );
};
