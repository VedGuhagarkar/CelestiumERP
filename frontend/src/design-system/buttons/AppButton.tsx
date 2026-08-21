import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tinted' | 'pill';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const AppButton: React.FC<AppButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: '12px', borderRadius: 'var(--radius-md)' },
    md: { padding: '10px 18px', fontSize: '14px', borderRadius: 'var(--radius-lg)' },
    lg: { padding: '14px 24px', fontSize: '15px', borderRadius: 'var(--radius-xl)' }
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--color-primary)',
          color: '#ffffff',
          border: 'none',
          boxShadow: 'var(--shadow-glow)'
        };
      case 'secondary':
        return {
          background: 'var(--material-thin)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-regular)',
          backdropFilter: 'var(--glass-blur)'
        };
      case 'tinted':
        return {
          background: 'var(--color-primary-subtle)',
          color: 'var(--color-primary)',
          border: '1px solid rgba(249, 115, 22, 0.3)'
        };
      case 'danger':
        return {
          background: 'var(--color-danger)',
          color: '#ffffff',
          border: 'none'
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          border: 'none'
        };
      case 'pill':
        return {
          background: 'var(--material-thin)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-full)'
        };
    }
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 600,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'all var(--duration-fast) var(--ease-spring)',
    outline: 'none',
    userSelect: 'none',
    ...sizeStyles[size],
    ...getVariantStyles()
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={baseStyle}
      className={className}
      {...props}
    >
      {isLoading && <Loader2 size={16} className="animate-spin" />}
      {!isLoading && leftIcon && <span style={{ display: 'inline-flex' }}>{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span style={{ display: 'inline-flex' }}>{rightIcon}</span>}
    </button>
  );
};
