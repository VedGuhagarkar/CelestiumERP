import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  breadcrumbs
}) => {
  return (
    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {breadcrumbs && <div>{breadcrumbs}</div>}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)'
            }}
          >
            {title}
          </h1>
          {badge}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{actions}</div>}
      </div>
      {subtitle && (
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '700px' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};
