import React from 'react';

export interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'elevated' | 'outlined' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  isInteractive?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  variant = 'glass',
  padding = 'md',
  isInteractive = false,
  className = '',
  style,
  ...props
}) => {
  const paddingMap = {
    none: '0',
    sm: '12px',
    md: '20px',
    lg: '28px'
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'glass':
        return {
          background: 'var(--material-thin)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-md)'
        };
      case 'elevated':
        return {
          background: 'var(--color-bg-subtle)',
          border: '1px solid var(--color-border-regular)',
          boxShadow: 'var(--shadow-lg)'
        };
      case 'outlined':
        return {
          background: 'transparent',
          border: '1px solid var(--color-border-regular)'
        };
      case 'subtle':
        return {
          background: 'var(--material-ultra-thin)',
          border: '1px solid var(--color-border-subtle)'
        };
    }
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-xl)',
    padding: paddingMap[padding],
    transition: isInteractive ? 'all var(--duration-fast) var(--ease-spring)' : undefined,
    cursor: isInteractive ? 'pointer' : undefined,
    ...getVariantStyles(),
    ...style
  };

  return (
    <div
      style={cardStyle}
      className={`app-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
